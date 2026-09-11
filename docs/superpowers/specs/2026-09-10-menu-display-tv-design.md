# Menu Display TV — approved MVP

User approved a standalone Kotlin Google TV / Android TV application under
`apps/menu-display-tv`. Apple tvOS is outside this implementation.

## User flow
TV launches an offline image library. Upload screen shows LAN IPv4 addresses,
a QR code for the browser page and a six-digit pairing code. A phone/computer
on the same LAN uploads JPG, PNG or WebP, stored privately on the TV.
Library offers thumbnails, preview/display, rename, delete and storage usage.
Select an image for fullscreen fit-center display with black letterboxing.
Slideshow editor allows selecting images, ordering with buttons and choosing
5/10/15/30/60 second intervals. Playback loops; OK pauses/resumes, arrows step,
Back returns to library. Remember image/playlist and resume on app reopen.

## Architecture and limits
Native Android Activity and views, Kotlin storage repository, bounded embedded
HTTP server, bundled browser assets, ZXing for local QR generation. No cloud,
accounts or POS dependency. Upload listener lives only while Activity is in
foreground; playback works without a network. Pairing codes rotate each listener
session and are rate limited. Browser requests authenticate with a header;
no cross-origin access. Raw uploads avoid multipart temporary-file expansion.
20 MiB/file, 50 megapixels/source, 500 MiB library, 200 images; validate actual
decoded type and bound decode size. Atomic metadata writes and upload cleanup.
Network/upload/storage/decode errors remain visible and do not replace the
current display. Image decoding runs off the UI thread with bounded sampling.

## Screen behavior and validation
Fullscreen playback holds FLAG_KEEP_SCREEN_ON while foreground. Clear it when
leaving playback. System Home/power remain functional; this is not a device-owner
kiosk or boot launcher. TV-level power timers require device configuration.
Unit tests cover HTTP authorization and malformed requests, upload bounds,
playlist reconciliation and persistence. Build/lint verify Android integration.
Actual TV checks must cover D-pad focus, upload over LAN, offline reopen,
long-duration static/slideshow playback and TV-specific sleep behavior.
