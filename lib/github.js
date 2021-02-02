const { Octokit } = require("@octokit/rest");
const base64 = require('base-64');
const ROBOT_AUTH_TOKEN = process.env.npm_config_CHIENWEN_ROBOT_AUTH_TOKEN;

function GitHubOperator(owner, repo) {
    this.owner = owner;
    this.repo = repo;
    this.octokit = new Octokit({
        auth: ROBOT_AUTH_TOKEN
    });
    this.fileSHACache = {};
}

GitHubOperator.prototype.createOrUpdate = (filePath, content) => {
};

module.exports = {
    GitHubOperator
}
