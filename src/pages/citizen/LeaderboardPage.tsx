import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, EmptyState, ErrorAlert, Select, cn } from '../../components/ui/Primitives';

interface LeaderboardEntry {
  rank: number;
  userId: number;
  displayName: string;
  xp: number;
  isCurrentUser: boolean;
}

interface DistrictItem {
  id: number;
  name: string;
}

const PERIOD_TABS = [
  { id: 'today', label: 'Bugun' },
  { id: 'week', label: 'Haftalik' },
  { id: 'month', label: 'Oylik' },
  { id: 'all', label: 'Umumiy' },
] as const;

export const LeaderboardPage: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [selectedDistrictId, setSelectedDistrictId] = useState<number>(user?.districtId ?? 0);

  const { data: districtsData } = useQuery({
    queryKey: ['districts'],
    queryFn: () => apiRequest<{ districts: DistrictItem[] }>('/api/geography/districts'),
  });

  const effectiveDistrictId = selectedDistrictId || user?.districtId || districtsData?.districts?.[0]?.id || 0;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['citizen-leaderboard', period, effectiveDistrictId],
    queryFn: () =>
      apiRequest<{ entries: LeaderboardEntry[]; period: string; districtId: number | null }>(
        `/api/citizen/leaderboard?period=${period}&districtId=${effectiveDistrictId}`
      ),
    enabled: effectiveDistrictId > 0,
  });

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-end justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Tuman reytingi
          </h1>
          <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            Faqat reytingda ko‘rinishga rozilik bergan faol fuqarolar haqiqiy XP jurnali asosida reytinglanadi.
          </p>
        </div>

        <div className="w-full sm:w-[240px]">
          <label htmlFor="lb-district" className="sr-only">
            Tumanni tanlang
          </label>
          <Select
            id="lb-district"
            value={effectiveDistrictId || ''}
            onChange={(e) => setSelectedDistrictId(Number(e.target.value))}
          >
            {districtsData?.districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Filter Tabs: 40px height */}
      <div
        role="tablist"
        aria-label="Reyting davri"
        className="inline-flex flex-wrap items-center gap-[6px] p-[4px] rounded-[12px] bg-[#E2E8F0]/60 dark:bg-[#13231D] border border-[var(--border-default)]"
      >
        {PERIOD_TABS.map((tab) => {
          const active = period === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPeriod(tab.id)}
              className={cn(
                'h-[40px] px-[16px] rounded-[8px] text-[14px] font-semibold transition-colors cursor-pointer whitespace-nowrap',
                active
                  ? 'bg-white dark:bg-[#059669] text-[#065F46] dark:text-white shadow-xs'
                  : 'text-[#64748B] dark:text-[#A7B8AE] hover:text-[#0F172A] dark:hover:text-[#F1F5F9]'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isError && (
        <ErrorAlert
          message={error instanceof Error ? error.message : 'Reytingni yuklashda xatolik.'}
        />
      )}

      <Card className="p-0 md:p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-[24px] space-y-[12px]">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[64px] rounded-[10px] bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : !data?.entries?.length ? (
          <EmptyState
            icon={<Trophy />}
            title="Hozircha reyting ma’lumoti yo‘q"
            description="Ushbu tumanda va tanlangan davrda faol ishtirokchilar hali qayd etilmagan."
          />
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {data.entries.map((entry) => {
              const initial = (entry.displayName?.trim()?.[0] || 'F').toUpperCase();
              return (
                <div
                  key={entry.userId}
                  className={cn(
                    'min-h-[64px] px-[16px] md:px-[24px] py-[12px] flex items-center justify-between gap-[12px]',
                    entry.isCurrentUser
                      ? 'bg-[#ECFDF5] dark:bg-[#059669]/20'
                      : 'bg-transparent'
                  )}
                >
                  <div className="flex items-center gap-[12px] min-w-0">
                    <span
                      className={cn(
                        'w-[40px] text-center text-[14px] leading-[22px] font-bold tabular-nums shrink-0',
                        entry.rank <= 3
                          ? 'text-[#047857] dark:text-[#34D399]'
                          : 'text-[#64748B] dark:text-[#A7B8AE]'
                      )}
                    >
                      #{entry.rank}
                    </span>
                    <span className="w-[36px] h-[36px] rounded-full bg-[#064E3B] text-white text-[14px] font-bold flex items-center justify-center shrink-0">
                      {initial}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] leading-[22px] font-semibold text-[#0F172A] dark:text-[#F1F5F9] truncate">
                        {entry.displayName}
                        {entry.isCurrentUser && (
                          <span className="ml-[8px] text-[12px] font-medium text-[#047857] dark:text-[#34D399]">
                            (Siz)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[14px] leading-[22px] font-bold text-[#0F172A] dark:text-[#F1F5F9] tabular-nums whitespace-nowrap shrink-0">
                    {entry.xp} XP
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
