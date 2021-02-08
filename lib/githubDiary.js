const { GitHubOperator } = require('./github');
const GITHUB_OWNER = 'chienwen';
const GITHUB_REPO = "blahblah";
const github = new GitHubOperator(GITHUB_OWNER, GITHUB_REPO);
const _ = require('lodash');

//github.createOrUpdate('pizza/hut.c', "#include<stdio.h>\nint main() { return0; }\n" + Math.random())
//    .then((data) => { console.error('ok', data.status) })
//    .catch((err) => { console.error('error', err) });

module.exports = {
    publishDiary: (fileName, dataDict) => {
        return new Promise((resolve, reject) => {
            const diaryFilePath = 'diary/' + fileName;
            github.read(diaryFilePath).then((existingData) => {
                const existingDataDict = {};
                let sha = undefined;
                if (existingData) {
                    JSON.parse(existingData.content).forEach((diary) => {
                        existingDataDict[diary.id] = diary;
                    });
                    sha = existingData.sha;
                }
                _.assign(existingDataDict, dataDict);
                const newData = [];
                Object.keys(existingDataDict).forEach((diaryId) => {
                    newData.push(existingDataDict[diaryId]);
                });
                newData.sort((a, b) => {
                    return a.ts - b.ts;
                });
                github.write(diaryFilePath, sha, JSON.stringify(newData, null, 4)).then(resolve).catch(reject);
            }).catch(reject);
        });
    }
};

