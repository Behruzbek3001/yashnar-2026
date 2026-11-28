import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  RefreshCw,
  MapPin,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import {
  VOLUME_RANGE_OPTIONS,
  WASTE_CATEGORIES,
  createReportSchema,
  type ReportStatus,
} from '../../lib/domain';
import {
  Button,
  Card,
  ErrorAlert,
  FormField,
  Input,
  Select,
  StatusBadge,
  Textarea,
  useToast,
} from '../../components/ui/Primitives';

export const WasteReportPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess } = useToast();

  // Camera & Photo State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // Form state
  const [category, setCategory] = useState<string>(WASTE_CATEGORIES[0]);
  const [estimatedRange, setEstimatedRange] = useState<string>(VOLUME_RANGE_OPTIONS[1].range);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdReport, setCreatedReport] = useState<{
    id: number;
    publicCode: string;
    status: ReportStatus;
  } | null>(null);

  const { data: estimatesData } = useQuery({
    queryKey: ['volume-estimates'],
    queryFn: () => apiRequest<{ estimates: Record<string, number> }>('/api/citizen/volume-estimates'),
  });

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async (mode: 'environment' | 'user') => {
    setCameraError(null);
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Brauzeringiz kamerani qo‘llab-quvvatlamaydi. Boshqa brauzerda (Chrome/Safari) oching.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError(
        'Kameraga ruxsat berilmadi yoki kamera topilmadi. Brauzer sozlamalaridan kameraga ruxsat bering.'
      );
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // The <video> element only mounts once cameraActive is true, so attach the stream after it renders.
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (cameraActive && video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  }, [cameraActive, photoDataUrl]);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoDataUrl(dataUrl);
    stopCamera();
    handleAddLocation(); // location is taken at the moment of the photo
  };

  const handleAddLocation = () => {
    if (!navigator.geolocation) {
      setSubmitError('Qurilmangiz geolokatsiyani qo‘llab-quvvatlamaydi.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGpsAccuracy(pos.coords.accuracy);
        setGeoLoading(false);
        toastSuccess(`GPS joylashuv aniqlandi (±${Math.round(pos.coords.accuracy)} m).`);
      },
      () => {
        setGeoLoading(false);
        setSubmitError('Joylashuvni aniqlab bo‘lmadi. Brauzer ruxsatini tekshiring.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    if (!photoDataUrl) {
      setSubmitError('Iltimos, avval chiqindini kamera orqali suratga oling.');
      return;
    }
    if (latitude === null || longitude === null || gpsAccuracy === null) {
      setSubmitError('GPS joylashuv majburiy. “Joylashuvni aniqlash” tugmasini bosing va ruxsat bering.');
      return;
    }

    const parsed = createReportSchema.safeParse({
      category,
      estimatedRange,
      description,
      address,
      latitude,
      longitude,
    });

    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{
        message: string;
        report: { id: number; publicCode: string; status: ReportStatus };
      }>('/api/citizen/reports', {
        method: 'POST',
        body: JSON.stringify({
          ...parsed.data,
          gpsAccuracy,
          photoDataUrl,
        }),
      });
      setCreatedReport(res.report);
      toastSuccess(res.message);
      queryClient.invalidateQueries({ queryKey: ['citizen-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['citizen-reports'] });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Murojaatni yuborishda xatolik.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCreatedReport(null);
    setPhotoDataUrl(null);
    setDescription('');
    setAddress('');
    setLatitude(null);
    setLongitude(null);
    setSubmitError(null);
  };

  if (createdReport) {
    return (
      <div className="max-w-[560px] mx-auto">
        <Card className="text-center py-[32px]">
          <div className="w-[56px] h-[56px] mx-auto rounded-full bg-[#D1FAE5] text-[#065F46] flex items-center justify-center mb-[16px]">
            <CheckCircle2 className="w-[32px] h-[32px]" />
          </div>
          <h1 className="text-[24px] leading-[32px] font-bold">
            Murojaatingiz muvaffaqiyatli yuborildi!
          </h1>
          <p className="mt-[8px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            Murojaatingiz ma’lumotlar bazasida saqlandi va mahalla haydovchilariga yetkazildi.
          </p>

          <div className="mt-[20px] p-[16px] rounded-[12px] bg-[#F8FAFC] dark:bg-[#0F1D17] border border-[var(--border-default)] flex items-center justify-between">
            <div className="text-left">
              <div className="text-[12px] text-[#64748B]">Murojaat identifikatori</div>
              <div className="text-[16px] font-bold tabular-nums">{createdReport.publicCode}</div>
            </div>
            <StatusBadge status={createdReport.status} />
          </div>

          <div className="mt-[24px] flex flex-wrap justify-center gap-[12px]">
            <Link to="/citizen/requests">
              <Button>Murojaatlarimni ko‘rish</Button>
            </Link>
            <Button variant="secondary" onClick={resetForm}>
              Yana xabar yuborish
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-[24px]">
      <div>
        <h1 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[38px] font-bold">
          Chiqindi haqida xabar yuborish
        </h1>
        <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
          Chiqindini suratga oling, toifa va foydalanuvchi taxminiy hajmini belgilang.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[24px] items-start">
        {/* LEFT: CAMERA / PHOTO PANEL (4/3 aspect, #0F172A, 16px radius) */}
        <Card className="space-y-[16px]">
          <div className="relative aspect-[4/3] w-full rounded-[16px] bg-[#0F172A] overflow-hidden flex items-center justify-center">
            {photoDataUrl ? (
              <img
                src={photoDataUrl}
                alt="Olingan chiqindi fotosurati"
                className="w-full h-full object-cover"
              />
            ) : cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center px-[20px] text-slate-300">
                <Camera className="w-[40px] h-[40px] mx-auto mb-[12px] opacity-80" />
                <p className="text-[14px] leading-[22px]">
                  Jonli kamerani yoqing yoki qurilmadan fotosurat yuklang
                </p>
              </div>
            )}

            {/* Switch camera 44x44 */}
            {cameraActive && !photoDataUrl && (
              <button
                type="button"
                onClick={() => {
                  const next = facingMode === 'environment' ? 'user' : 'environment';
                  setFacingMode(next);
                  startCamera(next);
                }}
                aria-label="Kamerani almashtirish"
                className="absolute top-[12px] right-[12px] w-[44px] h-[44px] rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75 cursor-pointer"
              >
                <RefreshCw className="w-[20px] h-[20px]" />
              </button>
            )}

            {/* Capture shutter button: 64x64 outer with 4px white border, 48x48 inner */}
            {cameraActive && !photoDataUrl && (
              <div className="absolute bottom-[16px] inset-x-0 flex justify-center">
                <button
                  type="button"
                  onClick={captureFrame}
                  aria-label="Suratga olish"
                  className="w-[64px] h-[64px] rounded-full border-4 border-white bg-black/30 flex items-center justify-center cursor-pointer"
                >
                  <span className="w-[48px] h-[48px] rounded-full bg-white block" />
                </button>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {cameraError && (
            <div className="text-[12px] leading-[18px] text-[#92400E] bg-[#FEF3C7] p-[12px] rounded-[10px]">
              {cameraError}
            </div>
          )}

          {/* Controls: Open camera / Retake (48px) / File fallback (48px) */}
          <div className="flex flex-wrap gap-[12px]">
            {!photoDataUrl ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => startCamera(facingMode)}
                className="flex-1"
              >
                <Camera className="w-[18px] h-[18px] inline mr-[8px]" />
                {cameraActive ? 'Kamerani qayta ulash' : 'Kamerani yoqish'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPhotoDataUrl(null);
                  startCamera(facingMode);
                }}
                className="flex-1"
              >
                <RotateCcw className="w-[18px] h-[18px] inline mr-[8px]" />
                Qayta suratga olish
              </Button>
            )}

          </div>
          <p className="text-[12px] leading-[18px] text-[#64748B] dark:text-[#A7B8AE]">
            Faqat kamera orqali, chiqindi joyida turib suratga oling. Galereyadan yuklash mumkin emas.
            Rasm sun’iy intellekt orqali tekshiriladi: ekrandan qayta olingan yoki chiqindi bo‘lmagan rasmlar qabul qilinmaydi.
          </p>
        </Card>

        {/* RIGHT: REPORT FORM */}
        <Card>
          {submitError && <ErrorAlert message={submitError} className="mb-[20px]" />}

          <form onSubmit={handleSubmit} className="space-y-[20px]" noValidate>
            <FormField
              label="Chiqindi toifasi"
              htmlFor="rep-category"
              required
              error={fieldErrors.category}
            >
              <Select
                id="rep-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {WASTE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label="Taxminiy hajm (foydalanuvchi taxmini)"
              htmlFor="rep-volume"
              required
              helper="Bu rejalashtirish uchun foydalanuvchi taxmini; yakuniy hajmni haydovchi QR tasdiqlashda kiritadi."
              error={fieldErrors.estimatedRange}
            >
              <Select
                id="rep-volume"
                value={estimatedRange}
                onChange={(e) => setEstimatedRange(e.target.value)}
              >
                {VOLUME_RANGE_OPTIONS.map((opt) => {
                  const configuredLiters =
                    estimatesData?.estimates?.[opt.range] ?? opt.defaultLiters;
                  return (
                    <option key={opt.range} value={opt.range}>
                      {opt.range} (taxminan ~{configuredLiters} L)
                    </option>
                  );
                })}
              </Select>
            </FormField>

            <FormField
              label="Manzil"
              htmlFor="rep-address"
              required
              helper="Maksimal 300 belgi"
              error={fieldErrors.address}
            >
              <Input
                id="rep-address"
                maxLength={300}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ko‘cha nomi, uy raqami yoki mo‘ljal"
              />
            </FormField>

            <FormField
              label="Izoh (ixtiyoriy)"
              htmlFor="rep-desc"
              error={fieldErrors.description}
            >
              <Textarea
                id="rep-desc"
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Chiqindi holati yoki kirish yo‘li haqida qo‘shimcha ma’lumot..."
              />
            </FormField>

            <div className="flex flex-wrap items-center justify-between gap-[12px] p-[12px] rounded-[10px] bg-[#F8FAFC] dark:bg-[#0F1D17] border border-[var(--border-default)]">
              <div className="text-[12px] leading-[18px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
                {latitude !== null && longitude !== null
                  ? `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}${gpsAccuracy ? ` (±${Math.round(gpsAccuracy)} m)` : ''}`
                  : 'GPS joylashuv majburiy — hali aniqlanmagan'}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={geoLoading}
                loadingLabel="Aniqlanmoqda..."
                onClick={handleAddLocation}
              >
                <MapPin className="w-4 h-4 inline mr-[6px]" />
                Joylashuvni aniqlash
              </Button>
            </div>

            <Button
              type="submit"
              className="w-full"
              loading={submitting}
              loadingLabel="Yuborilmoqda..."
            >
              Chiqindi haqida xabar yuborish
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
