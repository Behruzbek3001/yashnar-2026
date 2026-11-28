import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { YashnarMap, type MapDriverPoint, type MapPickupPoint } from '../../components/map/YashnarMap';
import { Button, ErrorAlert } from '../../components/ui/Primitives';
import { useAuth } from '../../contexts/AuthContext';
import { estimateArrival, formatEta } from '../../lib/eta';

interface CitizenMapResponse {
  drivers: MapDriverPoint[];
  pickups: MapPickupPoint[];
}

export const CitizenMapPage: React.FC = () => {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['citizen-map'],
    queryFn: () => apiRequest<CitizenMapResponse>('/api/citizen/map'),
    refetchInterval: 15000,
  });

  // Where the truck is heading for this citizen: their device location if allowed, else their pending pickup.
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 }
    );
  }, []);
  const pickupTarget = (data?.pickups ?? []).find((p) => p.latitude != null && p.longitude != null);
  const target = myPos ?? (pickupTarget ? { lat: pickupTarget.latitude!, lng: pickupTarget.longitude! } : null);
  const etas = (data?.drivers ?? [])
    .filter((d) => target && d.latitude != null && d.longitude != null)
    .map((d) => ({ driver: d, ...estimateArrival(d.latitude, d.longitude, target!.lat, target!.lng) }));

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Haydovchi xaritasi
          </h1>
          <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            {user?.mfyName
              ? `${user.mfyName} MFYga biriktirilgan faol haydovchi joylashuvi va sizning kutilayotgan murojaatlaringiz.`
              : 'Mahallangizga biriktirilgan faol haydovchi joylashuvi.'}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={isFetching}
          onClick={() => refetch()}
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Yangilash
        </Button>
      </div>

      {isError && (
        <ErrorAlert
          message={
            error instanceof Error ? error.message : 'Xarita ma’lumotlarini yuklashda xatolik.'
          }
        />
      )}

      {!isLoading && (data?.drivers?.length ?? 0) > 0 && (
        <div className="rounded-[16px] border border-[#D1FAE5] dark:border-[#1F3A2E] bg-[#ECFDF5] dark:bg-[#11211B] p-[16px] space-y-[8px]">
          {etas.length ? (
            etas.map(({ driver, minutes, roadKm }) => (
              <div key={driver.tripId} className="flex items-center gap-[12px]">
                <Clock className="w-[22px] h-[22px] text-[#047857] shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-[16px] font-bold text-[#065F46] dark:text-[#6EE7B7]">
                    Taxminiy yetib kelish vaqti: {formatEta(minutes)}
                  </div>
                  <div className="text-[13px] text-[#047857] dark:text-[#A7B8AE]">
                    {driver.vehiclePlate ? `${driver.vehiclePlate} · ` : ''}~{roadKm.toFixed(1)} km
                    {myPos ? ' (sizning joylashuvingizgacha)' : ' (murojaatingiz manzilgacha)'}
                    {driver.isStale ? ' · signal eskirgan' : ''}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-[12px] text-[14px] text-[#047857] dark:text-[#A7B8AE]">
              <Clock className="w-[20px] h-[20px] shrink-0" aria-hidden="true" />
              Yetib kelish vaqtini hisoblash uchun joylashuvingizga ruxsat bering.
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div
          className="w-full rounded-[16px] bg-slate-200/70 dark:bg-slate-800/60 animate-pulse"
          style={{ height: 'clamp(320px, calc(100svh - 300px), 620px)' }}
        />
      ) : (
        <YashnarMap
          drivers={data?.drivers ?? []}
          pickups={data?.pickups ?? []}
          emptyMessage="Hozircha faol haydovchi joylashuvi mavjud emas."
        />
      )}
    </div>
  );
};
