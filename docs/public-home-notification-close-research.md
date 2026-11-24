# Public Home - temporary macOS notification X-close reference

## Exact action being adapted

The transient upper-right notification's **X close control**, not its timeout,
a swipe-right gesture, a Notification Center bulk-clear, or a banner/window
navigation animation. The homepage's Sign in click should visually dismiss
its glass tiles *as if they were miniature notification surfaces*, then route
to the real `/login` URL.

## What the sources actually establish

- Historical OS X 10.8 notifications disappeared in a **smoke-like poof**
  when the close button was clicked. Ars Technica's 2012 review specifically
  describes this as more realistic and less cartoonish than the Dock's old
  five-frame poof.
- AppKit has an `NSAnimationEffect.poof` API, and historical
  `NSUserNotificationPrivate._poofsOnCancel` provided a similar effect for
  notification alerts. Those are evidence of **the historical close action**,
  not proof of the current macOS 26 implementation.
- Read-only Colosseum `macos-decompile` inspection of the installed
  `/System/Library/CoreServices/NotificationCenter.app/Contents/MacOS/NotificationCenter`
  found `ncDismissAlert:withAnimation:completion:`,
  `BannerTransition`, `BannerTransitionModifier` and
  `NCCAController:dismissRemoteSession:withAnimation:` strings, but **no**
  `poof` string or recoverable public animation curve. The last task
  incorrectly treated swipe-offset symbols as proof of an X-close motion.
- `liquid-plexiglass-oracle` covers Glass material optics, SDF, refraction,
  blur/mip handling, and numerical precision. It does **not** contain a
  timestamped X-close notification animation capture or extracted smoke
  texture, easing, or native particle/animation source.

## Internal-only findings from macOS 26.5.1 (2026-11-20)

Per the user's restriction, **no screen recordings or screenshots were captured**.
The local Mac was inspected through `macos-decompile` and system
instrumentation instead:

- The current `NotificationCenter.app` executable exposes
  `NotificationsContentSmallCloseButton`, `BannerTransition`,
  `BannerTransitionModifier`, `_opacity`,
  `setAlphaValue:`, and `ncDismissAlert:withAnimation:completion:`.
  None establishes the X button's numerical animation parameters.
- The executable contains no obvious `poof`/smoke/particle shader
  identifier; `assetutil --info` on its `Assets.car` reports
  `blurMask` but no poof/smoke resource. This is **not proof** that
  the compositor has no procedural particle effect.
- Unified logs expose dismissal events but not their visual curves.
- A 1048-sample window-level `CGWindowListCopyWindowInfo` probe
  observed public notification overlay alpha at 1 until window
  removal. This API cannot read the internal Core Animation layer
  transformations responsible for the rendered disappearance.
- An 18-second `xctrace` SwiftUI instrumentation run attached to
  NotificationCenter during the X-close test yielded **no SwiftUI data**.
- `radare2` level-1 analysis discovered 18,619 native functions;
  metadata-string cross-reference queries did not reconstruct the
  actual X-close shader, easing, or alpha producer.

These are carefully scoped negative findings, not evidence that macOS
uses a particular smoke, shimmer, or dissolve animation.

## Browser adaptation, not a claimed exact reconstruction

`dashboard-public-dismiss.js` now uses an authored 440ms transition:
the existing WebGPU Liquid Glass surface loses opacity through a
spatially continuous, smoothly varying field, with minor local
edge-feathering. The original refracted colors and SDF are retained,
and the invented gray smoke/cloud material has been removed. Square
geometry expands by no more than 8.5% horizontally / 6.5% vertically;
drift stays within about one CSS pixel. The SVG glyphs fade and soften
with their corresponding squares.

The static CSS fallback uses only small expansion and local fade.
The backdrop, Doof logo and CTA exit, persistent theme switch,
reduced-motion routing, private authenticated dashboard and real
`/login` navigation remain separate.

**Precision limit:** No source-backed macOS 26.5.1 notification
X-close shader, visual reference, keyframe sequence, or exact duration
could be recovered under an internal-only capture policy. The numeric
parameters above are engineering approximations, not Apple's values.
Further changes should use verified native compositor evidence
instead of adding conjectural smoke or particles.

## Reference links

- [OS X 10.8 review - notification smoke](https://arstechnica.com/gadgets/2012/07/os-x-10-8/)
- [AppKit NSAnimationEffect.poof](https://developer.apple.com/documentation/appkit/nsanimationeffect)
- [Historic Notification private poof flag](https://github.com/indragiek/NSUserNotificationPrivate)
- [2016 X-click description](https://apple.stackexchange.com/questions/254657/how-can-i-speed-up-dismissal-animation-of-os-x-notification-dialog-boxes)
