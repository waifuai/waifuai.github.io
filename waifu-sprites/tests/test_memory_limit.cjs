const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function client(saved, embed = false) {
  const key = embed ? 'ws_embed_settings' : 'ws_settings';
  const store = new Map(saved === undefined ? [] : [[key, JSON.stringify({ memorySize: saved, aboutUser: 'Remember me' })]]);
  const ctx = vm.createContext({ window: { WaifuSpritesEmbed: embed },
    Sprites: { EMOTIONS: ['happy'] }, Pictures: { CHAT_RULE: 'Picture instructions' }, navigator: {},
    crypto: require('node:crypto').webcrypto,
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../chat.js'), 'utf8') + '\nthis.chat = Chat;', ctx);
  return { chat: ctx.chat, store, key };
}

test('saved values above 20 are clamped and persisted for full and embedded clients', () => {
  for (const embed of [false, true]) for (const saved of [30, 50, 60]) {
    const { chat, store, key } = client(saved, embed);
    assert.equal(chat.settings.memorySize, 20);
    const persisted = JSON.parse(store.get(key));
    assert.equal(persisted.memorySize, 20);
    assert.equal(persisted.aboutUser, 'Remember me');
  }
});

test('fresh defaults and smaller saved choices use 20 and the smaller value respectively', () => {
  assert.equal(client().chat.settings.memorySize, 20);
  assert.equal(client(10).chat.settings.memorySize, 10);
});

test('settings saves and request construction enforce the cap without deleting messages', async () => {
  const { chat, store, key } = client(30);
  chat.settings.memorySize = 60;
  chat.saveSettings();
  assert.equal(JSON.parse(store.get(key)).memorySize, 20);
  for (let i = 0; i < 35; i++) chat.messages.push({ id: 'm' + i, role: i % 2 ? 'assistant' : 'user', content: 'message ' + i });
  chat.settings.memorySize = 60; // request boundary still protects against direct changes
  const messages = await chat.modelMessages();
  assert.equal(messages.length, 21);
  assert.equal(messages[1].content, 'message 15');
  assert.equal(messages.at(-1).content, 'message 34');
  assert.equal(chat.messages.length, 35);
});
