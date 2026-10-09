# Waifu Sprites Player Card

After publishing this checkout, share **https://waifuai.github.io/waifu-sprites/**
on X. Its static HTML advertises a 480 × 480 Player Card, with the existing
`og.png` as its preview image. The player URL is
**https://waifuai.github.io/waifu-sprites/?embed=x**.

The embedded view uses the same app, sized to its iframe, with a **Full app**
link. Site navigation and the About section stay on the full page. Chats,
settings, speech preferences and stored pictures use a separate embed storage
namespace, so opening a card cannot display the normal app's saved chats or
reuse its saved provider credentials. Storage blocked by the host still allows
an in-memory chat, but it will not survive a reload.

Loading a card makes no inference request. Video clips load on demand instead
of warming the seven-clip cache. Automatic chat titles default to off in the
embed; user-triggered chats and image requests still use the usual proxy.

## Validation and publishing

Serve the repository root locally and open `/waifu-sprites/?embed=x`. Check
480 × 480 and narrow mobile frames, settings, chat submission and the full-app
link. Test requests can be mocked to avoid production inference usage.

This follows [X's Player Card metadata example](https://github.com/xdevplatform/cards-player-samples/blob/main/player/page.html).
Local iframe validation cannot confirm X acceptance or rendering. After
publishing, check the link in X on desktop and mobile before using it in a
campaign. X may cache old cards, show a preview instead, or restrict microphone,
audio, storage and popup access; visitors can use **Full app** when needed.
