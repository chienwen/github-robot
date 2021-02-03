const { GitHubOperator } = require('./lib/github');
const OWNER = 'chienwen';
const REPO = "blahblah";

const operator = new GitHubOperator(OWNER, REPO);

operator.createOrUpdate('pizza/hut.c', "#include<stdio.h>\nint main() { return0; }\n" + Math.random())
    .then((data) => { console.log('ok', data.status) })
    .catch((err) => { console.log('error', err) });

const plurk = require('./lib/plurk');

plurk.callAPI('https://www.plurk.com/APP/Profile/getOwnProfile',
    {"user_id": "chienwen"},
    function(error, data, res) {
        console.log(data);
    }
);
