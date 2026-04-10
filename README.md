# Pomodoro App

Desktop Pomodoro timer for people who want the timer to stay visible while they work.

The key feature is not the sound. It is the desktop behavior: a compact always-on-top timer that stays above other windows, plus a full-screen attention view when a cycle ends.

## Highlights

- Compact always-on-top mode for macOS and Windows.
- Full-screen attention mode when a timer finishes.
- Slide-to-start control so the next stage starts intentionally, not from an accidental click.
- Focus, short break, and long break modes.
- Daily completed-session counter with reset after 05:00 local time.
- Synthesized completion sound as a secondary cue.
- Russian and English UI with an in-app language switch.
- Browser demo on GitHub Pages, with true always-on-top available only in the desktop app.

## Скачать / Download

Latest desktop builds are published in GitHub Releases:

https://github.com/IvanVokhtantsev/pomodoro-app/releases/latest

The website and browser demo are published with GitHub Pages.

## Почему desktop app?

Браузер не может надёжно держать вкладку поверх всех приложений. Desktop-версия может:

- держать компактный таймер поверх других окон;
- запретить случайное сворачивание compact-режима;
- развернуть окно поверх экрана, когда цикл завершён;
- вернуть окно обратно в обычный или compact-режим после slide-to-start.

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
- `npm run dist` builds the app and packages desktop installers.

## Deployment

GitHub Pages is configured with `.github/workflows/deploy.yml`. The workflow builds `dist` with the `/pomodoro-app/` base path and publishes the landing page plus browser demo.

Desktop downloads are attached to GitHub Releases after packaging with Electron Builder.

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
