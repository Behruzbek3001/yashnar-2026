import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/api';
import { onboardingSchema } from '../lib/domain';
import {
  Button,
  Dialog,
  ErrorAlert,
  FormField,
  Input,
  SearchableSelect,
  YashnarLogo,
  useToast,
} from '../components/ui/Primitives';

interface RegionItem {
  id: number;
  name: string;
}
interface DistrictItem {
  id: number;
  name: string;
}
interface MfyItem {
  id: number;
  name: string;
  status: string;
}

export const OnboardingPage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone || '+998');
  const [regionId, setRegionId] = useState<number | null>(user?.regionId ?? null);
  const [districtId, setDistrictId] = useState<number | null>(user?.districtId ?? null);
  const [mfyId, setMfyId] = useState<number | null>(user?.mfyId ?? null);
  const [publicLeaderboardName, setPublicLeaderboardName] = useState(
    user?.publicLeaderboardName || user?.fullName?.split(' ')[0] || ''
  );
  const [leaderboardVisible, setLeaderboardVisible] = useState(user?.leaderboardVisible ?? true);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Add new MFY dialog
  const [addMfyOpen, setAddMfyOpen] = useState(false);
  const [newMfyName, setNewMfyName] = useState('');
  const [newMfyError, setNewMfyError] = useState<string | null>(null);

  const { data: regionsData } = useQuery({
    queryKey: ['regions'],
    queryFn: () => apiRequest<{ regions: RegionItem[] }>('/api/geography/regions'),
  });

  useEffect(() => {
    if (!regionId && regionsData?.regions?.length) {
      const namangan =
        regionsData.regions.find((r) => r.name.includes('Namangan')) ?? regionsData.regions[0];
      setRegionId(namangan.id);
    }
  }, [regionId, regionsData]);

  useEffect(() => {
    if (!districtId && user?.districtId) {
      setDistrictId(user.districtId);
    }
  }, [districtId, user?.districtId]);

  const effectiveRegionId = regionId ?? regionsData?.regions?.[0]?.id ?? null;

  const { data: districtsData } = useQuery({
    queryKey: ['districts', effectiveRegionId ?? 'all'],
    queryFn: () =>
      apiRequest<{ districts: DistrictItem[] }>(
        effectiveRegionId
          ? `/api/geography/districts?regionId=${effectiveRegionId}`
          : '/api/geography/districts'
      ),
  });

  const { data: mfysData, isLoading: mfysLoading } = useQuery({
    queryKey: ['mfys', districtId],
    queryFn: () =>
      apiRequest<{ mfys: MfyItem[] }>(`/api/geography/mfys?districtId=${districtId}`),
    enabled: Boolean(districtId),
  });

  const addMfyMutation = useMutation({
    mutationFn: (payload: { districtId: number; name: string }) =>
      apiRequest<{ mfy: MfyItem }>('/api/geography/mfys', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mfys', districtId] });
      setMfyId(data.mfy.id);
      setNewMfyName('');
      setNewMfyError(null);
      setAddMfyOpen(false);
      toastSuccess(`“${data.mfy.name}” qo‘shildi (Tasdiqlanmagan).`);
    },
    onError: (err) => {
      setNewMfyError(err instanceof Error ? err.message : 'MFY qo‘shishda xatolik.');
    },
  });

  const handleCreateMfy = (e: React.FormEvent) => {
    e.preventDefault();
    setNewMfyError(null);
    if (!districtId) {
      setNewMfyError('Avval tumanni tanlang.');
      return;
    }
    if (newMfyName.trim().length < 2 || newMfyName.trim().length > 100) {
      setNewMfyError('MFY nomi 2–100 belgidan iborat bo‘lishi kerak.');
      return;
    }
    addMfyMutation.mutate({ districtId, name: newMfyName.trim() });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const parsed = onboardingSchema.safeParse({
      fullName,
      phone,
      regionId: effectiveRegionId ?? undefined,
      districtId: districtId ?? 0,
      mfyId: mfyId ?? 0,
      publicLeaderboardName,
      leaderboardVisible,
    });

    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/api/auth/onboarding', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      await refreshUser();
      toastSuccess('Mahalla ma’lumotlari saqlandi!');
      navigate('/citizen', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ma’lumotlarni saqlashda xatolik.';
      setServerError(msg);
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRegionName =
    regionsData?.regions?.find((r) => r.id === regionId)?.name ?? 'Namangan viloyati';

  const mfyList = mfysData?.mfys ?? [];

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-page)] flex flex-col items-center justify-center p-[16px] md:p-[24px]">
      <div className="w-full max-w-[640px] card-surface p-[24px] md:p-[32px]">
        <div className="flex items-center justify-between mb-[24px]">
          <div className="flex items-center gap-[10px]">
            <YashnarLogo size={36} />
            <span className="text-[20px] font-extrabold text-[#065F46] dark:text-[#34D399]">
              YASHNAR
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="text-[13px] font-medium text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F1F5F9] cursor-pointer"
          >
            Chiqish
          </button>
        </div>

        <h1 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[38px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
          Mahallangizni tanlang
        </h1>
        <p className="mt-[8px] mb-[24px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
          Chiqindi yig‘ish jadvali, haydovchini kuzatish va tuman reytingi uchun hududingizni
          tasdiqlang.
        </p>

        {serverError && <ErrorAlert message={serverError} className="mb-[20px]" />}

        <form onSubmit={handleSubmit} className="space-y-[20px]" noValidate>
          {/* 1. Full name */}
          <FormField
            label="To‘liq ism"
            htmlFor="onb-fullname"
            required
            error={fieldErrors.fullName}
          >
            <Input
              id="onb-fullname"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ismingiz va familiyangiz"
            />
          </FormField>

          {/* 2. Phone */}
          <FormField
            label="Telefon raqami"
            htmlFor="onb-phone"
            required
            helper="Masalan: +998901234567"
            error={fieldErrors.phone}
          >
            <Input
              id="onb-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998901234567"
            />
          </FormField>

          {/* 3. Region (Pre-attached Namangan viloyati) */}
          <FormField
            label="Viloyat"
            htmlFor="onb-region"
            required
            helper="Namangan viloyati avtomatik biriktirilgan"
          >
            <Input id="onb-region" value={selectedRegionName} readOnly disabled />
          </FormField>

          {/* 4. District (Searchable) */}
          <FormField label="Tuman / shahar" htmlFor="onb-district" required error={fieldErrors.districtId}>
            <SearchableSelect
              id="onb-district"
              placeholder="Tumanni tanlang"
              searchPlaceholder="Tumanni qidiring..."
              value={districtId}
              options={(districtsData?.districts ?? []).map((d) => ({
                value: d.id,
                label: d.name,
              }))}
              onChange={(val) => {
                setDistrictId(Number(val));
                setMfyId(null);
              }}
            />
          </FormField>

          {/* 5. MFY (Searchable + Add New MFY) */}
          <div>
            <FormField label="Mahalla (MFY)" htmlFor="onb-mfy" required error={fieldErrors.mfyId}>
              <SearchableSelect
                id="onb-mfy"
                disabled={!districtId || mfysLoading}
                placeholder={!districtId ? 'Avval tumanni tanlang' : 'MFYni tanlang'}
                searchPlaceholder="MFY nomini qidiring..."
                emptyText="Hozircha MFY mavjud emas."
                value={mfyId}
                options={mfyList.map((m) => ({
                  value: m.id,
                  label: m.name,
                  badge: m.status === 'pending' ? 'Tasdiqlanmagan' : undefined,
                }))}
                onChange={(val) => setMfyId(Number(val))}
              />
            </FormField>

            {districtId && (
              <div className="mt-[8px] flex items-center justify-between gap-[12px]">
                <span className="text-[12px] leading-[18px] text-[#64748B] dark:text-[#A7B8AE]">
                  {mfyList.length === 0 ? 'Hozircha MFY mavjud emas.' : 'Ro‘yxatda mahallangiz yo‘qmi?'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNewMfyError(null);
                    setAddMfyOpen(true);
                  }}
                  className="inline-flex items-center gap-[6px] min-h-[36px] px-[10px] rounded-[8px] text-[12px] font-semibold text-[#047857] dark:text-[#34D399] hover:bg-[#D1FAE5]/50 dark:hover:bg-[#059669]/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Yangi MFY qo‘shish</span>
                </button>
              </div>
            )}
          </div>

          {/* 6. Public leaderboard name */}
          <FormField
            label="Reytingda ko‘rinadigan ism"
            htmlFor="onb-lb-name"
            required
            helper="Tuman reytingida faqat ushbu ommaviy nom ko‘rsatiladi."
            error={fieldErrors.publicLeaderboardName}
          >
            <Input
              id="onb-lb-name"
              value={publicLeaderboardName}
              onChange={(e) => setPublicLeaderboardName(e.target.value)}
              placeholder="Masalan: Jasur T."
            />
          </FormField>

          {/* 7. Leaderboard visibility checkbox (>=44px touch target, 18px visual) */}
          <label className="flex items-center gap-[10px] min-h-[44px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={leaderboardVisible}
              onChange={(e) => setLeaderboardVisible(e.target.checked)}
              className="w-[18px] h-[18px] rounded-[4px] accent-[#059669] cursor-pointer shrink-0"
            />
            <span className="text-[14px] leading-[22px] text-[#0F172A] dark:text-[#F1F5F9]">
              Ismim tuman reytingida ommaviy ko‘rsatilsin
            </span>
          </label>

          <Button
            type="submit"
            className="w-full"
            loading={submitting}
            loadingLabel="Saqlanmoqda..."
          >
            Saqlash va davom etish
          </Button>
        </form>
      </div>

      {/* Add New MFY Dialog */}
      <Dialog
        open={addMfyOpen}
        onClose={() => setAddMfyOpen(false)}
        title="Yangi MFY qo‘shish"
        description="Yangi qo‘shilgan mahalla darhol foydalanish uchun ochiladi va administrator tasdiqlaguniga qadar “Tasdiqlanmagan” belgisi bilan ko‘rinadi."
      >
        <form onSubmit={handleCreateMfy} className="space-y-[16px]">
          {newMfyError && <ErrorAlert message={newMfyError} />}
          <FormField label="MFY nomi" htmlFor="new-mfy-name" required helper="2–100 belgi">
            <Input
              id="new-mfy-name"
              value={newMfyName}
              onChange={(e) => setNewMfyName(e.target.value)}
              placeholder="Masalan: Chorsu MFY"
            />
          </FormField>
          <div className="flex justify-end gap-[12px]">
            <Button type="button" variant="secondary" onClick={() => setAddMfyOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              type="submit"
              loading={addMfyMutation.isPending}
              loadingLabel="Qo‘shilmoqda..."
            >
              Qo‘shish
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
