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
    AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
  });
  ctx.window.ConversationBudget = require('../context_budget.js');
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../chat.js'), 'utf8') + '\nthis.chat = Chat;', ctx);
  return { chat: ctx.chat, store, key, ctx };
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

function populate(chat, large = false) {
  chat.newConversation();
  for (let i = 0; i < 30; i++) chat.messages.push({ id: 'm' + i, role: i % 2 ? 'assistant' : 'user', content: 'item ' + i + 'x'.repeat(large ? 10000 : 100) });
}
function response(content) { return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) }; }
test('failed and oversized results preserve both memory boundary and archive', async () => {
  for (const fail of ['offline', 'oversized']) {
    const { chat, ctx } = client(); populate(chat); chat.setSummary('Existing facts');
    ctx.fetch = async () => { if (fail === 'offline') throw Error('Offline'); return response('x'.repeat(4097)); };
    await assert.rejects(chat.summarize(true));
    assert.equal(chat.summary, 'Existing facts');
    assert.equal(chat.unsummarizedStart(), 0);
    assert.equal(chat.messages.length, 30);
  }
});
test('chat switches and manual edits invalidate an in-flight summary', async () => {
  for (const action of ['switch', 'edit', 'delete']) {
    const { chat, ctx } = client(); populate(chat);
    let finish; ctx.fetch = () => new Promise(resolve => { finish = resolve; });
    const work = chat.summarize(true);
    if (action === 'switch') chat.newConversation();
    else if (action === 'edit') chat.setSummary('Edited memory');
    else chat.deleteMessage('m0');
    finish(response('Stale result'));
    assert.equal(await work, false);
    assert.notEqual(chat.summary, 'Stale result');
  }
});
test('one automatic batch per user turn advances only completed source', async () => {
  const { chat, ctx } = client(); populate(chat, true);
  const calls = []; ctx.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); return response('Remembered facts'); };
  await chat.summarize(); await chat.summarize();
  assert.equal(calls.length, 1);
  assert.equal(chat.messages.length, 30);
  assert.ok(chat.unsummarizedStart() > 0 && chat.unsummarizedStart() < 30);
  chat.messages.push({ id: 'next', role: 'user', content: 'Next turn' });
  await chat.summarize(); assert.equal(calls.length, 2);
  assert.ok(calls.every(r => Buffer.byteLength(JSON.stringify(r)) <= 32768));
});
test('legacy memory is progressively recompressed and the full original is retained', async () => {
  const { chat, ctx, store } = client(); populate(chat);
  const id = chat.convId, original = 'Older facts. '.repeat(10000);
  store.set('ws_conv_' + id, JSON.stringify(chat.messages));
  store.set('ws_mem_' + id, JSON.stringify({ summary: original, through: 'm0' }));
  chat.openConversation(id);
  let calls = 0; ctx.fetch = async () => { calls++; return response('Compact names and promises'); };
  await chat.summarize(true);
  assert.equal(chat.summary, original);
  assert.ok(chat.memoryPending);
  chat.openConversation(id); // resume persisted work
  while (chat.memoryPending) { await chat.summarize(true); assert.ok(calls < 15); }
  assert.equal(chat.summary, 'Compact names and promises');
  assert.equal(JSON.parse(store.get('ws_mem_' + id)).backup, original);
  assert.equal(chat.messages.length, 30);
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

test('oversized legacy summary never blocks chat or prompts the user, using active summary within budget', async () => {
  const { chat, store } = client();
  const id = chat.convId, legacySummary = 'Older facts about user and story. '.repeat(500);
  chat.messages.push(
    { id: 'm1', role: 'user', content: 'prior question' },
    { id: 'm2', role: 'assistant', content: 'prior answer' }
  );
  store.set('ws_conv_' + id, JSON.stringify(chat.messages));
  store.set('ws_mem_' + id, JSON.stringify({ summary: legacySummary, through: 'm1' }));
  chat.openConversation(id);
  const messages = await chat.modelMessages('new message');
  assert.ok(messages.length >= 2);
  const sysMsg = messages.find(m => m.role === 'system');
  assert.ok(sysMsg);
  assert.ok(sysMsg.content.includes('Summary of your conversation with the user so far:'));
  assert.ok(Buffer.byteLength(sysMsg.content, 'utf8') < 10000);
  assert.equal(chat.summary, legacySummary);
  const body = { model: 'waifuai-v1', messages, max_tokens: 600, stream: true };
  assert.ok(Buffer.byteLength(JSON.stringify(body), 'utf8') <= 32768);
});


