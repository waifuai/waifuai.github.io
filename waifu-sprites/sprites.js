/**
 * sprites.js: the sprite player.
 *
 * Every state and emotion is a short looping MP4 clip with one or two
 * alternates. Two <video> elements are stacked: the next clip loads in the
 * hidden one and only swaps in (with a short crossfade) once it can play, so a
 * clip still downloading never shows a blank frame.
 *
 * Emotions go through RANSOC: each emotion has a mass that drops when it is
 * shown and recovers while others are shown, so the same face never plays
 * twice in a row and recently seen ones are less likely. When a detected
 * emotion was just shown, a similar one plays instead.
 */
const Sprites = (() => {
  const BASE = 'videos/';

  const STATES = {
    idle: 1, listening: 2, speaking: 3, thinking: 4, typing: 5, searching: 6,
    calculating: 7, fixing: 8, success: 9, error: 10, alert: 11, sleeping: 12,
  };
  const EMOTIONS = {
    happy: 1, funny: 2, empathetic: 3, curious: 4, confused: 5, amazed: 6,
    sorry: 7, found_it: 8, annoyed: 9, overwhelmed: 10, planning: 11, love: 12,
  };
  const LABELS = { funny: 'laughing', found_it: 'triumphant' };

  // Clips with a second alternate (most have one: N.mp4 and N-1.mp4).
  const EXTRA_VARIANTS = { '4': ['4-2'], 'e2': ['e2-2'] };

  const SIMILAR = {
    happy: ['love', 'funny', 'found_it'],
    funny: ['happy', 'amazed', 'love'],
    empathetic: ['sorry', 'love', 'confused'],
    curious: ['confused', 'planning', 'amazed'],
    confused: ['curious', 'overwhelmed', 'empathetic'],
    amazed: ['found_it', 'happy', 'funny'],
    sorry: ['empathetic', 'confused', 'love'],
    found_it: ['amazed', 'happy', 'planning'],
    annoyed: ['overwhelmed', 'confused', 'sorry'],
    overwhelmed: ['annoyed', 'confused', 'empathetic'],
    planning: ['curious', 'found_it', 'confused'],
    love: ['happy', 'empathetic', 'funny'],
  };

  // Fallback when the reply carries no emotion tag. First match wins.
  const KEYWORDS = [
    [['haha', 'lol', 'lmao', 'hehe', 'funny', 'silly'], 'funny'],
    [['love', 'thank you', 'sweet', 'cutie', 'heart', 'glad', 'welcome'], 'love'],
    [['sorry', 'apolog', 'unfortunately', 'my bad', 'oops'], 'sorry'],
    [['a lot', 'so many', 'overwhelm', 'massive'], 'overwhelmed'],
    [['wow', 'amazing', 'incredible', 'fascinating', 'woah'], 'amazed'],
    [['hmm', 'confus', 'unclear', 'not sure'], 'confused'],
    [['again', 'already', 'seriously'], 'annoyed'],
    [['what is', 'how does', 'curious', 'interesting', 'tell me', 'what if'], 'curious'],
    [['found', 'perfect', 'exactly', 'done', 'got it'], 'found_it'],
    [['let me', 'going to', 'step by step', 'plan'], 'planning'],
    [['understand', 'tough', 'worry', 'breathe', 'here for you'], 'empathetic'],
    [['great', 'good', 'nice', 'awesome', 'wonderful', 'yay'], 'happy'],
  ];

  // ── RANSOC ──
  const LR = 0.3;
  const N = Object.keys(EMOTIONS).length;
  const SIMILARITY_BONUS = 3;
  const masses = {};
  Object.keys(EMOTIONS).forEach(k => { masses[k] = 1; });
  let lastEmotion = null;

  function weightedPick(items) {
    let total = 0;
    items.forEach(it => { total += it.weight; });
    let r = Math.random() * total;
    for (const it of items) {
      r -= it.weight;
      if (r <= 0) return it.name;
    }
    return items[items.length - 1].name;
  }

  function pickExcluding(exclude) {
    return weightedPick(Object.keys(masses).filter(k => k !== exclude).map(k => ({ name: k, weight: masses[k] })));
  }

  function pickSimilar(emotion) {
    const near = (SIMILAR[emotion] || []).filter(k => k !== lastEmotion);
    if (!near.length) return pickExcluding(lastEmotion);
    const items = near.map(k => ({ name: k, weight: masses[k] * SIMILARITY_BONUS }));
    Object.keys(masses).forEach(k => {
      if (k !== lastEmotion && !near.includes(k)) items.push({ name: k, weight: masses[k] });
    });
    return weightedPick(items);
  }

  function updateMass(shown) {
    lastEmotion = shown;
    Object.keys(masses).forEach(k => {
      masses[k] *= k === shown ? 1 - LR : 1 + LR / (N - 1);
      masses[k] = Math.max(0.1, Math.min(5, masses[k]));
    });
  }

  function ransocSelect(detected) {
    let pick;
    if (!EMOTIONS[detected]) {
      pick = pickExcluding(lastEmotion);
    } else if (detected === lastEmotion) {
      pick = pickSimilar(detected);
    } else {
      // A recently shown emotion (low mass) sometimes gives way to a similar one.
      let total = 0;
      Object.keys(masses).forEach(k => { total += masses[k]; });
      const swapChance = Math.max(0, 1 - masses[detected] / (total / N)) * 0.5;
      pick = Math.random() < swapChance ? pickSimilar(detected) : detected;
    }
    updateMass(pick);
    return pick;
  }

  // ── Player ──
  let videos = [];
  let front = 0;
  let labelEl = null;
  let lastClip = '';
  let loadToken = 0;
  let visible = true;
  let current = { kind: 'state', name: 'idle' };
  const listeners = [];

  function variantsOf(base) {
    return [base, base + '-1'].concat(EXTRA_VARIANTS[base] || []);
  }

  // A variant of base that differs from the clip playing now.
  function chooseClip(base) {
    const options = variantsOf(base).filter(v => v !== lastClip);
    return options[Math.floor(Math.random() * options.length)];
  }

  function play(clip, label) {
    lastClip = clip;
    if (labelEl) labelEl.textContent = label;
    listeners.forEach(fn => fn(current));
    if (!visible || !videos.length) return;

    const token = ++loadToken;
    const next = videos[1 - front];
    const shown = videos[front];
    next.onerror = () => {
      if (token !== loadToken) return;
      // Fall back to the plain clip if an alternate fails to load.
      const plain = clip.replace(/-\d$/, '');
      if (plain !== clip) play(plain, label);
    };
    next.oncanplay = () => {
      if (token !== loadToken) return;
      next.oncanplay = null;
      const p = next.play();
      if (p) p.catch(() => {});
      next.classList.add('front');
      shown.classList.remove('front');
      front = 1 - front;
      setTimeout(() => { if (token === loadToken) shown.pause(); }, 300);
    };
    next.src = BASE + clip + '.mp4';
  }

  function setState(name) {
    if (!STATES[name]) return;
    current = { kind: 'state', name };
    play(chooseClip(String(STATES[name])), name);
  }

  function setEmotion(detected) {
    const name = ransocSelect(detected);
    current = { kind: 'emotion', name };
    play(chooseClip('e' + EMOTIONS[name]), LABELS[name] || name.replace('_', ' '));
    return name;
  }

  function detectEmotion(text) {
    const t = (text || '').toLowerCase();
    for (const [words, emotion] of KEYWORDS) {
      if (words.some(w => t.includes(w))) return emotion;
    }
    return null;
  }

  function setVisible(on) {
    visible = !!on;
    if (!visible) videos.forEach(v => v.pause());
    else if (current.kind === 'emotion') play(chooseClip('e' + EMOTIONS[current.name]), LABELS[current.name] || current.name.replace('_', ' '));
    else setState(current.name);
  }

  // Mobile browsers only autoplay muted inline video, and some still wait for a tap.
  function unlock() {
    const v = videos[front];
    if (v && v.paused && visible) v.play().catch(() => {});
  }

  // Warm the cache with the clips every chat uses, once the first clip is up.
  function prefetch() {
    const conn = navigator.connection;
    if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ''))) return;
    const clips = ['2', '3', '4', '4-1', '1-1', '3-1', '2-1'];
    let i = 0;
    const nextFetch = () => {
      if (i >= clips.length) return;
      fetch(BASE + clips[i++] + '.mp4').then(r => r.blob()).catch(() => {}).then(nextFetch);
    };
    setTimeout(nextFetch, 1500);
  }

  function init(videoEls, label) {
    videos = videoEls;
    labelEl = label;
    videos.forEach(v => {
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
    });
    videos[0].classList.add('front');
    setState('idle');
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
      document.addEventListener(ev, unlock, { once: true, passive: true }));
    prefetch();
  }

  return {
    init, setState, setEmotion, detectEmotion, setVisible,
    onChange: fn => listeners.push(fn),
    STATES: Object.keys(STATES),
    EMOTIONS: Object.keys(EMOTIONS),
    get current() { return current; },
  };
})();
