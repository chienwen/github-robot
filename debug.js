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

const logger = require('./lib/logger');
logger.info('hihi', 5566);
