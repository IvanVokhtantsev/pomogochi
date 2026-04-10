import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import "./App.css";

type Mode = "focus" | "shortBreak" | "longBreak";

type TimerState = {
  mode: Mode;
  secondsLeft: number;
  isRunning: boolean;
  completedPomodoros: number;
  focusStreak: number;
  endTime: number | null;
  statsDayKey: string;
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
  onSwitchMode: (mode: Mode) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
  onToggleMiniMode?: () => void;
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

const STORAGE_KEY = "pomodoro_state_v2";
const SYNC_CHANNEL = "pomodoro_sync_v2";
const DOWNLOAD_URL = "https://github.com/IvanVokhtantsev/pomodoro-app/releases/latest";
const REPOSITORY_URL = "https://github.com/IvanVokhtantsev/pomodoro-app";
const WINDOW_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `window-${Math.random().toString(36).slice(2)}`;

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
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_STATE;
  }

  try {
    return sanitizeState(JSON.parse(raw));
  } catch {
    return DEFAULT_STATE;
  }
}

function getRemainingSeconds(endTime: number) {
  return Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
}

function advanceTimer(state: TimerState) {
  if (state.mode === "focus") {
    const nextStreak = state.focusStreak + 1;
    const nextMode: Mode = nextStreak % 4 === 0 ? "longBreak" : "shortBreak";

    return {
      mode: nextMode,
      secondsLeft: DURATIONS[nextMode],
      isRunning: false,
      completedPomodoros: state.completedPomodoros + 1,
      focusStreak: nextStreak,
      endTime: null,
      statsDayKey: state.statsDayKey,
    };
  }

  return {
    mode: "focus" as const,
    secondsLeft: DURATIONS.focus,
    isRunning: false,
    completedPomodoros: state.completedPomodoros,
    focusStreak: state.focusStreak,
    endTime: null,
    statsDayKey: state.statsDayKey,
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

function TimerPanel({
  mode,
  title,
  eyebrow = "Desktop timer",
  heading = "Pomodoro Timer",
  subtitle = "Переключай текущее окно в компактный always-on-top режим, когда нужен таймер без шума.",
  secondsLeft,
  isRunning,
  completedPomodoros,
  isCompactMode,
  isDesktopApp,
  miniModeEnabled,
  showMiniModeControl = true,
  onSwitchMode,
  onStart,
  onPause,
  onReset,
  onSkip,
  onToggleMiniMode,
}: TimerPanelProps) {
  if (isCompactMode) {
    return (
      <section className="panel panel--mini">
        <div className="compact-shell">
          <div className="compact-topline">
            <div className="compact-brand">
              <span className="compact-brand-label">Pomodoro</span>
              <span className="compact-mode-name">{title}</span>
            </div>
            {onToggleMiniMode ? (
              <button
                className={`mode-toggle mode-toggle--compact ${miniModeEnabled ? "mode-toggle--active" : ""}`}
                onClick={onToggleMiniMode}
                disabled={!isDesktopApp}
                title={
                  isDesktopApp
                    ? "Вернуть обычный размер окна"
                    : "Режим доступен только в desktop-приложении"
                }
              >
                {isDesktopApp ? "Обычный" : "Desktop"}
              </button>
            ) : null}
          </div>

          <div className="compact-main-grid">
            <div className="compact-timer-wrap">
              <div className="timer timer--compact">{formatTime(secondsLeft)}</div>
            </div>
            <div className="compact-side">
              <span className={`running-badge ${isRunning ? "running-badge--live" : ""}`}>
                {isRunning ? "Идёт" : "Пауза"}
              </span>
              <span className="compact-stats">Сегодня {completedPomodoros}</span>
            </div>
          </div>

          <div className="compact-footer">
            <div className="mode-switch" aria-label="Режим таймера">
              <button
                className={mode === "focus" ? "active" : ""}
                onClick={() => onSwitchMode("focus")}
                title="Фокус"
              >
                F
              </button>
              <button
                className={mode === "shortBreak" ? "active" : ""}
                onClick={() => onSwitchMode("shortBreak")}
                title="Короткий перерыв"
              >
                S
              </button>
              <button
                className={mode === "longBreak" ? "active" : ""}
                onClick={() => onSwitchMode("longBreak")}
                title="Длинный перерыв"
              >
                L
              </button>
            </div>

            <div className="controls controls--mini controls--mini-compact">
              {!isRunning ? (
                <button className="primary-button" onClick={onStart}>
                  Старт
                </button>
              ) : (
                <button className="primary-button primary-button--pause" onClick={onPause}>
                  Пауза
                </button>
              )}
              <button onClick={onReset}>Сброс</button>
              <button onClick={onSkip}>Пропуск</button>
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
          {showMiniModeControl && onToggleMiniMode ? (
            <button
              className={`mode-toggle ${miniModeEnabled ? "mode-toggle--active" : ""}`}
              onClick={onToggleMiniMode}
              disabled={!isDesktopApp}
              title={
                isDesktopApp
                  ? "Открыть компактное окно поверх остальных приложений"
                  : "Режим доступен только в desktop-приложении"
              }
            >
              {isDesktopApp
                ? miniModeEnabled
                  ? "Выключить always-on-top"
                  : "Включить always-on-top"
                : "Always-on-top доступен в desktop app"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="tabs">
        <button
          className={mode === "focus" ? "active" : ""}
          onClick={() => onSwitchMode("focus")}
        >
          Фокус
        </button>
        <button
          className={mode === "shortBreak" ? "active" : ""}
          onClick={() => onSwitchMode("shortBreak")}
        >
          Короткий перерыв
        </button>
        <button
          className={mode === "longBreak" ? "active" : ""}
          onClick={() => onSwitchMode("longBreak")}
        >
          Длинный перерыв
        </button>
      </div>

      <div className="status-strip">
        <p className="mode">{title}</p>
        <span className={`running-badge ${isRunning ? "running-badge--live" : ""}`}>
          {isRunning ? "Идёт" : "Пауза"}
        </span>
      </div>

      <div className="timer">{formatTime(secondsLeft)}</div>

      <div className="controls">
        {!isRunning ? (
          <button className="primary-button" onClick={onStart}>
            Старт
          </button>
        ) : (
          <button className="primary-button primary-button--pause" onClick={onPause}>
            Пауза
          </button>
        )}
        <button onClick={onReset}>Сброс</button>
        <button onClick={onSkip}>Пропустить</button>
      </div>

      <div className="stats-card">
        <span className="stats-label">Завершено сегодня</span>
        <strong className="stats-value">{completedPomodoros}</strong>
      </div>
    </section>
  );
}

function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <div className="landing">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="landing-kicker">Pomodoro App</p>
          <h1 id="landing-title">Фокус-таймер, который не теряется среди окон</h1>
          <p className="landing-lead">
            Запускай Pomodoro прямо в браузере или скачай desktop-приложение, чтобы компактный
            таймер оставался поверх экрана во время работы.
          </p>

          <div className="landing-actions">
            <a className="landing-button landing-button--primary" href={DOWNLOAD_URL}>
              Скачать приложение
            </a>
            <a className="landing-button landing-button--secondary" href="#try-online">
              Открыть демо
            </a>
          </div>

          <div className="landing-note">
            <strong>Важно:</strong> настоящий always-on-top работает в desktop-версии. В браузере
            таймер можно попробовать онлайн, но поверх всех приложений он держаться не сможет.
          </div>
        </div>

        <div className="landing-showcase" aria-label="Превью компактного режима">
          <div className="showcase-window showcase-window--back">
            <span />
            <span />
            <span />
          </div>
          <div className="showcase-window">
            <div className="showcase-titlebar">
              <span />
              <span />
              <span />
              <strong>24:47 • Compact</strong>
            </div>
            <div className="showcase-card">
              <div>
                <p>Pomodoro</p>
                <h2>Фокус</h2>
              </div>
              <strong>24:47</strong>
              <div className="showcase-controls">
                <span>Старт</span>
                <span>Сброс</span>
                <span>Пропуск</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-feature-grid" aria-label="Возможности приложения">
        <article>
          <span>01</span>
          <h2>Поверх экрана</h2>
          <p>Desktop-режим превращает таймер в компактное always-on-top окно.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Звук окончания</h2>
          <p>Таймер играет мягкий синтезированный сигнал после завершения цикла.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Счётчик дня</h2>
          <p>Фокус-сессии считаются за текущий день и сбрасываются после 05:00.</p>
        </article>
      </section>

      <section className="landing-demo" id="try-online" aria-labelledby="demo-title">
        <div className="landing-demo-copy">
          <p className="landing-kicker">Browser timer</p>
          <h2 id="demo-title">Таймер в браузере</h2>
          <p>
            Это тот же таймер: фокус, короткий перерыв, длинный перерыв, звук и сохранение
            состояния в браузере. Для настоящего окна поверх всех приложений скачай desktop app.
          </p>
        </div>
        {children}
      </section>

      <footer className="landing-footer">
        <a href={REPOSITORY_URL}>GitHub repository</a>
        <span>React + TypeScript + Vite + Electron</span>
      </footer>
    </div>
  );
}

export default function App() {
  const isDesktopApp = Boolean(window.electronAPI?.isDesktop);
  const [timerState, setTimerState] = useState<TimerState>(() => readStoredState());
  const [miniModeEnabled, setMiniModeEnabled] = useState(false);

  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastSerializedRef = useRef(JSON.stringify(timerState));

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
      if (event.key !== STORAGE_KEY || !event.newValue) {
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
      let completed = false;

      setTimerState((current) => {
        const nextCurrent = normalizeDailyStats(current);

        if (!nextCurrent.isRunning || nextCurrent.endTime === null) {
          return nextCurrent;
        }

        const remaining = getRemainingSeconds(nextCurrent.endTime);
        if (remaining <= 0) {
          completed = true;
          return advanceTimer(nextCurrent);
        }

        if (remaining === nextCurrent.secondsLeft) {
          return nextCurrent;
        }

        return {
          ...nextCurrent,
          secondsLeft: remaining,
        };
      });

      if (completed) {
        void playCompletionTone();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [timerState.isRunning, timerState.endTime]);

  useEffect(() => {
    const viewLabel = isDesktopApp ? (miniModeEnabled ? "Compact" : "Main") : "Online";
    document.title = `${formatTime(timerState.secondsLeft)} • ${viewLabel}`;
  }, [isDesktopApp, miniModeEnabled, timerState.secondsLeft]);

  const title = useMemo(() => {
    if (timerState.mode === "focus") return "Фокус";
    if (timerState.mode === "shortBreak") return "Короткий перерыв";
    return "Длинный перерыв";
  }, [timerState.mode]);

  const start = () => {
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

  const timerPanel = (
      <TimerPanel
        mode={timerState.mode}
        title={title}
        eyebrow={isDesktopApp ? "Desktop timer" : "Online demo"}
        heading={isDesktopApp ? "Pomodoro Timer" : "Онлайн-таймер"}
        subtitle={
          isDesktopApp
            ? "Переключай текущее окно в компактный always-on-top режим, когда нужен таймер без шума."
            : "Браузерная версия таймера. Настоящий always-on-top доступен в desktop-приложении."
        }
        secondsLeft={timerState.secondsLeft}
        isRunning={timerState.isRunning}
        completedPomodoros={timerState.completedPomodoros}
        isCompactMode={miniModeEnabled}
        isDesktopApp={isDesktopApp}
        miniModeEnabled={miniModeEnabled}
        showMiniModeControl={isDesktopApp}
        onSwitchMode={switchMode}
        onStart={start}
        onPause={pause}
        onReset={reset}
        onSkip={skip}
        onToggleMiniMode={toggleMiniMode}
      />
  );

  if (!isDesktopApp) {
    return (
      <main className="container container--landing">
        <MarketingPage>{timerPanel}</MarketingPage>
      </main>
    );
  }

  return (
    <main className={`container ${miniModeEnabled ? "container--mini" : ""}`}>
      {timerPanel}
    </main>
  );
}
