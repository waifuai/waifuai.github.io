const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const locales = path.join(root, '../i18n/locales');

function client(locale = 'en') {
  const store = new Map();
  const ctx = vm.createContext({
    window: {}, navigator: {}, crypto: require('node:crypto').webcrypto,
    AbortController, TextEncoder, TextDecoder, TypeError,
    Sprites: { EMOTIONS: ['happy', 'curious', 'love', 'empathetic'], detectEmotion: () => null },
    Pictures: { CHAT_RULE: '', forget() {} },
    setTimeout, clearTimeout,
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) },
  });
  ctx.window.ConversationBudget = require('../context_budget.js');
  vm.runInContext(fs.readFileSync(path.join(root, '../i18n/chat_prompts.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'prompt_translations.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'local_fallback_engine.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'chat.js'), 'utf8') + '\nthis.chat = Chat;', ctx);
  ctx.WaifuI18n = { locale };
  return { chat: ctx.chat, ctx, store };
}

test('default provider is the local built-in engine, with no endpoint configured', () => {
  const { chat } = client();
  assert.equal(chat.settings.provider, 'cloud');
  assert.equal(chat.PROVIDERS.cloud.name, 'Built-in local replies');
  assert.throws(() => chat.buildRequest([{ role: 'user', content: 'hi' }], 'chat', true, 600), /no endpoint/);
});

test('a local greeting turn completes with an emotion and text and no fetch', async () => {
  const { chat, ctx } = client();
  let requests = 0;
  ctx.fetch = async () => { requests++; throw Error('unexpected request'); };
  const events = [];
  await chat.send('hello there', {
    onEmotion: e => events.push(['emotion', e]),
    onText: t => events.push(['text', t]),
    onDone: m => events.push(['done', m]),
  });
  assert.equal(requests, 0);
  assert.equal(chat.messages.length, 2);
  assert.equal(chat.messages[1].status, 'completed');
  assert.ok(chat.messages[1].content.length > 0);
  assert.equal(chat.messages[1].emotion, 'happy');
  assert.deepEqual(events.map(e => e[0]), ['emotion', 'text', 'done']);
});

test('a local turn in French replies in French when the bundle is loaded', async () => {
  const { chat } = client('fr');
  chat.settings.language = 'French';
  await chat.send('bonjour', {});
  assert.ok(chat.messages[1].content.length > 0);
  assert.notEqual(chat.messages[1].content, 'bonjour');
});

test('local ambient turns are excluded from canned replies', async () => {
  const { chat, ctx } = client();
  let requests = 0;
  ctx.fetch = async () => { requests++; throw Error('unexpected request'); };
  const owner = chat.beginTurn('be spontaneous', { ambient: true });
  await chat.send('be spontaneous', {}, { owner });
  assert.equal(requests, 0);
});

test('no local network calls for summary, titles or transliteration', async () => {
  const { chat, ctx } = client();
  let requests = 0;
  ctx.fetch = async () => { requests++; throw Error('unexpected request'); };
  assert.equal(await chat.summarize(true), false);
  assert.equal(await chat.generateTitle(chat.convId), null);
  assert.equal(chat.settings.provider, 'cloud');
  assert.equal(requests, 0);
});

test('locale strings no longer promise cloud inference or pictures', () => {
  for (const file of fs.readdirSync(locales).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(locales, file), 'utf8');
    for (const key of ['provider.cloud.name', 'settings.providerNoteCloud', 'settings.providerNoteOwn']) {
      const line = src.split('\n').find(l => l.includes("'" + key + "'"));
      assert.ok(line, file + ' missing ' + key);
      assert.doesNotMatch(line, /WaifuAI Cloud|Pictures are drawn/i, file + ' ' + key);
    }
  }
});
