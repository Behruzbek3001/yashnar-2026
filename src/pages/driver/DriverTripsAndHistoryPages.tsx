import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Navigation } from 'lucide-react';
import { apiRequest, formatTashkentDateTime } from '../../lib/api';
import { Button, Card, EmptyState, ErrorAlert, StatusBadge, useToast } from '../../components/ui/Primitives';

interface TripRecord {
  id: number;
  mfyId: number;
  mfyName: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  totalCollectedLiters: number;
}

export const DriverTripsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['driver-trips'],
    queryFn: () => apiRequest<{ trips: TripRecord[] }>('/api/driver/trips'),
  });

  const endTripMutation = useMutation({
    mutationFn: (tripId: number) =>
      apiRequest(`/api/driver/trips/${tripId}/end`, { method: 'POST' }),
    onSuccess: () => {
      toastSuccess('Reys yakunlandi.');
      queryClient.invalidateQueries({ queryKey: ['driver-trips'] });
      queryClient.invalidateQueries({ queryKey: ['driver-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['driver-mfys'] });
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : 'Reysni yakunlashda xatolik.');
    },
  });

  return (
    <div className="space-y-[24px]">
      <div>
        <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
          Reyslar
        </h1>
        <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
          Barcha boshlangan va yakunlangan chiqindi yig‘ish reyslari.
        </p>
      </div>

      {isError && (
        <ErrorAlert message={error instanceof Error ? error.message : 'Reyslarni yuklashda xatolik.'} />
      )}

      <Card className="p-0 md:p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-[24px] space-y-[12px]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[60px] rounded-[10px] bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : !data?.trips?.length ? (
          <EmptyState
            icon={<Navigation />}
            title="Hali reyslar yo‘q"
            description="MFYlar bo‘limidan birinchi reysingizni boshlang."
          />
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {data.trips.map((trip) => (
              <div
                key={trip.id}
                className="p-[16px_20px] md:px-[24px] flex flex-wrap items-center justify-between gap-[12px]"
              >
                <div>
                  <div className="flex items-center gap-[10px]">
                    <span className="text-[15px] font-semibold">{trip.mfyName} MFY</span>
                    <StatusBadge
                      tone={trip.status === 'active' ? 'mint' : 'neutral'}
                      label={trip.status === 'active' ? 'Faol' : 'Yakunlangan'}
                    />
                  </div>
                  <div className="mt-[4px] text-[12px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
                    Boshlandi: {formatTashkentDateTime(trip.startedAt)}
                    {trip.endedAt ? ` · Yakunlandi: ${formatTashkentDateTime(trip.endedAt)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-[12px]">
                  <span className="text-[14px] font-bold tabular-nums">
                    {trip.totalCollectedLiters} L
                  </span>
                  {trip.status === 'active' && (
                    <Button
                      variant="danger"
                      size="sm"
                      loading={endTripMutation.isPending}
                      onClick={() => endTripMutation.mutate(trip.id)}
                    >
                      Yakunlash
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

interface DriverHistoryItem {
  id: number;
  publicCode: string;
  category: string;
  estimatedRange: string;
  actualLiters: number | null;
  mfyName: string;
  citizenName: string;
  updatedAt: string;
}

export const DriverHistoryPage: React.FC = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['driver-history'],
    queryFn: () => apiRequest<{ history: DriverHistoryItem[] }>('/api/driver/history'),
  });

  return (
    <div className="space-y-[24px]">
      <div>
        <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
          Yig‘imlar tarixi
        </h1>
        <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
          QR orqali tasdiqlangan barcha yakunlangan yig‘imlar.
        </p>
      </div>

      {isError && (
        <ErrorAlert message={error instanceof Error ? error.message : 'Tarixni yuklashda xatolik.'} />
      )}

      <Card className="p-0 md:p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-[24px] space-y-[12px]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[60px] rounded-[10px] bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : !data?.history?.length ? (
          <EmptyState
            icon={<History />}
            title="Tasdiqlangan yig‘imlar hali yo‘q"
            description="QR skaner orqali tasdiqlangan yig‘imlar shu yerda ko‘rinadi."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="h-[44px] border-b border-[var(--border-default)] text-[12px] font-semibold text-[#64748B] dark:text-[#A7B8AE]">
                  <th className="px-[20px]">Kod</th>
                  <th className="px-[16px]">Fuqaro</th>
                  <th className="px-[16px]">MFY</th>
                  <th className="px-[16px]">Kategoriya</th>
                  <th className="px-[16px]">Haqiqiy hajm</th>
                  <th className="px-[20px]">Sana</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] text-[14px]">
                {data.history.map((item) => (
                  <tr key={item.id} className="h-[60px]">
                    <td className="px-[20px] font-semibold tabular-nums">{item.publicCode}</td>
                    <td className="px-[16px]">{item.citizenName}</td>
                    <td className="px-[16px]">{item.mfyName}</td>
                    <td className="px-[16px]">{item.category}</td>
                    <td className="px-[16px] font-bold text-[#047857] dark:text-[#34D399] tabular-nums">
                      {item.actualLiters ?? 0} L
                    </td>
                    <td className="px-[20px] text-[13px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
                      {formatTashkentDateTime(item.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
