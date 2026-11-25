import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, ShoppingBag } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Button, Card, Dialog, EmptyState, ErrorAlert, useToast } from '../../components/ui/Primitives';

interface MarketReward {
  id: number;
  title: string;
  description: string;
  imageUrl: string | null;
  coinCost: number;
  stockQuantity: number;
  fulfillmentConditions: string;
}

interface MarketResponse {
  rewards: MarketReward[];
  coinBalance: number;
}

export const EcoMarketPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const [selectedReward, setSelectedReward] = useState<MarketReward | null>(null);
  const [pendingKey, setPendingKey] = useState<string>('');
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['citizen-market'],
    queryFn: () => apiRequest<MarketResponse>('/api/citizen/market'),
  });

  const redeemMutation = useMutation({
    mutationFn: ({ rewardId, idempotencyKey }: { rewardId: number; idempotencyKey: string }) =>
      apiRequest<{ message: string }>('/api/citizen/market/redeem', {
        method: 'POST',
        body: JSON.stringify({ rewardId, idempotencyKey }),
      }),
    onSuccess: (res) => {
      toastSuccess(res.message);
      setSelectedReward(null);
      queryClient.invalidateQueries({ queryKey: ['citizen-market'] });
      queryClient.invalidateQueries({ queryKey: ['citizen-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['citizen-dashboard'] });
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : 'Almashtirishda xatolik yuz berdi.');
    },
  });

  const openConfirm = (reward: MarketReward) => {
    setSelectedReward(reward);
    setPendingKey(`redeem-${reward.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  };

  const coinBalance = data?.coinBalance ?? 0;

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Eco Market
          </h1>
          <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            To‘plagan Eco Ballaringizni ekologik sovrinlarga almashtiring.
          </p>
        </div>

        <div className="inline-flex items-center gap-[10px] px-[16px] py-[10px] rounded-[12px] bg-[#064E3B] text-white">
          <Coins className="w-5 h-5 text-[#34D399]" aria-hidden="true" />
          <div>
            <div className="text-[11px] leading-[14px] text-[#D1FAE5]">Joriy balans</div>
            <div className="text-[18px] leading-[22px] font-bold tabular-nums">
              {coinBalance} Eco Ball
            </div>
          </div>
        </div>
      </div>

      {isError && (
        <ErrorAlert
          message={error instanceof Error ? error.message : 'Eco Market mahsulotlarini yuklashda xatolik.'}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[24px]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[360px] rounded-[16px] bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : !data?.rewards?.length ? (
        <Card>
          <EmptyState
            icon={<ShoppingBag />}
            title="Hozircha sovrinlar mavjud emas"
            description="Eco Market katalogi tez orada yangilanadi."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[24px]">
          {data.rewards.map((reward) => {
            const outOfStock = reward.stockQuantity <= 0;
            const insufficient = coinBalance < reward.coinCost;
            const imageBroken = !reward.imageUrl || failedImages[reward.id];

            return (
              <div
                key={reward.id}
                className="card-surface p-[20px] rounded-[16px] flex flex-col justify-between gap-[16px]"
              >
                <div className="space-y-[14px]">
                  <div className="aspect-[4/3] w-full rounded-[12px] overflow-hidden bg-[#F1F5F9] dark:bg-[#0F1D17] border border-[var(--border-default)] flex items-center justify-center">
                    {imageBroken ? (
                      <div className="flex flex-col items-center justify-center text-[#64748B] dark:text-[#A7B8AE] p-[16px] text-center">
                        <ShoppingBag className="w-[36px] h-[36px] mb-[8px]" aria-hidden="true" />
                        <span className="text-[12px]">Rasm mavjud emas</span>
                      </div>
                    ) : (
                      <img
                        src={reward.imageUrl!}
                        alt={reward.title}
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [reward.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div>
                    <h2 className="text-[16px] leading-[24px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                      {reward.title}
                    </h2>
                    <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
                      {reward.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-[12px] pt-[8px] border-t border-[var(--border-default)]">
                  <div className="flex items-baseline justify-between gap-[8px]">
                    <span className="text-[20px] leading-[28px] font-bold text-[#047857] dark:text-[#34D399] tabular-nums">
                      {reward.coinCost} Eco Ball
                    </span>
                    <span className="text-[12px] leading-[18px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
                      {outOfStock ? 'Omborda qolmagan' : `Qoldiq: ${reward.stockQuantity} dona`}
                    </span>
                  </div>

                  <Button
                    className="w-full"
                    disabled={outOfStock || insufficient}
                    onClick={() => openConfirm(reward)}
                  >
                    {outOfStock
                      ? 'Tugagan'
                      : insufficient
                      ? 'Eco Ballar yetarli emas'
                      : 'Eco Ballarga almashtirish'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(selectedReward)}
        onClose={() => setSelectedReward(null)}
        title="Almashtirishni tasdiqlang"
        description={selectedReward?.title}
      >
        {selectedReward && (
          <div className="space-y-[16px]">
            <div className="rounded-[12px] bg-[#F8FAFC] dark:bg-[#0F1D17] border border-[var(--border-default)] p-[16px] space-y-[10px] text-[14px]">
              <div className="flex justify-between">
                <span className="text-[#64748B] dark:text-[#A7B8AE]">Sovrin narxi</span>
                <span className="font-semibold tabular-nums">{selectedReward.coinCost} Eco Ball</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] dark:text-[#A7B8AE]">Joriy balans</span>
                <span className="font-semibold tabular-nums">{coinBalance} Eco Ball</span>
              </div>
              <div className="pt-[8px] border-t border-[var(--border-default)] flex justify-between">
                <span className="font-medium">Qoladigan balans</span>
                <span className="font-bold text-[#047857] dark:text-[#34D399] tabular-nums">
                  {coinBalance - selectedReward.coinCost} Eco Ball
                </span>
              </div>
            </div>

            {selectedReward.fulfillmentConditions && (
              <div className="text-[13px] leading-[20px] text-[#64748B] dark:text-[#A7B8AE]">
                <span className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">Topshirish shartlari: </span>
                {selectedReward.fulfillmentConditions}
              </div>
            )}

            <div className="flex justify-end gap-[12px] pt-[8px]">
              <Button variant="secondary" onClick={() => setSelectedReward(null)}>
                Bekor qilish
              </Button>
              <Button
                loading={redeemMutation.isPending}
                loadingLabel="Tasdiqlanmoqda..."
                onClick={() =>
                  redeemMutation.mutate({
                    rewardId: selectedReward.id,
                    idempotencyKey: pendingKey,
                  })
                }
              >
                Tasdiqlash
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
