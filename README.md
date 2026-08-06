# Song Scratch

A lightweight place to scratch down the pieces of a song: **chord
progressions**, **lyrics**, and **voice notes**. These aren't saved on their
own — each of the three is a **tab inside one save** (one song). Black
background, white text, grey for detail; deliberately close to iOS Notes and
Voice Memos.

One codebase runs on Windows (dev), an iPhone (as an installable web app now,
and a native App Store build later via Capacitor).

> Status: **foundation only.** The toolchain, theme and iPhone workflow are in
> place. The actual screens are built step by step from here.

---

## Quick start (Windows)

```bash
npm install
```

```bash
npm run icons
```

```bash
npm run dev
```

Open <http://localhost:5173>. `localhost` counts as a secure context, so the
microphone (for voice notes) works without any certificate setup.

## Running it on your iPhone 12 — no Mac needed

### Option A — over your network (fastest for a quick look)

```bash
npm run phone
```

Vite prints several addresses. **Use the one on your LAN subnet** — the
`192.168.x.x` one. The others are not reachable from a phone and will fail with
"Safari can't open the page":

- `25.x.x.x` (Hamachi), `10.x.x.x` (NordVPN/NordLynx) — VPN adapters
- `169.254.x.x` — link-local fallback, meaning that adapter has no real address

This serves over plain HTTP, so there is no certificate warning. Everything
works except the microphone, which browsers only grant on a secure origin — so
reach for this until the voice tab exists.

### Option B — HTTPS on your network (needed for voice memos)

```bash
npm run phone:https
```

The certificate is self-signed, so Safari shows **"This Connection Is Not
Private."** That is expected, not a failure. Tap **Show Details** → **visit this
website** → **Visit Website**. Safari remembers it for that address.

### Option B — GitHub Pages (a real certificate, works anywhere)

Push to `main`. The Deploy workflow builds and publishes to
`https://<user>.github.io/SongScratch/` over HTTPS with a proper certificate —
no warning to click through, and reachable off your network.

One-time setup: repo **Settings → Pages → Source: "GitHub Actions."**

### Keep it on the home screen

In Safari: **Share → Add to Home Screen.** It then launches full-screen with no
browser chrome, and works offline (a service worker caches the app shell).

## Building native App Store apps later

The project is Capacitor-ready (`capacitor.config.json`, `webDir: dist`). A
native iOS build ultimately needs a Mac with Xcode, but everything up to that
point is done on Windows. When the time comes:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
```

The microphone needs a usage string on both platforms — `NSMicrophoneUsageDescription`
in `ios/App/App/Info.plist`, and `RECORD_AUDIO` in the Android manifest.

---

## How it's built

- **Vite + React + TypeScript**, shipped as an installable PWA. Same stack and
  iPhone-testing approach as the OpusTuner project.
- **Black / white / grey theme** via CSS variables in
  [`src/styles/app.css`](src/styles/app.css) — everything downstream reads from
  those tokens.
- **Data lives on the device in IndexedDB**, not a server and not `localStorage`.
  Voice recordings are audio blobs far too large for `localStorage`'s few MB,
  and IndexedDB stores blobs natively. No account, no network.

### The data model (the shape everything is built around)

A **Song** is one save. The three sections are tabs *within* it, never saved
separately:

```
Song
  id, title, tuning, description, createdAt, updatedAt
  ├── chords    — the chosen chords / progressions
  ├── lyrics    — sections (Verse, Chorus, Bridge…), each with a chord line and lyrics
  └── voice     — a list of recordings (each: name = date/time, audio blob, duration)
```

The lyric tab renders top-to-bottom: title, tuning, italic description, then per
section a heading, the section's chord progression (bold), and the lyrics.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server on localhost |
| `npm run phone` | build + serve over HTTP on your LAN, for the iPhone |
| `npm run phone:https` | same but HTTPS (self-signed) — needed for the microphone |
| `npm run host` | dev server over HTTPS on your LAN (quick checks) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run build` | typecheck + production build to `dist/` |
| `npm run preview` | serve the production build |
| `npm run icons` | regenerate the PWA icon set |
