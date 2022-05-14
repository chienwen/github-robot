const config = require('./lib/config');
const plurkLib = require('./lib/plurk');
const enrichRes = require('./lib/enrichRes');
const githubDiary = require('./lib/githubDiary');
const dashdash = require('dashdash');
const _ = require('lodash');
const logger = require('./lib/logger');

const argOptions = dashdash.parse({options: [
    {
        name: 'fetch-count-limit',
        type: 'positiveInteger',
        help: 'Max number of plurks to fetch. Omit this option to make it unlimited.'
    },
    {
        name: 'fetch-batch-size',
        type: 'positiveInteger',
        help: 'Max number of plurks to fetch per batch. Max seems 30.'
    }
]});

const FETCH_BATCH_SIZE = argOptions.fetch_batch_size || 20;
const FETCH_COUNT_LIMIT = argOptions.fetch_count_limit || Number.MAX_VALUE;

const processPlurkPromises = [];
let fetchedCount = 0;
let resTaskCount = 0;

function extractExtendedResource(url) {
    return new Promise((resolve, reject) => {
        if (token = url.match(/^https:\/\/images\.plurk\.com\/([^\/]+)$/)) {
            resolve({});
        } else {
            logger.info('Will fetch resource', url);
            resTaskCount += 1;
            enrichRes(url).then((res) => {
                resTaskCount -= 1;
                logger.info('Remaining resource to fetch', resTaskCount);
                resolve(res);
            }).catch((err) => {
                resTaskCount -= 1;
                reject({err, url});
            });
        }
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
    processPlurkPromises.push(new Promise((resolve, reject) => {
        const dObj =  new Date(plurk.posted);
        const data = {
            id: 'pl' + plurk.plurk_id,
            by: myPlurkId / 1,
            ts: Math.floor(dObj.getTime() / 1000),
            ct: plurk.content_raw,
            plat: {
                type: plurk.qualifier,
                ams: plurk.anonymous,
                resc: plurk.response_count
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
                logger.warn('Unable to fetch resource', err.url, err.err, 'when backup', plurkLib.getPlurkUrlFromId(plurk.plurk_id));
                resolve(data); // skip broken resource
                //reject(err);
            });
        }
        else {
            resolve(data);
        }
    }));
}

function backupPlurk(dateTimeFrom, user, resolve) {
    logger.info('backup start at', dateTimeFrom, user);
    plurkLib.callAPI('/APP/Timeline/getPlurks', user,
        {
            limit: FETCH_BATCH_SIZE,
            filter: 'my',
            offset: dateTimeFrom.toISOString()
        },
        function(data) {
            const plurks = data.plurks;
            logger.info('new fetched', plurks.length, ', already fetched', fetchedCount, '/', FETCH_COUNT_LIMIT);
            if (plurks.length > 0) {
                fetchedCount += plurks.length;
                plurks.filter((plurk) => {
                    if (user.isValidOnly) {
                        return user.isValidOnly(plurk);
                    } else {
                        return true;
                    }
                }).forEach((plurk) => {
                    processPlurk(plurk, user.id);
                });
                if (fetchedCount < FETCH_COUNT_LIMIT) {
                    const nextDateTime = new Date(plurks[plurks.length - 1].posted);
                    backupPlurk(nextDateTime, user, resolve);
                }
                else {
                    resolve();
                }
            } else {
                resolve();
            }
        }
    );
}

const collectByAccountPromises = [];

// main account
collectByAccountPromises.push(new Promise((resolve) => {
    backupPlurk(new Date(), {
            id: config('PLURK_SMULLERS_USER_ID'),
            token: config('PLURK_SMULLERS_OAUTH_ACCESS_TOKEN'),
            secret: config('PLURK_SMULLERS_OAUTH_ACCESS_TOKEN_SECRET'),
        }, resolve);
}));

// accounts only track anonymous plurks
['SCHIPHOL', 'HOTELDELLUNA'].forEach((account) => {
    collectByAccountPromises.push(new Promise((resolve) => {
        backupPlurk(new Date(), {
                id: config('PLURK_' + account + '_USER_ID'),
                token: config('PLURK_' + account + '_OAUTH_ACCESS_TOKEN'),
                secret: config('PLURK_' + account + '_OAUTH_ACCESS_TOKEN_SECRET'),
                isValidOnly: function (plurk) {
                    return plurk.anonymous;
                },
            }, resolve);
    }));
});

Promise.all(collectByAccountPromises).then(() => {
        
    // Debugging, don't push
    //Promise.all(processPlurkPromises).then((items) => { console.log(require('util').inspect(items, {showHidden: false, depth: null}))}); return;

    Promise.all(processPlurkPromises).then(githubDiary.publishDiaryItems).then(() => {
        logger.info('All done.');
    });
});
