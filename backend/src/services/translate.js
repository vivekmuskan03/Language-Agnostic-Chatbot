const axios = require('axios');

// Google Translate API configuration
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';

// LibreTranslate as fallback
// Prefer a more stable public instance by default; still overridden by LIBRETRANSLATE_URL
const RAW_LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'https://translate.astian.org';
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY;
const LIBRETRANSLATE_ENABLED = (process.env.LIBRETRANSLATE_ENABLED || 'true').toLowerCase() !== 'false';
const LIBRETRANSLATE_TOTAL_BUDGET_MS = Number(process.env.LIBRETRANSLATE_TOTAL_BUDGET_MS || 4000);

// Language code mapping
const LANGUAGE_MAP = {
  'en': 'en',
  'hi': 'hi',
  'te': 'te',
  'gu': 'gu',
  'ta': 'ta',
  'kn': 'kn'
};

function isLikelyHtml(text) {
  if (typeof text !== 'string') return false;
  const sample = text.slice(0, 200).toLowerCase();
  return sample.includes('<!doctype') || sample.includes('<html');
}

// Preserve critical tokens (times, dates, numbers, acronyms) to prevent
// MT engines from reordering or altering them. We replace with placeholders
// before translation and restore after translation.
function tokenizeProtectedSegments(text) {
  const tokens = [];
  let protectedText = text;

  // Time formats like 8:00 A.M., 10:00 PM, 5 PM
  const timeRegex = /\b(\d{1,2}:\d{2}\s?(?:A\.M\.|P\.M\.|AM|PM)|\d{1,2}\s?(?:A\.M\.|P\.M\.|AM|PM))\b/g;
  // Ranges like 8:00 AM to 10:00 PM, 8 AM - 10 PM
  const rangeRegex = /\b(\d{1,2}:?\d{0,2}\s?(?:A\.M\.|P\.M\.|AM|PM)?\s?(?:to|\-|–|—)\s?\d{1,2}:?\d{0,2}\s?(?:A\.M\.|P\.M\.|AM|PM))\b/gi;
  // Dates like 2025, 10/09/2025
  const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4})\b/g;
  // All-caps acronyms
  const acronymRegex = /\b([A-Z]{2,6})\b/g;

  const patterns = [rangeRegex, timeRegex, dateRegex, acronymRegex];

  patterns.forEach((regex) => {
    protectedText = protectedText.replace(regex, (match) => {
      const id = tokens.push(match) - 1;
      return `__T${id}__`;
    });
  });

  return { protectedText, tokens };
}

function restoreProtectedSegments(translated, tokens) {
  let restored = translated;
  tokens.forEach((original, idx) => {
    const placeholder = new RegExp(`__T${idx}__`, 'g');
    restored = restored.replace(placeholder, original);
  });
  return restored;
}

// Simple language detection based on common patterns
function simpleLanguageDetection(text) {
  const hindiPattern = /[\u0900-\u097F]/;
  const teluguPattern = /[\u0C00-\u0C7F]/;
  const gujaratiPattern = /[\u0A80-\u0AFF]/;
  const tamilPattern = /[\u0B80-\u0BFF]/;
  const kannadaPattern = /[\u0C80-\u0CFF]/;
  
  if (hindiPattern.test(text)) return 'hi';
  if (teluguPattern.test(text)) return 'te';
  if (gujaratiPattern.test(text)) return 'gu';
  if (tamilPattern.test(text)) return 'ta';
  if (kannadaPattern.test(text)) return 'kn';
  
  return 'en';
}

// Heuristic detection for romanized (Latin-script) Indian languages
function detectRomanizedLanguage(text) {
  if (!text || /[^\x00-\x7F]/.test(text)) return null; // Only ASCII
  const lower = text.toLowerCase();

  const lexicon = {
    hi: ['kya', 'kaise', 'kab', 'kyun', 'haan', 'nahi', 'shukriya', 'dhanyavad', 'namaste'],
    te: ['eppudu', 'ela', 'ekkada', 'em', 'emi', 'le', 'ledu', 'namaskaram', 'meeru', 'teravata', 'terustundi', 'terucukuntundi'],
    ta: ['eppo', 'eppothu', 'eppadi', 'enna', 'illai', 'nandri', 'vanakkam', 'unga'],
    gu: ['kyare', 'kem', 'kevi', 'nathi', 'dhanyavaad', 'namaskar', 'tamne', 'shu'],
    kn: ['yavaga', 'hegide', 'elli', 'illa', 'dhanyavada', 'namaskara', 'neevu']
  };

  let best = { code: null, score: 0 };
  for (const [code, words] of Object.entries(lexicon)) {
    let score = 0;
    for (const w of words) {
      if (lower.includes(w)) score += 1;
    }
    if (score > best.score) best = { code, score };
  }
  return best.score >= 2 ? best.code : (best.score === 1 ? best.code : null);
}

// Google Translate API implementation
async function googleTranslate(text, source, target) {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    throw new Error('Google Translate API key not configured');
  }

  const params = new URLSearchParams({
    key: GOOGLE_TRANSLATE_API_KEY,
    q: text,
    target: target,
    format: 'text'
  });
  // Let Google auto-detect when source is 'auto' or falsy
  if (source && source !== 'auto') {
    params.set('source', source);
  }

  const { data } = await axios.post(`${GOOGLE_TRANSLATE_URL}?${params}`, {}, {
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  return data.data.translations[0].translatedText;
}

// Healthy instance selection + caching
let CACHED_LIBRE_INSTANCE = null;
let LAST_INSTANCE_CHECK_MS = 0;
const INSTANCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let LAST_GLOBAL_FAILURE_MS = 0;
const GLOBAL_FAILURE_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function getCandidateInstances() {
  // Prefer reliable public instances first (ordered by perceived stability)
  const candidates = [
    normalizeBaseUrl(RAW_LIBRETRANSLATE_URL),
    // Known stable public instances
    'https://translate.astian.org',
    'https://translate.argosopentech.com',
    'https://lt.vern.cc',
    'https://libretranslate.de',
    // Place the busiest public instance later
    'https://libretranslate.com',
  ].filter(Boolean);
  // De-duplicate while preserving order
  return Array.from(new Set(candidates));
}

function normalizeBaseUrl(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    let url = value.trim();
    // Remove common path suffixes if present
    url = url.replace(/\/?(translate|languages|detect)\/?$/i, '');
    // Drop trailing slashes
    url = url.replace(/\/+$/, '');
    const u = new URL(url);
    // Preserve subpath if instance is hosted under a path
    const pathname = u.pathname.replace(/\/+$/, '');
    return pathname && pathname !== '/' ? `${u.origin}${pathname}` : u.origin;
  } catch (_) {
    return value;
  }
}

function joinUrl(base, path) {
  if (!base) return path;
  if (!path) return base;
  const b = String(base).replace(/\/+$/, '');
  const p = String(path).replace(/^\/+/, '');
  return `${b}/${p}`;
}

async function probeLibreInstance(baseUrl) {
  try {
    const { status, headers, data } = await axios.get(joinUrl(baseUrl, '/languages'), {
      timeout: 2000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'chatbot-backend/1.0 (+https://example.local)'
      },
      validateStatus: (s) => s >= 200 && s < 500
    });
    const contentType = String(headers['content-type'] || '');
    const looksJson = contentType.includes('application/json') || Array.isArray(data);
    return status >= 200 && status < 300 && looksJson;
  } catch (e) {
    return false;
  }
}

async function resolveLibreInstance() {
  const now = Date.now();
  if (CACHED_LIBRE_INSTANCE && (now - LAST_INSTANCE_CHECK_MS) < INSTANCE_TTL_MS) {
    return CACHED_LIBRE_INSTANCE;
  }

  const candidates = getCandidateInstances();
  for (const baseUrl of candidates) {
    const ok = await probeLibreInstance(baseUrl);
    if (ok) {
      CACHED_LIBRE_INSTANCE = normalizeBaseUrl(baseUrl);
      LAST_INSTANCE_CHECK_MS = now;
      return CACHED_LIBRE_INSTANCE;
    } else {
      console.log(`LibreTranslate probe failed (${baseUrl})`);
    }
  }
  // As last resort, keep the configured URL even if probe failed
  CACHED_LIBRE_INSTANCE = normalizeBaseUrl(RAW_LIBRETRANSLATE_URL);
  LAST_INSTANCE_CHECK_MS = now;
  return CACHED_LIBRE_INSTANCE;
}

async function libreTranslate(text, source, target) {
  if (!LIBRETRANSLATE_ENABLED) {
    throw new Error('LibreTranslate disabled by configuration');
  }
  if (Date.now() - LAST_GLOBAL_FAILURE_MS < GLOBAL_FAILURE_COOLDOWN_MS) {
    throw new Error('LibreTranslate temporarily disabled after repeated failures');
  }

  // Try currently cached instance first, then fail over across candidates
  const tried = new Set();
  let baseUrl = normalizeBaseUrl(await resolveLibreInstance());
  const candidates = [baseUrl, ...getCandidateInstances()].map(normalizeBaseUrl).filter((u) => !!u);
  const deadline = Date.now() + Math.max(1000, LIBRETRANSLATE_TOTAL_BUDGET_MS);

  for (const candidate of candidates) {
    if (tried.has(candidate)) continue;
    tried.add(candidate);

    const payload = new URLSearchParams({ q: text, source: source || 'auto', target, format: 'text' });
    if (LIBRETRANSLATE_API_KEY) payload.set('api_key', LIBRETRANSLATE_API_KEY);

    for (let attempt = 0; attempt < 1; attempt++) {
      try {
        const response = await axios.post(joinUrl(candidate, '/translate'), payload.toString(), {
          timeout: 1500,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': 'chatbot-backend/1.0 (+https://example.local)'
          },
          maxRedirects: 2,
          validateStatus: (s) => s >= 200 && s < 500
        });

        const contentType = String(response.headers?.['content-type'] || '');
        if (!contentType.includes('application/json')) {
          // Many public instances front with HTML (rate-limit, challenge, etc.)
          throw new Error('LibreTranslate returned non-JSON response');
        }

        const data = response.data;
        const translated = data?.translatedText || data?.translation;
        if (translated && isLikelyHtml(translated)) {
          throw new Error('LibreTranslate returned HTML instead of JSON');
        }
        if (translated) {
          // Update cache to the successful instance
          CACHED_LIBRE_INSTANCE = normalizeBaseUrl(candidate);
          LAST_INSTANCE_CHECK_MS = Date.now();
          return translated;
        }
        throw new Error(`LibreTranslate unexpected body at ${candidate}`);
      } catch (err) {
        const status = err?.response?.status;
        console.log(`LibreTranslate request failed (${candidate}) [attempt ${attempt + 1}]:`, status || err.message);
        // no per-instance retries to keep latency low
      }
      if (Date.now() > deadline) break;
    }

    // Probe next instance when current one is unhealthy
    console.log(`Switching LibreTranslate instance from ${candidate}`);
    if (Date.now() > deadline) break;
  }

  LAST_GLOBAL_FAILURE_MS = Date.now();
  throw new Error('All LibreTranslate instances failed');
}

// Note: We intentionally avoid MyMemory because it can introduce factual drift
// and inconsistent phrasing for institutional content (e.g., timings, numbers).

async function detectLanguage(text) {
  // Try Google Translate detection first
  if (GOOGLE_TRANSLATE_API_KEY) {
    try {
      const params = new URLSearchParams({
        key: GOOGLE_TRANSLATE_API_KEY,
        q: text
      });

      const { data } = await axios.post(`${GOOGLE_TRANSLATE_URL}/detect?${params}`, {}, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const detectedLang = data.data.detections[0][0].language;
      return LANGUAGE_MAP[detectedLang] || 'en';
    } catch (error) {
      console.log('Google Translate detection failed:', error.message);
    }
  }

  // Try LibreTranslate detection (only if enabled and not in cooldown)
  if (LIBRETRANSLATE_ENABLED && (Date.now() - LAST_GLOBAL_FAILURE_MS >= GLOBAL_FAILURE_COOLDOWN_MS)) {
    try {
      const baseUrl = await resolveLibreInstance();
      const body = new URLSearchParams({ q: text });
      if (LIBRETRANSLATE_API_KEY) body.set('api_key', LIBRETRANSLATE_API_KEY);
      const { data } = await axios.post(joinUrl(baseUrl, '/detect'), body.toString(), {
        timeout: 3000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.detections) ? data.detections : []);
      const top = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
      return LANGUAGE_MAP[top?.language] || 'en';
    } catch (error) {
      // Some instances require JSON; retry once with JSON body
      try {
        const baseUrl = await resolveLibreInstance();
        const jsonBody = { q: text };
        if (LIBRETRANSLATE_API_KEY) jsonBody.api_key = LIBRETRANSLATE_API_KEY;
        const { data } = await axios.post(joinUrl(baseUrl, '/detect'), jsonBody, {
          timeout: 3000,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.detections) ? data.detections : []);
        const top = Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
        return LANGUAGE_MAP[top?.language] || 'en';
      } catch (err2) {
        console.log('LibreTranslate detection failed:', err2.message);
      }
    }
  }

  // Try romanized detection for ASCII inputs
  const romanized = detectRomanizedLanguage(text);
  if (romanized) return romanized;

  // Fallback to simple detection
  return simpleLanguageDetection(text);
}

async function translateText(text, source, target) {
  if (!text || source === target) return text;
  const { protectedText, tokens } = tokenizeProtectedSegments(text);
  const effectiveSource = source && source !== target ? source : 'auto';
  
  // Try Google Translate first (if API key is available)
  if (GOOGLE_TRANSLATE_API_KEY) {
    try {
      const result = await googleTranslate(protectedText, effectiveSource, target);
      console.log(`Google Translate: ${source} -> ${target} successful`);
      return restoreProtectedSegments(result, tokens);
    } catch (error) {
      console.log('Google Translate failed:', error.message);
    }
  }

  // Try LibreTranslate as fallback
  try {
    const result = await libreTranslate(protectedText, effectiveSource, target);
    console.log(`LibreTranslate: ${source} -> ${target} successful`);
    return restoreProtectedSegments(result, tokens);
  } catch (error) {
    console.log('LibreTranslate failed:', error.message);
  }

  // If all translation services fail, return original text
  console.log('All translation services failed, returning original text');
  return text;
}

// Safe translate function that handles errors gracefully
async function safeTranslate(text, sourceLang, targetLang) {
  try {
    if (!text || !targetLang || sourceLang === targetLang) {
      return text;
    }
    return await translateText(text, sourceLang, targetLang);
  } catch (error) {
    console.error('Translation error:', error.message);
    return text; // Return original text if translation fails
  }
}

module.exports = { detectLanguage, translateText, safeTranslate };


