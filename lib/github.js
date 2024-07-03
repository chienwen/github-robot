// Github API
// https://octokit.github.io/rest.js/v18
// https://github.com/octokit/rest.js

const { Octokit } = require("@octokit/rest");
const base64 = require('base-64');
const _ = require('lodash');
const os = require('os');
const config = require('./config');
const GITHUB_OWNER = config('GITHUB_OWNER');
const GITHUB_REPO = config('GITHUB_REPO');
const GITHUB_AUTH_TOKEN = config('GITHUB_AUTH_TOKEN');
const COMMIT_MESSAGE_INFO = [
    process.env.npm_package_name + '-' + process.env.npm_package_version,
    os.userInfo().username,
    os.hostname(),
    os.platform() + '-' + os.release()
];

function GitHubOperator(owner, repo) {
    this.owner = owner || GITHUB_OWNER;
    this.repo = repo || GITHUB_REPO;
    this.octokit = new Octokit({
        auth: GITHUB_AUTH_TOKEN
    });
}

GitHubOperator.prototype.read = function(filePath) {
    const op = this;
    return new Promise((resolve, reject) => {
        op.octokit.repos.getContent({
            owner: op.owner,
            repo: op.repo,
            path: filePath,
        }).then((existingFile) => {
            resolve({
                content: Buffer.from(existingFile.data.content, 'base64').toString(),
                sha: existingFile.data.sha
            });
        }).catch((err) => {
            if (err.status == 404) { // warn: err.status can be a string or number, don't use ===
                resolve(null);
            } else {
                reject(err);
            }
        });
    });
};

GitHubOperator.prototype.write = function(filePath, sha, content, isContentBase64) {
    const op = this;
    return new Promise((resolve, reject) => {
        const timeNow = new Date();
        op.octokit.repos.createOrUpdateFileContents({
            owner: op.owner,
            repo: op.repo,
            path: filePath,
            message: 'Auto commit ' + timeNow.getTime() + "\n" + COMMIT_MESSAGE_INFO.join("\n") + "\n" + timeNow.toString(),
            content: isContentBase64 ? content : Buffer.from(content).toString('base64'),
            sha: sha ? sha : undefined
        }).then(resolve).catch(reject);
    });
};

GitHubOperator.prototype.writeAnyway = function(filePath, content, isContentBase64) {
    const op = this;
    return new Promise((resolve, reject) => {
        const writeAnyway = (sha) => {
            op.write(filePath, sha, content, isContentBase64).then(resolve).catch(reject);
        };
        op.read(filePath).then((existingData) => {
            if (existingData) {
                writeAnyway(existingData.sha);
            } else {
                writeAnyway();
            }
        }).catch(reject);
    });
};

GitHubOperator.prototype.writeBase64Anyway = function(filePath, contentBase64) {
    return this.writeAnyway(filePath, contentBase64, true);
};

module.exports = {
    GitHubOperator
}
