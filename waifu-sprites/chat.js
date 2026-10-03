/**
 * chat.js: providers, personas, memory, conversation history and streaming.
 *
 * Guests chat through WaifuAI Cloud with no key. Visitors can switch to their
 * own OpenRouter, Groq or any OpenAI-compatible key instead; keys stay in this
 * browser's localStorage and requests go straight from the browser to that
 * provider.
 *
 * Replies start with an emotion tag like "[curious]" that picks the sprite
 * clip. The tag is stripped from what is shown and stored on the message.
 *
 * Messages are {id, role, content, emotion?, romaji?}. A picture is its own
 * assistant message {id, role, image, prompt, caption} (see pictures.js).
 *
 * Memory works like waifu-companion's: once a chat holds more unsummarized
 * messages than the memory size, the oldest are folded into a running summary
 * (ws_mem_<id>: {summary, through}) that goes into the system prompt. The
 * messages stay on screen; only what the model sees changes. "About you" is
 * memory shared by every chat.
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

  // Reply languages. '' follows whatever language the user writes in.
  const LANGUAGES = ['Arabic', 'Bengali', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Czech', 'Dutch', 'English', 'Filipino',
    'French', 'German', 'Greek', 'Hebrew', 'Hindi', 'Hungarian', 'Indonesian', 'Italian', 'Japanese', 'Korean', 'Malay', 'Persian',
    'Polish', 'Portuguese (Brazil)', 'Portuguese (Portugal)', 'Romanian', 'Russian', 'Spanish', 'Swedish', 'Tamil', 'Thai', 'Turkish',
    'Ukrainian', 'Urdu', 'Vietnamese'];

  const SUMMARY_LENGTHS = {
    'ultra-concise': 'Create an ultra-concise one-sentence summary',
    concise: 'Create a single, concise and cohesive summary',
    detailed: 'Create a detailed summary of one or two paragraphs',
    comprehensive: 'Create a comprehensive, in-depth summary of the conversation history',
  };

  const DEFAULT_AMBIENT_PROMPT = '(The user has gone quiet for a while. Continue the conversation naturally, in character: share a thought or a feeling, ' +
    'or ask them something related to what you were talking about. One or two sentences. Speak directly to them.)';

  const KEY = {
    settings: 'ws_settings',
    history: 'ws_history',
    conv: 'ws_conv_',
    mem: 'ws_mem_',
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
    extraPrompt: '',
    aboutUser: '',
    aspect: 'portrait',
    language: '',
    romaji: false,
    includeTime: true,
    includeBattery: false,
    memorySize: 30,
    summaryLength: 'concise',
    autoTitles: true,
    queue: true,
    ambient: false,
    ambientDelay: 60,
    ambientMax: 3,
    ambientPrompt: '',
  }, load(KEY.settings, {}));
  if (!PROVIDERS[settings.provider]) settings.provider = 'cloud';
  if (!PERSONAS[settings.persona]) settings.persona = 'aurora';
  if (!SUMMARY_LENGTHS[settings.summaryLength]) settings.summaryLength = 'concise';

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

  let msgSeq = 0;
  function messageId() { return 'm' + Date.now().toString(36) + (msgSeq++).toString(36); }

  // ── Conversations ──
  let convId = null;
  let messages = [];
  let memory = { summary: '', through: null }; // through = id of the last summarized message
  let busy = false;
  let abortCtrl = null;

  function historyIndex() {
    const list = load(KEY.history, []);
    return Array.isArray(list) ? list : [];
  }

  function saveConversation() {
    if (!convId || !messages.length) return;
    const all = historyIndex();
    const prev = all.find(h => h.id === convId);
    const list = all.filter(h => h.id !== convId);
    const first = messages.find(m => m.role === 'user');
    // A named chat (generated or renamed) keeps its name; others use the first message.
    const title = prev && prev.named ? prev.title : (first ? first.content.slice(0, 48) : 'Picture');
    list.unshift({ id: convId, title, named: Boolean(prev && prev.named), updated: Date.now(), count: messages.length, persona: settings.persona });
    save(KEY.history, list.slice(0, 100));
    save(KEY.conv + convId, messages);
  }

  function saveMemory() {
    if (!convId) return;
    if (memory.summary) save(KEY.mem + convId, memory);
    else remove(KEY.mem + convId);
  }

  function renameConversation(id, title) {
    const list = historyIndex();
    const h = list.find(x => x.id === id);
    if (!h || !title.trim()) return;
    h.title = title.trim().slice(0, 60);
    h.named = true;
    save(KEY.history, list);
  }

  function newConversation() {
    convId = 'c' + Date.now().toString(36);
    messages = [];
    memory = { summary: '', through: null };
    return convId;
  }

  function openConversation(id) {
    const data = load(KEY.conv + id, null);
    if (!Array.isArray(data)) return null;
    convId = id;
    messages = data;
    // Chats saved before memory existed have no message ids.
    if (messages.some(m => !m.id)) {
      messages.forEach(m => { if (!m.id) m.id = messageId(); });
      save(KEY.conv + id, messages);
    }
    const mem = load(KEY.mem + id, null);
    memory = mem && typeof mem.summary === 'string' ? mem : { summary: '', through: null };
    return messages;
  }

  function deleteConversation(id) {
    const data = load(KEY.conv + id, []);
    if (Array.isArray(data)) data.forEach(m => { if (m.image) Pictures.forget(m.image); });
    save(KEY.history, historyIndex().filter(h => h.id !== id));
    remove(KEY.conv + id);
    remove(KEY.mem + id);
    if (id === convId) newConversation();
  }

  function deleteMessage(id) {
    const i = messages.findIndex(m => m.id === id);
    if (i === -1) return;
    const [m] = messages.splice(i, 1);
    if (m.image) Pictures.forget(m.image);
    // Keep the summary boundary on a message that still exists.
    if (memory.through === id) {
      memory.through = i > 0 ? messages[i - 1].id : null;
      saveMemory();
    }
    if (messages.length) saveConversation();
    else deleteConversation(convId);
  }

  // Exports every saved chat as JSON. Pictures kept only in this browser
  // (idb: references) stay behind.
  function exportAll() {
    return {
      app: 'waifu-sprites',
      version: 1,
      exportedAt: new Date().toISOString(),
      aboutUser: settings.aboutUser,
      chats: historyIndex().map(h => ({
        meta: h,
        messages: load(KEY.conv + h.id, []),
        summary: (load(KEY.mem + h.id, null) || {}).summary || '',
      })),
    };
  }

  // ── Memory ──
  // Index of the first message the summary doesn't cover.
  function unsummarizedStart() {
    if (!memory.through) return 0;
    const i = messages.findIndex(m => m.id === memory.through);
    return i === -1 ? 0 : i + 1;
  }

  function memorySize() {
    return Math.min(60, Math.max(6, Number(settings.memorySize) || 30));
  }

  function setSummary(text) {
    memory.summary = (text || '').trim();
    if (!memory.summary) memory.through = null;
    saveMemory();
  }

  function asTranscript(list) {
    return list.map(m => m.image
      ? 'ASSISTANT: (sent a picture: ' + (m.prompt || 'a picture') + ')'
      : m.role.toUpperCase() + ': ' + m.content).join('\n');
  }

  let summarizing = false;
  let summaryFailedAt = 0;

  /**
   * Folds the oldest unsummarized messages into the summary. Automatic runs
   * start once more than the memory size are waiting and keep the newest half;
   * force (the "Summarize now" button) keeps only the last few. Resolves with
   * true when the summary changed. A failure keeps every message and backs off
   * for two minutes.
   */
  async function summarize(force) {
    if (summarizing || (!force && Date.now() - summaryFailedAt < 120000)) return false;
    const start = unsummarizedStart();
    const pending = messages.length - start;
    const keep = force ? 4 : Math.ceil(memorySize() / 2);
    if (pending <= (force ? keep : memorySize())) return false;
    const batch = messages.slice(start, messages.length - keep);
    if (!batch.length) return false;
    const id = convId;
    summarizing = true;
    try {
      const prompt = 'You are a memory compression engine.\nThe following is an existing summary of a conversation:\n"' +
        (memory.summary || 'No previous summary exists.') + '"\n\nThe following are the ' + batch.length +
        ' oldest messages that were just pushed out of memory:\n' + asTranscript(batch) + '\n\n' +
        SUMMARY_LENGTHS[settings.summaryLength] + ' that combines the previous summary and these new messages. ' +
        'Focus on important facts about the user, names, events, promises and the emotional progress of the relationship. ' +
        'Respond ONLY with the new summary text.';
      const summary = await complete([
        { role: 'system', content: 'You summarize conversations concisely.' },
        { role: 'user', content: prompt },
      ], 'summary', 700);
      if (!summary) throw new Error('empty summary');
      if (id !== convId) return false; // the visitor switched chats meanwhile
      memory = { summary, through: batch[batch.length - 1].id };
      saveMemory();
      summaryFailedAt = 0;
      return true;
    } catch (e) {
      summaryFailedAt = Date.now();
      if (force) throw e;
      return false;
    } finally {
      summarizing = false;
    }
  }

  // ── Requests ──
  function personaPrompt() {
    return (settings.persona === 'custom' ? settings.customPrompt : PERSONAS[settings.persona].prompt) || '';
  }

  async function contextLines() {
    const lines = [];
    if (settings.includeTime) {
      lines.push('The current date and time for the user is ' + new Date().toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }) + '.');
    }
    if (settings.includeBattery && navigator.getBattery) {
      try {
        const b = await navigator.getBattery();
        lines.push('The user\'s device battery is at ' + Math.round(b.level * 100) + '% and ' + (b.charging ? 'charging' : 'not charging') + '.');
      } catch (e) {}
    }
    return lines;
  }

  async function systemPrompt() {
    const parts = [personaPrompt().trim()];
    if (settings.extraPrompt.trim()) parts.push('Additional personality instructions: ' + settings.extraPrompt.trim());
    if (settings.aboutUser.trim()) parts.push('What the user has told you about themselves (always keep it in mind): ' + settings.aboutUser.trim());
    if (memory.summary) parts.push('Summary of your conversation with the user so far: ' + memory.summary);
    parts.push(...await contextLines());
    parts.push(settings.language
      ? 'Reply in ' + settings.language + ', unless the user asks you to speak another language; then switch. Never mix languages in one reply.'
      : 'Reply in the language of the user\'s latest message, and never mix languages in one reply. If they ask you to switch languages, do so.');
    parts.push(Pictures.CHAT_RULE, EMOTION_RULE);
    return parts.filter(Boolean).join('\n\n');
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

  // The messages the model gets after the system prompt: what the summary
  // doesn't cover, capped at the memory size.
  function recentForModel() {
    return contextForModel(messages.slice(unsummarizedStart()).slice(-memorySize()));
  }

  async function modelMessages(extraUserTurn) {
    const out = [{ role: 'system', content: await systemPrompt() }].concat(recentForModel());
    if (extraUserTurn) out.push({ role: 'user', content: extraUserTurn });
    return out;
  }

  // Adds a finished picture to a conversation, which may no longer be the open one.
  // Returns true when it went into the open conversation.
  function addPicture(id, message) {
    message.id = message.id || messageId();
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

  // purpose: chat, ambient, summary, title or translate. WaifuAI Cloud logs
  // each kind apart; side calls carry no client settings.
  function buildRequest(msgs, purpose, stream, maxTokens) {
    const provider = settings.provider;
    const body = { model: modelFor(provider), messages: msgs, max_tokens: maxTokens || 600, stream };
    const headers = { 'Content-Type': 'application/json' };
    let url;
    if (provider === 'cloud') {
      url = CLOUD_URL;
      headers['x-session-id'] = sessionId;
      headers['x-visitor-id'] = visitorId();
      if (purpose !== 'chat') headers['X-Waifu-Purpose'] = purpose;
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

  // One non-streaming call for the side jobs (summary, title, romaji). Resolves with the text.
  async function complete(msgs, purpose, maxTokens) {
    const req = buildRequest(msgs, purpose, false, maxTokens || 300);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    try {
      const resp = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal: ctrl.signal });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      return String(data.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    } finally {
      clearTimeout(timer);
    }
  }

  // Names a chat in a few words from its first messages, unless it already has a name.
  async function generateTitle(id) {
    const h = historyIndex().find(x => x.id === id);
    if (!h || h.named || id !== convId) return null;
    const text = messages.filter(m => !m.image).slice(0, 6)
      .map(m => (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content.slice(0, 150)).join('\n');
    if (!text) return null;
    try {
      let title = await complete([
        { role: 'system', content: 'Generate a very short title (3-6 words) that summarizes the topic of this conversation, in the conversation\'s language. Reply with ONLY the title, no quotes or punctuation.' },
        { role: 'user', content: text },
      ], 'title', 30);
      title = title.split('\n')[0].replace(/^["'\s*#]+|["'.\s*]+$/g, '').slice(0, 48);
      if (!title) return null;
      renameConversation(id, title);
      return title;
    } catch (e) {
      return null;
    }
  }

  const KANA = /[぀-ヿ]/;
  const HANGUL = /[가-힯]/;
  function needsRomaji(text) { return KANA.test(text) || HANGUL.test(text); }

  // Latin-letter reading of a Japanese or Korean reply, stored on the message.
  async function romanize(message) {
    const lang = KANA.test(message.content) ? 'Japanese' : 'Korean';
    const how = lang === 'Japanese' ? 'Romaji' : 'Revised Romanization';
    const text = await complete([
      { role: 'system', content: 'Provide a ' + how + ' transliteration of the following ' + lang + ' text. Respond ONLY with the transliterated text, nothing else.' },
      { role: 'user', content: message.content },
    ], 'translate', 400);
    if (!text) return null;
    message.romaji = text;
    if (messages.includes(message)) saveConversation();
    return text;
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
      .replace(/<think>[\s\S]*?(<\/think>|$)/gi, '')
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
   * opts.ambient: text is an instruction for an unprompted message, sent but
   * never stored or shown.
   */
  async function send(text, cb, opts = {}) {
    if (busy) return;
    if (!convId) newConversation();
    busy = true;
    const ambient = Boolean(opts.ambient);
    if (!ambient) {
      messages.push({ id: messageId(), role: 'user', content: text });
      saveConversation();
    }

    let raw = '';
    let emotion = null;
    let emotionSent = false;
    try {
      const req = buildRequest(await modelMessages(ambient ? text : null), ambient ? 'ambient' : 'chat', true, 600);
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
          const part = splitTag(raw.replace(/^\s*<think>[\s\S]*?(<\/think>\s*|$)/i, ''));
          if (part.pending) return;
          const visible = clean(part.text, true);
          if (!emotionSent) {
            if (!part.emotion && !visible) return; // still inside a <think> block
            emotionSent = true;
            emotion = part.emotion;
            cb.onEmotion(emotion);
          }
          cb.onText(visible);
        });
      } finally {
        clearTimeout(timer);
      }
      const part = splitTag(raw.replace(/^\s*<think>[\s\S]*?(<\/think>\s*|$)/i, ''));
      const reply = clean(part.text, false);
      if (!reply) throw new Error('The reply came back empty. Try again or pick another model.');
      if (!emotionSent) cb.onEmotion(null);
      const message = { id: messageId(), role: 'assistant', content: reply, emotion: emotion || Sprites.detectEmotion(reply) };
      if (ambient) message.ambient = true;
      messages.push(message);
      saveConversation();
      cb.onDone(message);
    } catch (err) {
      // Drop the unanswered turn so a retry doesn't send it twice.
      if (!ambient && messages.length && messages[messages.length - 1].role === 'user') messages.pop();
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
    PROVIDERS, PERSONAS, LANGUAGES, SUMMARY_LENGTHS, DEFAULT_AMBIENT_PROMPT, settings, saveSettings, modelFor,
    send, stop, ids, addPicture, lastReply, newConversation, openConversation, deleteConversation, deleteMessage,
    renameConversation, historyIndex, exportAll, summarize, setSummary, generateTitle, needsRomaji, romanize, modelMessages,
    unsummarizedStart,
    get messages() { return messages; },
    get summary() { return memory.summary; },
    get convId() { return convId; },
    get busy() { return busy; },
  };
})();
