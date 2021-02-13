const fs = require('fs');
const utf8 = require('utf8');
const util = require('util');
const _ = require('lodash');
const encodeUrl = require('encodeurl');
const fbBackupFile = process.argv[2];
const sliceFrom = process.argv[3];
const sliceTo = process.argv[4];
const githubDiary = require('./lib/githubDiary');
const enrichRes = require('./lib/enrichRes');
const logger = require('./lib/logger');
const BATCH_SIZE = 20;
const TITLE_MATCH_REGEXP = new RegExp(process.env.npm_config_FACEBOOK_TITLE_MATCH_PATTERN);

if (process.argv.length !== 5) {
    logger.info('Usage:', process.argv[0], process.argv[1], 'fb_backup_file_your_posts_and_comments_in_groups.json', 'slice_from_inclusive', 'slice_to_exclusive');
    return;
}

fs.readFile(fbBackupFile, function (err, data) {
    if (err) {
        throw err; 
    }
    const fbData = JSON.parse(data.toString());

    let activities = fbData.group_posts.activity_log_data.filter((a) => {
        return !!a.title.match(TITLE_MATCH_REGEXP);
    }).map((a) => {
        const diary = {
            id: 'fbpc' + a.timestamp,
            ts: a.timestamp,
            ct: _.get(a, 'data.0.post', null)
        };
        if (diary.ct) {
            diary.ct = utf8.decode(diary.ct);
        }
        const url = _.get(a, 'attachments.0.data.0.external_context.url');
        if (url) {
            diary.res = {url: encodeUrl(utf8.decode(url))};
        }
        //diary.debug = a;
        return diary;
    })

    // de-dup id
    const dict = {};
    activities.forEach((item) => {
        if (dict[item.id]) {
            item.ct = item.ct || dict[item.id].ct;
        }
        dict[item.id] = item;
    });
    activities = [];
    Object.keys(dict).forEach((id) => {
        activities.push(dict[id]);
    });

    // slice batch
    activities = activities.slice(sliceFrom, sliceTo)

    if (activities.length == 0) {
        logger.info('No data in this range.');
        return;
    }
    
    function process(items, reportCb) {
        let resTaskCount = 0;
        function extractExtendedResource(url) {
            return new Promise((resolve, reject) => {
                logger.info('Will fetch resource', url);
                resTaskCount += 1;
                enrichRes(url).then((res) => {
                    resTaskCount -= 1;
                    //logger.info('Remaining resource to fetch', resTaskCount);
                    resolve(res);
                }).catch((err) => {
                    resTaskCount -= 1;
                    reject({err, url});
                });
            });
        }
        let successCount = 0;
        let hasResCount = 0;
        return new Promise((resolve, reject) => {
            const enrichPromises = [];
            items.forEach((item) => {
                if (item.res) {
                    hasResCount += 1
                    enrichPromises.push(new Promise((resolve, reject) => {
                        extractExtendedResource(item.res.url).then((eitem) => {
                            _.assign(item.res, eitem);
                            successCount += 1;
                            resolve(item);
                        }).catch((err) => {
                            logger.warn('Unable to fetch resource', err.url, err.err);
                            resolve(item);
                        });
                    }));
                }
            });
            Promise.all(enrichPromises).then(() => {
                const waitSec = Math.floor(1000 + Math.random() * 2000);
                logger.info('Success', successCount, 'Fail', hasResCount - successCount , 'Pausing', waitSec, 'ms');
                setTimeout(resolve, waitSec);
            });
            reportCb();
        });
    }

    const enrichedItems = [];
    
    ~async function() {
        let batchStart = 0;
        while(true) {
            const items = activities.slice(batchStart, batchStart + BATCH_SIZE);
            if (items.length == 0) {
                break;
            }
            await process(items, () => {
                logger.info('========================================================================');
                logger.info('BATCH [', sliceFrom , sliceTo ,']');
                logger.info('Processing', batchStart, batchStart + BATCH_SIZE, 'total', activities.length, 'finish', batchStart * 100 / activities.length, '%');
                logger.info('========================================================================');
            });
            batchStart += BATCH_SIZE;
        }
        logger.info('Resource are all ready. Total', activities.length);
        githubDiary.publishDiaryItems(activities).then(() => {
            logger.info('All done.');
        });
    }();

});

