const urlMetadata = require('url-metadata');
const logger = require('./logger');
const META_USER_AGENT_STRING = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36';
const META_DESC_LENGTH_MAX = 1000;
const MAX_RETRY = 3;
const RETRY_MS = 1000;
        
function execute(url, resolve, reject, tried) {
    function shouldTryAgain(err) {
        logger.info('should try again?', url, err, tried);
        if (tried < MAX_RETRY && err.type === 'NOT_200') {
            const retryStatusCode = {
                502: true, // Bad Gateway
                503: true, // Service Unavailable
                504: true, // Gateway Timeout
                509: true, // Bandwidth Limit Exceeded
                529: true, // Site is overloaded
                598: true, // Network read timeout error
                520: true, // Cloudflare, Web Server Returned an Unknown Error
                521: true, // Cloudflare, Web Server Is Down
                522: true, // Cloudflare, Connection Timed Out
                523: true, // Cloudflare, Origin Is Unreachable
                524: true, // Cloudflare, A Timeout Occurred
                527: true, // Cloudflare, Railgun Error
            };
            return !!retryStatusCode[err.detail];
        } else {
            return false;
        }
    }
    urlMetadata(url, {
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
        resolve(res);
    }).catch(err => {
        if (shouldTryAgain(err)) {
            logger.info('Will retry', tried, url, err);
            setTimeout(() => {
                execute(url, resolve, reject, tried + 1);
            }, RETRY_MS);
        } else {
            logger.info('Give up');
            reject(err);
        }
    });
}

module.exports = function (url) {
    return new Promise((resolve, reject) => {
        execute(url, resolve, reject, 0);
    });
};
