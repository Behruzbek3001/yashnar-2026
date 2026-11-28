import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import jsQR from 'jsqr';
import { Camera, CheckCircle2, RefreshCw, ScanLine } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import {
  Button,
  Card,
  ErrorAlert,
  FormField,
  Input,
  Select,
  StatusBadge,
  useToast,
} from '../../components/ui/Primitives';
import type { ReportStatus } from '../../lib/domain';

interface EligiblePickup {
  id: number;
  publicCode: string;
  category: string;
  estimatedRange: string;
  estimatedLiters: number;
  address: string;
  status: ReportStatus;
}

interface VerifyResponse {
  citizen: {
    id: number;
    displayName: string;
  };
  tripId: number;
  eligiblePickups: EligiblePickup[];
}

export const DriverScanPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const [qrToken, setQrToken] = useState('');
  const [verifiedData, setVerifiedData] = useState<VerifyResponse | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number>(0);
  const [actualLiters, setActualLiters] = useState('');
  const [confirmIdempotencyKey, setConfirmIdempotencyKey] = useState('');
  const [confirmedMsg, setConfirmedMsg] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const verifyMutation = useMutation({
    mutationFn: (token: string) =>
      apiRequest<VerifyResponse>('/api/driver/scan/verify', {
        method: 'POST',
        body: JSON.stringify({ qrToken: token }),
      }),
    onSuccess: (res, token) => {
      stopCamera();
      setQrToken(token);
      setVerifiedData(res);
      setConfirmedMsg(null);
      const firstId = res.eligiblePickups[0]?.id ?? 0;
      setSelectedReportId(firstId);
      setActualLiters(res.eligiblePickups[0]?.estimatedLiters ? String(res.eligiblePickups[0].estimatedLiters) : '');
      setConfirmIdempotencyKey(`confirm-${firstId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : 'QR kodni tekshirishda xatolik.');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ message: string; xpGranted: number; coinsGranted: number }>(
        '/api/driver/scan/confirm',
        {
          method: 'POST',
          body: JSON.stringify({
            qrToken,
            reportId: selectedReportId,
            actualLiters: Number(actualLiters),
            idempotencyKey: confirmIdempotencyKey,
          }),
        }
      ),
    onSuccess: (res) => {
      toastSuccess(res.message);
      setConfirmedMsg(res.message);
      setVerifiedData(null);
      setQrToken('');
      setActualLiters('');
      queryClient.invalidateQueries({ queryKey: ['driver-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['driver-mfys'] });
      queryClient.invalidateQueries({ queryKey: ['driver-history'] });
      queryClient.invalidateQueries({ queryKey: ['driver-map'] });
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : 'Yig‘imni tasdiqlashda xatolik.');
    },
  });

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      stopCamera();
      setCameraError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Kamera qo‘llab-quvvatlanmaydi. Pastdagi maydonga QR kod matnini kiriting.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: false,
        });
        streamRef.current = stream;
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const scanFrame = () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || !streamRef.current) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imgData.data, imgData.width, imgData.height);
              if (code && code.data && !verifyMutation.isPending) {
                verifyMutation.mutate(code.data);
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(scanFrame);
        };
        rafRef.current = requestAnimationFrame(scanFrame);
      } catch {
        setCameraError('Kameraga ruxsat berilmadi yoki kamera topilmadi.');
      }
    },
    [stopCamera, verifyMutation]
  );

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const selectedPickup = verifiedData?.eligiblePickups.find((p) => p.id === selectedReportId) ?? null;

  return (
    <div className="max-w-[760px] mx-auto space-y-[24px]">
      <div>
        <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
          QR skaner va yig‘imni tasdiqlash
        </h1>
        <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
          Fuqaroning Eco ID QR kodini skanerlang, haqiqiy yig‘ilgan hajmni (litrda) kiriting va yig‘imni tasdiqlang.
        </p>
      </div>

      {confirmedMsg && (
        <div
          role="status"
          className="flex items-start gap-[12px] p-[16px] rounded-[12px] bg-[#D1FAE5] text-[#065F46] dark:bg-[#064E3B] dark:text-[#ECFDF5]"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-[2px]" aria-hidden="true" />
          <div className="text-[14px] font-medium">{confirmedMsg}</div>
        </div>
      )}

      {!verifiedData ? (
        <Card className="space-y-[20px]">
          {/* Camera viewport with 260x260 emerald frame & 45% overlay */}
          <div className="relative w-full aspect-[4/3] max-h-[380px] rounded-[14px] overflow-hidden bg-[#0F172A] flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {!cameraActive && (
              <div className="text-center p-[24px] text-white space-y-[12px]">
                <ScanLine className="w-[44px] h-[44px] mx-auto text-[#34D399]" aria-hidden="true" />
                <p className="text-[14px] text-slate-300">
                  Skanerlashni boshlash uchun kamerani yoqing
                </p>
                <Button onClick={() => startCamera(facingMode)}>
                  <Camera className="w-[18px] h-[18px]" aria-hidden="true" />
                  Kamerani yoqish
                </Button>
              </div>
            )}

            {cameraActive && (
              <>
                <div
                  className="absolute inset-0 pointer-events-none flex items-center justify-center"
                  style={{ boxShadow: 'inset 0 0 0 9999px rgba(0, 0, 0, 0.45)' }}
                >
                  <div
                    className="w-[260px] h-[260px] rounded-[16px] bg-transparent"
                    style={{
                      border: '3px solid #34D399',
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                    }}
                  />
                </div>
                <button
                  type="button"
                  aria-label="Kamerani almashtirish"
                  onClick={() => {
                    const next = facingMode === 'environment' ? 'user' : 'environment';
                    setFacingMode(next);
                    startCamera(next);
                  }}
                  className="absolute top-[12px] right-[12px] w-[44px] h-[44px] rounded-[10px] bg-black/60 text-white flex items-center justify-center cursor-pointer"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {cameraError && <ErrorAlert message={cameraError} />}

          {/* Manual QR opaque token verification (for damaged screens or camera-less devices) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (qrToken.trim()) verifyMutation.mutate(qrToken.trim());
            }}
            className="space-y-[12px] pt-[8px] border-t border-[var(--border-default)]"
          >
            <FormField
              label="Yoki fuqaroning 8 belgili kodini kiriting"
              htmlFor="manual-qr-token"
              helper="Kod fuqaroning «Eco ID QR» sahifasida QR ostida ko‘rsatiladi (10 daqiqa amal qiladi)."
            >
              <Input
                id="manual-qr-token"
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                placeholder="Masalan: K7P4-9QXM"
              />
            </FormField>
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              disabled={!qrToken.trim()}
              loading={verifyMutation.isPending}
              loadingLabel="Tekshirilmoqda..."
            >
              QR kodni tekshirish
            </Button>
          </form>
        </Card>
      ) : (
        /* Explicit Collection Confirmation Form */
        <Card className="space-y-[20px]">
          <div className="flex flex-wrap items-center justify-between gap-[12px] pb-[16px] border-b border-[var(--border-default)]">
            <div>
              <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE]">Fuqaro</div>
              <h2 className="text-[20px] leading-[28px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                {verifiedData.citizen.displayName}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setVerifiedData(null);
                setQrToken('');
              }}
            >
              Boshqa QR skanerlash
            </Button>
          </div>

          {verifiedData.eligiblePickups.length === 0 ? (
            <ErrorAlert message="Ushbu fuqaroning faol reys MFYsida kutilayotgan chiqindi murojaati topilmadi." />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                confirmMutation.mutate();
              }}
              className="space-y-[20px]"
            >
              <FormField label="Murojaatni tanlang" htmlFor="pickup-select" required>
                <Select
                  id="pickup-select"
                  value={selectedReportId}
                  onChange={(e) => {
                    const nextId = Number(e.target.value);
                    setSelectedReportId(nextId);
                    const found = verifiedData.eligiblePickups.find((p) => p.id === nextId);
                    setActualLiters(found ? String(found.estimatedLiters) : '');
                    setConfirmIdempotencyKey(
                      `confirm-${nextId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                    );
                  }}
                >
                  {verifiedData.eligiblePickups.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.publicCode} — {p.category} ({p.estimatedRange})
                    </option>
                  ))}
                </Select>
              </FormField>

              {selectedPickup && (
                <div className="rounded-[12px] bg-[#F8FAFC] dark:bg-[#0F1D17] border border-[var(--border-default)] p-[16px] space-y-[8px] text-[14px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] dark:text-[#A7B8AE]">Kategoriya</span>
                    <span className="font-semibold">{selectedPickup.category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] dark:text-[#A7B8AE]">Foydalanuvchi taxmini</span>
                    <span className="font-semibold tabular-nums">
                      {selectedPickup.estimatedRange} ({selectedPickup.estimatedLiters} L)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] dark:text-[#A7B8AE]">Manzil</span>
                    <span className="font-medium text-right">{selectedPickup.address}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] dark:text-[#A7B8AE]">Holat</span>
                    <StatusBadge status={selectedPickup.status} />
                  </div>
                </div>
              )}

              <FormField
                label="Haqiqiy yig‘ilgan hajm (litr)"
                htmlFor="actual-liters"
                required
                helper="0 dan katta va 100 000 litrdan oshmaydigan haqiqiy ko‘rsatkichni kiriting."
              >
                <Input
                  id="actual-liters"
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="100000"
                  value={actualLiters}
                  onChange={(e) => setActualLiters(e.target.value)}
                  required
                />
              </FormField>

              <Button
                type="submit"
                className="w-full"
                loading={confirmMutation.isPending}
                loadingLabel="Tasdiqlanmoqda..."
              >
                Yig‘imni tasdiqlash
              </Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
};
