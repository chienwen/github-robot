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

