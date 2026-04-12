import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import landingBreakPreviewRu from "./assets/landing-break-preview-ru.png";
import landingCompactPreviewRu from "./assets/landing-compact-preview-ru.png";
import landingBreakPreviewEn from "./assets/landing-break-preview-en.png";
import landingCompactPreviewEn from "./assets/landing-compact-preview-en.png";
import "./App.css";

type Mode = "focus" | "shortBreak" | "longBreak";
type Language = "ru" | "en";

type TimerState = {
  mode: Mode;
  secondsLeft: number;
  isRunning: boolean;
  completedPomodoros: number;
  focusStreak: number;
  endTime: number | null;
  statsDayKey: string;
};

type CompletionCue = {
  id: number;
  completedMode: Mode;
};

type SlideToStartProps = {
  label: string;
  completeLabel: string;
  onComplete: () => void;
};

type AdvanceTimerOptions = {
  startNext?: boolean;
  timestamp?: number;
};

type TimerPanelProps = {
  mode: Mode;
  title: string;
  eyebrow?: string;
  heading?: string;
  subtitle?: string;
  secondsLeft: number;
  isRunning: boolean;
  completedPomodoros: number;
  isCompactMode: boolean;
  isDesktopApp: boolean;
  miniModeEnabled: boolean;
  showMiniModeControl?: boolean;
  language: Language;
  copy: AppCopy;
  onSwitchMode: (mode: Mode) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
  onToggleMiniMode?: () => void;
  onToggleLanguage: () => void;
};

const DURATIONS: Record<Mode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const STATS_RESET_HOUR = 5;

const DEFAULT_STATE: TimerState = {
  mode: "focus",
  secondsLeft: DURATIONS.focus,
  isRunning: false,
  completedPomodoros: 0,
  focusStreak: 0,
  endTime: null,
  statsDayKey: "",
};

const STORAGE_KEY = "pomogochi_state_v1";
const LANGUAGE_STORAGE_KEY = "pomogochi_language_v1";
const LEGACY_STORAGE_KEY = "pomodoro_state_v2";
const LEGACY_LANGUAGE_STORAGE_KEY = "pomodoro_language_v1";
const SYNC_CHANNEL = "pomogochi_sync_v1";
const DOWNLOAD_URL = "https://github.com/IvanVokhtantsev/pomogochi/releases/latest";
const REPOSITORY_URL = "https://github.com/IvanVokhtantsev/pomogochi";
const WINDOW_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `window-${Math.random().toString(36).slice(2)}`;

const COPY = {
  ru: {
    languageLabel: "Переключить на English",
    modes: {
      focus: "Фокус",
      shortBreak: "Короткий перерыв",
      longBreak: "Длинный перерыв",
    },
    landing: {
      kicker: "Pomogochi",
      title: "Фокус-таймер с питомцем для перерывов",
      lead:
        "Pomogochi соединяет Pomodoro и Tamagotchi: компактный таймер остаётся поверх окон, а перерыв превращается в полноэкранного персонажа, который мягко отвлекает от работы.",
      download: "Скачать приложение",
      demo: "Открыть демо",
      notePrefix: "Важно:",
      note:
        "настоящий always-on-top и Pomogochi-перерыв поверх экрана работают в desktop-версии. В браузере можно попробовать механику таймера.",
      showcaseMode: "Перерыв",
      showcaseStart: "Старт",
      showcaseReset: "Сброс",
      showcaseSkip: "Пропуск",
      features: [
        {
          title: "Поверх всех окон",
          text: "Compact-режим держит таймер видимым во время работы в других приложениях.",
        },
        {
          title: "Pomogochi-перерыв",
          text: "После фокуса окно раскрывается в большого персонажа на 5 или 15 минут.",
        },
        {
          title: "Мягкий возврат к циклу",
          text: "Когда перерыв заканчивается, Pomogochi возвращает тебя к следующему фокусу.",
        },
      ],
      demoKicker: "Browser timer",
      demoTitle: "Таймер в браузере",
      demoText:
        "Это онлайн-демо с фокусом, перерывами и сохранением состояния. Для окна поверх всех приложений и полноэкранного Pomogochi скачай desktop app.",
      footerStack: "React + TypeScript + Vite + Electron",
    },
    timer: {
      desktopEyebrow: "Desktop timer",
      onlineEyebrow: "Online demo",
      desktopHeading: "Pomogochi",
      onlineHeading: "Онлайн-таймер",
      desktopSubtitle:
        "Держи фокус-таймер поверх окон, а перерыв отдавай Pomogochi-персонажу.",
      onlineSubtitle:
        "Браузерная версия таймера. Настоящий always-on-top и Pomogochi-перерыв доступны в desktop-приложении.",
      enableAlwaysOnTop: "Включить always-on-top",
      disableAlwaysOnTop: "Выключить always-on-top",
      alwaysOnTopUnavailable: "Always-on-top доступен в desktop app",
      openCompactTitle: "Открыть компактное окно поверх остальных приложений",
      restoreNormalTitle: "Вернуть обычный размер окна",
      desktopOnlyTitle: "Режим доступен только в desktop-приложении",
      normalView: "Обычный",
      desktopOnly: "Desktop",
      modeAria: "Режим таймера",
      controlsAria: "Управление таймером",
      start: "Старт",
      pause: "Пауза",
      reset: "Сброс",
      skip: "Пропустить",
      completedToday: "Завершено сегодня",
      today: "Сегодня",
      todayCompact: "Д",
      running: "Идёт",
      paused: "Пауза",
      runningShort: "●",
      pausedShort: "II",
      compactStart: "▶",
      compactPause: "II",
      compactReset: "↺",
      compactSkip: "»",
    },
    completion: {
      kicker: "Timer alert",
      focusTitle: "Фокус завершён",
      breakTitle: "Перерыв завершён",
      focusMessage: "Пора переключиться и дать голове выдохнуть.",
      breakMessage: "Можно возвращаться к следующему фокус-циклу.",
      slideLabel: "Потяни, чтобы начать следующий этап",
      slideComplete: "Стартуем",
    },
    pomogochi: {
      aria: "Экран перерыва Pomogochi",
      kicker: "Pomogochi break",
      shortTitle: "Pomogochi зовёт на 5 минут",
      longTitle: "Pomogochi зовёт на 15 минут",
      shortMessage: "Отведи взгляд, расправь плечи, дай голове выдохнуть.",
      longMessage: "Можно встать, пройтись и вернуться уже с новым запасом внимания.",
      helper: "Когда перерыв закончится, следующий фокус начнётся автоматически.",
      remaining: "Осталось",
      skip: "Пропустить перерыв",
      petAction: "Кликнуть Pomogochi",
    },
  },
  en: {
    languageLabel: "Switch to Russian",
    modes: {
      focus: "Focus",
      shortBreak: "Short break",
      longBreak: "Long break",
    },
    landing: {
      kicker: "Pomogochi",
      title: "A focus timer with a break-time pet",
      lead:
        "Pomogochi blends Pomodoro with Tamagotchi: the compact timer stays above your work, then breaks become a full-screen character that gently pulls you away.",
      download: "Download app",
      demo: "Open demo",
      notePrefix: "Note:",
      note:
        "true always-on-top and the full-screen Pomogochi break are available in the desktop app. The browser demo lets you try the timer flow.",
      showcaseMode: "Break",
      showcaseStart: "Start",
      showcaseReset: "Reset",
      showcaseSkip: "Skip",
      features: [
        {
          title: "Above every window",
          text: "Compact mode keeps the timer visible while you work in other apps.",
        },
        {
          title: "Pomogochi breaks",
          text: "After focus, the window expands into a big character for 5 or 15 minutes.",
        },
        {
          title: "A softer return",
          text: "When the break ends, Pomogochi brings you back into the next focus cycle.",
        },
      ],
      demoKicker: "Browser timer",
      demoTitle: "Try it online",
      demoText:
        "This online demo includes focus, breaks, and saved state. Download the desktop app for true always-on-top and the full Pomogochi break screen.",
      footerStack: "React + TypeScript + Vite + Electron",
    },
    timer: {
      desktopEyebrow: "Desktop timer",
      onlineEyebrow: "Online demo",
      desktopHeading: "Pomogochi",
      onlineHeading: "Online timer",
      desktopSubtitle:
        "Keep the focus timer above your windows, then hand breaks to the Pomogochi character.",
      onlineSubtitle:
        "Browser timer demo. True always-on-top and Pomogochi breaks are available in the desktop app.",
      enableAlwaysOnTop: "Enable always-on-top",
      disableAlwaysOnTop: "Disable always-on-top",
      alwaysOnTopUnavailable: "Always-on-top needs the desktop app",
      openCompactTitle: "Open the compact always-on-top window",
      restoreNormalTitle: "Return to the regular window size",
      desktopOnlyTitle: "This mode is available only in the desktop app",
      normalView: "Normal",
      desktopOnly: "Desktop",
      modeAria: "Timer mode",
      controlsAria: "Timer controls",
      start: "Start",
      pause: "Pause",
      reset: "Reset",
      skip: "Skip",
      completedToday: "Completed today",
      today: "Today",
      todayCompact: "D",
      running: "Running",
      paused: "Paused",
      runningShort: "●",
      pausedShort: "II",
      compactStart: "▶",
      compactPause: "II",
      compactReset: "↺",
      compactSkip: "»",
    },
    completion: {
      kicker: "Timer alert",
      focusTitle: "Focus complete",
      breakTitle: "Break complete",
      focusMessage: "Time to switch context and let your brain breathe.",
      breakMessage: "You can return to the next focus cycle.",
      slideLabel: "Slide to start the next stage",
      slideComplete: "Starting",
    },
    pomogochi: {
      aria: "Pomogochi break screen",
      kicker: "Pomogochi break",
      shortTitle: "Pomogochi wants 5 minutes",
      longTitle: "Pomogochi wants 15 minutes",
      shortMessage: "Look away, stretch your shoulders, and let your brain breathe.",
      longMessage: "Stand up, wander a little, and come back with fresh attention.",
      helper: "When the break ends, the next focus cycle starts automatically.",
      remaining: "Remaining",
      skip: "Skip break",
      petAction: "Click Pomogochi",
    },
  },
} as const;

type AppCopy = (typeof COPY)[Language];

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function getStatsDayKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  date.setHours(date.getHours() - STATS_RESET_HOUR);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function clampSeconds(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeDailyStats(state: TimerState, timestamp = Date.now()): TimerState {
  const currentStatsDayKey = getStatsDayKey(timestamp);

  if (state.statsDayKey === currentStatsDayKey) {
    return state;
  }

  return {
    ...state,
    completedPomodoros: 0,
    focusStreak: 0,
    statsDayKey: currentStatsDayKey,
  };
}

function sanitizeState(candidate: unknown): TimerState {
  if (!candidate || typeof candidate !== "object") {
    return normalizeDailyStats(DEFAULT_STATE);
  }

  const data = candidate as Partial<TimerState>;
  const mode: Mode =
    data.mode === "focus" || data.mode === "shortBreak" || data.mode === "longBreak"
      ? data.mode
      : "focus";
  const isRunning = Boolean(data.isRunning);
  const endTime =
    typeof data.endTime === "number" && Number.isFinite(data.endTime) ? data.endTime : null;
  const secondsLeft = clampSeconds(
    typeof data.secondsLeft === "number"
      ? data.secondsLeft
      : endTime
        ? Math.ceil((endTime - Date.now()) / 1000)
        : DURATIONS[mode]
  );

  return normalizeDailyStats({
    mode,
    secondsLeft,
    isRunning: isRunning && endTime !== null && secondsLeft > 0,
    completedPomodoros:
      typeof data.completedPomodoros === "number" && Number.isFinite(data.completedPomodoros)
        ? Math.max(0, Math.floor(data.completedPomodoros))
        : 0,
    focusStreak:
      typeof data.focusStreak === "number" && Number.isFinite(data.focusStreak)
        ? Math.max(0, Math.floor(data.focusStreak))
        : 0,
    endTime: isRunning && secondsLeft > 0 ? endTime : null,
    statsDayKey: typeof data.statsDayKey === "string" ? data.statsDayKey : "",
  });
}

function readStoredState() {
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_STATE;
  }

  try {
    return sanitizeState(JSON.parse(raw));
  } catch {
    return DEFAULT_STATE;
  }
}

function readStoredLanguage(): Language {
  const stored =
    localStorage.getItem(LANGUAGE_STORAGE_KEY) ??
    localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);
  if (stored === "ru" || stored === "en") {
    return stored;
  }

  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
}

function getRemainingSeconds(endTime: number) {
  return Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
}

function advanceTimer(state: TimerState, options: AdvanceTimerOptions = {}) {
  const startNext = Boolean(options.startNext);
  const timestamp = options.timestamp ?? Date.now();

  if (state.mode === "focus") {
    const nextStreak = state.focusStreak + 1;
    const nextMode: Mode = nextStreak % 4 === 0 ? "longBreak" : "shortBreak";
    const secondsLeft = DURATIONS[nextMode];

    return {
      mode: nextMode,
      secondsLeft,
      isRunning: startNext,
      completedPomodoros: state.completedPomodoros + 1,
      focusStreak: nextStreak,
      endTime: startNext ? timestamp + secondsLeft * 1000 : null,
      statsDayKey: state.statsDayKey,
    };
  }

  const secondsLeft = DURATIONS.focus;

  return {
    mode: "focus" as const,
    secondsLeft,
    isRunning: startNext,
    completedPomodoros: state.completedPomodoros,
    focusStreak: state.focusStreak,
    endTime: startNext ? timestamp + secondsLeft * 1000 : null,
    statsDayKey: state.statsDayKey,
  };
}

function getCompletionCopy(mode: Mode, copy: AppCopy) {
  if (mode === "focus") {
    return {
      title: copy.completion.focusTitle,
      message: copy.completion.focusMessage,
    };
  }

  return {
    title: copy.completion.breakTitle,
    message: copy.completion.breakMessage,
  };
}

function scheduleBellNote(
  ctx: AudioContext,
  startAt: number,
  frequency: number,
  duration: number,
  pan: number
) {
  const masterGain = ctx.createGain();
  const lowPartial = ctx.createOscillator();
  const midPartial = ctx.createOscillator();
  const highPartial = ctx.createOscillator();
  const panner = ctx.createStereoPanner();

  lowPartial.type = "sine";
  midPartial.type = "triangle";
  highPartial.type = "sine";

  lowPartial.frequency.setValueAtTime(frequency, startAt);
  midPartial.frequency.setValueAtTime(frequency * 2, startAt);
  highPartial.frequency.setValueAtTime(frequency * 3.01, startAt);

  panner.pan.setValueAtTime(pan, startAt);

  masterGain.gain.setValueAtTime(0.0001, startAt);
  masterGain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.02);
  masterGain.gain.exponentialRampToValueAtTime(0.035, startAt + 0.12);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  lowPartial.connect(masterGain);
  midPartial.connect(masterGain);
  highPartial.connect(masterGain);
  masterGain.connect(panner);
  panner.connect(ctx.destination);

  lowPartial.start(startAt);
  midPartial.start(startAt);
  highPartial.start(startAt);

  lowPartial.stop(startAt + duration);
  midPartial.stop(startAt + duration);
  highPartial.stop(startAt + duration);
}

async function playCompletionTone() {
  const toneTasks: Promise<unknown>[] = [];
  let synthesized = false;

  try {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const notes = [
        { offset: 0, frequency: 1318.51, duration: 0.78, pan: -0.12 },
        { offset: 0.18, frequency: 1760, duration: 0.9, pan: 0.12 },
        { offset: 0.64, frequency: 1318.51, duration: 0.72, pan: -0.08 },
        { offset: 0.82, frequency: 1760, duration: 0.84, pan: 0.08 },
      ];

      notes.forEach((note) => {
        scheduleBellNote(
          ctx,
          now + note.offset,
          note.frequency,
          note.duration,
          note.pan
        );
      });
      synthesized = true;

      toneTasks.push(
        new Promise((resolve) => {
          window.setTimeout(() => {
            void ctx.close();
            resolve(undefined);
          }, 1900);
        })
      );
    }
  } catch {
    // ignore browser audio errors
  }

  if (!synthesized && window.electronAPI?.playTimerSound) {
    toneTasks.push(window.electronAPI.playTimerSound());
  }

  await Promise.allSettled(toneTasks);
}

function LanguageToggle({
  language,
  onToggle,
  className = "",
  label,
}: {
  language: Language;
  onToggle: () => void;
  className?: string;
  label: string;
}) {
  return (
    <button
      className={`language-toggle ${className}`}
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
    >
      <span className={language === "ru" ? "active" : ""}>RU</span>
      <span className={language === "en" ? "active" : ""}>EN</span>
    </button>
  );
}

function SlideToStart({ label, completeLabel, onComplete }: SlideToStartProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const syncTrackWidth = () => {
      setTrackWidth(track.getBoundingClientRect().width);
    };

    syncTrackWidth();
    const resizeObserver = new ResizeObserver(syncTrackWidth);
    resizeObserver.observe(track);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const updateProgress = (clientX: number) => {
    const track = trackRef.current;
    if (!track || completedRef.current) {
      return;
    }

    const rect = track.getBoundingClientRect();
    const dragDistance = Math.max(1, rect.width - 58);
    const nextProgress = Math.min(1, Math.max(0, (clientX - dragStartXRef.current) / dragDistance));
    setProgress(nextProgress);

    if (nextProgress >= 0.92) {
      completedRef.current = true;
      setProgress(1);
      onComplete();
    }
  };

  return (
    <div
      ref={trackRef}
      className={`slide-to-start ${isDragging ? "slide-to-start--dragging" : ""}`}
      style={
        {
          "--slide-progress": `${progress * 100}%`,
          "--slide-knob-left": `${4 + progress * Math.max(0, trackWidth - 58)}px`,
        } as CSSProperties
      }
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStartXRef.current = event.clientX;
        setIsDragging(true);
      }}
      onPointerMove={(event) => {
        if (isDragging) {
          updateProgress(event.clientX);
        }
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setIsDragging(false);

        if (!completedRef.current) {
          setProgress(0);
        }
      }}
      onPointerCancel={() => {
        setIsDragging(false);

        if (!completedRef.current) {
          setProgress(0);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          completedRef.current = true;
          setProgress(1);
          onComplete();
        }
      }}
    >
      <span className="slide-to-start-fill" />
      <span className="slide-to-start-label">
        {progress >= 0.92 ? completeLabel : label}
      </span>
      <span className="slide-to-start-knob">→</span>
    </div>
  );
}

function CompletionOverlay({
  completedMode,
  copy,
  onContinue,
}: {
  completedMode: Mode;
  copy: AppCopy;
  onContinue: () => void;
}) {
  const completionCopy = getCompletionCopy(completedMode, copy);

  return (
    <div className="completion-overlay" aria-live="assertive" role="status">
      <div className="completion-overlay-card">
        <span className="completion-overlay-kicker">{copy.completion.kicker}</span>
        <strong>{completionCopy.title}</strong>
        <span>{completionCopy.message}</span>
        <SlideToStart
          label={copy.completion.slideLabel}
          completeLabel={copy.completion.slideComplete}
          onComplete={onContinue}
        />
      </div>
    </div>
  );
}

function PomogochiBreakOverlay({
  mode,
  secondsLeft,
  copy,
  onSkip,
}: {
  mode: Mode;
  secondsLeft: number;
  copy: AppCopy;
  onSkip: () => void;
}) {
  const CLICK_PENALTY_STEP = 0.18;
  const CLICK_PENALTY_DECAY = 0.012;
  const isLongBreak = mode === "longBreak";
  const [reactionCount, setReactionCount] = useState(0);
  const [clickPenalty, setClickPenalty] = useState(0);
  const agitation = clickPenalty;
  const easedAgitation = agitation * agitation * (3 - 2 * agitation);
  const calmProgress = 1 - easedAgitation;
  const petStyle = {
    "--agitation": agitation.toFixed(2),
    "--pomogochi-hue": `${(10 + calmProgress * 128).toFixed(2)}`,
    "--pomogochi-shake": `${(agitation * 5.5).toFixed(2)}px`,
    "--pomogochi-shake-duration": `${Math.round(1260 - agitation * 360)}ms`,
    "--pomogochi-blur": `${(agitation * 0.5).toFixed(2)}px`,
    "--pomogochi-glow-alpha": `${(0.2 + easedAgitation * 0.24).toFixed(2)}`,
    "--pomogochi-orbit-alpha": `${(0.16 + easedAgitation * 0.14).toFixed(2)}`,
    "--pomogochi-glow-scale": `${(0.92 + easedAgitation * 0.12).toFixed(2)}`,
  } as CSSProperties;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClickPenalty((current) => (current > 0 ? Math.max(0, current - CLICK_PENALTY_DECAY) : current));
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div
      className="pomogochi-overlay"
      aria-label={copy.pomogochi.aria}
      aria-modal="true"
      role="dialog"
    >
      <div className="pomogochi-card">
        <div className="pomogochi-copy">
          <span className="pomogochi-kicker">{copy.pomogochi.kicker}</span>
          <h2>{isLongBreak ? copy.pomogochi.longTitle : copy.pomogochi.shortTitle}</h2>
          <p>{isLongBreak ? copy.pomogochi.longMessage : copy.pomogochi.shortMessage}</p>
          <div className="pomogochi-countdown">
            <span>{copy.pomogochi.remaining}</span>
            <strong>{formatTime(secondsLeft)}</strong>
          </div>
          <small>{copy.pomogochi.helper}</small>
        </div>

        <button
          className="pomogochi-stage"
          type="button"
          aria-label={copy.pomogochi.petAction}
          onClick={() => {
            setReactionCount((count) => count + 1);
            setClickPenalty((current) => Math.min(1, current + CLICK_PENALTY_STEP));
          }}
        >
          <div
            className={`pomogochi-pet-shell ${agitation > 0.06 ? "pomogochi-pet-shell--agitated" : ""}`}
            style={petStyle}
          >
            <div
              className={`pomogochi-pet ${isLongBreak ? "pomogochi-pet--long" : ""} ${
                reactionCount % 2 === 1 ? "pomogochi-pet--surprised" : ""
              }`}
            >
              <span className="pomogochi-ear pomogochi-ear--left" />
              <span className="pomogochi-ear pomogochi-ear--right" />
              <span className="pomogochi-face">
                <span className="pomogochi-eye" />
                <span className="pomogochi-eye" />
                <span className="pomogochi-mouth" />
              </span>
            </div>
          </div>
          <span className="pomogochi-orbit pomogochi-orbit--one" />
          <span className="pomogochi-orbit pomogochi-orbit--two" />
        </button>

        <button className="pomogochi-skip" onClick={onSkip}>
          {copy.pomogochi.skip}
        </button>
      </div>
    </div>
  );
}

function TimerPanel({
  mode,
  title,
  eyebrow = "Desktop timer",
  heading = "Pomogochi",
  subtitle = "Переключай текущее окно в компактный always-on-top режим, когда нужен таймер без шума.",
  secondsLeft,
  isRunning,
  completedPomodoros,
  isCompactMode,
  isDesktopApp,
  miniModeEnabled,
  showMiniModeControl = true,
  language,
  copy,
  onSwitchMode,
  onStart,
  onPause,
  onReset,
  onSkip,
  onToggleMiniMode,
  onToggleLanguage,
}: TimerPanelProps) {
  if (isCompactMode) {
    return (
      <section className="panel panel--mini">
        <div className="compact-shell">
          <div className="compact-brand">
            <span className="compact-brand-label">Pomogochi</span>
            <span className="compact-mode-name">{title}</span>
          </div>

          <div className="compact-timer-wrap">
            <div className="timer timer--compact">{formatTime(secondsLeft)}</div>
          </div>

          <div className="compact-control-matrix">
            <span
              className={`running-badge ${isRunning ? "running-badge--live" : ""}`}
              title={isRunning ? copy.timer.running : copy.timer.paused}
            >
              {isRunning ? copy.timer.runningShort : copy.timer.pausedShort}
            </span>
            <span className="compact-stats" title={`${copy.timer.completedToday}: ${completedPomodoros}`}>
              {completedPomodoros}
            </span>
            {onToggleMiniMode ? (
              <button
                className={`compact-icon-button compact-icon-button--restore ${miniModeEnabled ? "compact-icon-button--active" : ""}`}
                onClick={onToggleMiniMode}
                disabled={!isDesktopApp}
                title={
                  isDesktopApp
                    ? copy.timer.restoreNormalTitle
                    : copy.timer.desktopOnlyTitle
                }
              >
                {isDesktopApp ? "↗" : copy.timer.desktopOnly}
              </button>
            ) : (
              <span aria-hidden="true" />
            )}

            <div className="mode-switch" aria-label={copy.timer.modeAria}>
              <button
                className={mode === "focus" ? "active" : ""}
                onClick={() => onSwitchMode("focus")}
                title={copy.modes.focus}
              >
                F
              </button>
              <button
                className={mode === "shortBreak" ? "active" : ""}
                onClick={() => onSwitchMode("shortBreak")}
                title={copy.modes.shortBreak}
              >
                S
              </button>
              <button
                className={mode === "longBreak" ? "active" : ""}
                onClick={() => onSwitchMode("longBreak")}
                title={copy.modes.longBreak}
              >
                L
              </button>
            </div>

            <div className="compact-control-cluster" aria-label={copy.timer.controlsAria}>
              {!isRunning ? (
                <button
                  className="compact-icon-button compact-icon-button--primary"
                  onClick={onStart}
                  title={copy.timer.start}
                >
                  {copy.timer.compactStart}
                </button>
              ) : (
                <button
                  className="compact-icon-button compact-icon-button--pause"
                  onClick={onPause}
                  title={copy.timer.pause}
                >
                  {copy.timer.compactPause}
                </button>
              )}
              <button className="compact-icon-button" onClick={onReset} title={copy.timer.reset}>
                {copy.timer.compactReset}
              </button>
              <button className="compact-icon-button" onClick={onSkip} title={copy.timer.skip}>
                {copy.timer.compactSkip}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="panel-title-block">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{heading}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>

        <div className="panel-actions">
          <LanguageToggle
            language={language}
            onToggle={onToggleLanguage}
            label={copy.languageLabel}
          />
          {showMiniModeControl && onToggleMiniMode ? (
            <button
              className={`mode-toggle ${miniModeEnabled ? "mode-toggle--active" : ""}`}
              onClick={onToggleMiniMode}
              disabled={!isDesktopApp}
              title={
                isDesktopApp
                  ? copy.timer.openCompactTitle
                  : copy.timer.desktopOnlyTitle
              }
            >
              {isDesktopApp
                ? miniModeEnabled
                  ? copy.timer.disableAlwaysOnTop
                  : copy.timer.enableAlwaysOnTop
                : copy.timer.alwaysOnTopUnavailable}
            </button>
          ) : null}
        </div>
      </div>

      <div className="tabs">
        <button
          className={mode === "focus" ? "active" : ""}
          onClick={() => onSwitchMode("focus")}
        >
          {copy.modes.focus}
        </button>
        <button
          className={mode === "shortBreak" ? "active" : ""}
          onClick={() => onSwitchMode("shortBreak")}
        >
          {copy.modes.shortBreak}
        </button>
        <button
          className={mode === "longBreak" ? "active" : ""}
          onClick={() => onSwitchMode("longBreak")}
        >
          {copy.modes.longBreak}
        </button>
      </div>

      <div className="status-strip">
        <p className="mode">{title}</p>
        <span className={`running-badge ${isRunning ? "running-badge--live" : ""}`}>
          {isRunning ? copy.timer.running : copy.timer.paused}
        </span>
      </div>

      <div className="timer">{formatTime(secondsLeft)}</div>

      <div className="controls">
        {!isRunning ? (
          <button className="primary-button" onClick={onStart}>
            {copy.timer.start}
          </button>
        ) : (
          <button className="primary-button primary-button--pause" onClick={onPause}>
            {copy.timer.pause}
          </button>
        )}
        <button onClick={onReset}>{copy.timer.reset}</button>
        <button onClick={onSkip}>{copy.timer.skip}</button>
      </div>

      <div className="stats-card">
        <span className="stats-label">{copy.timer.completedToday}</span>
        <strong className="stats-value">{completedPomodoros}</strong>
      </div>
    </section>
  );
}

function MarketingPage({
  children,
  language,
  copy,
  onToggleLanguage,
}: {
  children: ReactNode;
  language: Language;
  copy: AppCopy;
  onToggleLanguage: () => void;
}) {
  const landingBreakPreview = language === "ru" ? landingBreakPreviewRu : landingBreakPreviewEn;
  const landingCompactPreview =
    language === "ru" ? landingCompactPreviewRu : landingCompactPreviewEn;

  return (
    <div className="landing">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <div className="landing-toolbar">
            <p className="landing-kicker">{copy.landing.kicker}</p>
            <LanguageToggle
              language={language}
              onToggle={onToggleLanguage}
              label={copy.languageLabel}
            />
          </div>
          <h1 id="landing-title">{copy.landing.title}</h1>
          <p className="landing-lead">{copy.landing.lead}</p>

          <div className="landing-concept" aria-label="Pomogochi concept">
            <span>Pomodoro</span>
            <strong>+</strong>
            <span>Tamagotchi</span>
            <strong>=</strong>
            <span>Pomogochi</span>
          </div>

          <div className="landing-actions">
            <a className="landing-button landing-button--primary" href={DOWNLOAD_URL}>
              {copy.landing.download}
            </a>
            <a className="landing-button landing-button--secondary" href="#try-online">
              {copy.landing.demo}
            </a>
          </div>

          <div className="landing-note">
            <strong>{copy.landing.notePrefix}</strong> {copy.landing.note}
          </div>
        </div>

        <div className="landing-showcase" aria-label="Превью компактного режима">
          <figure className="showcase-poster showcase-poster--break">
            <img src={landingBreakPreview} alt={copy.pomogochi.shortTitle} />
          </figure>

          <figure className="showcase-poster showcase-poster--compact">
            <img src={landingCompactPreview} alt={copy.modes.shortBreak} />
          </figure>
        </div>
      </section>

      <section className="landing-feature-grid" aria-label="Возможности приложения">
        {copy.landing.features.map((feature, index) => (
          <article key={feature.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </article>
        ))}
      </section>

      <section className="landing-demo" id="try-online" aria-labelledby="demo-title">
        <div className="landing-demo-copy">
          <p className="landing-kicker">{copy.landing.demoKicker}</p>
          <h2 id="demo-title">{copy.landing.demoTitle}</h2>
          <p>{copy.landing.demoText}</p>
        </div>
        {children}
      </section>

      <footer className="landing-footer">
        <a href={REPOSITORY_URL}>GitHub repository</a>
        <span>{copy.landing.footerStack}</span>
      </footer>
    </div>
  );
}

export default function App() {
  const isDesktopApp = Boolean(window.electronAPI?.isDesktop);
  const [timerState, setTimerState] = useState<TimerState>(() => readStoredState());
  const [miniModeEnabled, setMiniModeEnabled] = useState(false);
  const [completionCue, setCompletionCue] = useState<CompletionCue | null>(null);
  const [language, setLanguage] = useState<Language>(() => readStoredLanguage());

  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastSerializedRef = useRef(JSON.stringify(timerState));
  const pomogochiAttentionActiveRef = useRef(false);
  const copy = COPY[language];
  const pomogochiActive =
    timerState.mode !== "focus" && timerState.isRunning && completionCue === null;
  const attentionModeActive = completionCue !== null || pomogochiActive;
  const compactViewportEnabled = isDesktopApp && miniModeEnabled && !attentionModeActive;

  useEffect(() => {
    const syncDailyStats = () => {
      setTimerState((current) => normalizeDailyStats(current));
    };

    syncDailyStats();
    const intervalId = window.setInterval(syncDailyStats, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const applyExternalState = (nextState: TimerState) => {
      const serialized = JSON.stringify(nextState);
      if (serialized === lastSerializedRef.current) {
        return;
      }

      lastSerializedRef.current = serialized;
      setTimerState(nextState);
    };

    const channel =
      typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(SYNC_CHANNEL) : null;
    channelRef.current = channel;

    if (channel) {
      channel.onmessage = (event: MessageEvent<{ source?: string; state?: TimerState }>) => {
        if (!event.data?.state || event.data.source === WINDOW_ID) {
          return;
        }

        applyExternalState(sanitizeState(event.data.state));
      };
    }

    const handleStorage = (event: StorageEvent) => {
      if (
        (event.key !== STORAGE_KEY && event.key !== LEGACY_STORAGE_KEY) ||
        !event.newValue
      ) {
        return;
      }

      try {
        applyExternalState(sanitizeState(JSON.parse(event.newValue)));
      } catch {
        // ignore malformed storage payloads
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      channel?.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!isDesktopApp || !window.electronAPI) {
      return;
    }

    let unsubscribed = false;
    window.electronAPI.getMiniModeEnabled().then((enabled) => {
      if (!unsubscribed) {
        setMiniModeEnabled(enabled);
      }
    });

    const unsubscribe = window.electronAPI.onMiniModeChanged((enabled) => {
      setMiniModeEnabled(enabled);
    });

    return () => {
      unsubscribed = true;
      unsubscribe();
    };
  }, [isDesktopApp]);

  useEffect(() => {
    document.body.classList.toggle("compact-viewport", compactViewportEnabled);

    return () => {
      document.body.classList.remove("compact-viewport");
    };
  }, [compactViewportEnabled]);

  useEffect(() => {
    if (!isDesktopApp) {
      return;
    }

    if (pomogochiActive) {
      pomogochiAttentionActiveRef.current = true;
      void window.electronAPI?.enterTimerAttentionMode();
      return;
    }

    if (pomogochiAttentionActiveRef.current) {
      pomogochiAttentionActiveRef.current = false;
      void window.electronAPI?.restoreFromTimerAttentionMode();
    }
  }, [isDesktopApp, pomogochiActive]);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const serialized = JSON.stringify(timerState);
    if (serialized === lastSerializedRef.current) {
      return;
    }

    lastSerializedRef.current = serialized;
    localStorage.setItem(STORAGE_KEY, serialized);
    channelRef.current?.postMessage({ source: WINDOW_ID, state: timerState });
  }, [timerState]);

  useEffect(() => {
    if (!timerState.isRunning || timerState.endTime === null) {
      return;
    }

    const tick = () => {
      let completedMode: Mode | null = null;
      const timestamp = Date.now();

      setTimerState((current) => {
        const nextCurrent = normalizeDailyStats(current);

        if (!nextCurrent.isRunning || nextCurrent.endTime === null) {
          return nextCurrent;
        }

        const remaining = getRemainingSeconds(nextCurrent.endTime);
        if (remaining <= 0) {
          completedMode = nextCurrent.mode;
          return advanceTimer(nextCurrent, { startNext: true, timestamp });
        }

        if (remaining === nextCurrent.secondsLeft) {
          return nextCurrent;
        }

        return {
          ...nextCurrent,
          secondsLeft: remaining,
        };
      });

      if (completedMode !== null) {
        setCompletionCue(null);
        void playCompletionTone();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isDesktopApp, timerState.isRunning, timerState.endTime]);

  useEffect(() => {
    const viewLabel = completionCue
      ? "Alert"
      : pomogochiActive
        ? "Pomogochi"
        : isDesktopApp
          ? miniModeEnabled
            ? "Compact"
            : "Main"
          : "Online";
    document.title = `${formatTime(timerState.secondsLeft)} • ${viewLabel}`;
  }, [completionCue, isDesktopApp, miniModeEnabled, pomogochiActive, timerState.secondsLeft]);

  const title = useMemo(() => {
    return copy.modes[timerState.mode];
  }, [copy, timerState.mode]);

  const toggleLanguage = () => {
    setLanguage((current) => (current === "ru" ? "en" : "ru"));
  };

  const dismissCompletionCue = () => {
    setCompletionCue(null);

    if (isDesktopApp) {
      void window.electronAPI?.restoreFromTimerAttentionMode();
    }
  };

  const start = () => {
    if (completionCue) {
      dismissCompletionCue();
    }

    setTimerState((current) => {
      const nextCurrent = normalizeDailyStats(current);

      if (nextCurrent.isRunning) {
        return nextCurrent;
      }

      return {
        ...nextCurrent,
        isRunning: true,
        endTime: Date.now() + nextCurrent.secondsLeft * 1000,
      };
    });
  };

  const pause = () => {
    setTimerState((current) => {
      const nextCurrent = normalizeDailyStats(current);

      if (!nextCurrent.isRunning || nextCurrent.endTime === null) {
        return nextCurrent;
      }

      return {
        ...nextCurrent,
        isRunning: false,
        secondsLeft: getRemainingSeconds(nextCurrent.endTime),
        endTime: null,
      };
    });
  };

  const reset = () => {
    setTimerState((current) => {
      const nextCurrent = normalizeDailyStats(current);

      return {
        ...nextCurrent,
        isRunning: false,
        secondsLeft: DURATIONS[nextCurrent.mode],
        endTime: null,
      };
    });
  };

  const skip = () => {
    setTimerState((current) => {
      const nextCurrent = normalizeDailyStats(current);
      return advanceTimer({ ...nextCurrent, isRunning: false, endTime: null });
    });
  };

  const switchMode = (mode: Mode) => {
    setTimerState((current) => {
      const nextCurrent = normalizeDailyStats(current);

      return {
        ...nextCurrent,
        mode,
        isRunning: false,
        secondsLeft: DURATIONS[mode],
        endTime: null,
      };
    });
  };

  const toggleMiniMode = () => {
    if (!window.electronAPI?.toggleMiniMode) {
      return;
    }

    void window.electronAPI.toggleMiniMode().then((enabled) => {
      setMiniModeEnabled(enabled);
    });
  };

  const pomogochiOverlay = pomogochiActive ? (
    <PomogochiBreakOverlay
      mode={timerState.mode}
      secondsLeft={timerState.secondsLeft}
      copy={copy}
      onSkip={skip}
    />
  ) : null;

  const timerPanel = (
      <TimerPanel
        mode={timerState.mode}
        title={title}
        eyebrow={isDesktopApp ? copy.timer.desktopEyebrow : copy.timer.onlineEyebrow}
        heading={isDesktopApp ? copy.timer.desktopHeading : copy.timer.onlineHeading}
        subtitle={isDesktopApp ? copy.timer.desktopSubtitle : copy.timer.onlineSubtitle}
        secondsLeft={timerState.secondsLeft}
        isRunning={timerState.isRunning}
        completedPomodoros={timerState.completedPomodoros}
        isCompactMode={compactViewportEnabled}
        isDesktopApp={isDesktopApp}
        miniModeEnabled={miniModeEnabled}
        showMiniModeControl={isDesktopApp && completionCue === null}
        language={language}
        copy={copy}
        onSwitchMode={switchMode}
        onStart={start}
        onPause={pause}
        onReset={reset}
        onSkip={skip}
        onToggleMiniMode={toggleMiniMode}
        onToggleLanguage={toggleLanguage}
      />
  );

  if (!isDesktopApp) {
    return (
      <main className="container container--landing">
        {pomogochiOverlay}
        {completionCue ? (
          <CompletionOverlay
            key={completionCue.id}
            completedMode={completionCue.completedMode}
            copy={copy}
            onContinue={start}
          />
        ) : null}
        {!pomogochiActive ? (
          <MarketingPage language={language} copy={copy} onToggleLanguage={toggleLanguage}>
            {timerPanel}
          </MarketingPage>
        ) : null}
      </main>
    );
  }

  return (
    <main
      className={`container ${compactViewportEnabled ? "container--mini" : ""} ${
        attentionModeActive ? "container--attention" : ""
      }`}
    >
      {pomogochiOverlay}
      {completionCue ? (
        <CompletionOverlay
          key={completionCue.id}
          completedMode={completionCue.completedMode}
          copy={copy}
          onContinue={start}
        />
      ) : null}
      {!pomogochiActive ? timerPanel : null}
    </main>
  );
}
