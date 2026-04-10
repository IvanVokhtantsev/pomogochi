export {};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }

  interface Window {
    electronAPI?: {
      isDesktop: boolean;
      showMainWindow: () => void;
      toggleMiniMode: () => Promise<boolean>;
      getMiniModeEnabled: () => Promise<boolean>;
      onMiniModeChanged: (callback: (enabled: boolean) => void) => () => void;
      playTimerSound: () => Promise<void>;
      enterTimerAttentionMode: () => Promise<void>;
      restoreFromTimerAttentionMode: () => Promise<void>;
    };
  }
}
