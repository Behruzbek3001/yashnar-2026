import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Coins, Gift, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest, formatTashkentDateTime } from '../../lib/api';
import { Button, Card, EmptyState, ErrorAlert, StatusBadge } from '../../components/ui/Primitives';

interface WalletResponse {
  wallet: {
    coinBalance: number;
    totalXp: number;
    currentLevel: number;
    currentStreak: number;
    longestStreak: number;
  };
  level: {
    level: number;
    title: string;
    currentLevelXp: number;
    nextLevelXp: number | null;
    progressPercent: number;
  };
  history: Array<{
    id: number;
    sourceType: string;
    coinAmount: number;
    description: string;
    createdAt: string;
  }>;
  redemptions: Array<{
    id: number;
    rewardTitle: string;
    coinCostSnapshot: number;
    status: string;
    fulfillmentNote: string | null;
    createdAt: string;
  }>;
}

const REDEMPTION_STATUS_LABELS: Record<string, { label: string; tone: 'warning' | 'mint' | 'danger' | 'neutral' }> = {
  pending: { label: 'Kutilmoqda', tone: 'warning' },
  fulfilled: { label: 'Topshirildi', tone: 'mint' },
  refunded: { label: 'Qaytarildi', tone: 'danger' },
};

export const WalletPage: React.FC = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['citizen-wallet'],
    queryFn: () => apiRequest<WalletResponse>('/api/citizen/wallet'),
  });

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Eco Hamyon
          </h1>
          <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            Eco Ballar balansi, barcha kirim-chiqim yozuvlari va sovrin buyurtmalari.
          </p>
        </div>
        <Link to="/citizen/market">
          <Button>Eco Marketga o‘tish</Button>
        </Link>
      </div>

      {isError && (
        <ErrorAlert
          message={error instanceof Error ? error.message : 'Hamyon ma’lumotlarini yuklashda xatolik.'}
        />
      )}

      {/* Balance Panel: min-height 160px, #064E3B, 28px padding, balance 40/48/700 white */}
      <div className="min-h-[160px] rounded-[16px] bg-[#064E3B] p-[28px] text-white flex flex-wrap items-center justify-between gap-[20px]">
        <div>
          <div className="flex items-center gap-[8px] text-[13px] font-medium text-[#D1FAE5]">
            <Coins className="w-4 h-4" aria-hidden="true" />
            <span>Mavjud Eco Ballar</span>
          </div>
          <div className="mt-[8px] text-[40px] leading-[48px] font-bold tracking-[-0.02em] tabular-nums">
            {isLoading ? '—' : data?.wallet.coinBalance ?? 0}
          </div>
          <p className="mt-[6px] text-[13px] text-[#D1FAE5]">
            Daraja: {data?.level.level ?? 1} ({data?.level.title ?? 'Yashil Boshlovchi'}) · Jami XP:{' '}
            <span className="font-semibold tabular-nums">{data?.wallet.totalXp ?? 0}</span>
          </p>
        </div>
        <div className="flex flex-col gap-[6px] text-left sm:text-right">
          <span className="text-[12px] text-[#A7F3D0]">Joriy seriya</span>
          <span className="text-[24px] leading-[30px] font-bold tabular-nums">
            {data?.wallet.currentStreak ?? 0} kun
          </span>
          <span className="text-[12px] text-[#D1FAE5] tabular-nums">
            Eng uzun seriya: {data?.wallet.longestStreak ?? 0} kun
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-[24px]">
        {/* Ledger History (2 cols) */}
        <Card className="xl:col-span-2 p-0 md:p-0 overflow-hidden">
          <div className="px-[20px] md:px-[24px] py-[16px] border-b border-[var(--border-default)]">
            <h2 className="text-[18px] leading-[26px] font-semibold">Tranzaksiyalar tarixi</h2>
          </div>
          {isLoading ? (
            <div className="p-[24px] space-y-[12px]">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[64px] rounded-[10px] bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
              ))}
            </div>
          ) : !data?.history?.length ? (
            <EmptyState
              icon={<Receipt />}
              title="Hali tranzaksiyalar yo‘q"
              description="Tasdiqlangan chiqindi yig‘imlari va kundalik topshiriqlar orqali Eco Ball to‘plang."
            />
          ) : (
            <div className="divide-y divide-[var(--border-default)]">
              {data.history.map((item) => {
                const isPositive = item.coinAmount >= 0;
                return (
                  <div
                    key={item.id}
                    className="min-h-[64px] px-[20px] md:px-[24px] py-[12px] flex items-center justify-between gap-[16px]"
                  >
                    <div className="flex items-center gap-[12px] min-w-0">
                      <div
                        className={`w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0 ${
                          isPositive
                            ? 'bg-[#D1FAE5] text-[#065F46] dark:bg-[#065F46]/40 dark:text-[#34D399]'
                            : 'bg-[#F1F5F9] text-[#475569] dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowDownLeft className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14px] leading-[22px] font-medium text-[#0F172A] dark:text-[#F1F5F9] truncate">
                          {item.description}
                        </div>
                        <div className="text-[12px] leading-[18px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
                          {formatTashkentDateTime(item.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`text-[15px] leading-[22px] font-bold tabular-nums whitespace-nowrap shrink-0 ${
                        isPositive
                          ? 'text-[#047857] dark:text-[#34D399]'
                          : 'text-[#0F172A] dark:text-[#F1F5F9]'
                      }`}
                    >
                      {isPositive ? `+${item.coinAmount}` : item.coinAmount} Ball
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Redemptions */}
        <Card className="p-0 md:p-0 overflow-hidden">
          <div className="px-[20px] md:px-[24px] py-[16px] border-b border-[var(--border-default)]">
            <h2 className="text-[18px] leading-[26px] font-semibold">Buyurtmalarim</h2>
          </div>
          {!data?.redemptions?.length ? (
            <EmptyState
              icon={<Gift />}
              title="Buyurtmalar yo‘q"
              description="Eco Marketdan almashtirilgan sovrinlaringiz shu yerda ko‘rinadi."
            />
          ) : (
            <div className="divide-y divide-[var(--border-default)]">
              {data.redemptions.map((r) => {
                const st = REDEMPTION_STATUS_LABELS[r.status] ?? {
                  label: r.status,
                  tone: 'neutral' as const,
                };
                return (
                  <div key={r.id} className="p-[16px_20px] space-y-[6px]">
                    <div className="flex items-start justify-between gap-[8px]">
                      <div className="text-[14px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                        {r.rewardTitle}
                      </div>
                      <StatusBadge tone={st.tone} label={st.label} />
                    </div>
                    <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
                      {r.coinCostSnapshot} Eco Ball · {formatTashkentDateTime(r.createdAt)}
                    </div>
                    {r.fulfillmentNote && (
                      <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE]">
                        Izoh: {r.fulfillmentNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
