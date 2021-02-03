const { GitHubOperator } = require('./lib/github');
const plurk = require('./lib/plurk');

const GITHUB_OWNER = 'chienwen';
const GITHUB_REPO = "blahblah";
const FETCH_BATCH_SIZE = 100;
const FETCH_COUNT_LIMIT = Number.MAX_VALUE;

const github = new GitHubOperator(GITHUB_OWNER, GITHUB_REPO);
let fetchedCount = 0;

//github.createOrUpdate('pizza/hut.c', "#include<stdio.h>\nint main() { return0; }\n" + Math.random())
//    .then((data) => { console.log('ok', data.status) })
//    .catch((err) => { console.log('error', err) });

function processPlurk(plurk) {
    const data = {
        content: plurk.content_raw,
        id: plurk.plurk_id,
        ts: (new Date(plurk.posted)).getTime(),
        type: plurk.qualifier,
        anonymous: plurk.anonymous,
        resc: plurk.response_count
    };
    console.log(data);
}

function backupPlurk(dateTimeFrom) {
    console.log('backup started from', dateTimeFrom);
    plurk.callAPI('/APP/Timeline/getPlurks',
        {
            limit: 10,
            filter: 'my',
            offset: dateTimeFrom.toISOString()
        },
        function(data) {
            const plurks = data.plurks;
            console.log('fetched', plurks.length);
            if (plurks.length > 0) {
                fetchedCount += plurks.length;
                plurks.forEach(processPlurk);
                if (fetchedCount < FETCH_COUNT_LIMIT) {
                    const nextDateTime = new Date(plurks[plurks.length - 1].posted);
                    backupPlurk(nextDateTime);
                }
                else {
                    backupPlurkDone(true);
                }
            } else {
                backupPlurkDone(false);
            }
        }
    );
}

function backupPlurkDone(isEndByCountLimit) {
    console.log('DONE', isEndByCountLimit);
}

backupPlurk(new Date());

