const { GitHubOperator } = require('./lib/github');
const GITHUB_OWNER = 'chienwen';
const GITHUB_REPO = "blahblah";

const operator = new GitHubOperator(GITHUB_OWNER, GITHUB_REPO);

operator.createOrUpdate('pizza/hut.c', "#include<stdio.h>\nint main() { return0; }\n" + Math.random())
    .then((data) => { console.log('ok', data.status) })
    .catch((err) => { console.log('error', err) });

const plurk = require('./lib/plurk');

plurk.callAPI('/APP/Timeline/getPlurks',
    {
        limit: 1,
        filter: 'my',
        offset: (new Date('Sun, 31 Jan 2021 22:50:48 GMT')).toISOString()
    },
    function(data) {
        console.log(data.plurks);
    }
);
