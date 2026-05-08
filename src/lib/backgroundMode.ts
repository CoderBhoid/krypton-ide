import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Background mode manager for Krypton IDE.
 * 
 * On Android: Starts a foreground service with a persistent notification
 * to prevent the OS from killing the app during background tasks.
 * 
 * On Web: Uses a keepalive Web Worker + Wake Lock API to prevent
 * the browser from throttling/suspending the tab.
 */

interface BackgroundModePlugin {
  enable(): Promise<{ enabled: boolean }>;
  disable(): Promise<{ enabled: boolean }>;
}

const NativeBackgroundMode = Capacitor.isNativePlatform()
  ? registerPlugin<BackgroundModePlugin>('BackgroundMode')
  : null;

let keepaliveInterval: ReturnType<typeof setInterval> | null = null;
let wakeLock: any = null;
let isEnabled = false;

/**
 * Enable background mode — prevents the app from being killed/suspended.
 */
export async function enableBackgroundMode(): Promise<void> {
  if (isEnabled) return;
  isEnabled = true;

  // ── Android: Start foreground service ──
  if (NativeBackgroundMode) {
    try {
      await NativeBackgroundMode.enable();
    } catch (e) {
      console.warn('[BackgroundMode] Failed to start native service:', e);
    }
  }

  // ── Web/All: Keepalive heartbeat ──
  // Prevents the WebView/browser from throttling timers when backgrounded
  if (!keepaliveInterval) {
    keepaliveInterval = setInterval(() => {
      // Tiny self-ping to keep the JS event loop active
      void Promise.resolve();
    }, 10000);
  }

  // ── Web: Screen Wake Lock API ──
  // Prevents the screen from turning off (useful during long AI operations)
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await (navigator as any).wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch (e) {
      // Wake Lock can fail if the document isn't visible — that's fine
      console.warn('[BackgroundMode] Wake Lock not acquired:', e);
    }
  }
}

/**
 * Disable background mode — allows normal OS power management.
 */
export async function disableBackgroundMode(): Promise<void> {
  if (!isEnabled) return;
  isEnabled = false;

  // ── Android: Stop foreground service ──
  if (NativeBackgroundMode) {
    try {
      await NativeBackgroundMode.disable();
    } catch (e) {
      console.warn('[BackgroundMode] Failed to stop native service:', e);
    }
  }

  // ── Clear keepalive ──
  if (keepaliveInterval) {
    clearInterval(keepaliveInterval);
    keepaliveInterval = null;
  }

  // ── Release Wake Lock ──
  if (wakeLock) {
    try {
      await wakeLock.release();
    } catch (e) {
      // Already released
    }
    wakeLock = null;
  }
}

/**
 * Check if background mode is currently active.
 */
export function isBackgroundModeEnabled(): boolean {
  return isEnabled;
}
