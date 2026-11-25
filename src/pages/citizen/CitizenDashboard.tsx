import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Camera,
  MapPin,
  Sparkles,
  Coins,
  Flame,
  Trophy,
  CheckCircle2,
  Clock,
  Award,
  BookOpen,
  Bell,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiRequest, formatTashkentDateTime } from '../../lib/api';
import type { ReportStatus } from '../../lib/domain';
import {
  Button,
  Card,
  EmptyState,
  ErrorAlert,
  StatusBadge,
} from '../../components/ui/Primitives';

interface CitizenDashboardData {
  stats: {
    totalXp: number;
    coinBalance: number;
    currentStreak: number;
    districtRank: number | null;
    completedPickups: number;
    pendingRequests: number;
    level: {
      level: number;
      title: string;
      progressPercent: number;
      nextLevelMinXp: number | null;
    };
  };
  activePickup: {
    id: number;
    publicCode: string;
    category: string;
    estimatedRange: string;
    status: ReportStatus;
    address: string;
    updatedAt: string;
  } | null;
  recentRequests: Array<{
    id: number;
    publicCode: string;
    category: string;
    estimatedRange: string;
    status: ReportStatus;
    createdAt: string;
  }>;
  dailyQuests: Array<{
    id: number;
    title: string;
    description: string;
    xpReward: number;
    coinReward: number;
    completedToday: boolean;
  }>;
  dailyFact: {
    id: number;
    title: string;
    content: string;
    category: string;
  } | null;
  leaderboardPreview: Array<{
    rank: number;
    userId: number;
    displayName: string;
    xp: number;
    isCurrentUser: boolean;
  }>;
  recentNotifications: Array<{
    id: number;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: string;
  }>;
}

export const CitizenDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['citizen-dashboard'],
    queryFn: () => apiRequest<CitizenDashboardData>('/api/citizen/dashboard'),
  });

  const firstName = user?.fullName?.trim().split(' ')[0] || 'Fuqaro';

  const statItems = [
    {
      label: 'Mening XP',
      value: data ? String(data.stats.totalXp) : '—',
      sub: data ? `${data.stats.level.level}-daraja · ${data.stats.level.title}` : '',
      icon: Sparkles,
    },
    {
      label: 'Eco Ballarim',
      value: data ? String(data.stats.coinBalance) : '—',
      sub: 'Eco Marketda sarflash mumkin',
      icon: Coins,
    },
    {
      label: 'Kundalik seriyam',
      value: data ? `${data.stats.currentStreak} kun` : '—',
      sub: '7 va 30 kunda bonus',
      icon: Flame,
    },
    {
      label: 'Reytingdagi o‘rnim',
      value: data && data.stats.districtRank !== null ? `#${data.stats.districtRank}` : '—',
      sub: user?.districtName || 'Tuman bo‘yicha',
      icon: Trophy,
    },
    {
      label: 'Bajarilgan yig‘imlar',
      value: data ? String(data.stats.completedPickups) : '—',
      sub: 'Tasdiqlangan topshirishlar',
      icon: CheckCircle2,
    },
    {
      label: 'Kutilayotgan murojaatlar',
      value: data ? String(data.stats.pendingRequests) : '—',
      sub: 'Faol jarayonda',
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-[24px]">
      {/* Page Heading Block (bottom margin 24px) */}
      <div className="mb-[24px]">
        <h1 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[38px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
          Assalomu alaykum, {firstName}!
        </h1>
        <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
          Bugun mahallangiz uchun yana bir yaxshi ish qilamizmi?
        </p>
      </div>

      {error && (
        <ErrorAlert
          message={error instanceof Error ? error.message : 'Ma’lumotlarni yuklashda xatolik.'}
        />
      )}

      {/* Action Panel (linear-gradient 110deg #064E3B -> #059669, 20px radius, min-h 200px desktop) */}
      <section
        className="rounded-[20px] p-[24px] md:p-[32px] md:min-h-[200px] text-white flex flex-col justify-between gap-[20px]"
        style={{ background: 'linear-gradient(110deg, #064E3B, #059669)' }}
      >
        <div>
          <h2 className="text-[24px] leading-[32px] md:text-[28px] md:leading-[36px] font-bold text-white">
            Mahallangizni yanada toza qilaylik!
          </h2>
          <p className="mt-[8px] text-[14px] leading-[22px] text-emerald-50 max-w-[520px]">
            Saralangan chiqindini suratga olib yuboring. Haydovchi mahallangizga kelganda shaxsiy
            ECO ID QR kodingizni ko‘rsating va Eco Ballar jamg‘aring.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[12px]">
          <Link to="/citizen/report">
            <Button variant="hero-white">
              <Camera className="w-[18px] h-[18px] inline mr-[8px]" />
              Chiqindini suratga olish
            </Button>
          </Link>
          <Link to="/citizen/map">
            <Button variant="hero-outline">
              <MapPin className="w-[18px] h-[18px] inline mr-[8px]" />
              Haydovchini kuzatish
            </Button>
          </Link>
        </div>
      </section>

      {/* Six Stat Cards (>=1440px: 6 cols, 1024-1439: 3 cols, <1024: 2 cols) */}
      <section
        aria-label="Asosiy ko‘rsatkichlar"
        className="grid grid-cols-2 lg:grid-cols-3 min-[1440px]:grid-cols-6 gap-[12px] md:gap-[16px]"
      >
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="card-surface p-[20px] min-h-[120px] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-[8px]">
                <span className="text-[12px] leading-[18px] font-medium text-[#64748B] dark:text-[#A7B8AE]">
                  {item.label}
                </span>
                <span className="w-[36px] h-[36px] rounded-[10px] bg-[#D1FAE5] dark:bg-[#059669]/25 text-[#047857] dark:text-[#34D399] flex items-center justify-center shrink-0">
                  <Icon className="w-[20px] h-[20px]" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-[12px]">
                <div className="text-[28px] md:text-[30px] leading-[36px] font-bold text-[#0F172A] dark:text-[#F1F5F9] tabular-nums">
                  {isLoading ? '—' : item.value}
                </div>
                {item.sub && (
                  <div className="mt-[4px] text-[11px] leading-[16px] text-[#64748B] dark:text-[#A7B8AE] truncate">
                    {item.sub}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Lower Panels (2fr / 1fr at >=1000px, gap 24px) */}
      <div className="grid grid-cols-1 min-[1000px]:grid-cols-[2fr_1fr] gap-[24px]">
        {/* Left Column */}
        <div className="space-y-[24px]">
          {/* Active Pickup */}
          <Card>
            <div className="flex items-center justify-between gap-[12px] mb-[16px]">
              <h2 className="text-[20px] leading-[28px] font-semibold">Faol yig‘im</h2>
              <Link
                to="/citizen/requests"
                className="text-[13px] font-semibold text-[#047857] dark:text-[#34D399] inline-flex items-center gap-[4px] hover:underline"
              >
                Barchasi <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {data?.activePickup ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[16px] p-[16px] rounded-[12px] bg-[#F8FAFC] dark:bg-[#0F1D17] border border-[var(--border-default)]">
                <div>
                  <div className="flex items-center gap-[8px] flex-wrap">
                    <span className="text-[16px] leading-[24px] font-semibold tabular-nums">
                      {data.activePickup.publicCode}
                    </span>
                    <StatusBadge status={data.activePickup.status} />
                  </div>
                  <div className="mt-[4px] text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
                    {data.activePickup.category} · {data.activePickup.estimatedRange} (foydalanuvchi taxmini)
                  </div>
                  <div className="mt-[4px] text-[12px] text-[#64748B] dark:text-[#A7B8AE]">
                    {data.activePickup.address}
                  </div>
                </div>
                <Link to="/citizen/qr">
                  <Button size="sm">ECO ID QR ko‘rsatish</Button>
                </Link>
              </div>
            ) : (
              <EmptyState
                icon={<ClipboardList />}
                title="Hozircha faol yig‘im yo‘q"
                description="Chiqindi haqida yangi xabar yuboring va haydovchi reysini shu yerda kuzating."
                action={
                  <Link to="/citizen/report">
                    <Button size="sm">Xabar yuborish</Button>
                  </Link>
                }
              />
            )}
          </Card>

          {/* Recent Requests */}
          <Card>
            <div className="flex items-center justify-between gap-[12px] mb-[16px]">
              <h2 className="text-[20px] leading-[28px] font-semibold">So‘nggi murojaatlar</h2>
              <Link
                to="/citizen/requests"
                className="text-[13px] font-semibold text-[#047857] dark:text-[#34D399] hover:underline"
              >
                To‘liq ro‘yxat
              </Link>
            </div>
            {data?.recentRequests?.length ? (
              <div className="divide-y divide-[var(--border-default)]">
                {data.recentRequests.map((r) => (
                  <div
                    key={r.id}
                    className="py-[12px] flex items-center justify-between gap-[12px]"
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold truncate tabular-nums">
                        {r.publicCode} · {r.category}
                      </div>
                      <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
                        {r.estimatedRange} · {formatTashkentDateTime(r.createdAt)}
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-[#64748B] dark:text-[#A7B8AE] py-[16px]">
                Hozircha yuborilgan murojaatlar mavjud emas.
              </p>
            )}
          </Card>

          {/* Daily Quests */}
          <Card>
            <div className="flex items-center justify-between gap-[12px] mb-[16px]">
              <h2 className="text-[20px] leading-[28px] font-semibold">Kundalik topshiriqlar</h2>
              <Link
                to="/citizen/quests"
                className="text-[13px] font-semibold text-[#047857] dark:text-[#34D399] hover:underline"
              >
                Barcha topshiriqlar
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
              {(data?.dailyQuests ?? []).slice(0, 4).map((q) => (
                <Link
                  key={q.id}
                  to="/citizen/quests"
                  className="p-[16px] rounded-[12px] border border-[var(--border-default)] hover:border-[#059669] transition-colors flex flex-col justify-between gap-[12px]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-[8px]">
                      <span className="text-[15px] font-semibold">{q.title}</span>
                      <StatusBadge
                        tone={q.completedToday ? 'mint' : 'neutral'}
                        label={q.completedToday ? 'Bajarildi' : `+${q.xpReward} XP`}
                      />
                    </div>
                    <p className="mt-[6px] text-[13px] leading-[20px] text-[#64748B] dark:text-[#A7B8AE] line-clamp-2">
                      {q.description}
                    </p>
                  </div>
                  <div className="text-[12px] font-semibold text-[#047857] dark:text-[#34D399] tabular-nums">
                    +{q.xpReward} XP · +{q.coinReward} Eco Ball
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-[24px]">
          {/* Daily Eco Fact */}
          <Card>
            <div className="flex items-center gap-[10px] mb-[12px]">
              <span className="w-[36px] h-[36px] rounded-[10px] bg-[#D1FAE5] dark:bg-[#059669]/25 text-[#047857] dark:text-[#34D399] flex items-center justify-center">
                <BookOpen className="w-[18px] h-[18px]" aria-hidden="true" />
              </span>
              <h2 className="text-[16px] leading-[24px] font-semibold">Kundalik eko-fakt</h2>
            </div>
            {data?.dailyFact ? (
              <div>
                <div className="text-[14px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                  {data.dailyFact.title}
                </div>
                <p className="mt-[6px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
                  {data.dailyFact.content}
                </p>
              </div>
            ) : (
              <p className="text-[14px] text-[#64748B]">Bugungi eko-fakt mavjud emas.</p>
            )}
          </Card>

          {/* District Leaderboard Preview */}
          <Card>
            <div className="flex items-center justify-between mb-[12px]">
              <h2 className="text-[16px] leading-[24px] font-semibold">Tuman reytingi</h2>
              <Link
                to="/citizen/leaderboard"
                className="text-[12px] font-semibold text-[#047857] dark:text-[#34D399] hover:underline"
              >
                To‘liq ko‘rish
              </Link>
            </div>
            {data?.leaderboardPreview?.length ? (
              <div className="space-y-[8px]">
                {data.leaderboardPreview.map((entry) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between px-[12px] py-[10px] rounded-[10px] ${
                      entry.isCurrentUser
                        ? 'bg-[#ECFDF5] dark:bg-[#059669]/20'
                        : 'bg-[#F8FAFC] dark:bg-[#0F1D17]'
                    }`}
                  >
                    <div className="flex items-center gap-[10px] min-w-0">
                      <span className="w-[24px] text-[13px] font-bold text-[#64748B] tabular-nums">
                        #{entry.rank}
                      </span>
                      <span className="text-[14px] font-semibold truncate">{entry.displayName}</span>
                    </div>
                    <span className="text-[13px] font-bold text-[#047857] dark:text-[#34D399] tabular-nums shrink-0">
                      {entry.xp} XP
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#64748B] dark:text-[#A7B8AE]">
                Hozircha reytingda qatnashuvchilar yo‘q.
              </p>
            )}
          </Card>

          {/* Recent Notifications */}
          <Card>
            <div className="flex items-center gap-[10px] mb-[12px]">
              <Bell className="w-[18px] h-[18px] text-[#047857] dark:text-[#34D399]" />
              <h2 className="text-[16px] leading-[24px] font-semibold">So‘nggi bildirishnomalar</h2>
            </div>
            {data?.recentNotifications?.length ? (
              <div className="space-y-[12px]">
                {data.recentNotifications.map((n) => (
                  <div
                    key={n.id}
                    className="pb-[12px] border-b last:border-b-0 last:pb-0 border-[var(--border-default)]"
                  >
                    <div className="text-[13px] font-semibold">{n.title}</div>
                    <div className="text-[12px] leading-[18px] text-[#64748B] dark:text-[#A7B8AE] mt-[2px]">
                      {n.body}
                    </div>
                    <div className="text-[11px] text-[#64748B] mt-[4px] tabular-nums">
                      {formatTashkentDateTime(n.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#64748B] dark:text-[#A7B8AE]">
                Yangi bildirishnomalar yo‘q.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
