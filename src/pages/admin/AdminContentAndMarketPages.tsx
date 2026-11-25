import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, BookOpen, Gift, Receipt, ShieldCheck } from 'lucide-react';
import { apiRequest, formatTashkentDateTime } from '../../lib/api';
import {
  Button,
  Card,
  EmptyState,
  ErrorAlert,
  FormField,
  Input,
  StatusBadge,
  Textarea,
  useToast,
} from '../../components/ui/Primitives';

// ============================================================
// ADMIN QUESTS
// ============================================================

export const AdminQuestsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');

  const { data } = useQuery({
    queryKey: ['admin-quests'],
    queryFn: () =>
      apiRequest<{
        quests: Array<{
          id: number;
          title: string;
          description: string;
          questType: string;
          xpReward: number;
          coinReward: number;
          isActive: boolean;
        }>;
      }>('/api/admin/quests'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/admin/quests', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          questType: 'quiz',
          xpReward: 10,
          coinReward: 2,
          questionText,
          options: [optionA, optionB, optionC].filter(Boolean),
          correctOptionIndex: 0,
        }),
      }),
    onSuccess: () => {
      toastSuccess('Yangi topshiriq yaratildi.');
      setTitle('');
      setDescription('');
      setQuestionText('');
      setOptionA('');
      setOptionB('');
      setOptionC('');
      queryClient.invalidateQueries({ queryKey: ['admin-quests'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest(`/api/admin/quests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      toastSuccess('Topshiriq holati yangilandi.');
      queryClient.invalidateQueries({ queryKey: ['admin-quests'] });
    },
  });

  return (
    <div className="space-y-[24px]">
      <div>
        <h1 className="text-[24px] leading-[32px] font-bold">Topshiriqlarni boshqarish</h1>
        <p className="mt-[4px] text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
          Kundalik viktorina va ekologik topshiriqlarni yarating yoki faollashtiring.
        </p>
      </div>

      <Card>
        <h2 className="text-[16px] font-semibold mb-[16px]">Yangi viktorina topshirig‘i</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-[16px]"
        >
          <FormField label="Sarlavha" htmlFor="q-title" required>
            <Input id="q-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </FormField>
          <FormField label="Qisqa tavsif" htmlFor="q-desc" required>
            <Input id="q-desc" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Savol matni" htmlFor="q-text" required>
              <Input id="q-text" value={questionText} onChange={(e) => setQuestionText(e.target.value)} required />
            </FormField>
          </div>
          <FormField label="To‘g‘ri javob (1-variant)" htmlFor="q-a" required>
            <Input id="q-a" value={optionA} onChange={(e) => setOptionA(e.target.value)} required />
          </FormField>
          <FormField label="2-variant" htmlFor="q-b" required>
            <Input id="q-b" value={optionB} onChange={(e) => setOptionB(e.target.value)} required />
          </FormField>
          <FormField label="3-variant" htmlFor="q-c">
            <Input id="q-c" value={optionC} onChange={(e) => setOptionC(e.target.value)} />
          </FormField>
          <div className="flex items-end">
            <Button type="submit" loading={createMutation.isPending} className="w-full">
              Topshiriq qo‘shish
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 md:p-0 overflow-hidden">
        {!data?.quests?.length ? (
          <EmptyState icon={<Award />} title="Topshiriqlar yo‘q" description="Yangi topshiriq qo‘shing." />
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {data.quests.map((q) => (
              <div key={q.id} className="p-[16px_20px] flex flex-wrap items-center justify-between gap-[12px]">
                <div>
                  <div className="font-semibold">{q.title}</div>
                  <div className="text-[13px] text-[#64748B]">{q.description}</div>
                  <div className="text-[12px] text-[#047857] tabular-nums mt-[4px]">
                    +{q.xpReward} XP · +{q.coinReward} Eco Ball
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={q.isActive ? 'secondary' : 'primary'}
                  onClick={() => toggleMutation.mutate({ id: q.id, isActive: !q.isActive })}
                >
                  {q.isActive ? 'Faolsizlantirish' : 'Faollashtirish'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ============================================================
// ADMIN ECO FACTS
// ============================================================

export const AdminEcoFactsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Qayta ishlash');

  const { data } = useQuery({
    queryKey: ['admin-eco-facts'],
    queryFn: () =>
      apiRequest<{ ecoFacts: Array<{ id: number; title: string; content: string; category: string }> }>(
        '/api/admin/eco-facts'
      ),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/admin/eco-facts', {
        method: 'POST',
        body: JSON.stringify({ title, content, category }),
      }),
    onSuccess: () => {
      toastSuccess('Eko-fakt qo‘shildi.');
      setTitle('');
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['admin-eco-facts'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/eco-facts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toastSuccess('Eko-fakt o‘chirildi.');
      queryClient.invalidateQueries({ queryKey: ['admin-eco-facts'] });
    },
  });

  return (
    <div className="space-y-[24px]">
      <h1 className="text-[24px] leading-[32px] font-bold">Eko-faktlar</h1>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-[16px]"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
            <FormField label="Sarlavha" htmlFor="ef-title" required>
              <Input id="ef-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </FormField>
            <FormField label="Kategoriya" htmlFor="ef-cat">
              <Input id="ef-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Fakt matni" htmlFor="ef-content" required>
            <Textarea
              id="ef-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={400}
              required
            />
          </FormField>
          <Button type="submit" loading={createMutation.isPending}>
            Eko-fakt qo‘shish
          </Button>
        </form>
      </Card>

      <Card className="p-0 md:p-0 overflow-hidden">
        {!data?.ecoFacts?.length ? (
          <EmptyState icon={<BookOpen />} title="Eko-faktlar yo‘q" description="Yangi fakt qo‘shing." />
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {data.ecoFacts.map((f) => (
              <div key={f.id} className="p-[16px_20px] flex items-start justify-between gap-[16px]">
                <div>
                  <div className="font-semibold">{f.title}</div>
                  <p className="text-[14px] text-[#64748B] dark:text-[#A7B8AE] mt-[4px]">{f.content}</p>
                </div>
                <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(f.id)}>
                  O‘chirish
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ============================================================
// ADMIN REWARDS (ECO MARKET CATALOG)
// ============================================================

export const AdminRewardsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coinCost, setCoinCost] = useState('40');
  const [stockQuantity, setStockQuantity] = useState('25');

  const { data } = useQuery({
    queryKey: ['admin-rewards'],
    queryFn: () =>
      apiRequest<{
        rewards: Array<{
          id: number;
          title: string;
          description: string;
          coinCost: number;
          stockQuantity: number;
          isActive: boolean;
        }>;
      }>('/api/admin/rewards'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/admin/rewards', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          coinCost: Number(coinCost),
          stockQuantity: Number(stockQuantity),
          fulfillmentConditions: 'Tuman markazidan olib ketiladi.',
        }),
      }),
    onSuccess: () => {
      toastSuccess('Yangi sovrin qo‘shildi.');
      setTitle('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['admin-rewards'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  const adjustStockMutation = useMutation({
    mutationFn: ({ id, stockQuantity: nextStock }: { id: number; stockQuantity: number }) =>
      apiRequest(`/api/admin/rewards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stockQuantity: nextStock }),
      }),
    onSuccess: () => {
      toastSuccess('Ombor qoldig‘i yangilandi.');
      queryClient.invalidateQueries({ queryKey: ['admin-rewards'] });
    },
  });

  return (
    <div className="space-y-[24px]">
      <h1 className="text-[24px] leading-[32px] font-bold">Eco Market sovrinlari</h1>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-[16px]"
        >
          <FormField label="Sovrin nomi" htmlFor="rw-title" required>
            <Input id="rw-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </FormField>
          <FormField label="Tavsif" htmlFor="rw-desc" required>
            <Input id="rw-desc" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </FormField>
          <FormField label="Narx (Eco Ball)" htmlFor="rw-cost" required>
            <Input id="rw-cost" type="number" min="1" value={coinCost} onChange={(e) => setCoinCost(e.target.value)} required />
          </FormField>
          <FormField label="Ombor qoldig‘i" htmlFor="rw-stock" required>
            <Input id="rw-stock" type="number" min="0" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} required />
          </FormField>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" loading={createMutation.isPending}>Sovrin qo‘shish</Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 md:p-0 overflow-hidden">
        {!data?.rewards?.length ? (
          <EmptyState icon={<Gift />} title="Sovrinlar yo‘q" description="Katalog bo‘sh." />
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {data.rewards.map((r) => (
              <div key={r.id} className="p-[16px_20px] flex flex-wrap items-center justify-between gap-[12px]">
                <div>
                  <div className="font-semibold">{r.title}</div>
                  <div className="text-[13px] text-[#64748B] tabular-nums">
                    {r.coinCost} Eco Ball · Qoldiq: {r.stockQuantity} dona
                  </div>
                </div>
                <div className="flex items-center gap-[8px]">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => adjustStockMutation.mutate({ id: r.id, stockQuantity: r.stockQuantity + 10 })}
                  >
                    +10 qoldiq qo‘shish
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ============================================================
// ADMIN REDEMPTIONS (Fulfill & Idempotent Refund)
// ============================================================

export const AdminRedemptionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-redemptions'],
    queryFn: () =>
      apiRequest<{
        redemptions: Array<{
          id: number;
          citizenName: string;
          citizenPhone: string;
          rewardTitle: string;
          coinCostSnapshot: number;
          status: string;
          createdAt: string;
        }>;
        total: number;
      }>('/api/admin/redemptions?page=1&pageSize=50'),
  });

  const fulfillMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/admin/redemptions/${id}/fulfill`, {
        method: 'POST',
        body: JSON.stringify({ fulfillmentNote: 'Fuqaroga topshirildi' }),
      }),
    onSuccess: () => {
      toastSuccess('Buyurtma topshirildi deb belgilandi.');
      queryClient.invalidateQueries({ queryKey: ['admin-redemptions'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  const refundMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/admin/redemptions/${id}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Administrator tomonidan bekor qilindi' }),
      }),
    onSuccess: () => {
      toastSuccess('Eco Ballar va ombor qoldig‘i qaytarildi.');
      queryClient.invalidateQueries({ queryKey: ['admin-redemptions'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  return (
    <div className="space-y-[24px]">
      <div>
        <h1 className="text-[24px] leading-[32px] font-bold">Eco Market buyurtmalari</h1>
        <p className="mt-[4px] text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
          Jami buyurtmalar: {data?.total ?? 0}. Bekor qilishda ballar va qoldiq faqat bir marta qaytariladi.
        </p>
      </div>

      {isError && <ErrorAlert message={error instanceof Error ? error.message : 'Xatolik.'} />}

      <Card className="p-0 md:p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-[24px]">Yuklanmoqda...</div>
        ) : !data?.redemptions?.length ? (
          <EmptyState icon={<Receipt />} title="Buyurtmalar yo‘q" description="Hali buyurtmalar kelib tushmagan." />
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {data.redemptions.map((r) => (
              <div key={r.id} className="p-[16px_20px] flex flex-wrap items-center justify-between gap-[12px]">
                <div>
                  <div className="flex items-center gap-[8px]">
                    <span className="font-semibold">#{r.id} · {r.rewardTitle}</span>
                    <StatusBadge
                      tone={r.status === 'fulfilled' ? 'mint' : r.status === 'pending' ? 'warning' : 'danger'}
                      label={r.status === 'fulfilled' ? 'Topshirildi' : r.status === 'pending' ? 'Kutilmoqda' : 'Qaytarildi'}
                    />
                  </div>
                  <div className="text-[13px] text-[#64748B] tabular-nums mt-[2px]">
                    {r.citizenName} ({r.citizenPhone}) · {r.coinCostSnapshot} Eco Ball · {formatTashkentDateTime(r.createdAt)}
                  </div>
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-[8px]">
                    <Button size="sm" onClick={() => fulfillMutation.mutate(r.id)}>
                      Topshirish
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => refundMutation.mutate(r.id)}>
                      Bekor qilib qaytarish
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ============================================================
// ADMIN AUDIT LOGS
// ============================================================

export const AdminAuditPage: React.FC = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () =>
      apiRequest<{
        logs: Array<{
          id: number;
          actorName: string | null;
          actorRole: string;
          action: string;
          targetType: string;
          targetId: string | null;
          createdAt: string;
        }>;
        total: number;
      }>('/api/admin/audit?page=1&pageSize=50'),
  });

  return (
    <div className="space-y-[24px]">
      <div>
        <h1 className="text-[24px] leading-[32px] font-bold">Audit jurnali</h1>
        <p className="mt-[4px] text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
          Barcha administrator harakatlarining o‘zgarmas tarixi (jami: {data?.total ?? 0}).
        </p>
      </div>

      {isError && <ErrorAlert message={error instanceof Error ? error.message : 'Xatolik.'} />}

      <Card className="p-0 md:p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-[24px]">Yuklanmoqda...</div>
        ) : !data?.logs?.length ? (
          <EmptyState icon={<ShieldCheck />} title="Yozuvlar yo‘q" description="Audit jurnali bo‘sh." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="h-[44px] border-b border-[var(--border-default)] text-[12px] font-semibold text-[#64748B]">
                  <th className="px-[20px]">Vaqt</th>
                  <th className="px-[16px]">Ijrochi</th>
                  <th className="px-[16px]">Harakat</th>
                  <th className="px-[20px]">Obyekt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] text-[13px]">
                {data.logs.map((log) => (
                  <tr key={log.id} className="h-[52px]">
                    <td className="px-[20px] tabular-nums text-[#64748B]">
                      {formatTashkentDateTime(log.createdAt)}
                    </td>
                    <td className="px-[16px] font-medium">{log.actorName || log.actorRole}</td>
                    <td className="px-[16px] font-mono text-[12px]">{log.action}</td>
                    <td className="px-[20px] text-[#64748B]">
                      {log.targetType} #{log.targetId}
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

// ============================================================
// ADMIN SETTINGS (Reward Rules & Volume Estimates)
// ============================================================

export const AdminSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const [draftRules, setDraftRules] = useState<Array<{ code: string; label: string; xpAmount: number; coinAmount: number }> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () =>
      apiRequest<{
        rewardRules: Array<{ code: string; label: string; xpAmount: number; coinAmount: number }>;
        volumeEstimates: Record<string, number>;
      }>('/api/admin/settings'),
  });

  const rules = draftRules ?? data?.rewardRules ?? [];

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ rewardRules: rules }),
      }),
    onSuccess: () => {
      toastSuccess('Mukofot siyosati saqlandi (kelgusi hodisalarga tatbiq etiladi).');
      setDraftRules(null);
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  return (
    <div className="max-w-[820px] space-y-[24px]">
      <div>
        <h1 className="text-[24px] leading-[32px] font-bold">Tizim sozlamalari</h1>
        <p className="mt-[4px] text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
          XP va Eco Ball mukofot qoidalari (o‘zgarishlar faqat kelgusi voqealarga qo‘llaniladi).
        </p>
      </div>

      <Card className="space-y-[16px]">
        <h2 className="text-[18px] font-semibold">Mukofot qoidalari</h2>
        {isLoading ? (
          <div>Yuklanmoqda...</div>
        ) : (
          <div className="space-y-[12px]">
            {rules.map((r, idx) => (
              <div
                key={r.code}
                className="p-[14px] rounded-[12px] border border-[var(--border-default)] flex flex-wrap items-center justify-between gap-[12px]"
              >
                <div>
                  <div className="font-semibold text-[14px]">{r.label}</div>
                  <div className="text-[12px] text-[#64748B] font-mono">{r.code}</div>
                </div>
                <div className="flex items-center gap-[12px]">
                  <label className="text-[12px] text-[#64748B] flex items-center gap-[6px]">
                    XP:
                    <Input
                      type="number"
                      min="0"
                      value={r.xpAmount}
                      onChange={(e) => {
                        const copy = [...rules];
                        copy[idx] = { ...copy[idx], xpAmount: Number(e.target.value) };
                        setDraftRules(copy);
                      }}
                      className="w-[84px] min-h-[38px] h-[38px] px-[8px]"
                    />
                  </label>
                  <label className="text-[12px] text-[#64748B] flex items-center gap-[6px]">
                    Ball:
                    <Input
                      type="number"
                      min="0"
                      value={r.coinAmount}
                      onChange={(e) => {
                        const copy = [...rules];
                        copy[idx] = { ...copy[idx], coinAmount: Number(e.target.value) };
                        setDraftRules(copy);
                      }}
                      className="w-[84px] min-h-[38px] h-[38px] px-[8px]"
                    />
                  </label>
                </div>
              </div>
            ))}

            <div className="flex justify-end pt-[8px]">
              <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                Sozlamalarni saqlash
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
