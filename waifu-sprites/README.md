# Waifu Sprites Player Card

After publishing this checkout, share **https://waifuai.github.io/waifu-sprites/**
on X. Its static HTML advertises a 480 × 480 Player Card, with the existing
`og.png` as its preview image. The player URL is
**https://waifuai.github.io/waifu-sprites/?embed=x**.

The embedded view uses the same app, sized to its iframe, with a **Full app**
link. The full page is the same full-page app with site navigation on top.
Its documentation lives on a separate indexed page, `docs/`, opened from the
book button in the top bar. Chats,
settings, speech preferences and stored pictures use a separate embed storage
namespace, so opening a card cannot display the normal app's saved chats or
reuse its saved provider credentials. Storage blocked by the host still allows
an in-memory chat, but it will not survive a reload.

Loading a card makes no inference request. Video clips load on demand instead
of warming the seven-clip cache. Automatic chat titles default to off in the
embed; user-triggered chats and image requests still use the usual proxy.

## Validation and publishing

Built-in chat instructions are translated for all 13 interface locales plus
Bengali. An explicit reply language takes priority; automatic replies use the
interface locale for instruction prose while following the user's latest
message. All four built-in personas, emotion explanations, picture behavior,
context wrappers and the default ambient instruction are translated. Custom
prompts and stored memories stay intact. Emotion tags keep their existing names
and remain hidden from the displayed and spoken reply. See
[`i18n/README.md`](../i18n/README.md#chat-instructions).

Run `node --test "waifu-sprites/tests/*.cjs"` for the unit checks and
`python waifu-sprites/tests/test_chat_prompts_browser.py` for mocked Send checks
in the mobile full app and embed, including a failed prompt-bundle download.
These validate request construction and tag handling; real output-language
adherence and translation quality need separate review after publication.

Memory defaults to 30 recent conversational messages, raisable to 100 in
settings, including the current turn. Cloud context packing also limits older
history to 128 KiB and the complete serialized request to 256 KiB. It preserves
the newest message, persona and accepted summary; an oversized mandatory context
gives a recovery message rather than silently cutting text.

Summaries aim for a compact size and accept at most 32 KiB of UTF-8 text.
Compression uses 128 KiB transcript batches reduced further to fit the complete
request. Long
messages and legacy summaries resume from saved checkpoints. A failed, blank,
oversized or stale result cannot advance the covered-message boundary. The full
chat archive stays saved, and completed legacy compression retains the original
summary as a backup in chat exports. Automatic work runs one job per user turn,
with a two-minute failure cooldown; the manual button continues a backlog.
Manual summary edits show their byte count and preserve the saved memory when
validation fails.

Serve the repository root locally and open `/waifu-sprites/?embed=x`. Check
480 × 480 and narrow mobile frames, settings, chat submission and the full-app
link. Test requests can be mocked to avoid production inference usage.

Run the browser regression checks with
`python waifu-sprites/tests/test_player_card.py` from the repository root
(requires `pip install playwright` and `python -m playwright install chromium`).
They mock every network request and exercise actual typing, Send clicks and
Enter presses, including a host sandbox without `allow-forms`, blocked storage,
IME composition and empty messages. Send and Enter use direct JavaScript chat
actions because a host may block the native form submit event.

This follows [X's Player Card metadata example](https://github.com/xdevplatform/cards-player-samples/blob/main/player/page.html).
Local iframe validation cannot confirm X acceptance or rendering. After
publishing, check the link in X on desktop and mobile before using it in a
campaign. X may cache old cards, show a preview instead, or restrict microphone,
audio, storage and popup access; visitors can use **Full app** when needed.
