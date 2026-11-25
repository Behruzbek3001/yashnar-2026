import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, ClipboardList, Navigation, Scale, ScanLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest, formatTashkentDateTime } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, ErrorAlert, StatusBadge, useToast } from '../../components/ui/Primitives';

interface DriverDashboardResponse {
  stats: {
    todayPickups: number;
    pendingRequests: number;
    hasActiveTrip: boolean;
    verifiedCollectedLiters: number;
    assignedMfysCount: number;
  };
  activeTrip: {
    id: number;
    mfyId: number;
    mfyName: string;
    startedAt: string;
    totalCollectedLiters: number;
  } | null;
}

export const DriverDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['driver-dashboard'],
    queryFn: () => apiRequest<DriverDashboardResponse>('/api/driver/dashboard'),
  });

  const endTripMutation = useMutation({
    mutationFn: (tripId: number) =>
      apiRequest(`/api/driver/trips/${tripId}/end`, { method: 'POST' }),
    onSuccess: () => {
      toastSuccess('Faol reys muvaffaqiyatli yakunlandi va GPS to‘xtatildi.');
      queryClient.invalidateQueries({ queryKey: ['driver-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['driver-mfys'] });
      queryClient.invalidateQueries({ queryKey: ['driver-trips'] });
      queryClient.invalidateQueries({ queryKey: ['driver-map'] });
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : 'Reysni yakunlashda xatolik.');
    },
  });

  const stats = [
    {
      label: 'Bugungi yig‘imlar',
      value: isLoading ? '—' : String(data?.stats.todayPickups ?? 0),
      icon: CheckCircle2,
    },
    {
      label: 'Kutilayotgan murojaatlar',
      value: isLoading ? '—' : String(data?.stats.pendingRequests ?? 0),
      icon: ClipboardList,
    },
    {
      label: 'Faol reys',
      value: isLoading ? '—' : data?.stats.hasActiveTrip ? 'Faol' : 'Yo‘q',
      icon: Navigation,
    },
    {
      label: 'Tasdiqlangan hajm',
      value: isLoading ? '—' : `${data?.stats.verifiedCollectedLiters ?? 0} L`,
      icon: Scale,
    },
    {
      label: 'Biriktirilgan MFYlar',
      value: isLoading ? '—' : String(data?.stats.assignedMfysCount ?? 0),
      icon: Building2,
    },
  ];

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Haydovchi boshqaruv paneli
          </h1>
          <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            {user?.fullName}
            {user?.driver?.vehiclePlate ? ` · ${user.driver.vehiclePlate}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-[12px]">
          <Link to="/driver/mfys">
            <Button variant="secondary">MFYlar yuklamasi</Button>
          </Link>
          <Link to="/driver/scan">
            <Button>
              <ScanLine className="w-[18px] h-[18px]" aria-hidden="true" />
              QR skanerlash
            </Button>
          </Link>
        </div>
      </div>

      {isError && (
        <ErrorAlert
          message={error instanceof Error ? error.message : 'Haydovchi panelini yuklashda xatolik.'}
        />
      )}

      {/* Active Trip Banner */}
      {data?.activeTrip ? (
        <div
          className="rounded-[16px] p-[24px] text-white flex flex-wrap items-center justify-between gap-[16px]"
          style={{ background: 'linear-gradient(135deg, #064E3B 0%, #059669 100%)' }}
        >
          <div className="space-y-[6px]">
            <div className="inline-flex items-center gap-[8px]">
              <StatusBadge tone="mint" label="Faol reys" />
              <span className="text-[13px] text-[#D1FAE5] tabular-nums">
                Boshlandi: {formatTashkentDateTime(data.activeTrip.startedAt)}
              </span>
            </div>
            <h2 className="text-[20px] leading-[28px] font-bold">
              {data.activeTrip.mfyName} MFY bo‘yicha yig‘im
            </h2>
            <p className="text-[14px] text-[#D1FAE5] tabular-nums">
              Ushbu reysda tasdiqlangan hajm: {data.activeTrip.totalCollectedLiters} L
            </p>
          </div>
          <div className="flex flex-wrap gap-[12px]">
            <Link to="/driver/map">
              <Button variant="hero-white">Xarita va GPS</Button>
            </Link>
            <Link to="/driver/scan">
              <Button variant="hero-outline">QR tasdiqlash</Button>
            </Link>
            <Button
              variant="danger"
              loading={endTripMutation.isPending}
              loadingLabel="Yakunlanmoqda..."
              onClick={() => endTripMutation.mutate(data.activeTrip!.id)}
            >
              Reysni yakunlash
            </Button>
          </div>
        </div>
      ) : (
        <Card className="flex flex-wrap items-center justify-between gap-[16px]">
          <div>
            <h2 className="text-[18px] leading-[26px] font-semibold">Faol reys yo‘q</h2>
            <p className="mt-[4px] text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
              Chiqindi yig‘ishni boshlash uchun biriktirilgan MFYlardan birini tanlab yo‘lga chiqing.
            </p>
          </div>
          <Link to="/driver/mfys">
            <Button>MFY tanlash va yo‘lga chiqish</Button>
          </Link>
        </Card>
      )}

      {/* 5 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-[16px]">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="min-h-[120px] p-[20px] flex flex-col justify-between">
              <div className="flex items-center justify-between gap-[8px]">
                <span className="text-[13px] font-medium text-[#64748B] dark:text-[#A7B8AE]">
                  {item.label}
                </span>
                <Icon className="w-[18px] h-[18px] text-[#059669] dark:text-[#34D399] shrink-0" aria-hidden="true" />
              </div>
              <div className="mt-[12px] text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9] tabular-nums">
                {item.value}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
