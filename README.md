# Pomogochi

Desktop focus timer that blends Pomodoro with a small Tamagotchi-like break companion.

The key feature is the desktop behavior: a compact always-on-top timer that stays above other windows, plus a full-screen Pomogochi character that appears during breaks and gently pulls you away from work.

Pomogochi = Pomodoro + Tamagotchi.

## Highlights

- Compact always-on-top mode for macOS and Windows.
- Full-screen Pomogochi break mode for 5-minute and 15-minute breaks.
- Automatic transition from focus into break, and from break into the next focus cycle.
- Clickable break character that reacts with a playful shape change and bubbles.
- Break character starts excited and red, then calms down as the break progresses if you leave it alone.
- Compact mode uses a tight 3x3 control grid so the timer stays readable in a small always-on-top window.
- Focus, short break, and long break modes.
- Daily completed-session counter with reset after 05:00 local time.
- Synthesized completion sound as a secondary cue.
- Russian and English UI with an in-app language switch.
- Browser demo on GitHub Pages, with true always-on-top available only in the desktop app.

## Download

Latest desktop builds are published in GitHub Releases:

https://github.com/IvanVokhtantsev/pomodoro-app/releases/latest

The website and browser demo are published with GitHub Pages.

## Why A Desktop App?

Browsers cannot reliably keep a tab above every other application. The desktop version can:

- keep the compact timer above other windows;
- prevent compact mode from being minimized accidentally;
- expand into a full-screen Pomogochi break companion;
- return to the previous regular or compact window state when the break ends.

## Development

Install dependencies:

```bash
npm install
```

Run the app in development mode:

```bash
npm run dev
```

This starts the Vite renderer and the Electron desktop shell together.

## Scripts

- `npm run dev` starts the local development app.
- `npm run build` type-checks and builds the renderer and Electron files.
- `npm run lint` runs ESLint.
- `npm run start` starts Electron from the built Electron entrypoint.
- `npm run dist` builds the app and packages desktop installers for the current OS.

## Deployment

GitHub Pages is configured with `.github/workflows/deploy.yml`. The workflow builds `dist` with the `/pomodoro-app/` base path and publishes the landing page plus browser demo.

Desktop release publishing is configured with `.github/workflows/release.yml`.

How to publish a production release:

1. Update app changes and commit to `main`.
2. Create a version tag like `v1.0.0`.
3. Push the tag to GitHub (`git push origin v1.0.0`).
4. GitHub Actions builds macOS (`.dmg`) and Windows (`.exe`) installers.
5. The workflow attaches all artifacts to the matching GitHub Release.

## Build Output

Generated folders are ignored by git:

- `dist` for the Vite renderer build.
- `electron-dist` for compiled Electron files.
- `release` for packaged desktop artifacts.
- `node_modules` for installed dependencies.

## Tech Stack

- React 19
- TypeScript
- Vite
- Electron
- Electron Builder
