/*
const { GitHubOperator } = require('./lib/github');
const GITHUB_OWNER = 'chienwen';
const GITHUB_REPO = "blahblah";
const github = new GitHubOperator(GITHUB_OWNER, GITHUB_REPO);

var sha = '3c840b722385abe67a2cfadac6a8eaab8429a45c';

github.write('good.js', sha, "hello world 4").then((data) => {
    console.log('ok', data.data);
}).catch((err) => {
    console.log('error', err);
});
*/

//const logger = require('./lib/logger');
//logger.info('hihi', 5566);

/*
const META_USER_AGENT_STRING = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36';
const META_DESC_LENGTH_MAX = 1000;
const urlMetadata = require('url-metadata');
const encodeUrl = require('encodeurl');

const url = 'https://marketing.adecco.com.tw/edm/201901/2019SalaryGuide/AdeccoSalaryGuideTW.pdf';
//const url = 'https://wiwi.video/';

urlMetadata(encodeUrl(url), {
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
    const res = {};
    Object.keys(newRes).forEach((k) => {
        if (newRes[k]) {
            res[k] = newRes[k];
        }
    });
    console.log('OK');
}).catch((err) => {
    console.log(err);
});
*/


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

if (process.argv.length !== 5) {
    logger.info('Usage:', process.argv[0], process.argv[1], 'fb_backup_file_your_posts_and_comments_in_groups.json', 'slice_from_inclusive', 'slice_to_exclusive');
    return;
}

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
            ct: _.get(a, 'data.0.post', null)
        };
        if (diary.ct) {
            diary.ct = utf8.decode(diary.ct);
        }
        const url = _.get(a, 'attachments.0.data.0.external_context.url');
        if (url) {
            diary.res = {url: encodeUrl(utf8.decode(url))};
        }
        return diary;
    });

    const dict = {};
    pChienwenActivities.forEach((item) => {
        if (dict[item.id]) {
            console.log('dup id', item, dict[item.id]);
        }
        dict[item.id] = item;
    });
    console.log(pChienwenActivities.length);
    console.log(Object.keys(dict).length);
});
