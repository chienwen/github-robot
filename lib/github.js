// Github API
// https://octokit.github.io/rest.js/v18
// https://github.com/octokit/rest.js

const { Octokit } = require("@octokit/rest");
const base64 = require('base-64');
const _ = require('lodash');
const os = require('os');
const GITHUB_AUTH_TOKEN = process.env.npm_config_GITHUB_AUTH_TOKEN;
const COMMIT_MESSAGE_INFO = [
    process.env.npm_package_name + '-' + process.env.npm_package_version,
    os.userInfo().username,
    os.hostname(),
    os.platform() + '-' + os.release()
];

function GitHubOperator(owner, repo) {
    this.owner = owner;
    this.repo = repo;
    this.octokit = new Octokit({
        auth: GITHUB_AUTH_TOKEN
    });
}

GitHubOperator.prototype.createOrUpdate = function (filePath, content) {
    const op = this;
    return new Promise((resolve, reject) => {
        const writeFileAnyway = (sha) => {
            const timeNow = new Date();
            op.octokit.repos.createOrUpdateFileContents({
                owner: op.owner,
                repo: op.repo,
                path: filePath,
                message: 'Auto commit ' + timeNow.getTime() + "\n" + COMMIT_MESSAGE_INFO.join("\n") + "\n" + timeNow.toString(),
                content: base64.encode(content),
                sha: sha
            }).then(resolve).catch(reject);
        };
        op.octokit.repos.getContent({
            owner: op.owner,
            repo: op.repo,
            path: filePath,
        }).then((existingFile) => {
            writeFileAnyway(_.get(existingFile, 'data.sha'));
        }).catch((err) => {
            if (err.status === 404) {
                writeFileAnyway();
            } else {
                reject(err);
            }
        });
    });
};

module.exports = {
    GitHubOperator
}
