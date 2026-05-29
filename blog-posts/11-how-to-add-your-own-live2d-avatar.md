# How to Add Your Own Live2D Avatar: A Complete Guide

Want to use your own Live2D avatar instead of the default model? This guide walks you through everything you need to know—from finding models to hosting them and adding them to the chatbot. No coding required!

## 📋 What You'll Need

- A Live2D Cubism 3.0+ model (not Cubism 2.x)
- A place to host the model files (GitHub, your own server, etc.)
- The direct URL to the .model3.json file
- Optional: A thumbnail image URL for the model selector

## 🗂️ Understanding Live2D Model Files

A Live2D model isn't just one file—it's a folder containing multiple files that work together:

```
📁 my_character/
├── my_character.model3.json  ← Main file (you need this URL!)
├── my_character.moc3         ← The actual 3D model data
├── my_character.physics3.json ← Physics settings (hair bounce, etc.)
├── my_character.pose3.json   ← Pose/expression data
├── 📁 textures/
│   └── texture_00.png        ← Character textures
└── 📁 motions/
    ├── idle.motion3.json
    └── tap.motion3.json
```

> **💡 Key Point:** The `.model3.json` file is the "entry point" that tells the system where all the other files are. You only need to provide the URL to this file—it will automatically load everything else.

## 🔍 Where to Find Live2D Models

### 🎁 Free Models

**Live2D Official Sample Models**  
[live2d.com/download/sample-data](https://www.live2d.com/en/download/sample-data/)  
High-quality official samples. Great for testing!

### 🎁 GitHub Repositories

**Search for "live2d model3.json"**  
Many developers share their models on GitHub. Look for repositories with .model3.json files.  
*Tip: Use GitHub's raw file URLs for direct access.*

### 💰 Commercial Models

**Live2D Marketplace / Booth.pm / nizima**  
Professional artists sell custom models. If you purchase one, you'll get the full file package to host yourself.

### 🎨 Create Your Own

**Live2D Cubism Editor**  
[live2d.com/download/cubism](https://www.live2d.com/en/download/cubism/)  
Free version available! Create your own avatar from artwork.

## 🌐 Hosting Your Model

The model files need to be hosted somewhere accessible via HTTPS. Here are your options:

| Option | Difficulty | Best For |
|--------|------------|----------|
| **GitHub Pages** | Easy | Free, reliable, great for most users |
| **Your Own Server** | Medium | Full control, already have hosting |
| **CDN Services** | Easy | Fast loading, paid option |
| **Direct GitHub Raw** | Easiest | Quick testing (rate limited) |

### How to Host on GitHub (Recommended)

1. **Create a new repository** on GitHub (or use an existing one)
2. **Upload your entire model folder** (all files, maintaining structure)
3. **Enable GitHub Pages:** Settings → Pages → Source: main branch
4. **Your URL will be:**

```
https://YOUR-USERNAME.github.io/YOUR-REPO/my_character/my_character.model3.json
```

Or use the raw file URL directly:

```
https://raw.githubusercontent.com/YOUR-USERNAME/YOUR-REPO/main/my_character/my_character.model3.json
```

> **🔒 CORS Note:** The hosting server must allow cross-origin requests. GitHub Pages and most CDNs handle this automatically. If you're self-hosting, make sure to configure CORS headers.

## ➕ Adding Your Model to the Chatbot

### Step 1: Open Settings

Click the **⚙️ Settings** gear icon to open the settings panel.

### Step 2: Find "Add Custom Model"

Scroll down to the **🧩 Model Settings** section. You'll see the "Add Custom Model" area with three input fields.

### Step 3: Fill in the Fields

| Field | Required? | What to Enter |
|-------|-----------|---------------|
| **Model Name** | Optional | A friendly name like "My Haru" (auto-detected from URL if blank) |
| **Model URL** | ✅ Required | Direct URL to the .model3.json file |
| **Thumbnail URL** | Optional | URL to an image for the model selector |

### Step 4: Click "Add Model"

The model will immediately load and appear in your model selector. It's also saved to your browser—it'll be there next time you visit!

> **✅ That's it!** Your custom model is now loaded. You can switch between models anytime using the model selector dropdown.

## 🔧 Troubleshooting

**❌ "Model won't load" / Nothing happens**  
Check the browser console (F12 → Console tab) for error messages. Common causes: wrong URL, CORS blocked, missing files.

**❌ "URL must end with .model3.json"**  
Make sure your URL ends exactly with `.model3.json`. Some URLs have query strings (like `?token=xyz`)—that's fine, it just needs .model3.json before the `?`.

**❌ Model loads but looks broken/distorted**  
The model might be Cubism 2.x format (we only support 3.0+). Check if files are .moc3 (good) or just .moc (old format).

**❌ "CORS error" or "blocked by CORS policy"**  
The server hosting your files isn't allowing cross-origin requests. Use GitHub Pages, or if self-hosting, add the header: `Access-Control-Allow-Origin: *`

**❌ Textures are missing (model appears white/blank)**  
The texture files weren't uploaded, or the paths in .model3.json don't match the actual file locations. Make sure the entire folder structure is preserved.

**❌ Model doesn't lip-sync**  
The model needs the parameter `ParamMouthOpenY` for lip sync to work. Some models use different parameter names—without this specific parameter, lips won't move.

## ✨ Pro Tips

> **🎯 Multiple Models:** You can add as many custom models as you want! Enable "Load multiple models at once" in Preferences to display several models simultaneously.

> **💾 Models are Saved:** Custom models are stored in your browser's local storage. They persist across sessions but are specific to that browser/device.

> **🗑️ Removing Models:** Select your custom model from the "Custom Models" dropdown, then click the "Remove" button that appears below with the model info.

## 📐 Required Parameters for Full Functionality

For the best experience, your model should have these Live2D parameters:

| Parameter | Used For | Required? |
|-----------|----------|-----------|
| `ParamMouthOpenY` | Lip sync (mouth opening) | Yes, for speech |
| `ParamMouthForm` | Lip shape | Optional |
| `ParamEyeLOpen` / `ParamEyeROpen` | Blinking | Optional |
| `ParamAngleX` / `Y` / `Z` | Head rotation | Optional |
| `ParamBodyAngleX` | Body sway | Optional |

Most professionally-made models include these parameters. If you're creating your own, make sure to add at least `ParamMouthOpenY`!

## 🎉 You're Ready!

Now you know how to find, host, and add custom Live2D models to your AI companion. Go make it your own! 🎭
