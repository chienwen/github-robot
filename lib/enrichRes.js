// Fetch a URL and extract { title, desc, iurl } from its <head> metadata.
//
// This version does NOT build a DOM tree (no cheerio / url-metadata), so it can't
// hit "Maximum call stack size exceeded" on pages with absurdly deep HTML nesting.
// Requires Node 18+ (global fetch).
const logger = require('./logger');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.96 Safari/537.36';
const DESC_LENGTH_MAX = 1000;
const MAX_RETRY = 3;
const RETRY_MS = 1000;
const TIMEOUT_MS = 20000;          // whole request, including reading the body
const MAX_HTML_BYTES = 512 * 1024; // only the first 512KB is needed for <head>

const RETRY_STATUS = new Set([
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
    509, // Bandwidth Limit Exceeded
    529, // Site is overloaded
    598, // Network read timeout error
    520, // Cloudflare, Web Server Returned an Unknown Error
    521, // Cloudflare, Web Server Is Down
    522, // Cloudflare, Connection Timed Out
    523, // Cloudflare, Origin Is Unreachable
    524, // Cloudflare, A Timeout Occurred
    527, // Cloudflare, Railgun Error
]);

class HttpError extends Error {
    constructor(status) {
        super('response code ' + status);
        this.status = status;
    }
}

const NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

function decodeEntities(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ent) => {
        try {
            if (ent[0] === '#') {
                const code = ent[1].toLowerCase() === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
                return String.fromCodePoint(code);
            }
        } catch (e) {
            return whole;
        }
        const v = NAMED_ENTITIES[ent.toLowerCase()];
        return v === undefined ? whole : v;
    });
}

function getAttr(tag, name) {
    const re = new RegExp('[\\s"\'/]' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i');
    const m = tag.match(re);
    if (!m) {
        return undefined;
    }
    return m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3]);
}

function pickCharset(contentType, headBytes) {
    let m = (contentType || '').match(/charset\s*=\s*["']?([\w-]+)/i);
    if (m) {
        return m[1];
    }
    m = headBytes.toString('latin1').match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i);
    return m ? m[1] : 'utf-8';
}

function decodeBody(buf, contentType) {
    const charset = pickCharset(contentType, buf.subarray(0, 4096));
    try {
        return new TextDecoder(charset).decode(buf);
    } catch (e) {
        return new TextDecoder('utf-8').decode(buf);
    }
}

function parseMetadata(html, baseUrl) {
    // Only look at the <head> if we can find its end; otherwise use what we have.
    const headEnd = html.search(/<\/head\s*>/i);
    const head = headEnd >= 0 ? html.slice(0, headEnd) : html;

    const meta = {};
    const re = /<meta\b[^>]*>/gi;
    let m;
    while ((m = re.exec(head))) {
        const key = (getAttr(m[0], 'property') || getAttr(m[0], 'name') || '').toLowerCase();
        const content = getAttr(m[0], 'content');
        if (key && content !== undefined && !(key in meta)) {
            meta[key] = decodeEntities(content).trim();
        }
    }
    const t = head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
    const titleTag = t ? decodeEntities(t[1]).replace(/\s+/g, ' ').trim() : undefined;

    let image = meta['og:image'] || meta['twitter:image'] || meta['og:image:url'];
    if (image) {
        try {
            image = new URL(image, baseUrl).href;
        } catch (e) {
            image = undefined;
        }
    }
    let desc = meta['description'] || meta['og:description'] || meta['twitter:description'];
    if (desc && desc.length > DESC_LENGTH_MAX) {
        desc = desc.slice(0, DESC_LENGTH_MAX);
    }
    return {
        title: meta['og:title'] || titleTag || meta['twitter:title'],
        desc: desc,
        iurl: image,
    };
}

async function fetchOnce(url) {
    // new URL().href percent-encodes non-ASCII paths (fixes ERR_UNESCAPED_CHARACTERS)
    const target = new URL(url).href;
    const res = await fetch(target, {
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
            'user-agent': USER_AGENT,
            'accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
            'cookie': 'over18=1',
        },
    });
    if (!res.ok) {
        throw new HttpError(res.status);
    }
    const type = res.headers.get('content-type') || '';
    if (type && !/html|xml/i.test(type)) {
        // image, pdf, etc. -- nothing to extract
        if (res.body) {
            res.body.cancel().catch(() => {});
        }
        return {};
    }
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    while (size < MAX_HTML_BYTES) {
        const {done, value} = await reader.read();
        if (done) {
            break;
        }
        chunks.push(value);
        size += value.length;
    }
    reader.cancel().catch(() => {});
    const html = decodeBody(Buffer.concat(chunks), type);
    const parsed = parseMetadata(html, res.url || target);

    const out = {};
    Object.keys(parsed).forEach((k) => {
        if (parsed[k]) {
            out[k] = parsed[k];
        }
    });
    return out;
}

module.exports = async function enrichRes(url) {
    for (let tried = 0; ; tried++) {
        try {
            return await fetchOnce(url);
        } catch (err) {
            const retry = tried < MAX_RETRY && err instanceof HttpError && RETRY_STATUS.has(err.status);
            logger.info('should try again?', url, err.message, tried, retry);
            if (!retry) {
                logger.info('Give up');
                throw err;
            }
            await new Promise((r) => setTimeout(r, RETRY_MS));
        }
    }
};
