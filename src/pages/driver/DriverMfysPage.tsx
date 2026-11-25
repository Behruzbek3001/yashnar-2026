import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Button, Card, EmptyState, ErrorAlert, StatusBadge, useToast } from '../../components/ui/Primitives';

interface AssignedMfyItem {
  mfyId: number;
  mfyName: string;
  districtName: string;
  pendingCount: number;
  estimatedPendingLiters: number;
  thresholdLiters: number;
  uncappedPercent: number;
  visualPercent: number;
  recommendedCollection: boolean;
  isActiveTripMfy: boolean;
}

interface DriverMfysResponse {
  mfys: AssignedMfyItem[];
  activeTrip: {
    id: number;
    mfyId: number;
  } | null;
}

export const DriverMfysPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['driver-mfys'],
    queryFn: () => apiRequest<DriverMfysResponse>('/api/driver/mfys'),
  });

  const startTripMutation = useMutation({
    mutationFn: (mfyId: number) =>
      apiRequest('/api/driver/trips/start', {
        method: 'POST',
        body: JSON.stringify({ mfyId }),
      }),
    onSuccess: () => {
      toastSuccess('Reys boshlandi! MFY fuqarolariga bildirishnoma yuborildi.');
      queryClient.invalidateQueries({ queryKey: ['driver-mfys'] });
      queryClient.invalidateQueries({ queryKey: ['driver-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['driver-map'] });
      queryClient.invalidateQueries({ queryKey: ['driver-trips'] });
      navigate('/driver/map');
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : 'Reysni boshlashda xatolik.');
    },
  });

  const hasActiveTrip = Boolean(data?.activeTrip);

  return (
    <div className="space-y-[24px]">
      <div>
        <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
          Biriktirilgan MFYlar
        </h1>
        <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
          Yuklama ko‘rsatkichi kutilayotgan murojaatlarning taxminiy hajmidan (foydalanuvchi taxmini) hisoblanadi.
        </p>
      </div>

      {isError && (
        <ErrorAlert
          message={error instanceof Error ? error.message : 'MFYlar ro‘yxatini yuklashda xatolik.'}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[20px]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[220px] rounded-[16px] bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : !data?.mfys?.length ? (
        <Card>
          <EmptyState
            icon={<Building2 />}
            title="Sizga MFY biriktirilmagan"
            description="Administrator sizga mas’ul MFYlarni biriktirgandan so‘ng ular shu yerda ko‘rinadi."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[20px]">
          {data.mfys.map((mfy) => {
            const over60 = mfy.recommendedCollection;
            const disabledStart = hasActiveTrip && !mfy.isActiveTripMfy;

            return (
              <Card key={mfy.mfyId} className="min-h-[220px] p-[24px] flex flex-col justify-between gap-[16px]">
                <div className="space-y-[12px]">
                  <div className="flex items-start justify-between gap-[8px]">
                    <div>
                      <h2 className="text-[18px] leading-[26px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                        {mfy.mfyName}
                      </h2>
                      <p className="text-[13px] text-[#64748B] dark:text-[#A7B8AE]">
                        {mfy.districtName}
                      </p>
                    </div>
                    {mfy.isActiveTripMfy ? (
                      <StatusBadge tone="mint" label="Faol reys" />
                    ) : over60 ? (
                      <StatusBadge tone="warning" label="Yig‘ish tavsiya etiladi" />
                    ) : (
                      <StatusBadge tone="neutral" label="Normal" />
                    )}
                  </div>

                  {/* Workload bar: 8px height, #E2E8F0 track, <=60% #059669, >60% #D97706, visually capped 100%, uncapped % displayed */}
                  <div className="space-y-[6px]">
                    <div className="flex items-center justify-between text-[13px] tabular-nums">
                      <span className="text-[#64748B] dark:text-[#A7B8AE]">
                        Taxminiy yuklama ({mfy.pendingCount} murojaat)
                      </span>
                      <span
                        className={`font-bold ${
                          over60
                            ? 'text-[#D97706] dark:text-amber-300'
                            : 'text-[#059669] dark:text-[#34D399]'
                        }`}
                      >
                        {mfy.uncappedPercent}%
                      </span>
                    </div>
                    <div className="w-full h-[8px] rounded-full bg-[#E2E8F0] dark:bg-[#294237] overflow-hidden">
                      <div
                        className="h-full transition-all duration-200"
                        style={{
                          width: `${mfy.visualPercent}%`,
                          backgroundColor: over60 ? '#D97706' : '#059669',
                        }}
                      />
                    </div>
                    <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
                      {mfy.estimatedPendingLiters} L / {mfy.thresholdLiters} L chegara
                    </div>
                  </div>
                </div>

                {mfy.isActiveTripMfy ? (
                  <Button variant="secondary" className="w-full" onClick={() => navigate('/driver/map')}>
                    <Navigation className="w-4 h-4" aria-hidden="true" />
                    Faol reysni ko‘rish
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={disabledStart}
                    loading={
                      startTripMutation.isPending && startTripMutation.variables === mfy.mfyId
                    }
                    loadingLabel="Boshlanmoqda..."
                    onClick={() => startTripMutation.mutate(mfy.mfyId)}
                  >
                    {disabledStart ? 'Boshqa reys faol' : 'Yo‘lga chiqish'}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
