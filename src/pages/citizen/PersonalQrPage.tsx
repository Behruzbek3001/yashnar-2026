import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { RefreshCw, ShieldOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiRequest } from '../../lib/api';
import { Button, ErrorAlert, YashnarLogo, useToast } from '../../components/ui/Primitives';

export const PersonalQrPage: React.FC = () => {
  const { user } = useAuth();
  const { toastSuccess } = useToast();

  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrPayloadText, setQrPayloadText] = useState<string | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [revoked, setRevoked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rotateQr = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRevoked(false);
    try {
      const res = await apiRequest<{
        qrPayload: string;
        expiresAt: string;
      }>('/api/citizen/qr/rotate', { method: 'POST', body: '{}' });

      // Pure white background, black modules, >= 4 modules quiet zone, no decorative logo obscuring modules
      const dataUrl = await QRCode.toDataURL(res.qrPayload, {
        width: 240,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrImageUrl(dataUrl);
      setQrPayloadText(res.qrPayload);
      const exp = new Date(res.expiresAt).getTime();
      setExpiresAtMs(exp);
      setSecondsLeft(Math.max(0, Math.floor((exp - Date.now()) / 1000)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR kod yaratishda xatolik.');
    } finally {
      setLoading(false);
    }
  }, []);

  const revokeQr = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/api/citizen/qr/revoke', { method: 'POST', body: '{}' });
      setQrImageUrl(null);
      setQrPayloadText(null);
      setExpiresAtMs(null);
      setSecondsLeft(0);
      setRevoked(true);
      toastSuccess('QR kodingiz muvaffaqiyatli bekor qilindi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR kodni bekor qilishda xatolik.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    rotateQr();
  }, [rotateQr]);

  useEffect(() => {
    if (!expiresAtMs) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setSecondsLeft(left);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAtMs]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const isExpired = expiresAtMs !== null && secondsLeft === 0;

  return (
    <div className="flex flex-col items-center justify-center py-[8px]">
      <div
        className="w-full max-w-[420px] rounded-[20px] bg-white text-[#0F172A] border border-[#E2E8F0] p-[24px] md:p-[32px] text-center"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {/* Header: 32x32 logo + ECO ID */}
        <div className="flex items-center justify-center gap-[10px] mb-[20px]">
          <YashnarLogo size={32} />
          <span className="text-[11px] leading-[16px] font-semibold tracking-[1px] uppercase text-[#065F46] bg-[#D1FAE5] px-[10px] py-[4px] rounded-[6px]">
            ECO ID
          </span>
        </div>

        {/* Citizen Name & Geography */}
        <h1 className="text-[20px] leading-[28px] font-bold text-[#0F172A]">
          {user?.fullName || 'Fuqaro'}
        </h1>
        <p className="mt-[4px] text-[13px] leading-[20px] text-[#64748B]">
          {[user?.districtName, user?.mfyName].filter(Boolean).join(' · ') || 'Namangan viloyati'}
        </p>

        {error && <ErrorAlert message={error} className="mt-[16px] text-left" />}

        {/* QR Code Area: 240x240px pure white, black modules, >=4 modules quiet zone */}
        <div className="my-[24px] flex flex-col items-center justify-center">
          {qrImageUrl && !revoked && !isExpired ? (
            <div className="p-[8px] bg-white rounded-[12px] border border-[#E2E8F0]">
              <img
                src={qrImageUrl}
                alt="Shaxsiy ECO ID QR kodi"
                width={240}
                height={240}
                data-testid="eco-id-qr-image"
                data-qr-token={qrPayloadText ?? ''}
                className="w-[240px] h-[240px] block"
              />
            </div>
          ) : (
            <div className="w-[240px] h-[240px] rounded-[12px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] flex flex-col items-center justify-center p-[20px] text-[13px] text-[#64748B]">
              {revoked
                ? 'QR kod bekor qilingan. Yangi kod yaratish uchun pastdagi tugmani bosing.'
                : isExpired
                ? 'QR kodning amal qilish muddati tugadi. Yangilang.'
                : 'QR kod tayyorlanmoqda...'}
            </div>
          )}

          {/* Countdown */}
          <div className="mt-[12px] text-[13px] leading-[20px] font-semibold text-[#065F46] tabular-nums">
            {revoked
              ? 'Holat: Bekor qilingan'
              : `Amal qilish muddati: ${mm}:${ss}`}
          </div>
        </div>

        <p className="text-[14px] leading-[22px] text-[#64748B] mb-[20px]">
          Chiqindi olib ketilganda QR kodingizni haydovchiga ko‘rsating.
        </p>

        <div className="space-y-[12px]">
          <Button
            className="w-full"
            onClick={rotateQr}
            loading={loading}
            loadingLabel="Yangilanmoqda..."
          >
            <RefreshCw className="w-[18px] h-[18px] inline mr-[8px]" />
            QR kodni yangilash
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            disabled={loading || revoked || !qrImageUrl}
            onClick={revokeQr}
          >
            <ShieldOff className="w-[18px] h-[18px] inline mr-[8px]" />
            QR kodni bekor qilish
          </Button>
        </div>
      </div>
    </div>
  );
};
