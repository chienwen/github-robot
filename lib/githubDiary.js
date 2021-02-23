const { GitHubOperator } = require('./github');
const github = new GitHubOperator();
const DIARY_PATH = 'diary';
const _ = require('lodash');
const logger = require('./logger');

const util = {
    getYearMonth: (dObj) => {
        return [dObj.getUTCFullYear().toString().substr(2), _.padStart(dObj.getUTCMonth() + 1, 2, '0')];
    }
};

function isNewDiaryItemBetter(itemExisting, itemNew) {
    if (JSON.stringify(itemExisting) === JSON.stringify(itemNew)) {
        return false;
    }
    if (itemExisting.res && itemNew.res) {
        const titleExsisting = itemExisting.res.title || '';
        const titleNew = itemNew.res.title || '';
        return titleNew.length > titleExsisting.length;
    } else {
        return true;
    }
}
    
function publishDiary(fileName, dataDict) {
    return new Promise((resolve, reject) => {
        const diaryFilePath = [DIARY_PATH.trim('/'), fileName].join('/');
        logger.info('Will commit', diaryFilePath, Object.keys(dataDict).length, 'items');
        github.read(diaryFilePath).then((existingData) => {
            const existingDataDict = {};
            let sha = undefined;
            if (existingData) {
                JSON.parse(existingData.content).forEach((diary) => {
                    existingDataDict[diary.id] = diary;
                });
                sha = existingData.sha;
            }
            let hasAnyChange = false;
            Object.keys(dataDict).forEach((key) => {
                if (existingDataDict[key]) {
                    if (isNewDiaryItemBetter(existingDataDict[key], dataDict[key])) {
                        existingDataDict[key] = dataDict[key];
                        hasAnyChange = true;
                    }
                } else {
                    existingDataDict[key] = dataDict[key];
                    hasAnyChange = true;
                }
            });
            if (hasAnyChange) {
                const newData = [];
                Object.keys(existingDataDict).forEach((diaryId) => {
                    newData.push(existingDataDict[diaryId]);
                });
                newData.sort((a, b) => {
                    return a.ts - b.ts;
                });
                github.write(diaryFilePath, sha, JSON.stringify(newData, null, 4)).then((info) => {
                    logger.info('Written', diaryFilePath, _.get(info, 'data.commit.sha'));
                    resolve();
                }).catch(reject);
            } else {
                logger.info('No change, so skip writing');
                resolve();
            }
        }).catch(reject);
    });
}

module.exports = {
    publishDiaryItems: (items) => {
        return new Promise((resolve, reject) => {
            const monthlyData = {};
            items.forEach((item) => {
                const dObj = new Date(item.ts * 1000);
                const fileName = util.getYearMonth(dObj).join('') + '.json';
                if (!monthlyData[fileName]) {
                    monthlyData[fileName] = {};
                }
                monthlyData[fileName][item.id] = item;
            });
            ~async function() {
                const listOfFileNames = Object.keys(monthlyData);
                for (let i = 0; i < listOfFileNames.length; i++) {
                    let fileName = listOfFileNames[i];
                    await publishDiary(fileName, monthlyData[fileName]);
                }
                resolve();
            }();
        });
    }
};

