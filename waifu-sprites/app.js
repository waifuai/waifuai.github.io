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

  const RETURN_TO_IDLE_MS = 12000;
  const SLEEP_AFTER_MS = 3 * 60 * 1000;
  const STARTERS = window.WaifuSpritesEmbed
    ? ['Hi!', 'Tell me something fun', 'Send me a selfie', 'Help me focus']
    : ['Hi! How is your day going?', 'Tell me something fun', 'Send me a selfie', 'Help me focus on my work'];

  Sprites.init(Array.from(document.querySelectorAll('.sprite')), $('spriteLabel'));

  // Analytics events use waifu-companion's names so both apps share GA reports;
  // app_source (and the page path) tells them apart.
  function track(name, params) {
    if (typeof gtag === 'function') gtag('event', name, Object.assign({ app_source: 'waifu-sprites' }, params));
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
    if (ambientTimer) scheduleAmbient(); // the visitor is around: restart the quiet countdown
  }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, activity, { passive: true }));
  // Sound is only allowed after a gesture, so every click or key unlocks it.
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, Speech.unlock, { passive: true }));

  input.addEventListener('input', () => {
    if (Chat.busy) return;
    clearTimeout(idleTimer);
    if (input.value.trim() && Sprites.current.name !== 'listening') Sprites.setState('listening');
    if (!input.value.trim()) later(() => Sprites.setState('idle'), 4000);
  });

  // ── Display settings ──
  const DISPLAY_KEY = window.WaifuSpritesEmbed ? 'ws_embed_display' : 'ws_display';
  let display = { opacity: 0.55, fontSize: 15, hideVideo: false, hideChat: false, voiceAutoSend: true, clock: false, radioVolume: 0.3 };
  try { display = Object.assign(display, JSON.parse(localStorage.getItem(DISPLAY_KEY) || '{}')); } catch (e) {}
  function saveDisplay() { try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(display)); } catch (e) {} }
  if (window.WaifuSpritesEmbed) document.addEventListener('visibilitychange', () => {
    Sprites.setVisible(!document.hidden && !display.hideVideo);
  });
  function applyDisplay() {
    stage.style.setProperty('--bubble-alpha', display.opacity);
    stage.style.setProperty('--chat-font', display.fontSize + 'px');
    stage.classList.toggle('no-video', display.hideVideo);
    stage.classList.toggle('chat-hidden', display.hideChat);
    $('chatToggle').setAttribute('aria-pressed', String(display.hideChat));
    $('chatToggle').title = display.hideChat ? 'Show chat' : 'Hide chat';
    Sprites.setVisible(!display.hideVideo);
    $('clock').hidden = !display.clock;
    tickClock();
  }
  function tickClock() {
    if (display.clock) $('clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  setInterval(tickClock, 10000);
  $('opacity').value = display.opacity;
  $('fontSize').value = display.fontSize;
  $('hideVideo').checked = display.hideVideo;
  $('showClock').checked = display.clock;
  $('voiceAutoSend').checked = display.voiceAutoSend;
  $('voiceAutoSend').addEventListener('change', e => { display.voiceAutoSend = e.target.checked; saveDisplay(); });
  $('opacity').addEventListener('input', e => { display.opacity = +e.target.value; applyDisplay(); saveDisplay(); });
  $('fontSize').addEventListener('input', e => { display.fontSize = +e.target.value; applyDisplay(); saveDisplay(); });
  $('hideVideo').addEventListener('change', e => { display.hideVideo = e.target.checked; applyDisplay(); saveDisplay(); track('setting_changed', { setting: 'hide_video', setting_value: e.target.checked }); });
  $('showClock').addEventListener('change', e => { display.clock = e.target.checked; applyDisplay(); saveDisplay(); track('setting_changed', { setting: 'show_clock', setting_value: e.target.checked }); });
  $('chatToggle').addEventListener('click', () => { display.hideChat = !display.hideChat; applyDisplay(); saveDisplay(); track('setting_changed', { setting: 'hide_chat', setting_value: display.hideChat }); });
  applyDisplay();

  // ── Radio ──
  let radio = null;
  const radioBtn = $('radioBtn');
  function applyRadio() {
    const on = radio && !radio.paused;
    radioBtn.innerHTML = on ? '&#9208; Pause radio' : '&#9654; Play anime radio';
    radioBtn.setAttribute('aria-pressed', String(Boolean(on)));
  }
  radioBtn.addEventListener('click', () => {
    if (!radio) {
      radio = new Audio('https://listen.moe/stream');
      radio.volume = display.radioVolume;
      ['play', 'pause', 'ended', 'error'].forEach(ev => radio.addEventListener(ev, applyRadio));
    }
    if (radio.paused) {
      radio.play().catch(() => bubble('error', "Couldn't start the radio. Try again in a moment."));
      track('radio_toggle', { action: 'play' });
    } else {
      radio.pause();
      track('radio_toggle', { action: 'pause' });
    }
  });
  $('radioVolume').value = display.radioVolume;
  $('radioVolume').addEventListener('input', e => {
    display.radioVolume = +e.target.value;
    if (radio) radio.volume = display.radioVolume;
    saveDisplay();
  });

  // ── Her voice ──
  const speakToggle = $('speakToggle');
  function applySpeech() {
    const on = Speech.settings.enabled;
    speakToggle.setAttribute('aria-pressed', String(on));
    speakToggle.innerHTML = on ? '&#128266;' : '&#128263;';
    speakToggle.title = on ? 'Mute her voice' : 'Read replies aloud';
    $('speakEnabled').checked = on;
    $('speakAutoLang').checked = Speech.settings.autoLang;
    $('speakVolume').value = Speech.settings.volume;
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
  $('speakVolume').addEventListener('change', e => { Speech.settings.volume = +e.target.value; Speech.save(); });
  $('voiceSelect').addEventListener('change', e => {
    Speech.settings.voiceId = e.target.value;
    Speech.save();
    track('voice_changed', { voice_id: e.target.value });
    Speech.speak('Hi! This is how I sound.'); // a sample of the new voice
  });
  applySpeech();

  // Reads a reply aloud and keeps her emotion on screen until it ends.
  // Resolves when she's done talking (at once when her voice is off).
  function speakReply(text, force) {
    if (!Speech.settings.enabled && !force) return Promise.resolve();
    return Speech.speak(text, {
      force,
      onStart() { clearTimeout(idleTimer); },
      onPlay(info) { if (!force) track('tts_played', info); },
      onEnd() { later(() => Sprites.setState('idle'), 4000); },
    });
  }

  // ── Messages ──
  function scrollDown() { messagesEl.scrollTop = messagesEl.scrollHeight; }

  function bubble(role, text) {
    const el = document.createElement('div');
    el.className = 'msg ' + role;
    const span = document.createElement('span');
    span.className = 'text';
    span.textContent = text;
    el.appendChild(span);
    messagesEl.appendChild(el);
    scrollDown();
    return el;
  }
  function setText(el, text) { el.querySelector('.text').textContent = text; }

  function showRomaji(el, text) {
    let r = el.querySelector('.romaji');
    if (!r) {
      r = document.createElement('div');
      r.className = 'romaji';
      el.insertBefore(r, el.querySelector('.actions'));
    }
    r.textContent = text;
    scrollDown();
  }

  function actionButton(label, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = label;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.addEventListener('click', e => { e.stopPropagation(); onClick(b); });
    return b;
  }

  // Replay, copy and delete on a finished message. Shown on hover, or on tap on touch screens.
  function addActions(el, message) {
    el.dataset.id = message.id;
    const bar = document.createElement('div');
    bar.className = 'actions';
    if (message.role === 'assistant' && message.content) {
      bar.appendChild(actionButton('&#128266;', 'Read aloud', () => {
        track('tts_action', { action: 'play', source: 'message' });
        speakReply(message.content, true);
      }));
    }
    if (message.content) {
      bar.appendChild(actionButton('&#128203;', 'Copy', b => {
        navigator.clipboard && navigator.clipboard.writeText(message.content).then(() => {
          b.innerHTML = '&#10003;';
          setTimeout(() => { b.innerHTML = '&#128203;'; }, 1500);
        });
        track('message_copied');
      }));
    }
    bar.appendChild(actionButton('&#128465;', 'Delete', () => {
      if (Chat.busy) return;
      Chat.deleteMessage(message.id);
      el.remove();
      track('message_deleted');
      placeMemoryMark();
      if (!Chat.messages.length) renderConversation();
    }));
    el.appendChild(bar);
    el.addEventListener('click', e => {
      if (e.target.closest('a, img') || !matchMedia('(hover: none)').matches) return;
      messagesEl.querySelectorAll('.msg.show-actions').forEach(m => { if (m !== el) m.classList.remove('show-actions'); });
      el.classList.toggle('show-actions');
    });
  }

  function messageBubble(message) {
    const el = bubble(message.role, message.content);
    if (message.romaji) showRomaji(el, message.romaji);
    addActions(el, message);
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
    if (message.id) addActions(fig, message);
    scrollDown();
    return fig;
  }

  // A divider above the first message the model still sees word for word;
  // everything above it reaches her as the summary.
  function placeMemoryMark() {
    messagesEl.querySelectorAll('.memory-mark').forEach(el => el.remove());
    if (!Chat.summary) return;
    const first = Chat.messages[Chat.unsummarizedStart()];
    const target = first && messagesEl.querySelector('[data-id="' + first.id + '"]');
    const mark = document.createElement('button');
    mark.type = 'button';
    mark.className = 'memory-mark';
    mark.textContent = 'Older messages are remembered as a summary';
    mark.title = 'See or edit what she remembers';
    mark.addEventListener('click', () => openPanel('settingsPanel', 'summaryText'));
    if (target) messagesEl.insertBefore(mark, target);
  }

  function renderConversation() {
    Speech.stop();
    stopAmbient();
    clearQueue();
    messagesEl.textContent = '';
    if (!Chat.messages.length) renderEmpty();
    else Chat.messages.forEach(m => (m.image ? pictureBubble(m) : messageBubble(m)));
    placeMemoryMark();
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

  // ── Queue ──
  // Messages typed while she's replying wait their turn, as in waifu-companion.
  let queue = []; // {text, source, el}
  function clearQueue() {
    queue.forEach(q => q.el.remove());
    queue = [];
  }
  function enqueue(text, source) {
    input.value = '';
    const el = bubble('user queued', text);
    queue.push({ text, source, el });
  }

  // ── Ambient: she speaks up when the visitor goes quiet ──
  let ambientTimer = null;
  let ambientRun = 0; // unprompted messages since the visitor last wrote
  function stopAmbient() {
    clearTimeout(ambientTimer);
    ambientTimer = null;
  }
  function scheduleAmbient() {
    stopAmbient();
    const s = Chat.settings;
    if (!s.ambient || !Chat.messages.length || ambientRun >= s.ambientMax) return;
    ambientTimer = setTimeout(fireAmbient, Math.max(15, s.ambientDelay) * 1000);
  }
  function fireAmbient() {
    ambientTimer = null;
    const panelOpen = Array.from(document.querySelectorAll('.panel')).some(p => !p.hidden);
    // Not while she's busy or talking, or the visitor is typing or away.
    if (Chat.busy || queue.length || Speech.speaking || input.value.trim() || panelOpen || document.hidden) {
      scheduleAmbient();
      return;
    }
    ambientRun++;
    runTurn({ ambient: true });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ambientTimer) scheduleAmbient(); });

  // ── Sending ──
  // source: typed, starter, voice, retry or queued
  function send(text, source = 'typed') {
    text = (text || '').trim();
    if (!text) return;
    if (/^\/(image|img)\b/i.test(text)) { imageCommand(text); return; }
    if (Chat.busy) {
      if (Chat.settings.queue) enqueue(text, source);
      return;
    }
    input.value = '';
    runTurn({ text, source });
  }

  // One exchange: a visitor message (or an ambient nudge) and her streamed reply.
  async function runTurn({ text, source, ambient, el }) {
    Speech.stop();
    stopAmbient();
    if (!ambient) ambientRun = 0;
    // Whether this turn wants a picture is decided alongside the reply.
    const pictureDecision = ambient ? Promise.resolve(null) : Pictures.decide(text, Chat.lastReply(), Chat.ids());
    messagesEl.querySelectorAll('.starters, .msg.info:not(.keep), .msg.error').forEach(m => m.remove());
    let userEl = el;
    if (userEl) {
      userEl.classList.remove('queued');
      messagesEl.appendChild(userEl); // below anything that arrived while it waited
    } else if (!ambient) {
      userEl = bubble('user', text);
    }
    const reply = bubble('assistant typing', '');
    stage.classList.add('busy');
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
    if (ambient) {
      track('ambient_message', { provider, persona: Chat.settings.persona, run: ambientRun });
    } else {
      track('chat_message_sent', { provider, persona: Chat.settings.persona, source, turn: Chat.messages.filter(m => m.role === 'user').length + 1 });
    }
    track('llm_request_started', { provider, model, is_streaming: true });

    let tagged = false;
    let done = null;
    await Chat.send(ambient ? (Chat.settings.ambientPrompt.trim() || Chat.DEFAULT_AMBIENT_PROMPT) : text, {
      onEmotion(name) {
        firstChunk();
        tagged = !!name;
        if (name) Sprites.setEmotion(name);
        else Sprites.setState('speaking');
      },
      onText(visible) {
        firstChunk();
        setText(reply, visible);
        scrollDown();
      },
      onDone(message) {
        done = message;
        reply.classList.remove('typing');
        setText(reply, message.content);
        addActions(reply, message);
        if (userEl) {
          const sent = Chat.messages[Chat.messages.length - 2];
          if (sent && sent.role === 'user' && !userEl.dataset.id) addActions(userEl, sent);
        }
        if (!tagged && message.emotion) Sprites.setEmotion(message.emotion);
        track('llm_stream_completed', { provider, model, success: true, total_time_ms: Date.now() - startedAt, reply_chars: message.content.length, emotion: message.emotion || '(none)' });
        later(() => Sprites.setState('idle'), RETURN_TO_IDLE_MS);
        scrollDown();
      },
      onError(msg) {
        track('llm_stream_completed', { provider, model, success: false, total_time_ms: Date.now() - startedAt });
        reply.remove();
        if (ambient) { // nobody asked, so fail quietly
          Sprites.setState('idle');
          return;
        }
        const errEl = bubble('error', msg);
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry';
        retry.addEventListener('click', () => {
          if (Chat.busy) return;
          errEl.remove();
          if (userEl) userEl.remove();
          runTurn({ text, source: 'retry' });
        });
        errEl.appendChild(retry);
        Sprites.setState('error');
        later(() => Sprites.setState('idle'), 5000);
      },
    }, { ambient });
    stage.classList.remove('busy');
    if (matchMedia('(pointer: fine)').matches && !ambient) input.focus();

    const spoken = done ? speakReply(done.content) : Promise.resolve();
    if (done) afterReply(done, reply);

    // No picture when the reply failed: a retry asks again.
    pictureDecision.then(prompt => { if (done && prompt) paint(prompt, aspectValue(Chat.settings.aspect), 'auto'); });

    if (queue.length) {
      const next = queue.shift();
      runTurn({ text: next.text, source: 'queued', el: next.el });
      return;
    }
    // The quiet countdown starts once she has finished talking.
    if (done) spoken.then(() => { if (!Chat.busy && !queue.length) scheduleAmbient(); });
  }

  // Background jobs after a reply: romaji, the chat's name, and memory.
  function afterReply(message, el) {
    const s = Chat.settings;
    if (s.romaji && Chat.needsRomaji(message.content)) {
      Chat.romanize(message).then(t => { if (t && el.isConnected) showRomaji(el, t); }).catch(() => {});
    }
    const meta = Chat.historyIndex().find(h => h.id === Chat.convId);
    if (s.autoTitles && meta && !meta.named && Chat.messages.length >= 2) {
      Chat.generateTitle(Chat.convId).then(t => { if (t && !$('historyPanel').hidden) renderHistory(); });
    }
    Chat.summarize(false).then(changed => {
      if (!changed) return;
      track('memory_summarized', { source: 'auto' });
      placeMemoryMark();
      if (!$('settingsPanel').hidden) $('summaryText').value = Chat.summary;
    });
  }

  // Player Card hosts can disallow native form submission in their sandbox.
  // Use the same direct send path as starter buttons for click and Enter.
  $('sendBtn').addEventListener('click', () => send(input.value));
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    send(input.value);
  });
  $('composer').addEventListener('submit', e => { e.preventDefault(); send(input.value); });

  // ── Voice ──
  const micBtn = $('micBtn');
  const PLACEHOLDERS = { idle: 'Say something...', starting: 'Starting the mic...', listening: 'Listening... release or tap to stop', transcribing: 'Transcribing...' };
  Voice.init(micBtn, {
    ids: Chat.ids,
    onState(state) {
      micBtn.dataset.state = state;
      input.placeholder = PLACEHOLDERS[state] || PLACEHOLDERS.idle;
      if (state === 'starting') { Speech.stop(); stopAmbient(); } // don't record her own voice
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
      if (display.voiceAutoSend && (!Chat.busy || Chat.settings.queue)) {
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
  function openPanel(id, focusId) {
    document.querySelectorAll('.panel').forEach(p => { p.hidden = p.id !== id || (!focusId && !p.hidden); });
    if (id === 'historyPanel') renderHistory();
    if (id === 'settingsPanel') renderSettings();
    if (!$(id).hidden) {
      track(id === 'settingsPanel' ? 'settings_opened' : 'history_opened', { source: focusId ? 'memory_mark' : 'user' });
      if (focusId) { $(focusId).scrollIntoView({ block: 'center' }); $(focusId).focus(); }
    }
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
      const rename = document.createElement('button');
      rename.type = 'button';
      rename.className = 'history-del';
      rename.title = 'Rename chat';
      rename.setAttribute('aria-label', 'Rename chat: ' + h.title);
      rename.innerHTML = '&#9998;';
      rename.addEventListener('click', () => {
        const name = prompt('Name this chat', h.title);
        if (name && name.trim()) { Chat.renameConversation(h.id, name); renderHistory(); }
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
      row.append(open, rename, del);
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

  $('exportChats').addEventListener('click', () => {
    const data = Chat.exportAll();
    if (!data.chats.length) { alert('No chats to export yet.'); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'waifu-sprites-chats-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    track('settings_action', { action: 'export_chats' });
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
    $('extraPrompt').value = s.extraPrompt;

    $('aboutUser').value = s.aboutUser;
    $('summaryText').value = Chat.summary;
    $('summaryStatus').textContent = '';
    $('memorySize').value = s.memorySize;
    $('memorySizeValue').textContent = s.memorySize;
    $('summaryLength').value = s.summaryLength;
    $('includeTime').checked = s.includeTime;
    $('includeBattery').checked = s.includeBattery;
    $('batteryRow').hidden = !navigator.getBattery;
    $('contextPeek').open = false;

    $('replyLanguage').value = s.language;
    $('romaji').checked = s.romaji;
    $('queueMessages').checked = s.queue;
    $('autoTitles').checked = s.autoTitles;
    $('ambient').checked = s.ambient;
    $('ambientBox').hidden = !s.ambient;
    $('ambientDelay').value = String(s.ambientDelay);
    $('ambientMax').value = String(s.ambientMax);
    $('ambientPrompt').value = s.ambientPrompt || Chat.DEFAULT_AMBIENT_PROMPT;

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

  Chat.LANGUAGES.forEach(name => $('replyLanguage').appendChild(new Option(name, name)));

  // Saves a settings control into Chat.settings. kind: text, check, number or select.
  function bindSetting(id, key, kind, after) {
    const el = $(id);
    const ev = kind === 'text' ? 'input' : 'change';
    el.addEventListener(ev, () => {
      const s = Chat.settings;
      s[key] = kind === 'check' ? el.checked : kind === 'number' ? +el.value : el.value;
      Chat.saveSettings();
      if (kind !== 'text') track('setting_changed', { setting: key, setting_value: String(s[key]) });
      if (after) after(s[key]);
    });
  }
  bindSetting('customPrompt', 'customPrompt', 'text');
  bindSetting('extraPrompt', 'extraPrompt', 'text');
  bindSetting('aboutUser', 'aboutUser', 'text');
  bindSetting('memorySize', 'memorySize', 'number', v => { $('memorySizeValue').textContent = v; });
  $('memorySize').addEventListener('input', e => { $('memorySizeValue').textContent = e.target.value; });
  bindSetting('summaryLength', 'summaryLength', 'select');
  bindSetting('includeTime', 'includeTime', 'check');
  bindSetting('includeBattery', 'includeBattery', 'check');
  bindSetting('replyLanguage', 'language', 'select');
  bindSetting('romaji', 'romaji', 'check');
  bindSetting('queueMessages', 'queue', 'check');
  bindSetting('autoTitles', 'autoTitles', 'check');
  bindSetting('ambient', 'ambient', 'check', on => {
    $('ambientBox').hidden = !on;
    ambientRun = 0;
    if (on) scheduleAmbient(); else stopAmbient();
  });
  bindSetting('ambientDelay', 'ambientDelay', 'number', () => { if (ambientTimer) scheduleAmbient(); });
  bindSetting('ambientMax', 'ambientMax', 'number');
  bindSetting('ambientPrompt', 'ambientPrompt', 'text');

  $('summaryText').addEventListener('change', e => { Chat.setSummary(e.target.value); placeMemoryMark(); });
  $('summarizeNow').addEventListener('click', async () => {
    const btn = $('summarizeNow');
    const status = $('summaryStatus');
    if (Chat.messages.length <= 4) { status.textContent = 'Chat a little more first.'; return; }
    btn.disabled = true;
    status.textContent = 'Summarizing...';
    try {
      const changed = await Chat.summarize(true);
      status.textContent = changed ? 'Updated.' : 'Nothing new to summarize.';
      if (changed) {
        track('manual_summary_triggered');
        $('summaryText').value = Chat.summary;
        placeMemoryMark();
      }
    } catch (e) {
      status.textContent = "Couldn't summarize right now. Try again later.";
    } finally {
      btn.disabled = false;
    }
  });
  $('contextPeek').addEventListener('toggle', async () => {
    if (!$('contextPeek').open) return;
    const msgs = await Chat.modelMessages(null);
    $('contextView').textContent = msgs.map(m => m.role.toUpperCase() + ':\n' + m.content).join('\n\n');
  });

  $('baseUrl').addEventListener('change', e => { Chat.settings.customBaseUrl = e.target.value.trim(); Chat.saveSettings(); });
  $('apiKey').addEventListener('change', e => { Chat.settings.keys[Chat.settings.provider] = e.target.value.trim(); Chat.saveSettings(); });
  $('modelName').addEventListener('change', e => { Chat.settings.models[Chat.settings.provider] = e.target.value.trim(); Chat.saveSettings(); renderMeta(); });

  // ── Start: reopen the most recent chat ──
  const recent = Chat.historyIndex()[0];
  if (!(recent && Chat.openConversation(recent.id))) Chat.newConversation();
  renderConversation();
  activity();
})();
