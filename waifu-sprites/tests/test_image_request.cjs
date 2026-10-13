const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function client(responses) {
  const calls = [];
  const context = vm.createContext({
    URLSearchParams,
    async fetch(url, options) {
      calls.push({ url: new URL(url), options });
      const response = responses[calls.length - 1];
      if (response instanceof Error) throw response;
      assert.ok(response, 'unexpected extra request');
      return response;
    }
  });
  vm.runInContext(readFileSync(path.join(__dirname, '../pictures.js'), 'utf8') + '\nthis.pictures = Pictures;', context);
  return { pictures: context.pictures, calls };
}

const success = () => ({ ok: true, headers: new Headers({ 'X-Image-Url': 'https://image.test/result.webp' }) });
const failure = (status, blocked = false) => ({ ok: false, status, json: async () => ({ error: 'Mock image failure', blocked }) });

test('a successful image generation makes one request and preserves its parameters', async () => {
  const { pictures, calls } = client([success()]);
  const result = await pictures.draw('Mock picture', '3:2', { session: 'mock-session', visitor: 'mock-visitor' });
  assert.equal(result, 'https://image.test/result.webp');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get('text'), 'Mock picture');
  assert.equal(calls[0].url.searchParams.get('aspect'), '3:2');
  assert.equal(calls[0].url.searchParams.get('seed'), null);
  assert.equal(calls[0].options.headers['x-session-id'], 'mock-session');
  assert.equal(calls[0].options.headers['x-visitor-id'], 'mock-visitor');
});

test('timeouts, server failures, blocks and rejected requests never retry', async () => {
  for (const [status, blocked] of [[504, false], [502, false], [503, false], [502, true], [429, false], [400, false]]) {
    const { pictures, calls } = client([failure(status, blocked), success()]);
    await assert.rejects(pictures.draw('Mock picture', '3:2', { session: 'mock-session', visitor: 'mock-visitor' }), error => {
      assert.equal(error.message, 'Mock image failure');
      assert.equal(error.timedOut, status === 504);
      assert.equal(error.blocked, blocked);
      return true;
    });
    assert.equal(calls.length, 1);
  }
});

test('network failures propagate without a second generation', async () => {
  const failure = new Error('Mock network failure');
  const { pictures, calls } = client([failure, success()]);
  await assert.rejects(pictures.draw('Mock picture', '3:2', { session: 'mock-session', visitor: 'mock-visitor' }), error => error === failure);
  assert.equal(calls.length, 1);
});
