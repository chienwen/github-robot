const fs = require('fs');
const utf8 = require('utf8');
const util = require('util');
const _ = require('lodash');
const fbBackupFile = process.argv[2];
const githubDiary = require('./lib/githubDiary');
const enrichRes = require('./lib/enrichRes');
const logger = require('./lib/logger');

fs.readFile(fbBackupFile, function (err, data) {
    if (err) {
        throw err; 
    }
    const fbData = JSON.parse(data.toString());
    const activities = fbData.group_posts.activity_log_data;

    const pChienwenActivities = activities.filter((a) => {
        return !!a.title.match(/P_chienwen/);
    }).map((a) => {
        const diary = {
            id: 'fbpc' + a.timestamp,
            ts: a.timestamp,
            ct: utf8.decode(_.get(a, 'data.0.post', a.title)),
        };
        const url = _.get(a, 'attachments.0.data.0.external_context.url');
        if (url) {
            diary.res = {url: utf8.decode(url)};
        }
        //diary.debug = a;
        return diary;
    });

    //console.log(util.inspect(pChienwenActivities, {showHidden: false, depth: null}));
    //return;
    
    function process(items) {
        let resTaskCount = 0;
        function extractExtendedResource(url) {
            return new Promise((resolve, reject) => {
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
            });
        }
        return new Promise((resolve, reject) => {
            const enrichPromises = [];
            items.forEach((item) => {
                if (item.res) {
                    enrichPromises.push(new Promise((resolve, reject) => {
                        extractExtendedResource(item.res.url).then((eitem) => {
                            _.assign(item.res, eitem);
                            resolve(item);
                        }).catch((err) => {
                            logger.warn('Unable to fetch resource', err.url, err.err);
                            resolve(item);
                        });
                    }));
                }
            });
            Promise.all(enrichPromises).then(() => {
                logger.info('All done.');
                setTimeout(resolve, 1000);
            });
        });
    }

    const BATCH_SIZE = 20;
    const enrichedItems = [];
    
    ~async function() {
        let batchStart = 0;
        while(true) {
            logger.info('===================================================');
            logger.info('Processing', batchStart, batchStart + BATCH_SIZE, 'total', pChienwenActivities.length, 'finish', batchStart * 100 / pChienwenActivities.length, '%');
            const items = pChienwenActivities.slice(batchStart, batchStart + BATCH_SIZE);
            if (items.length == 0) {
                break;
            }
            await process(items);
            batchStart += BATCH_SIZE;
        }
        githubDiary.publishDiaryItems(pChienwenActivities).then(() => {
            logger.info('All done.');
        });
    }();

});

