import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigation, Radio, StopCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest, formatTashkentDateTime } from '../../lib/api';
import { shouldSendGpsUpdate } from '../../lib/domain';

type GpsPoint = { lat: number; lng: number; timestampMs: number };
import { useAuth } from '../../contexts/AuthContext';
import { YashnarMap, type MapDriverPoint, type MapPickupPoint } from '../../components/map/YashnarMap';
import { Button, Card, ErrorAlert, StatusBadge, useToast } from '../../components/ui/Primitives';

interface DriverMapResponse {
  activeTrip: {
    id: number;
    mfyId: number;
    mfyName: string;
    startedAt: string;
  } | null;
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    receivedAt: string;
    isStale: boolean;
  } | null;
  pickups: MapPickupPoint[];
}

export const DriverMapPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const [sharingGps, setSharingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<GpsPoint | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['driver-map'],
    queryFn: () => apiRequest<DriverMapResponse>('/api/driver/map'),
    refetchInterval: 15000,
  });

  const endTripMutation = useMutation({
    mutationFn: (tripId: number) =>
      apiRequest(`/api/driver/trips/${tripId}/end`, { method: 'POST' }),
    onSuccess: () => {
      stopWatching();
      toastSuccess('Reys yakunlandi va joylashuv ma’lumoti o‘chirildi.');
      queryClient.invalidateQueries({ queryKey: ['driver-map'] });
      queryClient.invalidateQueries({ queryKey: ['driver-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['driver-mfys'] });
      queryClient.invalidateQueries({ queryKey: ['driver-trips'] });
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : 'Reysni yakunlashda xatolik.');
    },
  });

  const stopWatching = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharingGps(false);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const sendLocation = async (lat: number, lng: number, accuracy: number) => {
    const nowMs = Date.now();
    const candidate: GpsPoint = { lat, lng, timestampMs: nowMs };
    const decision = shouldSendGpsUpdate(lastPointRef.current, candidate);
    if (!decision.allow) return;

    try {
      const res = await apiRequest<{ accepted: boolean; receivedAt?: string }>('/api/driver/location', {
        method: 'POST',
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          accuracyMeters: accuracy,
          recordedAt: new Date(nowMs).toISOString(),
        }),
      });
      if (res.accepted) {
        lastPointRef.current = candidate;
        setLastSentAt(res.receivedAt ?? new Date(nowMs).toISOString());
        queryClient.invalidateQueries({ queryKey: ['driver-map'] });
      }
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : 'GPS yuborishda xatolik.');
    }
  };

  const startWatching = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Ushbu qurilmada GPS (Geolocation) qo‘llab-quvvatlanmaydi.');
      return;
    }
    setSharingGps(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (geoErr) => {
        setGpsError(
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Joylashuvga ruxsat berilmadi. Brauzer sozlamalaridan GPS ruxsatini yoqing.'
            : 'GPS signalini olishda xatolik yuz berdi.'
        );
        stopWatching();
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  };

  const driverMarkers: MapDriverPoint[] =
    data?.activeTrip && data?.currentLocation
      ? [
          {
            tripId: data.activeTrip.id,
            driverId: user?.driver?.id ?? 0,
            driverName: user?.fullName ?? 'Haydovchi',
            vehiclePlate: user?.driver?.vehiclePlate,
            mfyName: data.activeTrip.mfyName,
            latitude: data.currentLocation.latitude,
            longitude: data.currentLocation.longitude,
            accuracyMeters: data.currentLocation.accuracyMeters,
            receivedAt: data.currentLocation.receivedAt,
            isStale: data.currentLocation.isStale,
            etaLabel: 'Faol reys davom etmoqda',
          },
        ]
      : [];

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Haydovchi xaritasi va GPS
          </h1>
          <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            GPS faqat faol reys davomida 15 soniya / 20 metr qoidasi bo‘yicha ulashiladi va reys yakunida o‘chiriladi.
          </p>
        </div>

        {data?.activeTrip ? (
          <div className="flex flex-wrap items-center gap-[10px]">
            {sharingGps ? (
              <Button variant="secondary" onClick={stopWatching}>
                <StopCircle className="w-[18px] h-[18px] text-[#B91C1C]" aria-hidden="true" />
                GPS ulashishni to‘xtatish
              </Button>
            ) : (
              <Button onClick={startWatching}>
                <Radio className="w-[18px] h-[18px]" aria-hidden="true" />
                GPS ulashishni boshlash
              </Button>
            )}
            <Button
              variant="danger"
              loading={endTripMutation.isPending}
              onClick={() => endTripMutation.mutate(data.activeTrip!.id)}
            >
              Reysni yakunlash
            </Button>
          </div>
        ) : (
          <Link to="/driver/mfys">
            <Button>
              <Navigation className="w-[18px] h-[18px]" aria-hidden="true" />
              MFYdan reys boshlash
            </Button>
          </Link>
        )}
      </div>

      {isError && (
        <ErrorAlert message={error instanceof Error ? error.message : 'Xaritani yuklashda xatolik.'} />
      )}
      {gpsError && <ErrorAlert message={gpsError} />}

      {data?.activeTrip && (
        <Card className="p-[16px_20px] flex flex-wrap items-center justify-between gap-[12px]">
          <div className="flex items-center gap-[10px]">
            <StatusBadge tone={sharingGps ? 'mint' : 'warning'} label={sharingGps ? 'GPS faol' : 'GPS o‘chiq'} />
            <span className="text-[14px] font-semibold">{data.activeTrip.mfyName} MFY</span>
          </div>
          <div className="text-[13px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
            {lastSentAt
              ? `Oxirgi yuborilgan signal: ${formatTashkentDateTime(lastSentAt)}`
              : data.currentLocation
              ? `Oxirgi signal: ${formatTashkentDateTime(data.currentLocation.receivedAt)}`
              : 'Hali GPS signali yuborilmagan.'}
          </div>
        </Card>
      )}

      {isLoading ? (
        <div
          className="w-full rounded-[16px] bg-slate-200/70 dark:bg-slate-800/60 animate-pulse"
          style={{ height: 'clamp(320px, calc(100svh - 300px), 620px)' }}
        />
      ) : (
        <YashnarMap
          drivers={driverMarkers}
          pickups={data?.pickups ?? []}
          emptyMessage="Faol reys va GPS signali boshlangach, joylashuvingiz xaritada ko‘rinadi."
        />
      )}
    </div>
  );
};
