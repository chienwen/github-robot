/*
 *  https://octokit.github.io/rest.js/v18
 *  https://github.com/octokit/rest.js
 *  https://github.com/octokit/rest.js/issues/1666
 */

const { Octokit } = require("@octokit/rest");
const base64 = require('base-64');

const CHIENWEN_ROBOT_AUTH_TOKEN = process.env.npm_config_CHIENWEN_ROBOT_AUTH_TOKEN;

const octokit = new Octokit({
    auth: CHIENWEN_ROBOT_AUTH_TOKEN
});

var filePath = 'pizza/hut/hey7.py';
var content = "hello world\nnoway3\nkerker";

octokit.repos.getContent({
    owner: "chienwen",
    repo: "blahblah",
    path: filePath,
}).then((olddata) => {
    console.log(olddata);
    octokit.repos.createOrUpdateFileContents({
        owner: 'chienwen',
        repo: 'blahblah',
        path: filePath,
        message: 'updating ' + (new Date).getTime(),
        content: base64.encode(content),
        sha: olddata.data.sha
    }).then((data) => {
        console.log(data);
    }).catch((err) => {
        console.log(err)
    });
}).catch((err) => {
    console.log(err);
    if (err.status === 404) {
        octokit.repos.createOrUpdateFileContents({
            owner: 'chienwen',
            repo: 'blahblah',
            path: filePath,
            message: 'creating ' + (new Date).getTime(),
            content: base64.encode(content),
        }).then((data) => {
            console.log(data);
            console.log('created', data.data.content.sha);
            testsha = data.data.content.sha;
            /*
            octokit.repos.createOrUpdateFileContents({
                owner: 'chienwen',
                repo: 'blahblah',
                path: filePath,
                message: 'updating ' + (new Date).getTime(),
                content: base64.encode('bingo'),
                sha: testsha
            }).then((data) => {
                console.log(data);
            }).catch((err) => {
                console.log(err)
            });
            */
        }).catch((err) => {
            console.log(err)
        });
    }
});

