# Matching avatar cropper

Crop one image into two matching square profile pictures for Discord. Runs entirely in the browser; images never leave your device.

**[Live site](https://afriendlypug.github.io/duo-avatar-cropper/)**

## Features

- Two independent square crops on a single shared image, or load a separate image for each avatar
- Zoom and pan the canvas (scroll wheel to zoom toward cursor, Space + drag to pan, or use the zoom bar)
- Adjustable mask opacity to see more or less of the uncropped area while you work
- Dashed circle guide showing Discord's circular crop mask
- Per-avatar rotation via slider, 90° step buttons, a drag handle on the crop, or the <kbd>[</kbd> and <kbd>]</kbd> keys — independent, linked (same angle), or linked opposite (handy for pairs leaning towards each other)
- Per-avatar horizontal mirror and vertical flip
- Centre crop button to reset a crop to the middle of its image
- Crop corners scale from the centre, so the crop stays centred as you resize
- Optional "keep both the same size" link
- Live previews at profile and chat size, plus a side-by-side circular preview with a swap button to flip which avatar appears on which side
- Copy the side-by-side preview to clipboard to paste directly into a chat
- PNG export at 256, 512 or 1024 px — download individually or both with one button press
- Drag and drop, paste from clipboard, keyboard nudging (<kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> to move, <kbd>+</kbd><kbd>−</kbd> to resize, <kbd>Shift</kbd> for larger steps)
- Respects your system light/dark preference

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Nudge active crop (hold <kbd>Shift</kbd> for 10× step) |
| <kbd>+</kbd> / <kbd>−</kbd> | Resize active crop |
| <kbd>[</kbd> / <kbd>]</kbd> | Rotate by 1° |
| <kbd>{</kbd> / <kbd>}</kbd> | Rotate by 15° |
| <kbd>1</kbd> / <kbd>2</kbd> | Switch active crop |
| <kbd>Space</kbd> + drag | Pan the canvas |
| Scroll wheel | Zoom in/out toward cursor |

## Dependencies

One network request: the Lato typeface loaded from Google Fonts. Everything else is plain HTML, CSS and JavaScript with no libraries and no build step.
