/**
 * app.js: wires the sprite player and the chat engine to the page.
 *
 * Sprite flow: listening while the visitor types, thinking while the reply is
 * on its way, the reply's emotion as soon as its tag arrives, back to idle a
 * while after, and sleeping after a few minutes without activity.
 */
(() => {
  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const messagesEl = $('messages');
  const input = $('msgInput');
  const sendBtn = $('sendBtn');

  const RETURN_TO_IDLE_MS = 12000;
  const SLEEP_AFTER_MS = 3 * 60 * 1000;
  const STARTERS = ['Hi! How is your day going?', 'Tell me something fun', 'Send me a selfie', 'Help me focus on my work'];

  Sprites.init(Array.from(document.querySelectorAll('.sprite')), $('spriteLabel'));

  // Analytics events use waifu-companion's names so both apps share GA reports;
  // the app parameter (and the page path) tells them apart.
  function track(name, params) {
    if (typeof gtag === 'function') gtag('event', name, Object.assign({ app: 'waifu-sprites' }, params));
  }

  // ── Sprite timing ──
  let idleTimer = null;
  let sleepTimer = null;

  function later(fn, ms) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(fn, ms);
  }
  function activity() {
    clearTimeout(sleepTimer);
    if (Sprites.current.name === 'sleeping') Sprites.setState('idle');
    sleepTimer = setTimeout(() => { if (!Chat.busy) Sprites.setState('sleeping'); }, SLEEP_AFTER_MS);
  }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, activity, { passive: true }));
  // Sound is only allowed after a gesture, so every click or key unlocks it.
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, Speech.unlock, { passive: true }));
  activity();

  input.addEventListener('input', () => {
    if (Chat.busy) return;
    clearTimeout(idleTimer);
    if (input.value.trim() && Sprites.current.name !== 'listening') Sprites.setState('listening');
    if (!input.value.trim()) later(() => Sprites.setState('idle'), 4000);
  });

  // ── Display settings ──
  const DISPLAY_KEY = 'ws_display';
  let display = { opacity: 0.55, fontSize: 15, hideVideo: false, hideChat: false, voiceAutoSend: true };
  try { display = Object.assign(display, JSON.parse(localStorage.getItem(DISPLAY_KEY) || '{}')); } catch (e) {}
  function saveDisplay() { try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(display)); } catch (e) {} }
  function applyDisplay() {
    stage.style.setProperty('--bubble-alpha', display.opacity);
    stage.style.setProperty('--chat-font', display.fontSize + 'px');
    stage.classList.toggle('no-video', display.hideVideo);
    stage.classList.toggle('chat-hidden', display.hideChat);
    $('chatToggle').setAttribute('aria-pressed', String(display.hideChat));
    $('chatToggle').title = display.hideChat ? 'Show chat' : 'Hide chat';
    Sprites.setVisible(!display.hideVideo);
  }
  $('opacity').value = display.opacity;
  $('fontSize').value = display.fontSize;
  $('hideVideo').checked = display.hideVideo;
  $('voiceAutoSend').checked = display.voiceAutoSend;
  $('voiceAutoSend').addEventListener('change', e => { display.voiceAutoSend = e.target.checked; saveDisplay(); });
  $('opacity').addEventListener('input', e => { display.opacity = +e.target.value; applyDisplay(); saveDisplay(); });
  $('fontSize').addEventListener('input', e => { display.fontSize = +e.target.value; applyDisplay(); saveDisplay(); });
  $('hideVideo').addEventListener('change', e => { display.hideVideo = e.target.checked; applyDisplay(); saveDisplay(); track('setting_changed', { setting: 'hide_video', setting_value: e.target.checked }); });
  $('chatToggle').addEventListener('click', () => { display.hideChat = !display.hideChat; applyDisplay(); saveDisplay(); track('setting_changed', { setting: 'hide_chat', setting_value: display.hideChat }); });
  applyDisplay();

  // ── Her voice ──
  const speakToggle = $('speakToggle');
  function applySpeech() {
    const on = Speech.settings.enabled;
    speakToggle.setAttribute('aria-pressed', String(on));
    speakToggle.innerHTML = on ? '&#128266;' : '&#128263;';
    speakToggle.title = on ? 'Mute her voice' : 'Read replies aloud';
    $('speakEnabled').checked = on;
    $('speakAutoLang').checked = Speech.settings.autoLang;
    $('voiceSelect').value = Speech.settings.voiceId;
  }
  (() => {
    const select = $('voiceSelect');
    const groups = {};
    Speech.VOICES.forEach(v => {
      if (!groups[v.group]) {
        groups[v.group] = document.createElement('optgroup');
        groups[v.group].label = v.group;
        select.appendChild(groups[v.group]);
      }
      groups[v.group].appendChild(new Option(v.name, v.id));
    });
  })();
  function setSpeech(on) {
    Speech.settings.enabled = on;
    Speech.save();
    if (!on) Speech.stop();
    applySpeech();
    track('voice_enabled_toggle', { type: 'tiktok', enabled: on });
  }
  speakToggle.addEventListener('click', () => setSpeech(!Speech.settings.enabled));
  $('speakEnabled').addEventListener('change', e => setSpeech(e.target.checked));
  $('speakAutoLang').addEventListener('change', e => { Speech.settings.autoLang = e.target.checked; Speech.save(); });
  $('voiceSelect').addEventListener('change', e => {
    Speech.settings.voiceId = e.target.value;
    Speech.save();
    track('voice_changed', { voice_id: e.target.value });
    Speech.speak('Hi! This is how I sound.'); // a sample of the new voice
  });
  applySpeech();

  // Reads a reply aloud and keeps her emotion on screen until it ends.
  function speakReply(text) {
    if (!Speech.settings.enabled) return;
    Speech.speak(text, {
      onStart() { clearTimeout(idleTimer); },
      onPlay(info) { track('tts_played', info); },
      onEnd() { later(() => Sprites.setState('idle'), 4000); },
    });
  }

  // ── Messages ──
  function scrollDown() { messagesEl.scrollTop = messagesEl.scrollHeight; }

  function bubble(role, text) {
    const el = document.createElement('div');
    el.className = 'msg ' + role;
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollDown();
    return el;
  }

  function renderEmpty() {
    const persona = Chat.PERSONAS[Chat.settings.persona];
    bubble('info', persona.name === 'Custom' ? 'Say hi to start chatting.' : 'Say hi to ' + persona.name + '. She reacts to what she says.');
    const wrap = document.createElement('div');
    wrap.className = 'starters';
    STARTERS.forEach(text => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', () => send(text, 'starter'));
      wrap.appendChild(b);
    });
    messagesEl.appendChild(wrap);
  }

  function pictureBubble(message) {
    const fig = document.createElement('figure');
    fig.className = 'msg assistant pic';
    const img = document.createElement('img');
    img.alt = message.prompt || 'Picture';
    img.title = 'Open full size';
    img.addEventListener('load', scrollDown);
    img.addEventListener('click', () => openLightbox(img.src, img.alt));
    Pictures.resolve(message.image).then(src => {
      if (src) img.src = src;
      else fig.replaceWith(bubble('info', 'This picture is no longer available.'));
    });
    fig.appendChild(img);
    if (message.caption) {
      const cap = document.createElement('figcaption');
      cap.textContent = message.caption;
      fig.appendChild(cap);
    }
    messagesEl.appendChild(fig);
    scrollDown();
    return fig;
  }

  function renderConversation() {
    Speech.stop();
    messagesEl.textContent = '';
    if (!Chat.messages.length) renderEmpty();
    else Chat.messages.forEach(m => (m.image ? pictureBubble(m) : bubble(m.role, m.content)));
    renderMeta();
  }

  // ── Lightbox ──
  const lightbox = $('lightbox');
  function openLightbox(src, alt) {
    $('lightboxImg').src = src;
    $('lightboxImg').alt = alt;
    $('lightboxOpen').href = src;
    lightbox.hidden = false;
  }
  lightbox.addEventListener('click', e => { if (e.target !== $('lightboxOpen')) lightbox.hidden = true; });

  // ── Pictures ──
  // Draws in the background; the result lands in the chat it was asked in,
  // even if the visitor has opened another one meanwhile.
  async function paint(prompt, aspect, source) {
    const origin = Chat.convId;
    const wait = bubble('info keep', 'Painting your picture... \u{1F3A8}');
    if (!Chat.busy) Sprites.setEmotion('planning');
    track('image_generation_started', { source });
    let message = null;
    let failText = null;
    try {
      const ref = await Pictures.draw(prompt, aspect, Chat.ids());
      message = { role: 'assistant', image: ref, prompt, caption: '' };
      track('image_generation_completed', { source });
    } catch (err) {
      track('image_generation_failed', { source, blocked: Boolean(err.blocked), timed_out: Boolean(err.timedOut) });
      failText = err.blocked ? "I can only draw safe-for-work pictures, so I can't make that one. Want something cute instead?"
        : err.timedOut ? 'That one took too long and my brush gave up. Try again?'
        : 'Sorry, my canvas is acting up. Could we try again in a moment?';
    }
    wait.remove();
    const here = Chat.convId === origin;
    if (message) {
      if (Chat.addPicture(origin, message) && here) pictureBubble(message);
    } else if (here) {
      bubble('assistant', failText);
    }
    if (here && !Chat.busy) {
      Sprites.setEmotion(message ? 'found_it' : 'sorry');
      later(() => Sprites.setState('idle'), RETURN_TO_IDLE_MS);
    }
  }

  function aspectValue(name) { return Pictures.ASPECTS[name] || Pictures.ASPECTS.portrait; }

  // "/image a cozy cafe at sunset [portrait|square|landscape]"
  function imageCommand(text) {
    let prompt = text.replace(/^\/(image|img)\b\s*/i, '').trim();
    let aspect = aspectValue(Chat.settings.aspect);
    const m = prompt.match(/\s+(portrait|landscape|square)\s*$/i);
    if (m) {
      aspect = aspectValue(m[1].toLowerCase());
      prompt = prompt.slice(0, m.index).trim();
    }
    input.value = '';
    messagesEl.querySelectorAll('.starters, .msg.info:not(.keep)').forEach(el => el.remove());
    if (!prompt) {
      bubble('info', 'Describe what to draw, like: /image a cozy cafe at sunset. Add portrait, square or landscape at the end to pick the shape.');
      return;
    }
    bubble('user', text);
    paint(prompt, aspect, 'command');
  }

  function renderMeta() {
    const s = Chat.settings;
    const meta = $('chatMeta');
    meta.textContent = '';
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = Chat.PERSONAS[s.persona].name + ' · ' + (s.provider === 'cloud' ? 'WaifuAI Cloud' : Chat.modelFor(s.provider) || Chat.PROVIDERS[s.provider].name);
    b.title = 'Change personality or AI';
    b.addEventListener('click', () => openPanel('settingsPanel'));
    meta.appendChild(b);
  }

  // ── Sending ──
  // source: typed, starter, voice or retry
  async function send(text, source = 'typed') {
    text = (text || '').trim();
    if (!text || Chat.busy) return;
    if (/^\/(image|img)\b/i.test(text)) { imageCommand(text); return; }
    input.value = '';
    Speech.stop();
    // Whether this turn wants a picture is decided alongside the reply.
    const pictureDecision = Pictures.decide(text, Chat.lastReply());
    messagesEl.querySelectorAll('.starters, .msg.info:not(.keep), .msg.error').forEach(el => el.remove());
    bubble('user', text);
    const reply = bubble('assistant typing', '');
    stage.classList.add('busy');
    sendBtn.disabled = true;
    clearTimeout(idleTimer);
    Sprites.setState('thinking');
    const provider = Chat.settings.provider;
    const model = provider === 'cloud' ? 'cloud' : Chat.modelFor(provider) || '';
    const startedAt = Date.now();
    let streaming = false;
    const firstChunk = () => {
      if (streaming) return;
      streaming = true;
      track('llm_stream_started', { provider, model, time_to_first_chunk_ms: Date.now() - startedAt });
    };
    track('chat_message_sent', { provider, persona: Chat.settings.persona, source, turn: Chat.messages.filter(m => m.role === 'user').length + 1 });
    track('llm_request_started', { provider, model, is_streaming: true });

    let tagged = false;
    let replied = false;
    await Chat.send(text, {
      onEmotion(name) {
        firstChunk();
        tagged = !!name;
        if (name) Sprites.setEmotion(name);
        else Sprites.setState('speaking');
      },
      onText(visible) {
        firstChunk();
        reply.textContent = visible;
        scrollDown();
      },
      onDone(message) {
        replied = true;
        reply.classList.remove('typing');
        reply.textContent = message.content;
        if (!tagged && message.emotion) Sprites.setEmotion(message.emotion);
        track('llm_stream_completed', { provider, model, success: true, total_time_ms: Date.now() - startedAt, reply_chars: message.content.length, emotion: message.emotion || '(none)' });
        later(() => Sprites.setState('idle'), RETURN_TO_IDLE_MS);
        speakReply(message.content);
        scrollDown();
      },
      onError(msg) {
        track('llm_stream_completed', { provider, model, success: false, total_time_ms: Date.now() - startedAt });
        reply.remove();
        const el = bubble('error', msg);
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry';
        retry.addEventListener('click', () => { el.remove(); messagesEl.lastElementChild && messagesEl.lastElementChild.classList.contains('user') && messagesEl.lastElementChild.remove(); send(text, 'retry'); });
        el.appendChild(retry);
        Sprites.setState('error');
        later(() => Sprites.setState('idle'), 5000);
      },
    });
    stage.classList.remove('busy');
    sendBtn.disabled = false;
    if (matchMedia('(pointer: fine)').matches) input.focus();
    // No picture when the reply failed: a retry asks again.
    const prompt = await pictureDecision;
    if (replied && prompt) paint(prompt, aspectValue(Chat.settings.aspect), 'auto');
  }

  $('composer').addEventListener('submit', e => { e.preventDefault(); send(input.value); });

  // ── Voice ──
  const micBtn = $('micBtn');
  const PLACEHOLDERS = { idle: 'Say something...', starting: 'Starting the mic...', listening: 'Listening... release or tap to stop', transcribing: 'Transcribing...' };
  Voice.init(micBtn, {
    ids: Chat.ids,
    onState(state) {
      micBtn.dataset.state = state;
      input.placeholder = PLACEHOLDERS[state] || PLACEHOLDERS.idle;
      if (state === 'starting') Speech.stop(); // don't record her own voice
      if (Chat.busy) return;
      if (state === 'listening' || state === 'transcribing') {
        clearTimeout(idleTimer);
        Sprites.setState(state === 'listening' ? 'listening' : 'thinking');
      } else if (state === 'idle' && Sprites.current.name === 'listening') {
        later(() => Sprites.setState('idle'), 1000); // too short to transcribe, or mic failed
      }
    },
    onText(text) {
      track('voice_input_used', { engine: 'proxy' });
      const combined = (input.value.trim() + ' ' + text).trim();
      if (display.voiceAutoSend && !Chat.busy) {
        send(combined, 'voice');
      } else {
        input.value = combined;
        input.focus();
        if (!Chat.busy) later(() => Sprites.setState('idle'), 4000);
      }
    },
    onError(msg) {
      messagesEl.querySelectorAll('.starters').forEach(el => el.remove());
      bubble('error', msg);
      if (!Chat.busy) {
        Sprites.setState('error');
        later(() => Sprites.setState('idle'), 4000);
      }
    },
  });

  // ── Panels ──
  function openPanel(id) {
    document.querySelectorAll('.panel').forEach(p => { p.hidden = p.id !== id || !p.hidden; });
    if (id === 'historyPanel') renderHistory();
    if (id === 'settingsPanel') renderSettings();
    if (!$(id).hidden) track(id === 'settingsPanel' ? 'settings_opened' : 'history_opened', { source: 'user' });
  }
  function closePanels() { document.querySelectorAll('.panel').forEach(p => { p.hidden = true; }); }
  $('settingsBtn').addEventListener('click', () => openPanel('settingsPanel'));
  $('historyBtn').addEventListener('click', () => openPanel('historyPanel'));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closePanels));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanels(); });

  $('newBtn').addEventListener('click', () => {
    if (Chat.busy) return;
    Chat.newConversation();
    renderConversation();
    closePanels();
    track('conversation_new');
    Sprites.setState('idle');
  });

  // ── History ──
  function timeAgo(ms) {
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + ' min ago';
    if (min < 1440) return Math.round(min / 60) + ' h ago';
    return new Date(ms).toLocaleDateString();
  }

  function renderHistory() {
    const list = $('historyList');
    list.textContent = '';
    const items = Chat.historyIndex();
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'note';
      p.textContent = 'No saved chats yet.';
      list.appendChild(p);
      return;
    }
    items.forEach(h => {
      const row = document.createElement('div');
      row.className = 'history-item' + (h.id === Chat.convId ? ' current' : '');
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'history-open';
      const title = document.createElement('span');
      title.textContent = h.title;
      const meta = document.createElement('small');
      const persona = Chat.PERSONAS[h.persona];
      meta.textContent = (persona ? persona.name + ' · ' : '') + h.count + ' messages · ' + timeAgo(h.updated);
      open.append(title, meta);
      open.addEventListener('click', () => {
        if (Chat.busy) return;
        if (Chat.openConversation(h.id)) { renderConversation(); closePanels(); }
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'history-del';
      del.title = 'Delete chat';
      del.setAttribute('aria-label', 'Delete chat: ' + h.title);
      del.textContent = '✕';
      del.addEventListener('click', () => {
        if (Chat.busy && h.id === Chat.convId) return;
        const wasCurrent = h.id === Chat.convId;
        Chat.deleteConversation(h.id);
        if (wasCurrent) renderConversation();
        renderHistory();
      });
      row.append(open, del);
      list.appendChild(row);
    });
  }

  $('clearAll').addEventListener('click', () => {
    if (Chat.busy || !confirm('Delete all saved chats in this browser?')) return;
    Chat.historyIndex().forEach(h => Chat.deleteConversation(h.id));
    Chat.newConversation();
    renderConversation();
    renderHistory();
  });

  // ── Settings ──
  function optionButton(label, desc, checked, onPick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(checked));
    const name = document.createElement('span');
    name.textContent = label;
    const small = document.createElement('small');
    small.textContent = desc;
    b.append(name, small);
    b.addEventListener('click', onPick);
    return b;
  }

  function renderSettings() {
    const s = Chat.settings;
    const personaList = $('personaList');
    personaList.textContent = '';
    personaList.setAttribute('role', 'radiogroup');
    Object.entries(Chat.PERSONAS).forEach(([key, p]) => {
      personaList.appendChild(optionButton(p.name, p.desc, s.persona === key, () => {
        s.persona = key;
        Chat.saveSettings();
        track('persona_updated', { persona: key });
        renderSettings();
        renderMeta();
        if (!Chat.messages.length) renderConversation();
      }));
    });
    $('customPromptBox').hidden = s.persona !== 'custom';
    $('customPrompt').value = s.customPrompt;

    const providerList = $('providerList');
    providerList.textContent = '';
    providerList.setAttribute('role', 'radiogroup');
    Object.entries(Chat.PROVIDERS).forEach(([key, p]) => {
      providerList.appendChild(optionButton(p.name, p.desc, s.provider === key, () => {
        s.provider = key;
        Chat.saveSettings();
        track('llm_provider_changed', { provider: key, enabled: true });
        renderSettings();
        renderMeta();
      }));
    });

    const p = Chat.PROVIDERS[s.provider];
    const own = s.provider !== 'cloud';
    $('baseUrlRow').hidden = s.provider !== 'custom';
    $('keyRow').hidden = !own;
    $('modelRow').hidden = !own;
    $('baseUrl').value = s.customBaseUrl;
    $('apiKey').value = s.keys[s.provider] || '';
    $('modelName').value = s.models[s.provider] || '';
    $('modelName').placeholder = p.defaultModel || 'model-id';
    $('keyLink').hidden = !p.keyUrl;
    if (p.keyUrl) $('keyLink').href = p.keyUrl;
    $('providerNote').textContent = own
      ? 'Your key is saved in this browser only and sent only to ' + (s.provider === 'custom' ? 'your endpoint' : p.name) + '. Pictures and voice still go through WaifuAI Cloud.'
      : 'Free and keyless. Messages go to WaifuAI Cloud to generate replies and may be logged to improve the service.';

    const aspectList = $('aspectList');
    aspectList.textContent = '';
    aspectList.setAttribute('role', 'radiogroup');
    [['portrait', 'Portrait', 'Best for selfies and outfits'], ['square', 'Square', 'Avatars and icons'], ['landscape', 'Landscape', 'Scenes and wallpapers']].forEach(([key, label, desc]) => {
      aspectList.appendChild(optionButton(label, desc, s.aspect === key, () => {
        s.aspect = key;
        Chat.saveSettings();
        renderSettings();
      }));
    });
  }

  $('customPrompt').addEventListener('input', e => { Chat.settings.customPrompt = e.target.value; Chat.saveSettings(); });
  $('baseUrl').addEventListener('change', e => { Chat.settings.customBaseUrl = e.target.value.trim(); Chat.saveSettings(); });
  $('apiKey').addEventListener('change', e => { Chat.settings.keys[Chat.settings.provider] = e.target.value.trim(); Chat.saveSettings(); });
  $('modelName').addEventListener('change', e => { Chat.settings.models[Chat.settings.provider] = e.target.value.trim(); Chat.saveSettings(); renderMeta(); });

  // ── Start: reopen the most recent chat ──
  const recent = Chat.historyIndex()[0];
  if (!(recent && Chat.openConversation(recent.id))) Chat.newConversation();
  renderConversation();
})();
