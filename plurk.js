const { GitHubOperator } = require('./lib/github');
const plurk = require('./lib/plurk');
const dashdash = require('dashdash');
const _ = require('lodash');
const urlMetadata = require('url-metadata');
const imageToBase64 = require('image-to-base64');

const argOptions = dashdash.parse({options: [
    {
        name: 'fetch-count-limit',
        type: 'positiveInteger',
        help: 'Max number of plurks to fetch. Omit this option to make it unlimited.'
    }
]});

const GITHUB_OWNER = 'chienwen';
const GITHUB_REPO = "blahblah";
const FETCH_BATCH_SIZE = 100;
const FETCH_COUNT_LIMIT = argOptions.fetch_count_limit || Number.MAX_VALUE;
const META_USER_AGENT_STRING = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36';
const META_DESC_LENGTH_MAX = 1000;

const github = new GitHubOperator(GITHUB_OWNER, GITHUB_REPO);

const processPlurkPromises = [];
const plurkImages = {};
let fetchedCount = 0;

const util = {
    getYearMonth: (dObj) => {
        return [dObj.getUTCFullYear().toString().substr(2), _.padStart(dObj.getUTCMonth() + 1, 2, '0')];
    }
};

//github.createOrUpdate('pizza/hut.c', "#include<stdio.h>\nint main() { return0; }\n" + Math.random())
//    .then((data) => { console.error('ok', data.status) })
//    .catch((err) => { console.error('error', err) });

function extractExtendedResource(url, dObj) {
    return new Promise((resolve, reject) => {
        const res = {};
        if (token = url.match(/^https:\/\/images\.plurk\.com\/([^\/]+)$/)) {
            res.cache = {
                type: 'pl',
                name: token[1]
            };
            imageToBase64(url).then((data) => {
                plurkImages[util.getYearMonth(dObj).join('/') + '/' + res.cache.name] = data;
                resolve(res);
            }).catch(reject);
        } else {
            urlMetadata(url, {
                userAgent: META_USER_AGENT_STRING,
                descriptionLength: META_DESC_LENGTH_MAX,
                customHeaders: {
                    'cookie': 'over18=1'
                }
            }).then((metadata) => {
                const newRes = {
                    title: metadata.title || metadata['og:title'],
                    desc: metadata.description || metadata['og:description'],
                    iurl: metadata.image || metadata['og:image'],
                };
                Object.keys(newRes).forEach((k) => {
                    if (newRes[k]) {
                        res[k] = newRes[k];
                    }
                });
                resolve(res);
            }, reject)
        }
    });
}

function processPlurk(plurk) {
    processPlurkPromises.push(new Promise((resolve, reject) => {
        const dObj =  new Date(plurk.posted);
        const data = {
            id: 'pl' + plurk.plurk_id,
            ts: Math.floor(dObj.getTime() / 1000),
            ct: plurk.content_raw,
            plat: {
                type: plurk.qualifier,
                ams: plurk.anonymous,
                resc: plurk.response_count
            }
        };
        const m = data.ct.replace(/\n/g, ' ').match(/^(.*)(https?:\/\/.+)/);
        if (m) {
            data.ct = m[1].trim();
            data.plat.ctr = plurk.content_raw;
            data.res = {
                url: m[2].trim()
            };
            extractExtendedResource(data.res.url, dObj).then((edata) => {
                _.assign(data.res, edata);
                resolve(data);
            }).catch(reject);
        }
        else {
            resolve(data);
        }
    }));
}

function backupPlurk(dateTimeFrom) {
    console.error('backup start at', dateTimeFrom);
    plurk.callAPI('/APP/Timeline/getPlurks',
        {
            limit: FETCH_BATCH_SIZE,
            filter: 'my',
            offset: dateTimeFrom.toISOString()
        },
        function(data) {
            const plurks = data.plurks;
            console.error('new fetched', plurks.length, ', already fetched', fetchedCount, '/', FETCH_COUNT_LIMIT);
            if (plurks.length > 0) {
                fetchedCount += plurks.length;
                plurks.forEach(processPlurk);
                if (fetchedCount < FETCH_COUNT_LIMIT) {
                    const nextDateTime = new Date(plurks[plurks.length - 1].posted);
                    backupPlurk(nextDateTime);
                }
                else {
                    backupPlurkDone(true);
                }
            } else {
                backupPlurkDone(false);
            }
        }
    );
}

function backupPlurkDone(isEndByCountLimit) {
    console.error('Fetching done', isEndByCountLimit);
    Promise.all(processPlurkPromises).then((plurks) => {
        const monthlyData = {};
        plurks.forEach((plurk) => {
            const dObj = new Date(plurk.ts * 1000);
            const fileName = util.getYearMonth(dObj).join('') + '.json';
            if (!monthlyData[fileName]) {
                monthlyData[fileName] = {};
            }
            monthlyData[fileName][plurk.id] = plurk;
        });
        console.log(monthlyData);
        console.log(plurkImages);
    });
}

backupPlurk(new Date());

