/**
 * Interface-localization checks: dictionary parity, placeholder parity, the
 * detection/region table, English fallback and plural rules.
 *
 * Run: node --test waifu-sprites/tests/test_i18n.cjs
 */
const assert = require('node:assert/strict');
const { readdirSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const I18N_DIR = path.join(__dirname, '..', '..', 'i18n');
const LOCALES_DIR = path.join(I18N_DIR, 'locales');
const I18n = require(path.join(I18N_DIR, 'i18n.js'));

// Register every dictionary the way the browser does, in catalog order.
for (const meta of I18n.locales()) {
  const file = path.join(LOCALES_DIR, meta.code + '.js');
  require(file);
}

const dictKeys = code => new Set(I18n.keys(code));
const placeholders = value => new Set(String(value).match(/%\{(\w+)\}/g) || []);

function placeholdersOf(entry) {
  const out = new Set();
  if (entry && typeof entry === 'object') {
    for (const form of Object.keys(entry)) for (const ph of placeholders(entry[form])) out.add(ph);
  } else {
    for (const ph of placeholders(entry)) out.add(ph);
  }
  return out;
}

test('catalog and dictionary files line up', () => {
  const files = readdirSync(LOCALES_DIR).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).sort();
  const codes = I18n.locales().map(m => m.code).sort();
  assert.deepEqual(files, codes);
  assert.equal(codes.length, 13);
  for (const code of codes) assert.ok(I18n.dictionary(code), 'dictionary for ' + code);
});

test('every locale has exactly the English key set', () => {
  const reference = dictKeys('en');
  assert.ok(reference.size > 200, 'expected a full dictionary, got ' + reference.size);
  for (const meta of I18n.locales()) {
    if (meta.code === 'en') continue;
    const missing = [...reference].filter(k => !dictKeys(meta.code).has(k));
    const extra = [...dictKeys(meta.code)].filter(k => !reference.has(k));
    assert.deepEqual(missing, [], meta.code + ' is missing keys');
    assert.deepEqual(extra, [], meta.code + ' has keys English does not');
  }
});

test('every locale keeps the English %{placeholders}', () => {
  for (const meta of I18n.locales()) {
    if (meta.code === 'en') continue;
    const en = I18n.dictionary('en');
    const dict = I18n.dictionary(meta.code);
    for (const key of I18n.keys('en')) {
      const expected = placeholdersOf(en[key]);
      const actual = placeholdersOf(dict[key]);
      assert.deepEqual([...actual].sort(), [...expected].sort(), meta.code + ' ' + key + ' placeholders');
    }
  }
});

test('plural keys stay plural in every locale', () => {
  for (const meta of I18n.locales()) {
    const entry = I18n.dictionary(meta.code)['history.count'];
    assert.equal(typeof entry, 'object', meta.code + ' history.count must be a plural map');
    assert.equal(typeof entry.other, 'string', meta.code + ' history.count needs an "other" form');
  }
});

test('regional and legacy tags reduce to the supported base locale', () => {
  const table = {
    'es-MX': 'es', 'es-419': 'es', 'pt-BR': 'pt', 'pt-PT': 'pt', 'fr-CA': 'fr',
    'de-AT': 'de', 'de-CH': 'de', 'zh-CN': 'zh', 'zh-Hans': 'zh', 'zh-SG': 'zh',
    'zh-TW': 'zh', 'ar-EG': 'ar', 'ar-SA': 'ar', 'fa-IR': 'fa', 'ja-JP': 'ja',
    'ru-RU': 'ru', 'pl-PL': 'pl', 'ms-MY': 'ms', 'en-GB': 'en', 'en': 'en',
    'in': 'id', 'id-ID': 'id', 'EN_us': 'en', 'pt': 'pt',
  };
  for (const [tag, code] of Object.entries(table)) {
    assert.equal(I18n.resolve(tag), code, tag);
  }
  assert.equal(I18n.resolve('xx-YY'), null);
  assert.equal(I18n.resolve(''), null);
  assert.equal(I18n.resolve(null), null);
});

test('detection uses the browser order and falls back to English', () => {
  assert.equal(I18n.detect(['xx', 'fr-CA', 'de']), 'fr');
  assert.equal(I18n.detect(['de-AT']), 'de');
  assert.equal(I18n.detect(['nope']), 'en');
  assert.equal(I18n.detect([]), 'en');
  assert.equal(I18n.detect(['in']), 'id');
});

test('English is the fallback for a missing key, then the key itself', async () => {
  await I18n.setLocale('fr');
  const fr = I18n.dictionary('fr');
  const keep = fr['app.retry'];
  delete fr['app.retry'];
  try {
    assert.equal(I18n.t('app.retry'), I18n.dictionary('en')['app.retry']);
  } finally {
    fr['app.retry'] = keep;
  }
  assert.equal(I18n.t('no.such.key'), 'no.such.key');
  await I18n.setLocale('en');
});

test('plural forms resolve per locale through Intl.PluralRules', async () => {
  const cases = { en: ['en', [1, 3]], ru: ['ru', [1, 2, 5, 21, 22]], pl: ['pl', [1, 2, 5, 22, 25]], ar: ['ar', [0, 1, 2, 3, 11, 100]] };
  for (const [code, [tag, counts]] of Object.entries(cases)) {
    await I18n.setLocale(code);
    const entry = I18n.dictionary(code)['history.count'];
    const rules = new Intl.PluralRules(tag);
    for (const n of counts) {
      const form = rules.select(n);
      const expected = String(entry[form] != null ? entry[form] : entry.other).replace('%{count}', String(n));
      assert.equal(I18n.t('history.count', { count: n }), expected, code + ' count=' + n);
    }
  }
  await I18n.setLocale('en');
});

test('RTL metadata and native locale names are correct', () => {
  assert.equal(I18n.localeInfo('ar').dir, 'rtl');
  assert.equal(I18n.localeInfo('fa').dir, 'rtl');
  for (const code of ['en', 'es', 'pt', 'fr', 'ru', 'ja', 'zh', 'de', 'id', 'ms', 'pl']) {
    assert.equal(I18n.localeInfo(code).dir, 'ltr', code);
  }
  assert.equal(I18n.localeInfo('pt').tag, 'pt-BR');
  assert.equal(I18n.localeInfo('zh').tag, 'zh-CN');
  assert.equal(I18n.localeInfo('fa').tag, 'fa');
  // Native locale names, and the reply-language endonyms the app shows.
  assert.equal(I18n.localeInfo('ja').name, '日本語');
  assert.equal(I18n.languageName('Japanese'), '日本語');
  assert.equal(I18n.languageName('Arabic'), 'العربية');
  assert.equal(I18n.languageName('Klingon'), 'Klingon');
});
