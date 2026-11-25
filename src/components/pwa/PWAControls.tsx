import React, { useEffect, useState } from 'react';
import { Download, WifiOff } from 'lucide-react';
import { Button, Dialog } from '../ui/Primitives';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return { isInstallable: Boolean(deferredPrompt), isInstalled, isIOS, install };
}

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isInstallable) {
            install();
          } else {
            setShowGuide(true);
          }
        }}
        title="Ilovani o‘rnatish"
        aria-label="YASHNAR ilovasini qurilmaga o‘rnatish"
        className={
          compact
            ? 'w-[44px] h-[44px] rounded-[10px] flex items-center justify-center text-[#64748B] dark:text-[#A7B8AE] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2F27] cursor-pointer'
            : 'w-full h-[44px] px-[12px] rounded-[10px] flex items-center gap-[12px] text-[14px] font-medium text-[#065F46] dark:text-[#34D399] bg-[#D1FAE5]/60 dark:bg-[#065F46]/20 hover:bg-[#D1FAE5] dark:hover:bg-[#065F46]/35 transition-colors duration-150 cursor-pointer'
        }
      >
        <Download className="w-[20px] h-[20px] shrink-0" aria-hidden="true" />
        {!compact && <span>Ilovani o‘rnatish</span>}
      </button>

      <Dialog
        open={showGuide}
        onClose={() => setShowGuide(false)}
        title="YASHNAR ilovasini o‘rnatish"
        description="Tezkor kirish uchun YASHNAR ni qurilmangiz bosh ekraniga qo‘shing."
      >
        <div className="space-y-[12px] text-[14px] leading-[22px] text-[#0F172A] dark:text-[#F1F5F9]">
          {isIOS ? (
            <>
              <p>1. Safari brauzerining pastki panelidagi <strong>Ulashish</strong> tugmasini bosing.</p>
              <p>2. Pastga surib <strong>Bosh ekranga qo‘shish (Add to Home Screen)</strong> bandini tanlang.</p>
              <p>3. Yuqori o‘ng burchakdagi <strong>Qo‘shish</strong> tugmasini bosing.</p>
            </>
          ) : (
            <>
              <p>1. Brauzer manzil satridagi <strong>O‘rnatish</strong> belgisini yoki menyuni (⋮) oching.</p>
              <p>2. <strong>YASHNAR ilovasini o‘rnatish</strong> bandini tanlang.</p>
              <p className="text-[12px] text-[#64748B] dark:text-[#A7B8AE]">
                Eslatma: Murojaat yuborish, QR tasdiqlash va Eco Market amallari faqat faol internet ulanishida bajariladi.
              </p>
            </>
          )}
          <div className="pt-[8px]">
            <Button variant="secondary" className="w-full" onClick={() => setShowGuide(false)}>
              Tushunarli
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-[84px] md:bottom-[20px] left-[16px] z-50 flex items-center gap-[8px] px-[14px] py-[10px] rounded-[10px] bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]/40 text-[13px] font-medium"
    >
      <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>Oflayn rejim — ma’lumotlarni saqlash uchun internet kerak</span>
    </div>
  );
};
