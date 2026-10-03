/**
 * chat.js: providers, personas, conversation history and streaming.
 *
 * Guests chat through WaifuAI Cloud with no key. Visitors can switch to their
 * own OpenRouter, Groq or any OpenAI-compatible key instead; keys stay in this
 * browser's localStorage and requests go straight from the browser to that
 * provider.
 *
 * Replies start with an emotion tag like "[curious]" that picks the sprite
 * clip. The tag is stripped from what is shown and stored on the message.
 *
 * Messages are {role, content, emotion?}. A picture is its own assistant
 * message {role, image, prompt, caption} (see pictures.js).
 */
const Chat = (() => {
  const CLOUD_URL = 'https://waifu-companion-proxy.thewaifuai.workers.dev/chat/completions';

  const PROVIDERS = {
    cloud: { name: 'WaifuAI Cloud', desc: 'Free, no key needed', defaultModel: 'waifuai-v1' },
    openrouter: { name: 'OpenRouter', desc: 'Your own key', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'poolside/laguna-s-2.1:free', keyUrl: 'https://openrouter.ai/keys' },
    groq: { name: 'Groq', desc: 'Your own key', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys' },
    custom: { name: 'OpenAI-compatible', desc: 'Any /v1 endpoint', baseUrl: '', defaultModel: '' },
  };

  const EMOTION_RULE = 'Start every reply with exactly one emotion tag in square brackets, chosen from: ' +
    Sprites.EMOTIONS.join(', ') + '. Example: "[curious] Ooh, what are you working on?" ' +
    'Never mention the tag. Keep replies short and conversational, usually one to three sentences.';

  const PERSONAS = {
    aurora: {
      name: 'Aurora',
      desc: 'Cheerful, warm, a little playful',
      prompt: 'You are Aurora, a cheerful anime girl who keeps the user company. You are warm, upbeat and a little playful, ' +
        'you love music and games, and you are genuinely curious about the user\'s day. Talk like a friend, not an assistant.',
    },
    tsundere: {
      name: 'Tsundere',
      desc: 'Acts annoyed, secretly cares',
      prompt: 'You are a tsundere anime girl. You act prickly and pretend to be annoyed ("It\'s not like I wanted to help you or anything!"), ' +
        'but you clearly care and always help in the end. Stay playful, never actually mean.',
    },
    study: {
      name: 'Study buddy',
      desc: 'Calm, focused, encouraging',
      prompt: 'You are a calm, encouraging study buddy. You help the user focus, break work into small steps, explain things simply ' +
        'and celebrate progress. Gentle and patient, with the occasional joke.',
    },
    assistant: {
      name: 'Plain assistant',
      desc: 'Helpful, no character',
      prompt: 'You are a helpful, friendly assistant.',
    },
    custom: { name: 'Custom', desc: 'Write your own', prompt: '' },
  };

  const KEY = {
    settings: 'ws_settings',
    history: 'ws_history',
    conv: 'ws_conv_',
    visitor: 'ws_visitor',
  };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  const settings = Object.assign({
    provider: 'cloud',
    keys: {},
    models: {},
    customBaseUrl: '',
    persona: 'aurora',
    customPrompt: '',
    aspect: 'portrait',
  }, load(KEY.settings, {}));
  if (!PROVIDERS[settings.provider]) settings.provider = 'cloud';
  if (!PERSONAS[settings.persona]) settings.persona = 'aurora';

  function saveSettings() { save(KEY.settings, settings); }

  function randomId(prefix) {
    return (crypto.randomUUID && crypto.randomUUID()) || (prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  }
  function visitorId() {
    let id = load(KEY.visitor, null);
    if (!id) { id = randomId('v-'); save(KEY.visitor, id); }
    return id;
  }
  const sessionId = randomId('s-');
  function ids() { return { session: sessionId, visitor: visitorId() }; }

  // ── Conversations ──
  let convId = null;
  let messages = []; // {role, content, emotion?}
  let busy = false;
  let abortCtrl = null;

  function historyIndex() {
    const list = load(KEY.history, []);
    return Array.isArray(list) ? list : [];
  }

  function saveConversation() {
    if (!convId || !messages.length) return;
    const list = historyIndex().filter(h => h.id !== convId);
    const first = messages.find(m => m.role === 'user');
    const title = first ? first.content.slice(0, 48) : 'Picture';
    list.unshift({ id: convId, title, updated: Date.now(), count: messages.length, persona: settings.persona });
    save(KEY.history, list.slice(0, 100));
    save(KEY.conv + convId, messages);
  }

  function newConversation() {
    convId = 'c' + Date.now().toString(36);
    messages = [];
    return convId;
  }

  function openConversation(id) {
    const data = load(KEY.conv + id, null);
    if (!Array.isArray(data)) return null;
    convId = id;
    messages = data;
    return messages;
  }

  function deleteConversation(id) {
    const data = load(KEY.conv + id, []);
    if (Array.isArray(data)) data.forEach(m => { if (m.image) Pictures.forget(m.image); });
    save(KEY.history, historyIndex().filter(h => h.id !== id));
    remove(KEY.conv + id);
    if (id === convId) newConversation();
  }

  // ── Requests ──
  function systemPrompt() {
    const p = settings.persona === 'custom' ? settings.customPrompt : PERSONAS[settings.persona].prompt;
    return ((p || '').trim() + '\n\n' + Pictures.CHAT_RULE + '\n\n' + EMOTION_RULE).trim();
  }

  // What the model sees: tags kept on past replies so it keeps the format, and
  // each picture as a "(sent a picture: ...)" note on the reply it belongs to.
  function contextForModel(list) {
    const out = [];
    list.forEach(m => {
      if (m.image) {
        const note = '(sent a picture: ' + (m.prompt || 'a picture') + ')';
        const prev = out[out.length - 1];
        if (prev && prev.role === 'assistant') prev.content += '\n' + note;
        else out.push({ role: 'assistant', content: (m.caption || 'Here, I drew this for you!') + '\n' + note });
        return;
      }
      out.push({ role: m.role, content: m.role === 'assistant' && m.emotion ? '[' + m.emotion + '] ' + m.content : m.content });
    });
    return out;
  }

  // Adds a finished picture to a conversation, which may no longer be the open one.
  // Returns true when it went into the open conversation.
  function addPicture(id, message) {
    if (id === convId) {
      messages.push(message);
      saveConversation();
      return true;
    }
    const data = load(KEY.conv + id, null);
    if (!Array.isArray(data)) return false;
    data.push(message);
    save(KEY.conv + id, data);
    return false;
  }

  function lastReply() {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].content) return messages[i].content;
    }
    return '';
  }

  function modelFor(provider) {
    return (settings.models[provider] || '').trim() || PROVIDERS[provider].defaultModel;
  }

  function buildRequest() {
    const provider = settings.provider;
    const history = contextForModel(messages.slice(-30));
    const body = {
      model: modelFor(provider),
      messages: [{ role: 'system', content: systemPrompt() }].concat(history),
      max_tokens: 600,
      stream: true,
    };
    const headers = { 'Content-Type': 'application/json' };
    let url;
    if (provider === 'cloud') {
      url = CLOUD_URL;
      headers['x-session-id'] = sessionId;
      headers['x-visitor-id'] = visitorId();
      body.client_settings = { app: 'waifu-sprites', persona: settings.persona };
    } else {
      const base = provider === 'custom' ? settings.customBaseUrl : PROVIDERS[provider].baseUrl;
      const key = (settings.keys[provider] || '').trim();
      if (!base) throw new Error('Set the endpoint URL in Settings first.');
      if (!key && provider !== 'custom') throw new Error('Add your ' + PROVIDERS[provider].name + ' key in Settings, or switch back to WaifuAI Cloud.');
      if (!body.model) throw new Error('Set a model name in Settings first.');
      url = base.replace(/\/+$/, '') + '/chat/completions';
      if (key) headers.Authorization = 'Bearer ' + key;
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = location.origin;
        headers['X-Title'] = 'Waifu Sprites';
      }
    }
    return { url, headers, body };
  }

  async function readStream(resp, onDelta) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta;
          if (delta && delta.content) onDelta(delta.content);
        } catch (e) { /* partial or non-JSON line */ }
      }
    }
  }

  const TAG = /^\s*\[([a-z_ ]{2,20})\]\s*/i;

  // Splits a leading emotion tag off the text. pending = the tag may still be arriving.
  function splitTag(text) {
    const m = text.match(TAG);
    if (m) {
      const name = m[1].toLowerCase().trim().replace(' ', '_');
      return { emotion: Sprites.EMOTIONS.includes(name) ? name : null, text: text.slice(m[0].length), pending: false };
    }
    const pending = /^\s*\[[a-z_ ]{0,20}$/i.test(text);
    return { emotion: null, text: pending ? '' : text, pending };
  }

  // Removes what only the app should act on: stray emotion tags, picture notes
  // echoed from the history, and bracketed picture descriptions the model
  // sometimes writes despite being told the picture is drawn separately.
  // While streaming (partial), a bracket still open at the end is held back.
  const PICTURE_WORDS = /draw|paint|sketch|picture|photo|selfie|image|snap/i;
  function clean(text, partial) {
    let t = text
      .replace(/\(sent a picture:[^)\n]*\)?/gi, '')
      .replace(/\s*\[([^\]\n]{0,300})\]/g, (all, inner) =>
        /^[a-z_]{2,20}$/i.test(inner) || PICTURE_WORDS.test(inner) ? ' ' : all);
    if (partial) t = t.replace(/\s*\[[^\]\n]*$/, '');
    return t.replace(/[ \t]{2,}/g, ' ').trim();
  }

  /**
   * Sends text and streams the reply.
   * cb.onEmotion(name) fires as soon as the tag arrives, cb.onText(visibleText)
   * on every chunk, cb.onDone(message) at the end, cb.onError(message) on failure.
   */
  async function send(text, cb) {
    if (busy) return;
    if (!convId) newConversation();
    busy = true;
    messages.push({ role: 'user', content: text });
    saveConversation();

    let raw = '';
    let emotion = null;
    let emotionSent = false;
    try {
      const req = buildRequest();
      abortCtrl = new AbortController();
      const timer = setTimeout(() => abortCtrl.abort(), 90000);
      let resp;
      try {
        resp = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal: abortCtrl.signal });
        if (!resp.ok) {
          let detail = '';
          try { const j = await resp.json(); detail = (j.error && (j.error.message || j.error)) || ''; } catch (e) {}
          if (resp.status === 429) throw new Error('Too many messages right now. Wait a minute and try again.');
          if (resp.status === 401 || resp.status === 403) throw new Error('The provider rejected the key. Check it in Settings.');
          throw new Error('The AI service returned an error (' + resp.status + ')' + (detail ? ': ' + String(detail).slice(0, 160) : '.'));
        }
        await readStream(resp, delta => {
          raw += delta;
          const part = splitTag(raw);
          if (part.pending) return;
          if (!emotionSent) {
            emotionSent = true;
            emotion = part.emotion;
            cb.onEmotion(emotion);
          }
          cb.onText(clean(part.text, true));
        });
      } finally {
        clearTimeout(timer);
      }
      const part = splitTag(raw);
      const reply = clean(part.text, false);
      if (!reply) throw new Error('The reply came back empty. Try again or pick another model.');
      if (!emotionSent) cb.onEmotion(null);
      const message = { role: 'assistant', content: reply, emotion: emotion || Sprites.detectEmotion(reply) };
      messages.push(message);
      saveConversation();
      cb.onDone(message);
    } catch (err) {
      // Drop the unanswered turn so a retry doesn't send it twice.
      if (messages.length && messages[messages.length - 1].role === 'user') messages.pop();
      saveConversation();
      const msg = err.name === 'AbortError' ? 'The reply took too long. Try again.'
        : err instanceof TypeError ? 'Could not reach the AI service. Check your connection' + (settings.provider === 'custom' ? ' and that the endpoint allows browser requests (CORS).' : '.')
        : err.message;
      cb.onError(msg);
    } finally {
      busy = false;
      abortCtrl = null;
    }
  }

  function stop() { if (abortCtrl) abortCtrl.abort(); }

  return {
    PROVIDERS, PERSONAS, settings, saveSettings, modelFor,
    send, stop, ids, addPicture, lastReply, newConversation, openConversation, deleteConversation, historyIndex,
    get messages() { return messages; },
    get convId() { return convId; },
    get busy() { return busy; },
  };
})();
