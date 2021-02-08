const plurk = require('./lib/plurk');
const enrichRes = require('./lib/enrichRes');
const githubManager = require('./lib/githubManager');
const dashdash = require('dashdash');
const _ = require('lodash');
const imageToBase64 = require('image-to-base64');

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
const plurkImages = {};
let fetchedCount = 0;

const util = {
    getYearMonth: (dObj) => {
        return [dObj.getUTCFullYear().toString().substr(2), _.padStart(dObj.getUTCMonth() + 1, 2, '0')];
    }
};

function extractExtendedResource(url, dObj) {
    return new Promise((resolve, reject) => {
        if (token = url.match(/^https:\/\/images\.plurk\.com\/([^\/]+)$/)) {
            const res = {
                cache: {
                    type: 'pl',
                    name: token[1]
                }
            };
            imageToBase64(url).then((data) => {
                plurkImages[util.getYearMonth(dObj).join('/') + '/' + res.cache.name] = data;
                resolve(res);
            }).catch(reject);
        } else {
            enrichRes(url).then(resolve).catch(reject);
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
        const m = data.ct.replace(/\n/g, ' ').trim().match(/^(.*)(https?:\/\/[^ ]+)$/);
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
        ~async function() {
            const listOfFileNames = Object.keys(monthlyData);
            for (let i = 0; i < listOfFileNames.length; i++) {
                let fileName = listOfFileNames[i];
                await githubManager.publishDiary(fileName, monthlyData[fileName]);
            }
            const listOfPlurkImages = Object.keys(plurkImages);
            for (let i = 0; i < listOfPlurkImages.length; i++) {
                let fileName = listOfPlurkImages[i];
                await githubManager.publishPlurkImage(fileName, plurkImages[fileName]);
            }
            console.log('all done');
        }();
    });
}

backupPlurk(new Date());

