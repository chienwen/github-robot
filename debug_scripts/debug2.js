var url = 'http://technews.tw/2016/11/29/china-sell-air/?utm_source=pnn&utm_medium=pnn_post&utm_campaign=pnn';

const enrichRes = require('./lib/enrichRes');
                
enrichRes(url).then((res) => {
    console.log(res);
}).catch((err) => {
    reject({err, url});
});
