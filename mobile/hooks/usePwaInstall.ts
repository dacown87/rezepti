import { useEffect, useRef, useState } from 'react';

/** Minimal type for the non-standard BeforeInstallPromptEvent. */
interface BeforeInstallPromptEvent extends Event {
  preventDefault(): void;
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaInstallState {
  canInstall: boolean;
  install: () => Promise<void>;
  showIOSHint: boolean;
  platform: string;
}

function detectPlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Exposes PWA install capability (Android/desktop) and iOS install hint.
 * Safe no-op in native/SSR contexts where window is unavailable.
 */
export function usePwaInstall(): PwaInstallState {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [platform, setPlatform] = useState('unknown');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);

    // iOS detection — CQ2: use matchMedia for standalone, not navigator.standalone
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setShowIOSHint(isIOS && !isStandalone);

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  async function install(): Promise<void> {
    if (!deferredRef.current) return;
    const prompt = deferredRef.current;
    deferredRef.current = null;
    setCanInstall(false);
    await prompt.prompt();
  }

  return { canInstall, install, showIOSHint, platform };
}
