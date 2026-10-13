const config = require('./lib/config');
const plurkLib = require('./lib/plurk');
const enrichRes = require('./lib/enrichRes');
const githubDiary = require('./lib/githubDiary');
const dashdash = require('dashdash');
const _ = require('lodash');
const logger = require('./lib/logger');

// Safety nets: log instead of dying silently, and survive a stray stack overflow
// from a third-party parser. Anything else is a real bug: exit non-zero for cron.
process.on('unhandledRejection', (err) => {
    logger.warn('unhandledRejection', err && err.stack || err);
});
process.on('uncaughtException', (err) => {
    logger.warn('uncaughtException', err && err.stack || err);
    if (!(err instanceof RangeError)) {
        process.exit(1);
    }
});

const argOptions = dashdash.parse({options: [
    {
        name: 'fetch-count-limit',
        type: 'positiveInteger',
        help: 'Max number of plurks to fetch. Omit this option to make it unlimited.'
    },
    {
        name: 'fetch-date-limit',
        type: 'string',
        help: 'Fetch plurks until YYYY-MM-DD. Omit this option to make it unlimited.'
    },
    {
        name: 'fetch-batch-size',
        type: 'positiveInteger',
        help: 'Max number of plurks to fetch per batch. Max seems 30.'
    }
]});

const FETCH_BATCH_SIZE = argOptions.fetch_batch_size || 20;
const FETCH_COUNT_LIMIT = argOptions.fetch_count_limit || 99999999;
const FETCH_DATE_LIMIT = argOptions.fetch_date_limit ? new Date(argOptions.fetch_date_limit) : null;

const RES_MAX_CONCURRENT = 10;      // max simultaneous link fetches
const RES_HARD_TIMEOUT_MS = 60000;  // a link can never block the whole backup longer than this

const processPlurkPromises = [];
let fetchedCount = 0;
let resTaskCount = 0;
let resActive = 0;
const resQueue = [];

function runLimited(task) {
    return new Promise((resolve) => {
        const run = () => {
            resActive += 1;
            task().then(resolve, () => resolve({})).then(() => {
                resActive -= 1;
                const next = resQueue.shift();
                if (next) {
                    next();
                }
            });
        };
        if (resActive < RES_MAX_CONCURRENT) {
            run();
        } else {
            resQueue.push(run);
        }
    });
}

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('timeout: ' + label)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Never rejects: a broken link must not break the backup.
function extractExtendedResource(url) {
    if (/^https:\/\/images\.plurk\.com\/([^\/]+)$/.test(url)) {
        return Promise.resolve({});
    }
    logger.info('Will fetch resource', url);
    resTaskCount += 1;
    return runLimited(() => {
        logger.info('Fetching resource', url);
        return withTimeout(enrichRes(url), RES_HARD_TIMEOUT_MS, url);
    }).then((res) => {
        resTaskCount -= 1;
        (resTaskCount % 20 === 0) && logger.info('Remaining resource to fetch', resTaskCount);
        return res || {};
    }, (err) => {
        resTaskCount -= 1;
        logger.info('extractExtendedResource failed', url, err && err.message);
        return {};
    });
}

function getRandomInfo(content) {
    const texts = content.match(/class="emoticon" alt="\([a-z]+\)" rndnum="\d+"/g);
    if (texts) {
        const results = [];
        texts.forEach((text) => {
            const matches = text.match(/class="emoticon" alt="\(([a-z]+)\)" rndnum="(\d+)"/);
            if (matches) {
                results.push({alt: matches[1], num: matches[2] / 1});
            }
        });
        return results;
    } else {
        return false;
    }
}

function processPlurk(plurk, myPlurkId) {
    processPlurkPromises.push(new Promise((resolve) => {
        const dObj = new Date(plurk.posted);
        const data = {
            id: 'pl' + plurk.plurk_id,
            by: myPlurkId / 1,
            ts: Math.floor(dObj.getTime() / 1000),
            ct: plurk.content_raw,
            plat: {
                type: plurk.qualifier,
                ams: plurk.anonymous,
                resc: plurk.response_count,
                rp: plurk.replurked ? true : undefined,
            }
        };
        const randomInfo = getRandomInfo(plurk.content);
        if (randomInfo) {
            data.rand = randomInfo;
        }
        if (plurk.poll) {
            data.plat.poll = plurk.poll;
        }
        if (plurk.limited_to && plurkLib.isLimitedToMeOnly(plurk.limited_to, myPlurkId)) {
            data.plat.priv = true;
        }
        const m = data.ct.replace(/\n/g, ' ').trim().match(/^(.*)(https?:\/\/[^ ]+)$/);
        if (m) {
            data.ct = m[1].trim();
            data.plat.ctr = plurk.content_raw;
            data.res = {
                url: m[2].trim()
            };
            extractExtendedResource(data.res.url).then((edata) => {
                _.assign(data.res, edata);
                resolve(data);
            }).catch((err) => {
                logger.warn('Unable to fetch resource', data.res.url, err, 'when backup', plurkLib.getPlurkUrlFromId(plurk.plurk_id));
                resolve(data); // skip broken resource
            });
        }
        else {
            resolve(data);
        }
    }));
}

function backupPlurk(dateTimeFrom, user, resolve, target) {
    // Don't log the whole user object: it contains the OAuth token and secret.
    logger.info('backup start at', dateTimeFrom, 'user', user.id, target);
    const request = {
        limit: FETCH_BATCH_SIZE,
        filter: target,
        offset: dateTimeFrom.toISOString(),
    };
    plurkLib.callAPI('/APP/Timeline/getPlurks', user,
        request,
        function(data) {
            if (data.error) {
                logger.warn('Plurk API Error', request, data.error);
                process.exit(1);
                return;
            }
            const plurks = data.plurks;
            if (plurks.length > 0) {
                const nextDateTime = new Date(plurks[plurks.length - 1].posted);
                if (FETCH_DATE_LIMIT) {
                    logger.info('new fetched', plurks.length, ', already fetched', nextDateTime, '/', FETCH_DATE_LIMIT, request);
                } else {
                    logger.info('new fetched', plurks.length, ', already fetched', fetchedCount, '/', FETCH_COUNT_LIMIT, request);
                }
                fetchedCount += plurks.length;
                plurks.filter((plurk) => {
                    // use owner_id not user_id or plurk may return other people's plurks
                    if (plurk.owner_id == user.id
                            || plurk.replurked
                            || (plurk.anonymous && plurk.user_id == user.id)
                            ) {
                        if (user.isValidOnly) {
                            return user.isValidOnly(plurk);
                        } else {
                            return true;
                        }
                    } else {
                        return false;
                    }
                }).forEach((plurk) => {
                    processPlurk(plurk, user.id);
                });
                if (FETCH_DATE_LIMIT) {
                    if (FETCH_DATE_LIMIT.getTime() < nextDateTime.getTime()) {
                        backupPlurk(nextDateTime, user, resolve, target);
                    }
                    else {
                        resolve();
                    }
                } else {
                    if (fetchedCount < FETCH_COUNT_LIMIT) {
                        backupPlurk(nextDateTime, user, resolve, target);
                    }
                    else {
                        resolve();
                    }
                }
            } else {
                resolve();
            }
        }
    );
}

function userFor(account, extra) {
    return _.assign({
        id: config('PLURK_' + account + '_USER_ID'),
        token: config('PLURK_' + account + '_OAUTH_ACCESS_TOKEN'),
        secret: config('PLURK_' + account + '_OAUTH_ACCESS_TOKEN_SECRET'),
    }, extra);
}

const collectByAccountPromises = [];

// accounts full backup
['SMULLERS', 'BLOODRAYNE', 'VIOOL'].forEach((account) => {
    ['my', 'replurked'].forEach((target) => {
        collectByAccountPromises.push(new Promise((resolve) => {
            backupPlurk(new Date(), userFor(account), resolve, target);
        }));
    });
});

// accounts only track anonymous plurks
//['SCHIPHOL', 'MEEDCHEN_IG', 'HORMUZ'].forEach((account) => {
//['SCHIPHOL', 'MEEDCHEN_IG', 'HORMUZ'].forEach((account) => {
//['SCHIPHOL', 'MEEDCHEN_IG'].forEach((account) => {
['SCHIPHOL', 'MEEDCHEN_IG', 'SERCK', 'PEGGY146'].forEach((account) => {
    ['my', 'replurked'].forEach((target) => {
        collectByAccountPromises.push(new Promise((resolve) => {
            backupPlurk(new Date(), userFor(account, {
                isValidOnly: function (plurk) {
                    return plurk.anonymous;
                },
            }), resolve, target);
        }));
    });
});

Promise.all(collectByAccountPromises).then(() => {

    // Debugging, don't push
    //return Promise.all(processPlurkPromises).then((items) => {
    //    console.log('final output', require('util').inspect(items, {showHidden: false, depth: null, maxArrayLength: null}))
    //});

    return Promise.all(processPlurkPromises)
        .then(githubDiary.publishDiaryItems)
        .then(() => {
            logger.info('All done.');
        });
}).catch((err) => {
    logger.warn('Backup failed', err && err.stack || err);
    process.exit(1);
});
