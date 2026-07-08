// This script fetches reviews from pages 1 to 10 and merges them into reviews.json
// Usage: node fetch-reviews.js


require('dotenv').config({ path: '.env.local' });
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const API_URL = 'https://pappasoceancatch-ea.com.au/api/consumer/reviews?app_name=CUSTOMER&page=';
const LIMIT = 20;
const TOTAL_PAGES = 5;
const SOURCE = 'pappasoceancatch-ea.com.au';

const HEADERS = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-AU,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
    'api-token': 'J6WDf0ttQKGfYhQkRCjwraBS11JYuIDx',
    'authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdWQiOjMxMzU0MjIyMCwiaWF0IjoxNzgzMTM2MTQ5LCJuYmYiOjE3ODMxMzYxNDksImV4cCI6MzkxMDc5MzYxNDksInN1YiI6IiIsInNjb3BlcyI6WyIqIl19.85Hn7_kvQcLRPJkSRZN-XA1tT-1PmnOt_VUAUm6h3zg',
    'cache-control': 'no-cache',
    'deviceinfo': '{"os":"macOS","version":"12.2 (0325)","platform":"WEB","platform_id":1,"product_id":"1","path":"https://pappasoceancatch-ea.com.au/review"}',
    'language': 'en',
    'locale': 'australia',
    'passport': '1',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://pappasoceancatch-ea.com.au/review',
    'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'store': 'pappasoceancatch-ea.com.au',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
};

function fetchPage(page) {
    return new Promise((resolve, reject) => {
        const url = `${API_URL}${page}&limit=${LIMIT}&sid=jfx3-vQAJ-a5`;
        console.log(`[FETCH] ${url}`);
        https.get(url, { headers: HEADERS }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function toNumber(val) {
    if (val === null || val === undefined) return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
}

function toBoolean(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val === '1' || val.toLowerCase() === 'true';
    return Boolean(val);
}

// Load env vars for Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase env vars');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    let allReviews = [];
    for (let page = 1; page <= TOTAL_PAGES; page++) {
        try {
            console.log(`Fetching page ${page}...`);
            const result = await fetchPage(page);
            if (Array.isArray(result?.data)) {
                console.log(`[PAGE ${page}] Found ${result.data.length} items.`);
                allReviews = allReviews.concat(result.data);
            } else {
                console.warn(`No data array on page ${page}`);
            }
        } catch (err) {
            console.error(`Error fetching page ${page}:`, err);
        }
    }
    const allIds = allReviews.map(r => r.id);
    const uniqueIds = Array.from(new Set(allIds));
    console.log(`Fetched ${allReviews.length} reviews, ${uniqueIds.length} unique IDs.`);


    // Deduplicate by id (keep first occurrence)
    const seen = new Set();
    const upsertRows = [];
    for (const r of allReviews) {
        if (!seen.has(r.id)) {
            seen.add(r.id);
            const value = toNumber(r.value);
            const delivery = toNumber(r.delivery);
            const food = toNumber(r.food);
            // Calculate rating as average of non-null value, delivery, food
            const nums = [value, delivery, food].filter(v => typeof v === 'number' && !isNaN(v));
            const rating = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
            upsertRows.push({
                id: r.id,
                host: r.host,
                product_id: r.product_id,
                platform_id: r.platform_id,
                message: r.message,
                response: r.response,
                rating,
                name: r.name,
                date: r.date ? new Date(r.date) : null,
                active: toBoolean(r.active),
                portal: r.portal,
                created_at: r.created_at ? new Date(r.created_at) : null,
                replied_at: r.replied_at ? new Date(r.replied_at) : null,
                updated_at: r.updated_at ? new Date(r.updated_at) : null,
                source: SOURCE
            });
        }
    }
    console.log(`Prepared ${upsertRows.length} unique reviews for upsert.`);

    // Batch upsert (Supabase limit: 500 rows per call)
    const batchSize = 500;
    for (let i = 0; i < upsertRows.length; i += batchSize) {
        const batch = upsertRows.slice(i, i + batchSize);
        const { error } = await supabase.from('external_reviews').upsert(batch, { onConflict: 'id' });
        if (error) {
            console.error('Upsert error:', error);
        } else {
            console.log(`Upserted ${batch.length} reviews.`);
        }
    }

    console.log(`Done. Upserted ${upsertRows.length} reviews to external_reviews.`);
})();
