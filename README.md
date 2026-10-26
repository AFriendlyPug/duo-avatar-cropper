# Matching avatar cropper

Crop one image into two matching square profile pictures for Discord. Runs entirely in the browser; images never leave your device.

## Features

- Two independent square crops on one image, or a separate image per crop
- Dashed circle guide showing Discord's circular mask
- Live previews at profile and chat size, plus a side by side view
- Optional "keep both the same size" link and per-avatar mirroring
- Rotation for each avatar with a slider, 90° steps, a drag handle on the crop or the <kbd>[</kbd> and <kbd>]</kbd> keys, either independent, linked (same angle) or linked opposite (mirror image angles, handy for pairs that lean towards each other)
- PNG export at 256, 512 or 1024 px, individually or both as a .zip
- Drag and drop, paste from clipboard, keyboard nudging

## Publish on GitHub Pages

1. Create a new repository and add `index.html` (and this README) to the root.
2. Go to **Settings > Pages**.
3. Under **Build and deployment**, set Source to **Deploy from a branch**, choose `main` and `/ (root)`, then save.
4. After a minute or so the site is live at `https://<your-username>.github.io/<repo-name>/`.

## Dependencies

JSZip 3.10.1 loaded from cdnjs (used only for the "Download both" zip). Everything else is plain HTML, CSS and JavaScript.
