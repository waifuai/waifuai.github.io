/**
 * voice.js: voice input for the mic button.
 *
 * Records the mic with MediaRecorder and transcribes it through WaifuAI Cloud's
 * /transcribe endpoint, whichever provider the chat itself uses.
 *
 * Gestures, as in waifu-companion:
 *  - press and hold: records while held, stops on release (push-to-talk)
 *  - quick tap: keeps recording until the next tap
 *  - keyboard (Enter/Space): toggles, like a tap
 * Recordings stop by themselves after MAX_RECORDING_MS.
 */
const Voice = (() => {
  const TRANSCRIBE_URL = 'https://waifu-companion-proxy.thewaifuai.workers.dev/transcribe';
  const HOLD_THRESHOLD_MS = 300;
  const MIN_RECORDING_MS = 400;
  const MAX_RECORDING_MS = 60000;
  const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mpeg'];

  const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  let state = 'idle'; // idle | starting | listening | transcribing
  let stream = null;
  let recorder = null;
  let chunks = [];
  let startedAt = 0;
  let discard = false;
  let maxTimer = null;
  let opts = {};

  function setState(next) {
    state = next;
    if (opts.onState) opts.onState(state);
  }

  async function transcribe(blob) {
    const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : blob.type.includes('mpeg') ? 'mp3' : 'webm';
    const form = new FormData();
    form.append('file', blob, 'audio.' + ext);
    const lang = (navigator.language || 'en').split('-')[0];
    if (/^[a-z]{2}$/.test(lang)) form.append('language', lang);
    const ids = opts.ids ? opts.ids() : {};
    const headers = {};
    if (ids.session) headers['x-session-id'] = ids.session;
    if (ids.visitor) headers['x-visitor-id'] = ids.visitor;
    const res = await fetch(TRANSCRIBE_URL, { method: 'POST', body: form, headers });
    let body = null;
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) {
      const err = new Error((body && body.error) || 'Transcription failed (HTTP ' + res.status + ').');
      err.status = res.status;
      throw err;
    }
    return ((body && body.text) || '').trim();
  }

  function releaseMic() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  async function start() {
    discard = false;
    setState('starting');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setState('idle');
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      opts.onError(denied ? 'Microphone access is blocked. Allow it in your browser to talk to her.' : 'Could not start the microphone.');
      return;
    }
    if (discard) { releaseMic(); setState('idle'); return; } // Stopped while the permission prompt was open.

    const mimeType = MediaRecorder.isTypeSupported ? MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t)) : undefined;
    chunks = [];
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      clearTimeout(maxTimer);
      releaseMic();
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      recorder = null;
      if (discard || Date.now() - startedAt < MIN_RECORDING_MS) {
        setState('idle');
        return;
      }
      setState('transcribing');
      try {
        const text = await transcribe(blob);
        if (text) opts.onText(text);
        else opts.onError("I couldn't hear anything in that recording. Try again a bit closer to the mic?");
      } catch (err) {
        opts.onError(err.status === 429 ? 'Voice input is busy right now. Try again in a moment.' : 'Voice input failed: ' + err.message);
      } finally {
        setState('idle');
      }
    };
    recorder.start();
    startedAt = Date.now();
    maxTimer = setTimeout(stop, MAX_RECORDING_MS);
    setState('listening');
  }

  function stop() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else if (state === 'starting') discard = true;
    else setState('idle');
  }

  const recording = () => state === 'starting' || state === 'listening';

  /**
   * opts.onText(text) gets each transcript, opts.onState(state) every state
   * change, opts.onError(message) failures; opts.ids() returns {session, visitor}.
   */
  function init(button, options) {
    opts = options;
    if (!supported) { button.hidden = true; return; }

    let pressAction = null;
    let pressStartedAt = 0;

    button.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); // keep focus in the text box and stop long-press menus
      if (state === 'transcribing') return;
      if (recording()) { pressAction = 'stop'; return; }
      pressAction = 'start';
      pressStartedAt = Date.now();
      try { button.setPointerCapture(e.pointerId); } catch (err) {}
      start();
    });
    const pressEnd = () => {
      const action = pressAction;
      pressAction = null;
      if (action === 'stop') stop();
      else if (action === 'start' && Date.now() - pressStartedAt >= HOLD_THRESHOLD_MS && state === 'listening') stop();
      // A quick tap leaves it recording until the next tap.
    };
    button.addEventListener('pointerup', pressEnd);
    button.addEventListener('pointercancel', pressEnd);
    button.addEventListener('contextmenu', e => e.preventDefault());
    button.addEventListener('click', e => {
      if (e.detail !== 0 || state === 'transcribing') return; // keyboard only
      if (recording()) stop(); else start();
    });
  }

  return { init, supported, get state() { return state; } };
})();
