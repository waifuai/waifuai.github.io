/**
 * speech.js: reads her replies aloud, ported from waifu-companion's TTS.
 *
 * TikTok voices first (the service sends CORS headers, so it is called
 * directly), the browser's own SpeechSynthesis when that fails or when a
 * browser voice is picked. Replies are cleaned for speech (no *actions*, no
 * emoji), split into sentences and grouped into chunks of up to CHUNK_LIMIT
 * characters. While one chunk plays, the next is fetched.
 *
 * Language routing: a reply in Japanese, Korean, German, Indonesian and so on
 * is read by a voice for that language, whichever voice is picked.
 */
const Speech = (() => {
  const TIKTOK_URL = 'https://ottsy.weilbyte.dev/api/generation';
  const CHUNK_LIMIT = 300;
  const CHUNK_GAP_MS = 150;

  // [id, name, language, gender, group]
  const VOICES = [
    ['en_us_001', 'US English (F1)', 'en-US', 'female', 'TikTok'],
    ['en_us_002', 'US English (F2)', 'en-US', 'female', 'TikTok'],
    ['en_female_emotional', 'Emotional (F)', 'en-US', 'female', 'TikTok'],
    ['en_female_f08_warmy_breeze', 'Warmy Breeze (F)', 'en-US', 'female', 'TikTok'],
    ['en_au_001', 'Australian English (F)', 'en-AU', 'female', 'TikTok'],
    ['en_us_006', 'US English (M1)', 'en-US', 'male', 'TikTok'],
    ['en_us_007', 'US English (M2)', 'en-US', 'male', 'TikTok'],
    ['en_us_009', 'US English (M3)', 'en-US', 'male', 'TikTok'],
    ['en_us_010', 'US English (M4)', 'en-US', 'male', 'TikTok'],
    ['en_uk_001', 'UK English (M1)', 'en-GB', 'male', 'TikTok'],
    ['en_uk_003', 'UK English (M2)', 'en-GB', 'male', 'TikTok'],
    ['en_au_002', 'Australian English (M)', 'en-AU', 'male', 'TikTok'],
    ['en_male_narration', 'Narrator', 'en-US', 'male', 'TikTok'],
    ['jp_001', 'Japanese (F1)', 'ja-JP', 'female', 'Other languages'],
    ['jp_003', 'Japanese (F2)', 'ja-JP', 'female', 'Other languages'],
    ['jp_005', 'Japanese (F3)', 'ja-JP', 'female', 'Other languages'],
    ['jp_006', 'Japanese (M)', 'ja-JP', 'male', 'Other languages'],
    ['kr_003', 'Korean (F)', 'ko-KR', 'female', 'Other languages'],
    ['kr_002', 'Korean (M1)', 'ko-KR', 'male', 'Other languages'],
    ['kr_004', 'Korean (M2)', 'ko-KR', 'male', 'Other languages'],
    ['de_001', 'German (F)', 'de-DE', 'female', 'Other languages'],
    ['de_002', 'German (M)', 'de-DE', 'male', 'Other languages'],
    ['fr_001', 'French (M1)', 'fr-FR', 'male', 'Other languages'],
    ['fr_002', 'French (M2)', 'fr-FR', 'male', 'Other languages'],
    ['es_002', 'Spanish ES (M)', 'es-ES', 'male', 'Other languages'],
    ['es_mx_002', 'Spanish MX (M)', 'es-MX', 'male', 'Other languages'],
    ['br_001', 'Portuguese BR (F1)', 'pt-BR', 'female', 'Other languages'],
    ['br_003', 'Portuguese BR (F2)', 'pt-BR', 'female', 'Other languages'],
    ['br_004', 'Portuguese BR (F3)', 'pt-BR', 'female', 'Other languages'],
    ['br_005', 'Portuguese BR (M)', 'pt-BR', 'male', 'Other languages'],
    ['id_001', 'Indonesian (F)', 'id-ID', 'female', 'Other languages'],
    ['en_us_ghostface', 'Ghost Face', 'en-US', 'male', 'Characters'],
    ['en_us_c3po', 'C3PO', 'en-US', 'male', 'Characters'],
    ['en_us_stitch', 'Stitch', 'en-US', 'male', 'Characters'],
    ['en_us_chewbacca', 'Chewbacca', 'en-US', 'male', 'Characters'],
    ['en_us_stormtrooper', 'Stormtrooper', 'en-US', 'male', 'Characters'],
    ['en_us_rocket', 'Rocket', 'en-US', 'male', 'Characters'],
    ['en_male_pirate', 'Pirate', 'en-US', 'male', 'Characters'],
    ['en_male_funny', 'Funny', 'en-US', 'male', 'Characters'],
    ['en_male_m2_xhxs_m03_silly', 'Silly', 'en-US', 'male', 'Characters'],
    ['en_female_f08_salut_damour', 'Salut Damour', 'en-US', 'female', 'Singing'],
    ['en_female_f08_twinkle', 'Twinkle', 'en-US', 'female', 'Singing'],
    ['en_female_ht_f08_glorious', 'Glorious', 'en-US', 'female', 'Singing'],
    ['en_female_ht_f08_wonderful_world', 'Wonderful World', 'en-US', 'female', 'Singing'],
    ['en_male_m03_lobby', 'Lobby', 'en-US', 'male', 'Singing'],
    ['en_male_m03_sunshine_soon', 'Sunshine Soon', 'en-US', 'male', 'Singing'],
    ['browser-female', 'Browser voice (female)', 'en-US', 'female', 'Browser'],
    ['browser-male', 'Browser voice (male)', 'en-US', 'male', 'Browser'],
  ].map(([id, name, language, gender, group]) => ({ id, name, language, gender, group, provider: id.startsWith('browser-') ? 'browser' : 'tiktok' }));

  const byId = id => VOICES.find(v => v.id === id);

  // ── Text preparation (waifu-companion sentence_processor.js) ──
  // Drops whole *multi-word action* spans, keeps single-word emphasis, strips emoji.
  function stripForTTS(text) {
    const emoji = new RegExp('([\\u2700-\\u27BF]|[\\uE000-\\uF8FF]|\\uD83C[\\uDC00-\\uDFFF]|\\uD83D[\\uDC00-\\uDFFF]|[\\u2000-\\u2FFF]|\\uD83E[\\uDD00-\\uDFFF])', 'g');
    return (window.TTSLanguageRouter ? window.TTSLanguageRouter.clean(text) : String(text || ''))
      .replace(/\*\s*[^*\n]*\s[^*\n]*\s*\*/g, ' ')
      .replace(/\*\s*\*/g, ' ')
      .replace(/\*/g, '')
      .replace(emoji, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function splitIntoSentences(text) {
    if (!text) return [];
    const sentences = text.match(/[^.!?…。？！]+[.!?…。？！]?\s*|[^.!?…。？！]+$/g);
    return sentences ? sentences.map(s => s.trim()).filter(Boolean) : [text.trim()];
  }

  function chunksOf(text) {
    const chunks = [];
    let current = '';
    for (const s of splitIntoSentences(stripForTTS(text))) {
      if (current && current.length + s.length > CHUNK_LIMIT) { chunks.push(current); current = s; }
      else current += (current ? ' ' : '') + s;
    }
    if (current) chunks.push(current);
    return chunks;
  }

  // Reply-level language plans; the voice inventory remains local.
  const languageState = window.TTSLanguageRouter ? window.TTSLanguageRouter.create() : null;
  function conversationKey() { return typeof Chat !== 'undefined' ? Chat.convId || 'default' : 'default'; }
  function fingerprint() { return JSON.stringify([settings.voiceId, settings.autoLang]); }
  function prepareRouting(text, force = false, sample = false) {
    return languageState ? languageState.prepare(stripForTTS(text), { key: conversationKey(), voiceId: settings.voiceId, voices: VOICES,
      auto: settings.autoLang && !sample, enabled: settings.enabled || force || sample, fingerprint: fingerprint() }) : null;
  }
  function finishRouting(plan, request, valid = () => true) {
    return plan && languageState ? languageState.settle(plan, request, 'sprites_tts_language_v1', valid) : Promise.resolve(plan);
  }
  function routeVoice(text, voiceId, plan = null) {
    if (!window.TTSLanguageRouter) return { voiceId, lang: null };
    const language = plan ? plan.lang : window.TTSLanguageRouter.analyze(text).lang;
    return window.TTSLanguageRouter.selectVoice(VOICES, voiceId, language, settings.autoLang && (!plan || plan.auto));
  }

  // ── Settings ──
  const KEY = window.WaifuSpritesEmbed ? 'ws_embed_speech' : 'ws_speech';
  function defaultVoice() {
    const base = (navigator.language || 'en').split('-')[0].toLowerCase();
    const local = VOICES.find(v => v.provider === 'tiktok' && v.gender === 'female' && v.language.split('-')[0] === base);
    return local ? local.id : 'en_us_001';
  }
  const settings = { enabled: true, voiceId: '', autoLang: true, volume: 1 };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  if (!byId(settings.voiceId)) settings.voiceId = defaultVoice();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {} }

  // ── Audio ──
  let ctx = null;
  let source = null;
  let runToken = 0;
  let preparing = false;

  // Browsers only allow sound after a user gesture, so the page calls this on clicks and keys.
  function unlock() {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
  }

  async function fetchTikTok(text, voiceId) {
    const res = await fetch(TIKTOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceId }),
    });
    if (!res.ok) throw new Error('TikTok voice HTTP ' + res.status);
    const json = await res.json();
    if (json.success === false) throw new Error(json.error || 'TikTok voice error');
    const data = json.data || json.audio;
    if (!data) throw new Error('TikTok voice returned no audio');
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    unlock();
    return ctx.decodeAudioData(bytes.buffer);
  }

  // Resolves a chunk to something playable without making a sound, so the next
  // chunk can be fetched while this one plays.
  async function resolve(text, plan = null) {
    const voice = byId(settings.voiceId) || byId('en_us_001');
    let routed = routeVoice(text, voice.id, plan);
    if (routed.unsupportedPrimary) {
      if (window.speechSynthesis && !speechSynthesis.getVoices().length) {
        await new Promise(done => { const timer = setTimeout(done, 1000); speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(timer); done(); }, { once: true }); });
      }
      const available = window.speechSynthesis && speechSynthesis.getVoices().some(v => v.lang.split('-')[0].toLowerCase() === routed.lang.split('-')[0]);
      if (!available) routed = { voiceId: voice.id, lang: voice.language, provider: voice.provider, unsupported: true };
    }
    if (routed.provider === 'tiktok') {
      try {
        return { kind: 'buffer', buffer: await fetchTikTok(text, routed.voiceId), lang: routed.lang || voice.language, voiceId: routed.voiceId, unsupported: !!routed.unsupported };
      } catch (e) {
        // Rate limit or outage: fall through to the browser voice.
      }
    }
    const target = routed.lang || voice.language;
    const installed = window.speechSynthesis ? browserVoice(target, voice.gender) : null;
    if (!installed) return { kind: 'silent' };
    return { kind: 'browser', text, gender: voice.gender, lang: installed ? installed.lang : target };
  }

  function playBuffer(buffer) {
    return new Promise(done => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = settings.volume;
      src.connect(gain).connect(ctx.destination);
      source = src;
      const watchdog = setTimeout(() => { try { src.stop(); } catch (e) {} done(); }, buffer.duration * 1000 + 4000);
      src.onended = () => { clearTimeout(watchdog); if (source === src) source = null; done(); };
      src.start();
    });
  }

  function browserVoice(lang, gender) {
    const all = speechSynthesis.getVoices();
    let local = all.filter(v => v.lang.split('-')[0].toLowerCase() === lang.split('-')[0].toLowerCase());
    if (!local.length) {
      const fallbackLang = (byId(settings.voiceId) || byId('en_us_001')).language;
      local = all.filter(v => v.lang.split('-')[0].toLowerCase() === fallbackLang.split('-')[0].toLowerCase());
    }
    if (!local.length) return null;
    return window.TTSLanguageRouter.browserVoiceForGender(local, gender);
  }

  async function speakBrowser(text, lang, gender) {
    if (!window.speechSynthesis) return;
    if (!speechSynthesis.getVoices().length) {
      await new Promise(ok => {
        const t = setTimeout(ok, 2000);
        speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(t); ok(); }, { once: true });
      });
    }
    const selected = browserVoice(lang, gender);
    if (!selected) return;
    await new Promise(done => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.volume = settings.volume;
      const v = selected;
      if (v) u.voice = v;
      // A stalled utterance (a known Chrome behaviour) must not hang the queue.
      const watchdog = setTimeout(() => { speechSynthesis.cancel(); done(); }, Math.max(10000, text.length / 12 * 1000 + 8000));
      u.onend = u.onerror = () => { clearTimeout(watchdog); done(); };
      speechSynthesis.speak(u);
    });
  }

  function stop() {
    runToken++;
    preparing = false;
    if (source) { try { source.stop(); } catch (e) {} source = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  /**
   * Reads text aloud, replacing anything already playing. Resolves when it ends or is stopped.
   * hooks.onStart() fires at once, hooks.onPlay({provider, fell_back}) when the sound starts,
   * hooks.onEnd() when it finishes without being stopped. hooks.force plays it
   * even while her voice is muted (the replay button on a message).
   */
  async function speak(text, hooks = {}) {
    stop();
    if (!settings.enabled && !hooks.force) return;
    const chunks = chunksOf(text);
    if (!chunks.length) return;
    const token = runToken;
    const live = () => token === runToken;
    preparing = true;
    try {
      unlock();
      if (hooks.onStart) hooks.onStart();
      const key = conversationKey();
      const valid = () => live() && conversationKey() === key && (settings.enabled || hooks.force || hooks.sample);
      let plan = hooks.routingPlan ? await hooks.routingPlan : prepareRouting(text, hooks.force, hooks.sample);
      if (!valid()) return;
      const signature = JSON.stringify([key, settings.voiceId, settings.autoLang && !hooks.sample, fingerprint()]);
      if (plan && plan.signature !== signature) plan = prepareRouting(text, hooks.force, hooks.sample);
      if (plan && plan.needsDecision && !plan.finished && !plan.pending) {
        const recent = typeof Chat !== 'undefined' ? Chat.messages.slice(-4).filter(m => m.content !== text).map(m => ({ role: m.role, text: m.content.slice(0, 300) })) : [];
        const request = typeof Chat !== 'undefined' && typeof Chat.askDecisions === 'function'
          ? Chat.askDecisions(['sprites_tts_language_v1'], { reply: plan.text, conversation_language: plan.previousLang, recent_context: recent }) : null;
        plan = await finishRouting(plan, request, valid);
      } else if (plan && plan.pending && !plan.finished) plan = await plan.pending;
      if (!valid()) return;
      let next = resolve(chunks[0], plan);
      for (let i = 0; i < chunks.length && live(); i++) {
        const current = await next;
        if (!valid()) break;
        if (i + 1 < chunks.length) next = resolve(chunks[i + 1], plan);
        if (i === 0 && hooks.onPlay) {
          const wanted = (byId(settings.voiceId) || {}).provider;
          if (current.kind !== 'silent') hooks.onPlay({ provider: current.kind === 'buffer' ? 'tiktok' : 'browser', fell_back: wanted === 'tiktok' && current.kind !== 'buffer', voice_lang: current.lang || '', requested_voice_lang: plan && plan.lang || '', routing_source: plan && plan.source || 'local', routing_cache_hit: !!(plan && plan.cacheHit), decision_requested: !!(plan && plan.decisionRequested), routing_wait_ms: plan && plan.waitMs || 0 });
        }
        if (current.kind === 'buffer') await playBuffer(current.buffer);
        else if (current.kind === 'browser') await speakBrowser(current.text, current.lang, current.gender);
        if (i + 1 < chunks.length && live()) await new Promise(r => setTimeout(r, CHUNK_GAP_MS));
      }
      if (live() && hooks.onEnd) hooks.onEnd();
    } finally {
      if (live()) preparing = false;
    }
  }

  const speaking = () => preparing || !!source || (window.speechSynthesis && speechSynthesis.speaking);

  return { VOICES, settings, save, speak, stop, unlock, prepareRouting, finishRouting, get speaking() { return speaking(); } };
})();
