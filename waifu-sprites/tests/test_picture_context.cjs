const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function client(answer) {
  const decisions = [], writers = [];
  const context = vm.createContext({
    Chat: { async askDecisions(tasks, state) {
      decisions.push({ tasks, state });
      if (answer instanceof Error) throw answer;
      return answer === undefined
        ? { picture_action_v1: { choice_id: state.previous_reply.includes('Want a picture') ? 'draw' : 'none', confidence: 0.9 } }
        : answer;
    } },
    async fetch(_url, options) {
      writers.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'DRAW: An anime companion smiling in a cozy room, soft light and a comfortable outfit.' } }] }) };
    }
  });
  vm.runInContext(readFileSync(path.join(__dirname, '../pictures.js'), 'utf8') + '\nthis.pictures = Pictures;', context);
  return { pictures: context.pictures, decisions, writers };
}

test('accepting a closing offer in a long reply reaches the picture writer', async () => {
  const offer = 'Want a picture of me in my room, or in a cozy cafe?';
  const previous = 'Here is a little about me. ' + 'I enjoy good conversations. '.repeat(25) + offer;
  const { pictures, decisions, writers } = client();
  assert.ok(await pictures.decide('In your room', previous));
  assert.equal(decisions.length, 1);
  const state = decisions[0].state;
  assert.ok(state.previous_reply.length <= 300);
  assert.ok(state.previous_reply.startsWith('Here is a little about me.'));
  assert.ok(state.previous_reply.endsWith(offer));
  assert.equal(writers.length, 1);
  assert.equal(writers[0].messages[1].content, `Companion's previous message: ${state.previous_reply}\n\nUser's NEW message: In your room`);
});

test('short context stays intact and zero-confidence none suppresses the writer', async () => {
  const { pictures, decisions, writers } = client({ picture_action_v1: { choice_id: 'none', confidence: 0 } });
  const previous = 'Here is the picture you requested.';
  assert.equal(await pictures.decide('Thanks', previous), null);
  assert.equal(decisions[0].state.previous_reply, previous);
  assert.equal(writers.length, 0);
});

test('an unavailable decision retains the existing picture writer', async () => {
  const { pictures, writers } = client(null);
  assert.ok(await pictures.decide('Yes please', 'Want a picture?'));
  assert.equal(writers.length, 1);
});

test('zero-confidence draw sends an approved request to the description writer', async () => {
  const { pictures, writers } = client({ picture_action_v1: { choice_id: 'draw', confidence: 0 } });
  assert.ok(await pictures.decide('Yes please', 'Want a picture?'));
  assert.equal(writers.length, 1);
  const prompt = writers[0].messages[0].content;
  assert.match(prompt, /approved picture request/);
  assert.match(prompt, /exactly one line: DRAW:/);
  assert.doesNotMatch(prompt, /NONE|Decide whether/);
});

test('uncertain, unknown and failed actions retain the original picture judgment', async () => {
  for (const answer of [{ picture_action_v1: { choice_id: 'uncertain', confidence: 1 } }, { picture_action_v1: { choice_id: 'invented' } }, new Error('offline')]) {
    const { pictures, writers } = client(answer);
    assert.ok(await pictures.decide('Yes please', 'Want a picture?'));
    assert.equal(writers.length, 1);
    assert.match(writers[0].messages[0].content, /Decide whether/);
    assert.match(writers[0].messages[0].content, /NONE/);
  }
});
