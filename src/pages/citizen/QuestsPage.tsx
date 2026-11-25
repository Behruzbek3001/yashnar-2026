import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, BookOpen, CheckCircle2, ClipboardCheck, HelpCircle, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { Button, Card, EmptyState, ErrorAlert, StatusBadge, useToast } from '../../components/ui/Primitives';

interface CitizenQuest {
  id: number;
  templateCode: string;
  title: string;
  description: string;
  questType: string;
  xpReward: number;
  coinReward: number;
  questionText: string | null;
  options: string[] | null;
  quizDayNumber?: number | null;
  quizTotalCount?: number | null;
  completedToday: boolean;
}

interface QuestsResponse {
  localDateTashkent: string;
  quests: CitizenQuest[];
}

function getQuestIcon(type: string) {
  if (type === 'quiz') return BookOpen;
  if (type === 'participation') return Users;
  if (type === 'report') return ClipboardCheck;
  return HelpCircle;
}

export const QuestsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [feedbackByQuest, setFeedbackByQuest] = useState<Record<number, { ok: boolean; text: string }>>({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['citizen-quests'],
    queryFn: () => apiRequest<QuestsResponse>('/api/citizen/quests'),
  });

  const submitMutation = useMutation({
    mutationFn: ({ questId, selectedOptionIndex }: { questId: number; selectedOptionIndex: number }) =>
      apiRequest<{ correct: boolean; message: string; xpGranted?: number; coinsGranted?: number }>(
        `/api/citizen/quests/${questId}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ selectedOptionIndex }),
        }
      ),
    onSuccess: (res, vars) => {
      setFeedbackByQuest((prev) => ({
        ...prev,
        [vars.questId]: { ok: res.correct, text: res.message },
      }));
      if (res.correct) {
        toastSuccess(res.message);
        queryClient.invalidateQueries({ queryKey: ['citizen-quests'] });
        queryClient.invalidateQueries({ queryKey: ['citizen-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['citizen-wallet'] });
        queryClient.invalidateQueries({ queryKey: ['citizen-leaderboard'] });
      } else {
        toastError(res.message);
      }
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : 'Javobni tekshirishda xatolik.');
    },
  });

  const completedCount = data?.quests.filter((q) => q.completedToday).length ?? 0;
  const totalCount = data?.quests.length ?? 0;

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Kundalik topshiriqlar
          </h1>
          <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            Topshiriqlar har kuni Toshkent vaqti bilan 00:00 da yangilanadi
            {data?.localDateTashkent ? ` (${data.localDateTashkent})` : ''}.
          </p>
        </div>
        <div className="inline-flex items-center gap-[8px] px-[14px] py-[8px] rounded-[10px] bg-[#D1FAE5] dark:bg-[#065F46]/40 text-[#065F46] dark:text-[#34D399] text-[13px] font-semibold tabular-nums">
          <Award className="w-4 h-4" aria-hidden="true" />
          <span>
            Bugun bajarildi: {completedCount} / {totalCount}
          </span>
        </div>
      </div>

      {isError && (
        <ErrorAlert
          message={error instanceof Error ? error.message : 'Topshiriqlarni yuklashda xatolik.'}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[240px] rounded-[16px] bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : !data?.quests?.length ? (
        <Card>
          <EmptyState
            icon={<Award />}
            title="Faol topshiriqlar mavjud emas"
            description="Hozircha kundalik topshiriqlar qo‘shilmagan. Keyinroq yana tekshiring."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
          {data.quests.map((quest) => {
            const Icon = getQuestIcon(quest.questType);
            const picked = selectedOptions[quest.id];
            const feedback = feedbackByQuest[quest.id];
            const progressPercent = quest.completedToday ? 100 : 0;

            return (
              <Card key={quest.id} className="min-h-[220px] p-[24px] flex flex-col justify-between gap-[16px]">
                <div className="space-y-[16px]">
                  <div className="flex items-start justify-between gap-[12px]">
                    <div className="flex items-start gap-[14px]">
                      <div className="w-[48px] h-[48px] rounded-[12px] bg-[#D1FAE5] dark:bg-[#065F46]/40 text-[#065F46] dark:text-[#34D399] flex items-center justify-center shrink-0">
                        <Icon className="w-[24px] h-[24px]" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-[8px]">
                          <h2 className="text-[18px] leading-[26px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                            {quest.title}
                          </h2>
                          {quest.questType === 'quiz' && quest.quizDayNumber && quest.quizTotalCount && (
                            <span className="inline-flex items-center px-[8px] py-[2px] rounded-[6px] bg-[#DBEAFE] dark:bg-[#1E3A8A]/40 text-[#1E40AF] dark:text-[#93C5FD] text-[11px] font-semibold tabular-nums">
                              Savol {quest.quizDayNumber} / {quest.quizTotalCount}
                            </span>
                          )}
                        </div>
                        <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
                          {quest.description}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center h-[28px] px-[10px] rounded-[8px] bg-[#D1FAE5] dark:bg-[#065F46]/40 text-[#065F46] dark:text-[#34D399] text-[12px] font-semibold whitespace-nowrap shrink-0 tabular-nums">
                      +{quest.xpReward} XP · +{quest.coinReward} Ball
                    </span>
                  </div>

                  {/* Progress bar 8px height */}
                  <div>
                    <div className="flex items-center justify-between text-[12px] text-[#64748B] dark:text-[#A7B8AE] mb-[6px]">
                      <span>Holat</span>
                      {quest.completedToday ? (
                        <StatusBadge tone="mint" label="Bajarildi" />
                      ) : (
                        <span className="tabular-nums">0%</span>
                      )}
                    </div>
                    <div className="w-full h-[8px] rounded-full bg-[#E2E8F0] dark:bg-[#294237] overflow-hidden">
                      <div
                        className="h-full bg-[#059669] transition-all duration-200"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Interactive Question & Answer Buttons (48px min-height, 8px gap) */}
                  {quest.questType === 'report' ? (
                    <div className="pt-[4px]">
                      <p className="text-[13px] leading-[20px] text-[#64748B] dark:text-[#A7B8AE] mb-[12px]">
                        Ushbu topshiriq yangi chiqindi murojaatingiz administrator yoki haydovchi tomonidan tasdiqlanganda avtomatik bajariladi.
                      </p>
                      <Link to="/citizen/report">
                        <Button variant="secondary" className="w-full">
                          Xabar yuborish sahifasiga o‘tish
                        </Button>
                      </Link>
                    </div>
                  ) : quest.completedToday ? (
                    <div className="flex items-center gap-[10px] p-[12px_14px] rounded-[10px] bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#065F46] dark:text-[#34D399] text-[14px] font-medium">
                      <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                      <span>Bugungi topshiriq muvaffaqiyatli yakunlandi.</span>
                    </div>
                  ) : quest.questionText && quest.options && quest.options.length > 0 ? (
                    <div className="space-y-[12px] pt-[4px]">
                      <p className="text-[14px] leading-[22px] font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                        {quest.questionText}
                      </p>
                      <div className="flex flex-col gap-[8px]" role="radiogroup" aria-label={quest.title}>
                        {quest.options.map((option, idx) => {
                          const isSelected = picked === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() =>
                                setSelectedOptions((prev) => ({ ...prev, [quest.id]: idx }))
                              }
                              className={`min-h-[48px] w-full px-[14px] py-[10px] rounded-[10px] text-left text-[14px] leading-[20px] border transition-colors cursor-pointer ${
                                isSelected
                                  ? 'border-[#059669] bg-[#ECFDF5] dark:bg-[#065F46]/40 text-[#065F46] dark:text-[#34D399] font-semibold'
                                  : 'border-[#E2E8F0] dark:border-[#294237] bg-white dark:bg-[#0F1D17] text-[#0F172A] dark:text-[#F1F5F9] hover:bg-[#F8FAFC] dark:hover:bg-[#1A2F27]'
                              }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>

                      {feedback && !feedback.ok && (
                        <p role="alert" className="text-[13px] text-[#B91C1C] dark:text-[#FCA5A5]">
                          {feedback.text}
                        </p>
                      )}

                      <Button
                        className="w-full"
                        disabled={picked === undefined}
                        loading={submitMutation.isPending && submitMutation.variables?.questId === quest.id}
                        loadingLabel="Tekshirilmoqda..."
                        onClick={() => {
                          if (picked === undefined) return;
                          submitMutation.mutate({ questId: quest.id, selectedOptionIndex: picked });
                        }}
                      >
                        Javobni tekshirish
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
