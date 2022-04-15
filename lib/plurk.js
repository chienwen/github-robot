// Plurk API 
// https://www.plurk.com/API/2/
// https://www.plurk.com/PlurkApp/
// https://github.com/clsung/plurkjs/blob/master/lib/plurk_oauth.js

const oauth = require('oauth');
const config = require('./config');
const PLURK_CONSUMER_KEY = config('PLURK_CONSUMER_KEY');
const PLURK_CONSUMER_SECRET = config('PLURK_CONSUMER_SECRET');

const oa = new oauth.OAuth('https://www.plurk.com/OAuth/request_token',
    'https://www.plurk.com/OAuth/access_token',
    PLURK_CONSUMER_KEY,
    PLURK_CONSUMER_SECRET,
    '1.0',
    null,
    'HMAC-SHA1')

module.exports = {
    callAPI: function(path, auth, params, callback) {
        oa.post('https://www.plurk.com' + path,
            auth.token,
            auth.secret,
            params,
            'application/json',
            function(error, data, res) {
                if (error) {
                    callback(null);
                } else {
                    callback(JSON.parse(data));
                }
            }
        );
    },
    isLimitedToMeOnly: function(limitedTo, myPlurkId) {
        return limitedTo === '|' + myPlurkId + '|' || limitedTo === '|0|';
    },
    getPlurkUrlFromId: function(plurkId) {
        return 'https://www.plurk.com/p/' + Number(plurkId).toString(36);
    },
};

