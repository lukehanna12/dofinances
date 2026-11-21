# Public Home — temporary macOS notification X-close reference

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

## Browser adaptation, not a claimed exact reconstruction

`dashboard-public-dismiss.js` orchestrates the bounded 620ms animation.
The GPU shader keeps the existing Glass optics entirely unchanged until a
click, then adds an interpolated multi-scale **soft smoke** field over an
expanding material silhouette. Organic rounded billows replace pixel
breakup. Glass disappears as the fog appears; the fog then expands, thins,
and disappears. DOM SVG glyphs fade and blur with their owning square.

The static CSS fallback makes the same *in-place* blur/expansion/fade without
running a GPU shader. The background, Doof title fade and theme icon are
never hidden by the smoke. Reduced-motion uses immediate navigation. The
`/login` navigation and authentication internals remain unchanged.

Timing, smoke color, noise field, stage thresholds, and drift are all
**original browser approximations**. Matching the current macOS 26
notification X-close pixel-for-pixel would require a reproducible native
screen capture of that specific click and its Core Animation/rendering data.

## Reference links

- [OS X 10.8 review — notification smoke](https://arstechnica.com/gadgets/2012/07/os-x-10-8/)
- [AppKit NSAnimationEffect.poof](https://developer.apple.com/documentation/appkit/nsanimationeffect)
- [Historic Notification private poof flag](https://github.com/indragiek/NSUserNotificationPrivate)
- [2016 X-click description](https://apple.stackexchange.com/questions/254657/how-can-i-speed-up-dismissal-animation-of-os-x-notification-dialog-boxes)
