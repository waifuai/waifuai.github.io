const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function client(responses) {
  const calls = [];
  const math = Object.create(Math);
  math.random = () => 0.5;
  const context = vm.createContext({
    URLSearchParams, Math: math,
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

test('a successful first image request remains unseeded and makes one call', async () => {
  const { pictures, calls } = client([success()]);
  assert.equal(await pictures.draw('Mock picture'), 'https://image.test/result.webp');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.has('seed'), false);
});

test('transient and network failures retry once with an explicit new seed', async () => {
  for (const first of [failure(504), failure(502), failure(503), new Error('Mock network failure')]) {
    const { pictures, calls } = client([first, success()]);
    assert.equal(await pictures.draw('Mock picture', '3:2', { session: 'mock-session', visitor: 'mock-visitor' }), 'https://image.test/result.webp');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.searchParams.has('seed'), false);
    assert.match(calls[1].url.searchParams.get('seed'), /^\d+$/);
    for (const request of calls) {
      assert.equal(request.url.searchParams.get('text'), 'Mock picture');
      assert.equal(request.url.searchParams.get('aspect'), '3:2');
      assert.equal(request.options.headers['x-session-id'], 'mock-session');
      assert.equal(request.options.headers['x-visitor-id'], 'mock-visitor');
    }
  }
});

test('a failed retry stops after two calls and keeps the error flags', async () => {
  for (const second of [failure(504), failure(502, true), new Error('Mock retry network failure')]) {
    const { pictures, calls } = client([failure(502), second]);
    await assert.rejects(pictures.draw('Mock picture'), error => {
      if (second instanceof Error) assert.equal(error, second);
      else {
        assert.equal(error.timedOut, second.status === 504);
        assert.equal(error.blocked, second.status === 502);
      }
      return true;
    });
    assert.equal(calls.length, 2);
  }
});

test('content blocks, malformed requests and overload are never retried', async () => {
  for (const [status, blocked] of [[502, true], [429, false], [400, false]]) {
    const { pictures, calls } = client([failure(status, blocked)]);
    await assert.rejects(pictures.draw('Mock picture'), error => error.blocked === blocked && error.timedOut === false);
    assert.equal(calls.length, 1);
  }
});
