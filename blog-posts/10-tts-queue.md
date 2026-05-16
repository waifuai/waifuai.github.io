# TTS Queue Management: Making AI Speech Sound Natural

When your AI companion speaks, there's a lot happening behind the scenes. Text-to-speech might seem simple—text goes in, audio comes out—but making it sound *natural* requires sophisticated queue management, intelligent chunking, and graceful error handling. Here's a deep dive into how we make AI speech seamless.

## 🎯 The Challenge

When a user asks the AI a question, the response might be several paragraphs long. Playing this as one massive audio file creates problems:

| Problem | Description |
|---------|-------------|
| ⏳ Long Wait Times | Users would wait 10+ seconds before hearing anything while the entire response is synthesized |
| 💥 API Limits | TTS services have character limits (often 300-500 chars). Long text simply fails |
| 🔄 No Recovery | If playback fails halfway, you'd have to restart from the beginning |
| 🤖 Robotic Feel | Without natural pauses, AI speech sounds mechanical and exhausting to listen to |

## 🏗️ The Architecture

Our TTS system is split into three specialized modules:

```
📝 Queue Manager → ⚡ Preloader → 🔊 Audio Player
```

| Module | File | Responsibility |
|--------|------|----------------|
| **Queue Manager** | tts_queue_manager.js | Splits text into chunks, manages playback order, handles pause/resume |
| **Preloader** | audio_preloader.js | Fetches and caches the *next* audio chunk while current one plays |
| **Audio Player** | audio_player.js | Plays audio, syncs lip movements, handles retries and text splitting |

## 📦 Step 1: Intelligent Chunking

The first challenge is breaking text into playable chunks. We don't just split at arbitrary character limits—we split at **natural sentence boundaries** and then group sentences into chunks:

```javascript
// Group sentences into chunks based on character limit
const chunks = [];
const limit = window.ttsChunkLimit || 300;

sentences.forEach((sentence, idx) => {
  if (currentChunk.text.length + sentence.length > limit) {
    chunks.push(currentChunk); // Save current chunk
    currentChunk = { text: sentence, indices: [idx] }; // Start new
  } else {
    currentChunk.text += ' ' + sentence;
    currentChunk.indices.push(idx);
  }
});
```

> **💡 Why group sentences?** Making one API call for "Hello. How are you?" is more efficient than two separate calls—fewer network requests, less latency, and the TTS can apply natural prosody across the full phrase.

## ⚡ Step 2: Preloading Magic

The secret to seamless playback is **preloading**. While chunk #1 plays, we're already fetching chunk #2 in the background:

1. **T=0s:** Start playing Chunk 1 - Audio begins immediately. User hears "Hello! I'm your AI companion..."
2. **T=0.1s:** Begin preloading Chunk 2 - While chunk 1 plays, we silently fetch chunk 2's audio in the background
3. **T=2s:** Chunk 1 finishes, Chunk 2 already cached - Zero delay—chunk 2 starts instantly from cache. Meanwhile, chunk 3 begins preloading
4. **T=4s:** Continue until complete - Each chunk starts with near-zero latency because it was preloaded during the previous chunk

```javascript
// Inside the playback loop
const preloaded = await TTSPreloader.getPreloadedBuffer(i, chunkText, voiceId);

// Start preloading NEXT chunk immediately
if (i + 1 < chunks.length) {
  TTSPreloader.preloadNext(i + 1, chunks[i+1].text, voiceId);
}

await tryPlaySingleChunk(chunkText, voiceId, 0, preloaded);
```

> **✨ Result:** Instead of a noticeable pause between every sentence, playback feels continuous and natural—just like a real person speaking.

## 🔄 Step 3: Error Recovery

Network errors happen. Rate limits get hit. Long text fails. Our system handles all of these gracefully:

### Rate Limit Handling (HTTP 429)

When the TTS API returns a rate limit error, we don't crash—we pause gracefully and show a retry button:

```javascript
if (err.status === 429) {
  debugLog("Rate limit hit. Pausing playback.", "warn");
  showRetryTTSButton(messageId, chunk.indices[0], languageCode);
  isCurrentlySpeaking = false;
  ttsCancelled = true;
  return; // Stop cleanly, keep queue intact
}
```

### Text Too Long? Split It!

Sometimes even our chunks exceed the API limit. Instead of failing, we recursively split the chunk at natural word boundaries:

```javascript
if (err.message.includes("text too long")) {
  const halfPoint = Math.floor(textChunk.length / 2);
  let splitPoint = textChunk.lastIndexOf(' ', halfPoint);
  
  const firstHalf = textChunk.substring(0, splitPoint);
  const secondHalf = textChunk.substring(splitPoint).trim();
  
  await tryPlaySingleChunk(firstHalf, voiceId, attempt + 1);
  await tryPlaySingleChunk(secondHalf, voiceId, attempt + 1);
}
```

> **⚠️ Safety Limit:** We cap recursive splits at 5 attempts. If text still fails after being split 32 times, something's seriously wrong and we skip it.

## 👄 Step 4: Lip Sync Integration

The magic really happens when TTS connects to the Live2D avatar. We use Web Audio API's AnalyserNode to extract real-time audio amplitude:

```javascript
const updateMouth = () => {
  analyserNode.getByteFrequencyData(dataArray);
  const vocalRange = dataArray.slice(10, 100); // Human voice frequencies
  const volume = vocalRange.reduce((a, v) => a + v) / vocalRange.length;
  
  // Smooth the animation to prevent jittering
  const smoothed = lastVolume + (volume - lastVolume) * 0.3;
  
  // Apply to Live2D model
  model.setParameterValueById("ParamMouthOpenY", smoothed * 1.5);
  model.setParameterValueById("ParamMouthForm", smoothed * 0.5 - 0.25);
  requestAnimationFrame(updateMouth);
};
```

We specifically analyze frequencies 10-100 in the frequency data—this corresponds to the human voice range (roughly 300-3000 Hz), filtering out background noise and music that might interfere.

## 🎮 Step 5: User Controls

Users need control over their AI's voice. We provide three actions:

| Action | Behavior |
|--------|----------|
| **▶️ Play** | Resume from where we left off, or start a new queued message |
| **⏸️ Pause** | Stop current audio but keep the queue intact for later |
| **⏹️ Stop** | Cancel everything—current audio, queue, and preloaded cache |

```javascript
function stopTTS() {
  ttsCancelled = true;
  ttsQueue = []; // Clear pending messages
  TTSPreloader.clear(); // Clear preloaded audio
  if (window.currentAudio) {
    currentAudio.stop();
    currentAudio = null;
  }
  isCurrentlySpeaking = false;
}
```

## 📊 Performance Metrics

| Metric | Without Preloading | With Preloading |
|--------|-------------------|-----------------|
| Time to first audio | ~500ms | ~500ms |
| Gap between chunks | 400-800ms | **~0ms** |
| Perceived latency | High (noticeable pauses) | **None** |
| Error recovery | Full restart required | **Resume from sentence** |

## 🎁 Key Takeaways

> "The best TTS system is one users don't notice. They should focus on *what* the AI is saying, not *how* it's being delivered."

**✅ Our approach:**

- Split text at natural sentence boundaries, not arbitrary character limits
- Preload the next chunk while the current one plays
- Handle rate limits gracefully with pause and resume
- Split oversized chunks recursively instead of failing
- Sync lip movements to audio amplitude in real-time
- Add 150ms pauses between chunks for natural rhythm

The result? Speech that flows naturally, recovers from errors gracefully, and keeps your AI companion feeling alive and responsive. 🎙️
