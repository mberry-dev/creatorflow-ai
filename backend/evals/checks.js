// Pass/fail checks for CreatorFlow AI evals.
// Each check looks at one eval case and the API response, and returns
// { check, pass, detail }. A case passes only if every check passes.
//
// These checks encode what the app is SUPPOSED to do (from the SRS),
// not what the code currently does. Some are simple text heuristics,
// so when a case fails, read the saved output to confirm it's a real
// problem before changing the prompt.

// ---------- Limits from the requirements ----------

// Title limits: 100 characters on YouTube, 150 everywhere else.
export function titleLimit(platform = 'YouTube') {
  return platform === 'YouTube' ? 100 : 150;
}

// Description limits: TikTok and Instagram Reels 2,200, YouTube 5,000.
// The app's dropdown sends "Instagram" for Instagram Reels, so both spellings count.
export function descriptionLimit(platform = 'YouTube') {
  return ['TikTok', 'Instagram', 'Instagram Reels'].includes(platform) ? 2200 : 5000;
}

// ---------- Text helpers ----------

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'your', 'from', 'that', 'this', 'into', 'about',
  'after', 'what', 'when', 'using', 'without', 'have', 'how', 'why', 'who',
  'you', 'are', 'can', 'all', 'our', 'its', 'not', 'but', 'was', 'one', 'out',
  'cómo', 'para', 'sin', 'con', 'los', 'las', 'del', 'una', 'que', 'por'
]);

// Meaningful words (3+ letters, not stop words) from a piece of text.
// 3 letters, not 4, so short topic words like "pan" (bread) still count.
function keywords(text) {
  const words = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return [...new Set(words)];
}

// True if the output shares at least one keyword with the topic.
// Uses the start of each word so "tomatoes" also matches "tomato".
function mentionsTopic(output, topic) {
  const out = output.toLowerCase();
  return keywords(topic).some((k) => out.includes(k.slice(0, Math.max(4, k.length - 2))));
}

// Numbers that appear in text, ignoring numbered-list markers like "1." at a line start.
function numbersIn(text) {
  const withoutListMarkers = text.replace(/^\s*\d+[.)]\s/gm, '');
  return withoutListMarkers.match(/\d+(?:[.,:]\d+)*/g) || [];
}

// Numbers in the output that the user never gave (invented stats, prices, years, timestamps).
function inventedNumbers(output, topic) {
  const allowed = new Set(numbersIn(topic));
  return [...new Set(numbersIn(output).filter((n) => !allowed.has(n)))];
}

const charCount = (s) => [...s].length; // counts an emoji as 1 character
const result = (check, pass, detail = '') => ({ check, pass, detail });
const isNonEmptyString = (x) => typeof x === 'string' && x.trim().length > 0;

// ---------- Individual checks ----------

const CHECKS = {
  // ----- Shared -----
  status200: ({ res }) =>
    result('status200', res.status === 200 && res.body?.success === true, `HTTP ${res.status}`),

  rejected: ({ res }) =>
    result('rejected', res.status === 400 && res.body?.success === false,
      res.status === 400 ? 'rejected with 400' : `expected 400, got HTTP ${res.status}`),

  mustNotContain: ({ testCase, text }) => {
    const hits = (testCase.mustNotContain || []).filter((w) => text.toLowerCase().includes(w.toLowerCase()));
    return result('mustNotContain', hits.length === 0, hits.length ? `found: ${hits.join(', ')}` : '');
  },

  // ----- Titles -----
  titleCount: ({ res }) => {
    const list = res.body?.suggestions;
    const n = Array.isArray(list) ? list.length : 0;
    return result('titleCount', n >= 3 && n <= 5, `${n} titles (want 3-5)`);
  },

  titlesValid: ({ res }) => {
    const list = res.body?.suggestions || [];
    const allStrings = list.every(isNonEmptyString);
    const unique = new Set(list.map((t) => String(t).toLowerCase().trim())).size === list.length;
    return result('titlesValid', allStrings && unique,
      !allStrings ? 'a title is empty or not text' : !unique ? 'duplicate titles' : '');
  },

  titleLength: ({ testCase, res }) => {
    const limit = titleLimit(testCase.body.platform);
    const tooLong = (res.body?.suggestions || []).filter((t) => typeof t === 'string' && charCount(t) > limit);
    return result('titleLength', tooLong.length === 0,
      tooLong.length ? `${tooLong.length} over ${limit} chars (longest ${Math.max(...tooLong.map(charCount))})` : `all under ${limit}`);
  },

  // ----- Descriptions -----
  descriptionPresent: ({ res }) =>
    result('descriptionPresent', isNonEmptyString(res.body?.description), ''),

  descriptionLength: ({ testCase, res }) => {
    const limit = descriptionLimit(testCase.body.platform);
    const n = charCount(res.body?.description || '');
    return result('descriptionLength', n <= limit, `${n} chars (limit ${limit})`);
  },

  noPlaceholders: ({ text }) => {
    const m = text.match(/\[[^\]\n]{1,60}\]|\binsert\b|lorem ipsum|xx:xx/i);
    return result('noPlaceholders', !m, m ? `found "${m[0]}"` : '');
  },

  noInventedLinks: ({ testCase, text }) => {
    const m = text.match(/(https?:\/\/|www\.)\S+/i);
    const inTopic = m && testCase.body.topic.includes(m[0]);
    return result('noInventedLinks', !m || inTopic, m && !inTopic ? `found ${m[0]}` : '');
  },

  // ----- Hashtags -----
  hashtagCount: ({ res }) => {
    const list = res.body?.hashtags;
    const n = Array.isArray(list) ? list.length : 0;
    return result('hashtagCount', n >= 10 && n <= 15, `${n} hashtags (want 10-15)`);
  },

  hashtagFormat: ({ res }) => {
    const list = res.body?.hashtags || [];
    const bad = list.filter((t) => !/^#[\p{L}\p{N}_]+$/u.test(t));
    const unique = new Set(list.map((t) => t.toLowerCase())).size === list.length;
    return result('hashtagFormat', bad.length === 0 && unique,
      bad.length ? `not hashtags: ${bad.slice(0, 4).join(' ')}` : !unique ? 'duplicate hashtags' : '');
  },

  // ----- SEO -----
  seoKeywords: ({ res }) => {
    const list = res.body?.keywords;
    const ok = Array.isArray(list) && list.length >= 3 && list.every(isNonEmptyString);
    return result('seoKeywords', ok,
      !Array.isArray(list) ? 'missing' : `${list.length} keywords${list.every(isNonEmptyString) ? '' : ', some are not text'}`);
  },

  seoRecommendations: ({ res }) => {
    const list = res.body?.recommendations;
    const ok = Array.isArray(list) && list.length >= 3 && list.every(isNonEmptyString);
    return result('seoRecommendations', ok,
      !Array.isArray(list) ? 'missing' : `${list.length} recommendations${list.every(isNonEmptyString) ? '' : ', some are not text (the UI expects text)'}`);
  },

  // ----- Content quality -----
  onTopic: ({ testCase, res, text }) => {
    const topic = testCase.body.topic;
    if (testCase.endpoint === 'title') {
      const off = (res.body?.suggestions || []).filter((t) => typeof t === 'string' && !mentionsTopic(t, topic));
      return result('onTopic', off.length === 0, off.length ? `off-topic: "${off[0]}"` : '');
    }
    return result('onTopic', mentionsTopic(text, topic), '');
  },

  noInventedNumbers: ({ testCase, text }) => {
    const extra = inventedNumbers(text, testCase.body.topic);
    return result('noInventedNumbers', extra.length === 0, extra.length ? `numbers not in topic: ${extra.slice(0, 5).join(', ')}` : '');
  },

  professionalTone: ({ res }) => {
    const list = (res.body?.suggestions || []).filter((t) => typeof t === 'string');
    const emoji = list.some((t) => /\p{Extended_Pictographic}/u.test(t));
    const shouting = list.some((t) => /\b[A-Z]{4,}\b/.test(t));
    return result('professionalTone', !emoji && !shouting,
      emoji ? 'contains emoji' : shouting ? 'contains ALL-CAPS words' : '');
  }
};

// Default checks for each endpoint. Cases can add extraChecks or skip some with skipChecks.
const DEFAULT_CHECKS = {
  title: ['status200', 'titleCount', 'titlesValid', 'titleLength', 'onTopic', 'noInventedNumbers'],
  description: ['status200', 'descriptionPresent', 'descriptionLength', 'onTopic', 'noPlaceholders', 'noInventedLinks', 'noInventedNumbers'],
  hashtags: ['status200', 'hashtagCount', 'hashtagFormat', 'onTopic'],
  seo: ['status200', 'seoKeywords', 'seoRecommendations', 'onTopic']
};

// All the generated text in a response, joined, for text-based checks.
function outputText(endpoint, body = {}) {
  const parts = {
    title: body.suggestions,
    description: [body.description],
    hashtags: body.hashtags,
    seo: [...(body.keywords || []), ...(body.recommendations || [])]
  }[endpoint] || [];
  return (parts || []).map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join('\n');
}

export function checkNames(testCase) {
  if (testCase.expectReject) return ['rejected'];
  const names = [...DEFAULT_CHECKS[testCase.endpoint], ...(testCase.extraChecks || [])]
    .filter((n) => !(testCase.skipChecks || []).includes(n));
  if (testCase.mustNotContain) names.push('mustNotContain');
  return names;
}

export function runChecks(testCase, res) {
  const text = outputText(testCase.endpoint, res.body);
  return checkNames(testCase).map((name) => CHECKS[name]({ testCase, res, text }));
}
