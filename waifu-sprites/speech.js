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
    return String(text || '')
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

  // ── Language routing (waifu-companion audio_player.js) ──
  const LANG_TAGS = { ru: 'ru-RU', ar: 'ar-SA', ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN', th: 'th-TH', hi: 'hi-IN', he: 'he-IL', el: 'el-GR', id: 'id-ID', de: 'de-DE', pt: 'pt-BR' };
  const PREFERRED = { ja: 'jp_003' };

  function detectScriptLang(text) {
    if (/[Ѐ-ӿ]/.test(text)) return 'ru';
    if (/[؀-ۿ]/.test(text)) return 'ar';
    if (/[぀-ヿ]/.test(text)) return 'ja'; // kana before Han, or Japanese reads as Chinese
    if (/[가-힯]/.test(text)) return 'ko';
    if (/[一-鿿]/.test(text)) return 'zh';
    if (/[฀-๿]/.test(text)) return 'th';
    if (/[ऀ-ॿ]/.test(text)) return 'hi';
    if (/[֐-׿]/.test(text)) return 'he';
    if (/[Ͱ-Ͽ]/.test(text)) return 'el';
    return null;
  }

  // Function words for the Latin-script languages that have a voice. English is
  // only a guard: when nothing clearly beats it, the picked voice is kept.
  const HINTS = {
    en: 'the and you that have for not with this but what your just like how are was can it is to of in my me we so do if on or at be as an his her they them would could should there here from about when then than some one all out up who why will well yeah okay ok love want know think feel really very much good happy sad please thanks thank sorry hello hey cute pretty beautiful little big day night morning time right back down over again still only even more most too oh haha lol yes',
    id: 'yang dan itu ini dari apa siapa kenapa bagaimana kapan dimana mana tidak tak bukan jangan aku kamu kau saya anda dia kita kami mereka orang dengan untuk pada dalam akan sudah udah belum bisa dapat boleh harus mau ingin suka sayang cinta hati senang sedih lucu cantik manis baik besar kecil banyak semua juga tapi karena kalau jadi adalah ada tahu tau lihat kasih buat bikin makan gambar minum tidur rumah kerja teman nama kabar halo terima maaf tolong selamat banget nggak gak nih dong sih deh kok yuk ayo oke sekarang nanti besok pagi malam hari ang mga ako ikaw niya tayo kayo sila ito dito saan paano bakit hindi wala dahil kasi naman lang talaga salamat kamusta kumusta mahal ganda masaya lahat ingat mahu jom',
    de: 'der die das dem den und oder aber ich wir ihr mich dich sich uns dein sein ihre nicht kein keine ein eine einem einen ist bin bist sind war waren wird werden kann kannst können muss will willst möchte habe hast hat haben für auf von bei nach über unter vor durch ohne wie was wer warum wo wann jetzt dann wenn weil dass doch mal schon nur auch noch immer wieder sehr gut ja nein danke bitte hallo liebe schatz herz tag nacht morgen gern gerne',
    pt: 'não nao sim você voce sou eu ele ela nós mas com para isso isto aqui muito bem tudo nada bom boa dia noite tarde olá ola oi obrigado obrigada desculpa amor querido querida saudade coração beijo gosto gente então também quando onde tá né acho vou vai está estão hola gracias muy usted eres del ellos nosotros puedo puedes quiero tengo tienes dime dónde donde quién bueno buena esto eso siempre nunca mañana feliz triste encanta corazón beso lindo linda amiga amigo casa vida tiempo favor cariño estoy estás están somos son mucho hermosa juntos sabes amo cómo aquí qué siento contigo',
  };
  const HINT_SETS = Object.fromEntries(Object.entries(HINTS).map(([k, v]) => [k, new Set(v.split(' '))]));

  function detectLatinLang(text) {
    const tokens = String(text || '').toLowerCase().split(/[^a-zà-öø-ÿ0-9']+/).filter(t => t.length >= 2);
    if (!tokens.length) return null;
    const scores = {};
    for (const lang of Object.keys(HINT_SETS)) scores[lang] = tokens.filter(t => HINT_SETS[lang].has(t)).length;
    let best = null, bestScore = 0, tied = false;
    for (const [lang, score] of Object.entries(scores)) {
      if (score > bestScore) { best = lang; bestScore = score; tied = false; }
      else if (score === bestScore && score > 0) tied = true;
    }
    if (!best || best === 'en' || tied || bestScore < 2) return null;
    if (bestScore < 3 && bestScore * 4 < tokens.length) return null;
    if (bestScore - scores.en < 1) return null;
    return best;
  }

  function routeVoice(text, voiceId) {
    if (!settings.autoLang) return { voiceId, lang: null };
    const lang = detectScriptLang(text) || detectLatinLang(text);
    if (!lang) return { voiceId, lang: null };
    const matches = v => v.provider === 'tiktok' && v.language.split('-')[0] === lang;
    const chosen = (PREFERRED[lang] && byId(PREFERRED[lang])) || VOICES.find(v => matches(v) && v.gender === 'female') || VOICES.find(matches);
    return { voiceId: chosen ? chosen.id : voiceId, lang: LANG_TAGS[lang] || null };
  }

  // ── Settings ──
  const KEY = 'ws_speech';
  function defaultVoice() {
    const base = (navigator.language || 'en').split('-')[0].toLowerCase();
    const local = VOICES.find(v => v.provider === 'tiktok' && v.gender === 'female' && v.language.split('-')[0] === base);
    return local ? local.id : 'en_us_001';
  }
  const settings = { enabled: true, voiceId: '', autoLang: true };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  if (!byId(settings.voiceId)) settings.voiceId = defaultVoice();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {} }

  // ── Audio ──
  let ctx = null;
  let source = null;
  let runToken = 0;

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
  async function resolve(text) {
    const voice = byId(settings.voiceId) || byId('en_us_001');
    const routed = routeVoice(text, voice.id);
    if (voice.provider === 'tiktok') {
      try {
        return { kind: 'buffer', buffer: await fetchTikTok(text, routed.voiceId) };
      } catch (e) {
        // Rate limit or outage: fall through to the browser voice.
      }
    }
    return { kind: 'browser', text, gender: voice.gender, lang: routed.lang || voice.language };
  }

  function playBuffer(buffer) {
    return new Promise(done => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      source = src;
      const watchdog = setTimeout(() => { try { src.stop(); } catch (e) {} done(); }, buffer.duration * 1000 + 4000);
      src.onended = () => { clearTimeout(watchdog); if (source === src) source = null; done(); };
      src.start();
    });
  }

  function browserVoice(lang, gender) {
    const all = speechSynthesis.getVoices();
    const local = all.filter(v => v.lang.startsWith(lang.split('-')[0]));
    if (!local.length) return all[0] || null;
    const female = ['female', 'woman', 'girl', 'zira', 'hazel', 'susan', 'samantha', 'karen', 'moira', 'tessa', 'fiona', 'kate', 'victoria', 'alice'];
    const male = ['male', 'man', 'boy', 'david', 'mark', 'james', 'daniel', 'thomas', 'george', 'alex', 'fred', 'ralph'];
    const [want, avoid] = gender === 'male' ? [male, female] : [female, male];
    const has = (v, words) => words.some(w => v.name.toLowerCase().includes(w));
    return local.find(v => has(v, want)) || local.find(v => !has(v, avoid)) || local[0];
  }

  async function speakBrowser(text, lang, gender) {
    if (!window.speechSynthesis) return;
    if (!speechSynthesis.getVoices().length) {
      await new Promise(ok => {
        const t = setTimeout(ok, 2000);
        speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(t); ok(); }, { once: true });
      });
    }
    await new Promise(done => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      const v = browserVoice(lang, gender);
      if (v) u.voice = v;
      // A stalled utterance (a known Chrome behaviour) must not hang the queue.
      const watchdog = setTimeout(() => { speechSynthesis.cancel(); done(); }, Math.max(10000, text.length / 12 * 1000 + 8000));
      u.onend = u.onerror = () => { clearTimeout(watchdog); done(); };
      speechSynthesis.speak(u);
    });
  }

  function stop() {
    runToken++;
    if (source) { try { source.stop(); } catch (e) {} source = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  /** Reads text aloud, replacing anything already playing. Resolves when it ends or is stopped. */
  async function speak(text, hooks = {}) {
    stop();
    if (!settings.enabled) return;
    const chunks = chunksOf(text);
    if (!chunks.length) return;
    const token = runToken;
    const live = () => token === runToken;
    unlock();
    if (hooks.onStart) hooks.onStart();
    let next = resolve(chunks[0]);
    for (let i = 0; i < chunks.length && live(); i++) {
      const current = await next;
      if (!live()) break;
      if (i + 1 < chunks.length) next = resolve(chunks[i + 1]);
      if (current.kind === 'buffer') await playBuffer(current.buffer);
      else await speakBrowser(current.text, current.lang, current.gender);
      if (i + 1 < chunks.length && live()) await new Promise(r => setTimeout(r, CHUNK_GAP_MS));
    }
    if (live() && hooks.onEnd) hooks.onEnd();
  }

  const speaking = () => !!source || (window.speechSynthesis && speechSynthesis.speaking);

  return { VOICES, settings, save, speak, stop, unlock, get speaking() { return speaking(); } };
})();
