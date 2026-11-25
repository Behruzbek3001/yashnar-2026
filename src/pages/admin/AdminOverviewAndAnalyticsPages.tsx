import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  Navigation,
  RefreshCw,
  Scale,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { YashnarMap, type MapDriverPoint, type MapPickupPoint } from '../../components/map/YashnarMap';
import { Button, Card, EmptyState, ErrorAlert, Input, cn } from '../../components/ui/Primitives';

interface AnalyticsResponse {
  range: { start: string; end: string; label: string };
  kpis: {
    citizensCount: number;
    approvedDriversCount: number;
    activeTripsCount: number;
    pendingMfysCount: number;
    totalReports: number;
    completedReports: number;
    pendingReports: number;
    verifiedLiters: number;
  };
  dailySeries: Array<{
    day: string;
    submitted: number;
    completed: number;
    liters: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    liters: number;
  }>;
}

export const AdminOverviewPage: React.FC = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-analytics', '7d'],
    queryFn: () => apiRequest<AnalyticsResponse>('/api/admin/analytics?range=7d'),
  });

  const kpis = [
    { label: 'Fuqarolar', value: data?.kpis.citizensCount ?? 0, icon: Users, to: '/admin/citizens' },
    { label: 'Tasdiqlangan haydovchilar', value: data?.kpis.approvedDriversCount ?? 0, icon: Truck, to: '/admin/drivers' },
    { label: 'Faol reyslar', value: data?.kpis.activeTripsCount ?? 0, icon: Navigation, to: '/admin/map' },
    { label: 'Ko‘rib chiqilayotgan MFYlar', value: data?.kpis.pendingMfysCount ?? 0, icon: Building2, to: '/admin/mfys' },
    { label: '7 kunlik murojaatlar', value: data?.kpis.totalReports ?? 0, icon: ClipboardList, to: '/admin/reports' },
    { label: 'Yakunlangan yig‘imlar', value: data?.kpis.completedReports ?? 0, icon: CheckCircle2, to: '/admin/reports' },
    { label: 'Kutilayotgan murojaatlar', value: data?.kpis.pendingReports ?? 0, icon: ClipboardList, to: '/admin/reports' },
    { label: 'Tasdiqlangan hajm (7 kun)', value: `${data?.kpis.verifiedLiters ?? 0} L`, icon: Scale, to: '/admin/analytics' },
  ];

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Administrator boshqaruv paneli
          </h1>
          <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            Namangan viloyati bo‘yicha haqiqiy vaqtdagi operatsion holat va ko‘rsatkichlar.
          </p>
        </div>
        <div className="flex flex-wrap gap-[12px]">
          <Link to="/admin/analytics">
            <Button variant="secondary">
              <BarChart3 className="w-[18px] h-[18px]" aria-hidden="true" />
              Batafsil analitika
            </Button>
          </Link>
          <Link to="/admin/ai">
            <Button>
              <Sparkles className="w-[18px] h-[18px]" aria-hidden="true" />
              YASHNAR AI tahlil
            </Button>
          </Link>
        </div>
      </div>

      {isError && (
        <ErrorAlert
          message={error instanceof Error ? error.message : 'Ko‘rsatkichlarni yuklashda xatolik.'}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} to={item.to} className="block">
              <Card className="min-h-[120px] p-[20px] flex flex-col justify-between hover:border-[#059669] transition-colors">
                <div className="flex items-center justify-between gap-[8px]">
                  <span className="text-[13px] font-medium text-[#64748B] dark:text-[#A7B8AE]">
                    {item.label}
                  </span>
                  <Icon className="w-[18px] h-[18px] text-[#059669] dark:text-[#34D399]" aria-hidden="true" />
                </div>
                <div className="mt-[12px] text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9] tabular-nums">
                  {isLoading ? '—' : item.value}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[20px]">
        <Card className="space-y-[10px]">
          <h2 className="text-[16px] font-semibold">MFY va tumanlar</h2>
          <p className="text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
            Fuqarolar qo‘shgan yangi MFYlarni tasdiqlang, chegara litrlarini sozlang yoki takroriylarini birlashtiring.
          </p>
          <Link to="/admin/mfys">
            <Button variant="secondary" size="sm">MFYlarni boshqarish</Button>
          </Link>
        </Card>
        <Card className="space-y-[10px]">
          <h2 className="text-[16px] font-semibold">Haydovchilar va MFY biriktirish</h2>
          <p className="text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
            Haydovchilarni tasdiqlang, mas’ul MFYlarga biriktiring va faoliyatini nazorat qiling.
          </p>
          <Link to="/admin/drivers">
            <Button variant="secondary" size="sm">Haydovchilarni boshqarish</Button>
          </Link>
        </Card>
        <Card className="space-y-[10px]">
          <h2 className="text-[16px] font-semibold">Buyurtmalar va qaytarishlar</h2>
          <p className="text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
            Eco Market buyurtmalarini topshiring yoki bekor qilib Eco Ball va qoldiqni bir marta qaytaring.
          </p>
          <Link to="/admin/redemptions">
            <Button variant="secondary" size="sm">Buyurtmalarni ko‘rish</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
};

const RANGE_OPTIONS = [
  { id: 'today', label: 'Bugun' },
  { id: '7d', label: 'Oxirgi 7 kun' },
  { id: '30d', label: '30 kun' },
  { id: '90d', label: '90 kun' },
  { id: 'custom', label: 'Maxsus' },
] as const;

export const AdminAnalyticsPage: React.FC = () => {
  const [range, setRange] = useState<'today' | '7d' | '30d' | '90d' | 'custom'>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const queryParams =
    range === 'custom' && customFrom && customTo
      ? `range=custom&from=${customFrom}&to=${customTo}`
      : `range=${range === 'custom' ? '7d' : range}`;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-analytics', queryParams],
    queryFn: () => apiRequest<AnalyticsResponse>(`/api/admin/analytics?${queryParams}`),
  });

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Analitika
          </h1>
          <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            Davr: {data?.range.label ?? 'Oxirgi 7 kun'} · Ma’lumotlar to‘g‘ridan-to‘g‘ri PostgreSQL bazasidan hisoblanadi.
          </p>
        </div>

        {/* Range Toolbar */}
        <div className="flex flex-wrap items-center gap-[8px]">
          <div className="inline-flex flex-wrap items-center gap-[4px] p-[4px] rounded-[12px] bg-[#E2E8F0]/60 dark:bg-[#13231D] border border-[var(--border-default)]">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={cn(
                  'h-[36px] px-[12px] rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap',
                  range === opt.id
                    ? 'bg-white dark:bg-[#059669] text-[#065F46] dark:text-white shadow-xs'
                    : 'text-[#64748B] dark:text-[#A7B8AE] hover:text-[#0F172A] dark:hover:text-[#F1F5F9]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-[8px]">
              <Input
                type="date"
                aria-label="Boshlanish sanasi"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="min-h-[40px] w-[150px]"
              />
              <Input
                type="date"
                aria-label="Tugash sanasi"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="min-h-[40px] w-[150px]"
              />
            </div>
          )}
        </div>
      </div>

      {isError && (
        <ErrorAlert
          message={error instanceof Error ? error.message : 'Analitika ma’lumotlarini yuklashda xatolik.'}
        />
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px]">
        <Card className="p-[20px]">
          <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE]">Jami murojaatlar</div>
          <div className="mt-[8px] text-[24px] font-bold tabular-nums">
            {isLoading ? '—' : data?.kpis.totalReports ?? 0}
          </div>
        </Card>
        <Card className="p-[20px]">
          <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE]">Yakunlangan</div>
          <div className="mt-[8px] text-[24px] font-bold text-[#059669] dark:text-[#34D399] tabular-nums">
            {isLoading ? '—' : data?.kpis.completedReports ?? 0}
          </div>
        </Card>
        <Card className="p-[20px]">
          <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE]">Kutilayotgan</div>
          <div className="mt-[8px] text-[24px] font-bold text-[#D97706] tabular-nums">
            {isLoading ? '—' : data?.kpis.pendingReports ?? 0}
          </div>
        </Card>
        <Card className="p-[20px]">
          <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE]">Tasdiqlangan hajm</div>
          <div className="mt-[8px] text-[24px] font-bold tabular-nums">
            {isLoading ? '—' : `${data?.kpis.verifiedLiters ?? 0} L`}
          </div>
        </Card>
      </div>

      {/* Charts: 280px desktop / 220px mobile, #E2E8F0 grid, #059669 / #2563EB / #D97706 series, 11px ticks, 8px tooltip */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-[24px]">
        <Card>
          <h2 className="text-[16px] leading-[24px] font-semibold mb-[16px]">
            Kunlik murojaatlar va yakunlangan yig‘imlar
          </h2>
          {!data?.dailySeries?.length ? (
            <EmptyState
              icon={<BarChart3 />}
              title="Ushbu davrda ma’lumot yo‘q"
              description="Tanlangan vaqt oralig‘ida murojaatlar hali qayd etilmagan."
            />
          ) : (
            <div className="h-[220px] md:h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailySeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="submitted"
                    name="Yuborilgan"
                    stroke="#2563EB"
                    fill="#DBEAFE"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Yakunlangan"
                    stroke="#059669"
                    fill="#D1FAE5"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-[16px] leading-[24px] font-semibold mb-[16px]">
            Chiqindi kategoriyalari bo‘yicha taqsimot
          </h2>
          {!data?.categoryBreakdown?.length ? (
            <EmptyState
              icon={<BarChart3 />}
              title="Kategoriyalar bo‘yicha ma’lumot yo‘q"
              description="Murojaatlar qo‘shilgach, kategoriyalar grafigi avtomatik shakllanadi."
            />
          ) : (
            <div className="h-[220px] md:h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.categoryBreakdown} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" name="Murojaatlar soni" fill="#059669" radius={[6, 6, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export const AdminMapPage: React.FC = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-map'],
    queryFn: () =>
      apiRequest<{ drivers: MapDriverPoint[]; pickups: MapPickupPoint[] }>('/api/admin/map'),
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Jonli monitoring xaritasi
          </h1>
          <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            Barcha faol haydovchilar va viloyat bo‘yicha kutilayotgan chiqindi yig‘imlari.
          </p>
        </div>
        <Button variant="secondary" size="sm" loading={isFetching} onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Yangilash
        </Button>
      </div>

      {isError && (
        <ErrorAlert message={error instanceof Error ? error.message : 'Xaritani yuklashda xatolik.'} />
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
          emptyMessage="Hozircha faol reysdagi haydovchi joylashuvi mavjud emas."
        />
      )}
    </div>
  );
};
