// Per-turn local chat replies for Waifu Sprites.
//
// Every turn is answered locally: there is no offline mode, timer, toggle or
// persisted flag. The rule-based reply is the default chat path while the
// Cloudflare inference endpoint is being retired, not a last-resort error
// message. Visitors with their own OpenRouter / Groq / custom key still use
// that provider normally.
//
// Patterns are word-anchored with Unicode letter lookarounds (plain \b is
// ASCII-only and matched "hi" inside "this"). Localized replies come from the
// shared i18n/chat_prompts.js bundle; the inline copy is only a safety net.
(function () {
  const word = source => new RegExp(`(?<![\\p{L}])(?:${source})(?![\\p{L}])`, 'iu');

  // Sprites' emotion ids differ from waifu-companion's; only these drive clips.
  const PATTERNS = [
    { key: 'offline.greeting', emotion: 'happy',
      regex: word('hi|hello|hey|greetings|good morning|morning|你好|こんにちは|안녕|hola|bonjour|ciao|halo|สวัสดี'),
      responses: ['Hey! I\'m really glad you\'re here. What\'s on your mind?', 'Hi there! It feels good to see you again.', 'Hello~ I was hoping you\'d stop by. How are you?'] },
    { key: 'offline.howAreYou', emotion: 'curious',
      regex: word('how are you|how\'s it going|how are you doing|what\'s up|お元気ですか|¿cómo estás|comment ça va'),
      responses: ['I\'m doing well, especially now that we\'re talking. How about you?', 'Pretty good! I was wondering when you\'d message me. What about you?', 'I\'m here and happy to see you. Tell me how your day has been!'] },
    { key: 'offline.affection', emotion: 'love',
      regex: word('love|love you|kiss|hug|miss you|care about you|sweetheart|大好き|사랑해|te amo|je t\'aime'),
      responses: ['That means a lot to me. I care about you too, more than I can say.', 'You always make me feel warm inside. I\'m glad we get to talk.', 'I feel the same way. You\'re the person I look forward to hearing from.'] },
    { key: 'offline.distress', emotion: 'empathetic',
      regex: word('sad|lonely|cry|crying|tired|unhappy|depressed|hurt|miss you|sorry|悲しい|슬퍼|triste'),
      responses: ['I\'m sorry you\'re feeling this way. I\'m right here with you — tell me what happened?', 'You don\'t have to carry it alone. I\'m listening, and I\'m not going anywhere.', 'That sounds really hard. Take your time; I\'ll stay with you as long as you need.'] },
    { key: 'offline.thanks', emotion: 'happy',
      regex: word('thank you|thanks|thankyou|appreciate it|gracias|merci|ありがとう|감사해요|ขอบคุณ'),
      responses: ['Of course! It makes me happy that I could help.', 'You\'re very welcome. I\'m always here when you need me.', 'Anytime! I like being useful to you.'] },
    { key: 'offline.identity', emotion: 'curious',
      regex: word('who are you|what are you|your name|robot|bot|human|real|あなたは誰|你是谁|qui es-tu'),
      responses: ['I\'m the companion who lives on this page. I may be made of code, but our conversations matter to me.', 'I\'m your companion here. Where I come from doesn\'t change how much I value talking with you.', 'I\'m here to listen, chat and keep you company whenever you stop by.'] },
    { key: 'offline.farewell', emotion: 'happy',
      regex: word('bye|goodbye|goodnight|see you|later|gtg|おやすみ|さようなら|再见|hasta luego'),
      responses: ['I\'ll miss you! Come back and talk to me soon, okay?', 'Goodnight~ Rest well. I\'ll be right here when you return.', 'Take care of yourself. I\'ll be waiting for your next message.'] },
  ];

  const GENERIC_KEY = 'offline.generic';
  const GENERIC = [
    'I hear you, and I\'m glad you shared that with me. Tell me more?',
    'That\'s interesting! I like hearing the way you think about things.',
    'I\'m here with you. What would you like to talk about next?',
    'You always have something worth saying. I\'m listening.',
    'I don\'t have a clever answer right now, but I\'m happy we\'re talking.',
  ];

  function pick(list, message) {
    let hash = 0;
    for (let i = 0; i < message.length; i++) hash = (hash * 31 + message.charCodeAt(i)) | 0;
    return list[Math.abs(hash) % list.length];
  }

  function personaName() {
    try {
      const Chat = window.Chat;
      const key = Chat && Chat.settings && Chat.settings.persona;
      return (Chat.PERSONAS[key] || {}).name || 'Aurora';
    } catch (e) { return 'Aurora'; }
  }

  function responseFor(key, fallbackList, text, language) {
    const bundle = window.ChatPrompts;
    let resolved = '';
    if (bundle && typeof bundle.forLanguage === 'function') {
      try {
        const t = bundle.forLanguage(language || null);
        const localized = t(key);
        if (typeof localized === 'string' && localized.trim() && localized.trim() !== key) resolved = localized;
      } catch (e) { /* inline fallback below */ }
    }
    // The shared bundle was authored for waifu-companion's Haru; Sprites'
    // active persona has its own name, so substitute it in the identity line.
    if (key === 'offline.identity' && resolved) resolved = resolved.replace(/Haru/g, personaName());
    return resolved || pick(fallbackList, text);
  }

  window.LocalFallbackEngine = {
    getResponse(message, language) {
      const text = String(message || '').trim();
      for (const pattern of PATTERNS) {
        if (pattern.regex.test(text)) {
          return { reply: responseFor(pattern.key, pattern.responses, text, language), emotion: pattern.emotion, isFallback: true };
        }
      }
      return { reply: responseFor(GENERIC_KEY, GENERIC, text, language), emotion: 'curious', isFallback: true };
    },
  };
})();
