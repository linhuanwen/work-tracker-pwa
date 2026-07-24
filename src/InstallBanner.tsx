import { useState, useEffect, useCallback } from 'react';
import { Icon } from './Icon';
import styles from './InstallBanner.module.css';

const DISMISS_KEY = 'pwa-install-banner-dismissed';

/**
 * InstallBanner — 首次打开检测是否已安装为 PWA
 *
 * 未安装且浏览器支持 beforeinstallprompt 时显示底部横幅
 * "添加到桌面，像 App 一样使用"，点击触发安装。
 * 已安装（standalone 模式）或已关闭则不再显示。
 */
export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const isStandalone = (): boolean => {
    // Check display-mode: standalone (PWA installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    // Safari / old iOS standalone
    if ('standalone' in window.navigator && (window.navigator as Record<string, unknown>).standalone === true) {
      return true;
    }
    return false;
  };

  const handleBeforeInstall = useCallback((e: Event) => {
    e.preventDefault();
    // Check if already dismissed
    if (localStorage.getItem(DISMISS_KEY) === 'true') return;
    if (isStandalone()) return;

    setDeferredPrompt(e as BeforeInstallPromptEvent);
    setShow(true);
  }, []);

  useEffect(() => {
    // Don't show if already installed or dismissed
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === 'true') return;

    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // If the event never fires (already captured), check appinstalled
    const handleInstalled = () => {
      setShow(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [handleBeforeInstall]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setShow(false);
        setDeferredPrompt(null);
      }
    } catch {
      // User dismissed the native prompt
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setShow(false);
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div className={styles.banner} role="banner">
      <span className={styles.message}><Icon name="pin" size={16} /> 添加到桌面，像 App 一样使用</span>
      <span className={styles.actions}>
        <button
          className={styles.installBtn}
          onClick={handleInstall}
          type="button"
        >
          立即添加
        </button>
        <button
          className={styles.dismissBtn}
          onClick={handleDismiss}
          type="button"
          aria-label="关闭"
        >
          <Icon name="x" size={16} />
        </button>
      </span>
    </div>
  );
}

// Type for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
