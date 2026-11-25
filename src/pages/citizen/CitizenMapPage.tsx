import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { YashnarMap, type MapDriverPoint, type MapPickupPoint } from '../../components/map/YashnarMap';
import { Button, ErrorAlert } from '../../components/ui/Primitives';
import { useAuth } from '../../contexts/AuthContext';

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
