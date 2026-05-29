# Complete Settings Guide: Every Option Explained

This guide covers every setting in the chatbot application. Click the ⚙️ gear icon to open the Settings panel, then explore each section below to understand what each option does.

## 📑 Table of Contents

- [🧠 Persona System Prompt](#-persona-system-prompt)
- [🧠 Memory Settings](#-memory-settings)
- [🧩 Model Settings](#-model-settings)
- [🌐 Language Settings](#-language-settings)
- [🔊 Voice Settings](#-voice-settings)
- [🎧 Audio Settings](#-audio-settings)
- [🖥️ Display Settings](#%EF%B8%8F-display-settings)
- [🖼️ Background Image](#%EF%B8%8F-background-image)
- [⚙️ Preferences](#%EF%B8%8F-preferences)
- [🐞 Debug Settings](#-debug-settings)
- [❓ Help & Tutorial](#-help--tutorial)

---

## 🧠 Persona System Prompt

Control who your AI companion is—their identity, personality, and how they interact with you.

### 🆔 Core Identity `Text Area`

Define the AI's fundamental character. This is the unchangeable core of who they are—their name, role, and basic traits. Example: "You are Haru, a friendly and curious AI companion."

### 🎭 Custom Personality / Roleplay `Text Area`

Add custom personality traits, roleplay scenarios, or specific behaviors on top of the core identity. Example: "You are a tsundere childhood friend who secretly has a crush on the user."

### 💾 Save Persona Settings `Button`

Saves your persona configuration. Changes won't take effect until you save.

### 🔄 Reset Persona `Button`

Resets persona to the default settings, clearing any custom personality you've created.

> **💡 Tip:** Keep your Core Identity concise (1-3 sentences). Use Custom Personality for detailed traits and scenarios.

---

## 🧠 Memory Settings

Control how much conversation history the AI remembers when generating responses.

### 🧵 Conversation Memory Size `Slider (5-50)`

The number of previous messages the AI includes for context. Higher values = better memory but more API usage. Default: 10 messages.

**📊 Recommended Values:**

| Range | Best For |
|-------|----------|
| 5-10 | Quick, lightweight conversations |
| 15-25 | Good balance for roleplay and ongoing stories |
| 30-50 | Maximum context for complex narratives (may be slower) |

---

## 🧩 Model Settings

Choose and manage your Live2D avatar models.

### 🎭 Select Model `Dropdown`

Choose from available Live2D models. Click the dropdown to see thumbnails and model names.

### ➕ Add Custom Model `Input Fields + Button`

Add your own Live2D model by providing:

- **Model Name:** Optional friendly name (auto-detected from URL if blank)
- **Model URL:** Direct URL to the `.model3.json` file (required)
- **Thumbnail URL:** Optional image for the model selector

### 📂 Custom Models `Dropdown`

Select and manage custom models you've added. Shows model info and removal options.

### ♻️ Reset Model Position & Zoom `Button`

Resets the model's position and zoom level to defaults. Useful if you've dragged the model off-screen.

### 🗑️ Clear All Models `Button`

Removes all models currently displayed on screen.

### 📖 Open Model Gallery `Button`

Opens a fullscreen gallery showing all available models with thumbnails for easy selection.

### 🗑️ Clear Custom Models `Button`

Removes all custom models you've added (built-in models remain).

---

## 🌐 Language Settings

Configure the language for AI responses and interface.

### 🌍 Language `Dropdown`

Select from 193 supported languages. The AI will respond in your chosen language.

### 🔤 Show Transliteration (for JA, KO) `Checkbox`

When enabled, shows romanized pronunciation (romaji/romanization) under Japanese and Korean text.

### 🈯 Translate User Interface (AI) `Checkbox`

Translates all UI labels and buttons to your selected language using AI. May take a moment to load.

### 🔄 Reset Languages `Button`

Resets language settings to English (default).

---

## 🔊 Voice Settings

Control the AI's text-to-speech voice output.

### 🔈 Enable Voice (TTS) `Checkbox`

Master switch for voice output. When enabled, the AI speaks its responses aloud.

### 🎙️ Voice `Dropdown`

Select which voice the AI uses. Options include female voices in various languages. Set to "None" to disable TTS while keeping other voice controls visible.

### 📏 TTS Chunk Character Limit `Slider (50-1000)`

Maximum characters per TTS request. Lower values = more frequent but shorter audio clips. Default: 300.

### ▶️ Play / ⏸️ Pause / ⏹️ Stop `Buttons`

Manual controls for voice playback. Play resumes, Pause halts temporarily, Stop cancels all queued speech.

> **💡 Tip:** The voice automatically matches your language when you switch languages. Languages without native voices use the closest phonetic alternative.

---

## 🎧 Audio Settings

Ambient audio and background music.

### 📻 Radio Stream `Play/Pause + Volume Slider`

Toggle an anime music radio stream (Listen.moe). Adjust volume with the slider (default: 25%).

---

## 🖥️ Display Settings

Customize the visual appearance of the interface.

### ⏰ Show Clock `Checkbox`

Displays a digital clock on the screen.

### 🪟 Chatbox Opacity `Slider (0.1-1.0)`

Controls transparency of the entire chat container. Lower = more transparent. Default: 0.9.

### 💬 Message Bubble Opacity `Slider (0.1-1.0)`

Controls transparency of individual message bubbles. Default: 0.3 (quite transparent for aesthetic).

### 🖼️ Background Image Opacity `Slider (0-1.0)`

Controls how visible the background image is. 0 = hidden, 1 = fully visible. Default: 1.0.

---

## 🖼️ Background Image

Customize the scene behind your AI companion.

### ✨ AI Background Prompt `Text Input + Button`

Describe a scene and click "Generate Background" to create an AI-generated image. Example: "tranquil starry night sky, minimal, soft light"

### 🌐 Generate from Conversation `Button`

Automatically generates a background based on the current conversation context.

### 🔗 Custom Background URL `Text Input + Button`

Set a background using any image URL. Click "Set Background" to apply.

### 🧹 Clear Background `Button`

Removes the current background, returning to the default dark theme.

### 📚 Background Library `Gallery`

View and manage all generated or added backgrounds. Click to apply, use Select mode to delete multiple.

### 📐 Background Fit `Button Group`

Control how the background image is displayed:

- **Contain:** Full image visible, may have letterboxing
- **Cover:** Fills screen, may crop edges
- **Stretch:** Stretches to fill (may distort)
- **Top/Center/Bottom:** Aligns the image vertically
- **Fit Width/Height:** Scales to fit one dimension

---

## ⚙️ Preferences

General application behavior settings.

### 🪄 Always show Settings on page load `Checkbox`

When enabled, the Settings panel opens automatically every time you load the page. Otherwise, it remembers whether you left it open or closed.

### ⏱️ Include current time in context `Checkbox`

Provides the AI with the current date and time so it can give time-aware responses like "Good morning!" or reference the current day.

### 🔋 Include battery status in context `Checkbox`

Lets the AI know your device's battery level and charging state. The AI might say "I see you're running low on battery!"

### 🧬 Load multiple models at once `Checkbox`

When enabled, selecting a model adds it to the screen without removing existing ones. Great for having multiple characters interact!

---

## 🐞 Debug Settings

Tools for developers and troubleshooting.

### 🧰 Enable Debug Panel `Checkbox`

Shows a draggable debug panel with real-time logs of system events, AI responses, and errors.

### 📜 Auto-scroll Log `Checkbox`

Automatically scrolls the debug log to show the newest entries.

### 🧹 Clear Debug Log `Button`

Clears all entries in the debug panel.

### 💬 Show Live2D Debug Logs `Checkbox`

Shows detailed logs about Live2D model loading, animations, and interactions.

### 🧠 Show AI Debug Logs `Checkbox`

Shows logs about AI requests, responses, and processing.

### 🔊 Show TTS Debug Logs `Checkbox`

Shows logs about text-to-speech processing, chunking, and playback.

### 🔌 Test Fallback AI `Checkbox`

Forces the app to use the offline fallback AI instead of the main API. Useful for testing offline behavior.

> **⚠️ Note:** Debug settings are primarily for developers. Enabling all logs may affect performance.

---

## ❓ Help & Tutorial

### 📘 Launch Tutorial `Button`

Opens an interactive walkthrough that explains the main features of the application.

---

## 📋 Quick Reference Table

| Setting | Type | Default | What It Does |
|---------|------|---------|--------------|
| Memory Size | Slider | 10 | Messages AI remembers |
| Language | Dropdown | English | AI response language |
| Voice | Dropdown | Auto | TTS voice selection |
| TTS Chunk Limit | Slider | 300 | Max chars per speech chunk |
| Chatbox Opacity | Slider | 0.9 | Chat container transparency |
| Message Opacity | Slider | 0.3 | Message bubble transparency |
| Background Opacity | Slider | 1.0 | Background image visibility |
| Radio Volume | Slider | 0.25 | Background music volume |

> **🎉 Pro Tip:** All settings are automatically saved to your browser's local storage. They'll persist across sessions until you clear your browser data.
