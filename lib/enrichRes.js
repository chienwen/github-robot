const urlMetadata = require('url-metadata');
const encodeUrl = require('encodeurl');
const META_USER_AGENT_STRING = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36';
const META_DESC_LENGTH_MAX = 1000;

module.exports = function (url) {
    return new Promise((resolve, reject) => {
        urlMetadata(encodeUrl(url), {
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
        }).catch(reject);
    });
};
