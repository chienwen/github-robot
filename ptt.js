const fetch = require('node-fetch');
const HTMLParser = require('node-html-parser');
const _ = require('lodash');
const logger = require('./lib/logger');
const META_USER_AGENT_STRING = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36';
const PTT_REQUEST_HEADER = {
    'cookie': 'over18=1',
    'User-Agent': META_USER_AGENT_STRING,
};
const PTT_QUERY_PAUSE_MS = 1000;

const config = require('./lib/config');
const PTT_USERS = config('PTT_USERS_COMMA_SEP').split(',');
const PTT_BOARDS = config('PTT_BOARDS_COMMA_SEP').split(',');
const { GitHubOperator } = require('./lib/github');
const github = new GitHubOperator();
const PTT_GITHUB_PATH_BASE = 'ptt/';
const PTT_GITHUB_INDEX_JSON_FILE = PTT_GITHUB_PATH_BASE + 'index.json';

function fetchPTTArticleList(board, user) {
    return new Promise((resolve, reject) => {
        const articleList = [];
        function fetchPTTIndexPageExecute(page) {
            return new Promise((resolve, reject) => {
                const url = 'https://www.ptt.cc/bbs/' + board + '/search?page=' + page + '&q=author%3A' + user;
                logger.info('Get list', url);
                fetch(url, { headers: PTT_REQUEST_HEADER })
                .then(res => res.text())
                .then((body) => {
                    const root = HTMLParser.parse(body);
                    const hasNextPage = root.querySelectorAll('#action-bar-container .btn-group-paging a').filter((node) => {
                        return node.innerText.match(/上頁/) && (!node.attributes.class.match(/disabled/));
                    }).length === 1;
                    root.querySelectorAll('.r-ent .title a').forEach((ele) => {
                        articleList.push(ele.getAttribute('href'));
                    });
                    resolve(hasNextPage);
                });
            });
        }
        async function fetchPTTIndexPage() {
            let page = 1;
            while(true) {
                let hasNextPage = await fetchPTTIndexPageExecute(page);
                if (hasNextPage) {
                    page += 1;
                } else {
                    break;
                }
            }
            resolve(articleList);
        }
        fetchPTTIndexPage();
    });
}

//fetchPTTArticleList('Gossiping', 'vimer').then((urlList) => { console.log(urlList) });

const fetchUrlPromises = [];

for (let i = 0 ; i < PTT_BOARDS.length; i++) {
    const board = PTT_BOARDS[i];
    for (let j = 0; j < PTT_USERS.length; j++) {
        const user = PTT_USERS[j];
        fetchUrlPromises.push(fetchPTTArticleList(board, user));
    }
}

const allUrlList = [];

Promise.all(fetchUrlPromises).then((urlLists) => {
    urlLists.forEach((urlList) => {
        urlList.forEach((url) => {
            allUrlList.push(url);
        });
    });
}).then(() => {
    const allIndexes = {};
    function processArticle(url) {
        return new Promise((resolve, reject) => {
            logger.info('Process', url);
            const fullUrl = 'https://www.ptt.cc' + url;
            fetch(fullUrl, { headers: PTT_REQUEST_HEADER })
            .then(res => res.text())
            .then((body) => {
                const lines = body.split("\n");
                if (lines.length < 30) {
                    logger.warn('Fetched invalid content', fullUrl, body);
                    resolve();
                    return;
                }
                const meta = {};
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const regs = line.match(/main-content.*>作者<\/span><span class="article-meta-value">([A-Za-z0-9]+) ([^<>]+)<\/span>/);
                    if (regs) {
                        meta.author = regs[1];
                        break;
                    }
                }
                const root = HTMLParser.parse(body);
                meta.title = root.querySelector('meta[property="og:title"]').attributes.content;
                const regs = url.match(/\/bbs\/([^\/]+)\/((\w\.(\d+).+)\.html)/);
                meta.board = regs[1];
                meta.fname = regs[2];
                meta.ts = regs[4] / 1;
                allIndexes[regs[3]] = meta;

                // push to github
                const filePath = `${PTT_GITHUB_PATH_BASE}${meta.board}/${meta.fname}`;

                github.writeAnyway(filePath, body).then((data) => {
                    logger.info("Pushed", meta);
                    setTimeout(() => {
                        resolve();
                    }, PTT_QUERY_PAUSE_MS);
                });
            }).catch((err) => {
                logger.warn('Unable to fetch', fullUrl, err);
                resolve();
            });
        });
    }
    async function fetchAllArticleContent() {
        for (let i = 0 ; i < allUrlList.length; i++) {
            logger.info('WIP', i, '/', allUrlList.length);
            await processArticle(allUrlList[i]);
        }
        github.read(PTT_GITHUB_INDEX_JSON_FILE).then((data) => {
            let existingIndex = {};
            if (data) {
                existingIndex = JSON.parse(data.content);
            }
            _.assign(existingIndex, allIndexes);
            github.write(PTT_GITHUB_INDEX_JSON_FILE, data ? data.sha : undefined, JSON.stringify(existingIndex, null, 4)).then((res) => {
                logger.info('OK done', res);
            });
        });
    }
    logger.info('Fetched', allUrlList.length);
    fetchAllArticleContent();
});
