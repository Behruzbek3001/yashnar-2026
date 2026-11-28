import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, CheckCircle2, FileWarning, GitMerge, Pencil, Truck, Users, X as XIcon } from 'lucide-react';
import { apiRequest, formatTashkentDateTime } from '../../lib/api';
import { PlateEditor } from '../../components/ui/PlateEditor';
import { ReportComments, ReportPhotoView } from '../../components/reports/ReportComments';
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorAlert,
  FormField,
  Input,
  Select,
  StatusBadge,
  useToast,
} from '../../components/ui/Primitives';
import type { ReportStatus } from '../../lib/domain';

// ============================================================
// ADMIN MFYs & DISTRICTS
// ============================================================

interface AdminMfy {
  id: number;
  districtId: number;
  districtName: string;
  name: string;
  status: string;
  workloadThresholdLiters: number;
  pendingCount: number;
  estimatedPendingLiters: number;
  uncappedPercent: number;
}

export const AdminMfysPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const [newDistrictName, setNewDistrictName] = useState('');
  const [mergeSource, setMergeSource] = useState<AdminMfy | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number>(0);
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<number, string>>({});
  const [nameEdit, setNameEdit] = useState<{ id: number; value: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-mfys'],
    queryFn: () => apiRequest<{ mfys: AdminMfy[] }>('/api/admin/mfys'),
  });

  const [newMfyDistrictId, setNewMfyDistrictId] = useState<number>(0);
  const { data: districtsData } = useQuery({
    queryKey: ['districts'],
    queryFn: () => apiRequest<{ districts: Array<{ id: number; name: string }> }>('/api/geography/districts'),
  });

  const createDistrictMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/admin/mfys', {
        method: 'POST',
        body: JSON.stringify({ name: newDistrictName, districtId: newMfyDistrictId }),
      }),
    onSuccess: () => {
      toastSuccess('Yangi MFY qo‘shildi va tasdiqlandi.');
      setNewDistrictName('');
      queryClient.invalidateQueries({ queryKey: ['admin-mfys'] });
      queryClient.invalidateQueries({ queryKey: ['mfys'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  const patchMfyMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      apiRequest(`/api/admin/mfys/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toastSuccess('MFY yangilandi.');
      setNameEdit(null);
      queryClient.invalidateQueries({ queryKey: ['admin-mfys'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  const mergeMutation = useMutation({
    mutationFn: ({ sourceId, targetMfyId }: { sourceId: number; targetMfyId: number }) =>
      apiRequest(`/api/admin/mfys/${sourceId}/merge`, {
        method: 'POST',
        body: JSON.stringify({ targetMfyId }),
      }),
    onSuccess: () => {
      toastSuccess('MFY muvaffaqiyatli birlashtirildi.');
      setMergeSource(null);
      queryClient.invalidateQueries({ queryKey: ['admin-mfys'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Birlashtirishda xatolik.'),
  });

  const activeMfys = (data?.mfys ?? []).filter((m) => m.status !== 'merged');

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-end justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold">MFY va tumanlar</h1>
          <p className="mt-[4px] text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
            Fuqarolar qo‘shgan MFYlarni tasdiqlang, yuklama chegarasini tahrirlang yoki takroriylarni birlashtiring.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newMfyDistrictId) {
              toastError('Avval tumanni tanlang.');
              return;
            }
            if (newDistrictName.trim()) createDistrictMutation.mutate();
          }}
          className="flex flex-wrap items-center gap-[8px]"
        >
          <select
            aria-label="Tuman"
            value={newMfyDistrictId}
            onChange={(e) => setNewMfyDistrictId(Number(e.target.value))}
            className="h-[44px] rounded-[10px] border border-[#E2E8F0] dark:border-[#24382F] bg-white dark:bg-[#11211B] px-[10px] text-[14px] text-[#0F172A] dark:text-[#F1F5F9]"
          >
            <option value={0}>Tumanni tanlang...</option>
            {(districtsData?.districts ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <Input
            aria-label="Yangi MFY nomi"
            placeholder="Yangi MFY nomi..."
            value={newDistrictName}
            onChange={(e) => setNewDistrictName(e.target.value)}
            className="w-[200px]"
          />
          <Button type="submit" loading={createDistrictMutation.isPending}>
            MFY qo‘shish
          </Button>
        </form>
      </div>

      {isError && <ErrorAlert message={error instanceof Error ? error.message : 'Xatolik.'} />}

      <Card className="p-0 md:p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-[24px]">Yuklanmoqda...</div>
        ) : !data?.mfys?.length ? (
          <EmptyState icon={<Building2 />} title="MFYlar topilmadi" description="Hozircha MFYlar mavjud emas." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="h-[44px] border-b border-[var(--border-default)] text-[12px] font-semibold text-[#64748B] dark:text-[#A7B8AE]">
                  <th className="px-[20px]">MFY nomi</th>
                  <th className="px-[16px]">Tuman</th>
                  <th className="px-[16px]">Holat</th>
                  <th className="px-[16px]">Yuklama</th>
                  <th className="px-[16px]">Chegara (L)</th>
                  <th className="px-[20px] text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] text-[14px]">
                {data.mfys.map((m) => (
                  <tr key={m.id} className="min-h-[60px]">
                    <td className="px-[20px] py-[12px] font-semibold">
                      {nameEdit?.id === m.id ? (
                        <form
                          className="flex items-center gap-[6px]"
                          onSubmit={(e) => {
                            e.preventDefault();
                            patchMfyMutation.mutate({ id: m.id, payload: { name: nameEdit.value } });
                          }}
                        >
                          <Input
                            autoFocus
                            aria-label="MFY nomi"
                            value={nameEdit.value}
                            onChange={(e) => setNameEdit({ id: m.id, value: e.target.value })}
                            onKeyDown={(e) => e.key === 'Escape' && setNameEdit(null)}
                            className="min-h-[36px] h-[36px] w-[180px] py-[4px] px-[8px]"
                          />
                          <button type="submit" aria-label="Saqlash" title="Saqlash" className="p-[6px] rounded-[8px] text-[#047857] hover:bg-[#ECFDF5] cursor-pointer">
                            <Check className="w-[18px] h-[18px]" />
                          </button>
                          <button type="button" aria-label="Bekor qilish" title="Bekor qilish" onClick={() => setNameEdit(null)} className="p-[6px] rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer">
                            <XIcon className="w-[18px] h-[18px]" />
                          </button>
                        </form>
                      ) : (
                        <span className="inline-flex items-center gap-[6px]">
                          {m.name}
                          <button
                            type="button"
                            aria-label={`${m.name} nomini tahrirlash`}
                            title="Nomini tahrirlash"
                            onClick={() => setNameEdit({ id: m.id, value: m.name })}
                            className="p-[4px] rounded-[6px] text-[#94A3B8] hover:text-[#047857] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2F27] cursor-pointer"
                          >
                            <Pencil className="w-[14px] h-[14px]" />
                          </button>
                        </span>
                      )}
                    </td>
                    <td className="px-[16px] py-[12px] text-[#64748B] dark:text-[#A7B8AE]">{m.districtName}</td>
                    <td className="px-[16px] py-[12px]">
                      <StatusBadge
                        tone={m.status === 'approved' ? 'mint' : m.status === 'pending' ? 'warning' : 'neutral'}
                        label={
                          m.status === 'approved'
                            ? 'Tasdiqlangan'
                            : m.status === 'pending'
                            ? 'Ko‘rib chiqilmoqda'
                            : 'Birlashtirilgan'
                        }
                      />
                    </td>
                    <td className="px-[16px] py-[12px] tabular-nums">
                      {m.uncappedPercent}% ({m.estimatedPendingLiters} L)
                    </td>
                    <td className="px-[16px] py-[12px]">
                      <div className="flex items-center gap-[6px]">
                        <Input
                          type="number"
                          aria-label={`${m.name} chegarasi`}
                          value={thresholdDrafts[m.id] ?? String(m.workloadThresholdLiters)}
                          onChange={(e) =>
                            setThresholdDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          className="min-h-[36px] h-[36px] w-[96px] py-[4px] px-[8px]"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            patchMfyMutation.mutate({
                              id: m.id,
                              payload: {
                                workloadThresholdLiters: Number(
                                  thresholdDrafts[m.id] ?? m.workloadThresholdLiters
                                ),
                              },
                            })
                          }
                        >
                          Saqlash
                        </Button>
                      </div>
                    </td>
                    <td className="px-[20px] py-[12px]">
                      <div className="flex items-center justify-end gap-[8px]">
                        {m.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() =>
                              patchMfyMutation.mutate({ id: m.id, payload: { status: 'approved' } })
                            }
                          >
                            Tasdiqlash
                          </Button>
                        )}
                        {m.status !== 'merged' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setMergeSource(m);
                              const alt = activeMfys.find((x) => x.id !== m.id);
                              setMergeTargetId(alt?.id ?? 0);
                            }}
                          >
                            <GitMerge className="w-3.5 h-3.5" aria-hidden="true" />
                            Birlashtirish
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={Boolean(mergeSource)}
        onClose={() => setMergeSource(null)}
        title="MFYni birlashtirish"
        description={
          mergeSource
            ? `“${mergeSource.name}” MFYdagi barcha fuqarolar va murojaatlar tanlangan maqsad MFYga o‘tkaziladi.`
            : undefined
        }
      >
        {mergeSource && (
          <div className="space-y-[16px]">
            <FormField label="Maqsad MFY" htmlFor="merge-target">
              <Select
                id="merge-target"
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(Number(e.target.value))}
              >
                {activeMfys
                  .filter((x) => x.id !== mergeSource.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} ({x.districtName})
                    </option>
                  ))}
              </Select>
            </FormField>
            <div className="flex justify-end gap-[12px]">
              <Button variant="secondary" onClick={() => setMergeSource(null)}>
                Bekor qilish
              </Button>
              <Button
                variant="danger"
                loading={mergeMutation.isPending}
                onClick={() =>
                  mergeMutation.mutate({ sourceId: mergeSource.id, targetMfyId: mergeTargetId })
                }
              >
                Birlashtirishni tasdiqlash
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

// ============================================================
// ADMIN DRIVERS & ASSIGNMENTS
// ============================================================

interface AdminDriver {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  approvalStatus: string;
  vehiclePlate: string;
  vehicleConfirmed?: boolean;
  vehicleCapacityLiters: number;
  assignedMfys: Array<{ driverId: number; mfyId: number; mfyName: string }>;
}

export const AdminDriversPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const [assignDriver, setAssignDriver] = useState<AdminDriver | null>(null);
  const [selectedMfyIds, setSelectedMfyIds] = useState<number[]>([]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: () => apiRequest<{ drivers: AdminDriver[] }>('/api/admin/drivers'),
  });

  const { data: mfysData } = useQuery({
    queryKey: ['admin-mfys'],
    queryFn: () => apiRequest<{ mfys: AdminMfy[] }>('/api/admin/mfys'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, approvalStatus }: { id: number; approvalStatus: string }) =>
      apiRequest(`/api/admin/drivers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ approvalStatus }),
      }),
    onSuccess: () => {
      toastSuccess('Haydovchi holati yangilandi.');
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ driverId, mfyIds }: { driverId: number; mfyIds: number[] }) =>
      apiRequest(`/api/admin/drivers/${driverId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ mfyIds }),
      }),
    onSuccess: () => {
      toastSuccess('MFY biriktirish saqlandi.');
      setAssignDriver(null);
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  return (
    <div className="space-y-[24px]">
      <div>
        <h1 className="text-[24px] leading-[32px] font-bold">Haydovchilar</h1>
        <p className="mt-[4px] text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
          Haydovchilarni tasdiqlang, vaqtincha to‘xtating yoki mas’ul MFYlarga biriktiring.
        </p>
      </div>

      {isError && <ErrorAlert message={error instanceof Error ? error.message : 'Xatolik.'} />}

      <Card className="p-0 md:p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-[24px]">Yuklanmoqda...</div>
        ) : !data?.drivers?.length ? (
          <EmptyState icon={<Truck />} title="Haydovchilar yo‘q" description="Hozircha haydovchilar ro‘yxatga olinmagan." />
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {data.drivers.map((drv) => (
              <div key={drv.id} className="p-[16px_20px] flex flex-wrap items-center justify-between gap-[16px]">
                <div className="space-y-[4px]">
                  <div className="flex items-center gap-[10px]">
                    <span className="text-[15px] font-semibold">{drv.fullName}</span>
                    <StatusBadge
                      tone={drv.approvalStatus === 'approved' ? 'mint' : drv.approvalStatus === 'pending' ? 'warning' : 'danger'}
                      label={
                        drv.approvalStatus === 'approved'
                          ? 'Tasdiqlangan'
                          : drv.approvalStatus === 'pending'
                          ? 'Kutilmoqda'
                          : 'To‘xtatilgan'
                      }
                    />
                  </div>
                  <div className="text-[13px] text-[#64748B] dark:text-[#A7B8AE]">
                    {drv.email} · {drv.phone} ·{' '}
                    <PlateEditor
                      plate={drv.vehiclePlate}
                      endpoint={`/api/admin/drivers/${drv.id}`}
                      onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-drivers'] })}
                    />
                    {drv.vehicleConfirmed === false && (
                      <span className="ml-[6px] inline-block rounded-[6px] bg-[#FEF3C7] text-[#92400E] px-[6px] py-[1px] text-[11px] font-semibold">
                        Haydovchi raqamni hali kiritmagan
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-[#047857] dark:text-[#34D399]">
                    Biriktirilgan MFYlar:{' '}
                    {drv.assignedMfys.length > 0
                      ? drv.assignedMfys.map((m) => m.mfyName).join(', ')
                      : 'Biriktirilmagan'}
                  </div>
                </div>

                <div className="flex flex-wrap gap-[8px]">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setAssignDriver(drv);
                      setSelectedMfyIds(drv.assignedMfys.map((m) => m.mfyId));
                    }}
                  >
                    MFY biriktirish
                  </Button>
                  {drv.approvalStatus !== 'approved' ? (
                    <Button
                      size="sm"
                      onClick={() => statusMutation.mutate({ id: drv.id, approvalStatus: 'approved' })}
                    >
                      Tasdiqlash
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => statusMutation.mutate({ id: drv.id, approvalStatus: 'suspended' })}
                    >
                      To‘xtatish
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog
        open={Boolean(assignDriver)}
        onClose={() => setAssignDriver(null)}
        title="MFY biriktirish"
        description={assignDriver?.fullName}
      >
        {assignDriver && (
          <div className="space-y-[16px]">
            <div className="max-h-[280px] overflow-y-auto space-y-[8px] pr-[4px]">
              {(mfysData?.mfys ?? [])
                .filter((m) => m.status !== 'merged')
                .map((m) => {
                  const checked = selectedMfyIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-[10px] p-[10px_12px] rounded-[10px] border border-[var(--border-default)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedMfyIds((prev) => [...prev, m.id]);
                          else setSelectedMfyIds((prev) => prev.filter((id) => id !== m.id));
                        }}
                        className="w-[18px] h-[18px] accent-[#059669]"
                      />
                      <span className="text-[14px] font-medium">{m.name}</span>
                      <span className="text-[12px] text-[#64748B] ml-auto">{m.districtName}</span>
                    </label>
                  );
                })}
            </div>
            <div className="flex justify-end gap-[12px]">
              <Button variant="secondary" onClick={() => setAssignDriver(null)}>
                Bekor qilish
              </Button>
              <Button
                loading={assignMutation.isPending}
                onClick={() =>
                  assignMutation.mutate({ driverId: assignDriver.id, mfyIds: selectedMfyIds })
                }
              >
                Saqlash
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

// ============================================================
// ADMIN CITIZENS (Paginated 25 / 50 / 100 with true count)
// ============================================================

interface AdminCitizen {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  accountStatus: string;
  districtName: string | null;
  mfyName: string | null;
  totalXp: number | null;
  coinBalance: number | null;
  createdAt: string;
}

export const AdminCitizensPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-citizens', page, pageSize],
    queryFn: () =>
      apiRequest<{ citizens: AdminCitizen[]; total: number; page: number; pageSize: number }>(
        `/api/admin/citizens?page=${page}&pageSize=${pageSize}`
      ),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, accountStatus }: { id: number; accountStatus: 'active' | 'suspended' }) =>
      apiRequest(`/api/admin/citizens/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ accountStatus }),
      }),
    onSuccess: () => {
      toastSuccess('Fuqaro holati yangilandi.');
      queryClient.invalidateQueries({ queryKey: ['admin-citizens'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  const promoteMutation = useMutation({
    mutationFn: (userId: number) =>
      apiRequest('/api/admin/drivers/promote', {
        method: 'POST',
        body: JSON.stringify({ userId, vehiclePlate: '50 B 100 AA', vehicleCapacityLiters: 4000 }),
      }),
    onSuccess: () => {
      toastSuccess('Foydalanuvchi haydovchi roliga o‘tkazildi.');
      queryClient.invalidateQueries({ queryKey: ['admin-citizens'] });
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold">Fuqarolar</h1>
          <p className="mt-[4px] text-[14px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
            Jami ro‘yxatdan o‘tgan fuqarolar: {data?.total ?? 0}
          </p>
        </div>
        <div className="flex items-center gap-[8px]">
          <label htmlFor="cit-page-size" className="text-[13px] text-[#64748B]">
            Sahifada:
          </label>
          <Select
            id="cit-page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="w-[96px] min-h-[40px]"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </Select>
        </div>
      </div>

      {isError && <ErrorAlert message={error instanceof Error ? error.message : 'Xatolik.'} />}

      <Card className="p-0 md:p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-[24px]">Yuklanmoqda...</div>
        ) : !data?.citizens?.length ? (
          <EmptyState icon={<Users />} title="Fuqarolar yo‘q" description="Hali fuqarolar ro‘yxatdan o‘tmagan." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="h-[44px] border-b border-[var(--border-default)] text-[12px] font-semibold text-[#64748B] dark:text-[#A7B8AE]">
                  <th className="px-[20px]">Ism va email</th>
                  <th className="px-[16px]">MFY</th>
                  <th className="px-[16px]">XP / Ball</th>
                  <th className="px-[16px]">Holat</th>
                  <th className="px-[20px] text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] text-[14px]">
                {data.citizens.map((c) => (
                  <tr key={c.id} className="min-h-[60px]">
                    <td className="px-[20px] py-[12px]">
                      <div className="font-semibold">{c.fullName}</div>
                      <div className="text-[12px] text-[#64748B]">{c.email} · {c.phone}</div>
                    </td>
                    <td className="px-[16px] py-[12px] text-[13px]">
                      {c.mfyName ? `${c.districtName} · ${c.mfyName}` : 'Tanlanmagan'}
                    </td>
                    <td className="px-[16px] py-[12px] tabular-nums">
                      {c.totalXp ?? 0} XP · {c.coinBalance ?? 0} Ball
                    </td>
                    <td className="px-[16px] py-[12px]">
                      <StatusBadge
                        tone={c.accountStatus === 'active' ? 'mint' : 'danger'}
                        label={c.accountStatus === 'active' ? 'Faol' : 'Bloklangan'}
                      />
                    </td>
                    <td className="px-[20px] py-[12px]">
                      <div className="flex items-center justify-end gap-[8px]">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => promoteMutation.mutate(c.id)}
                        >
                          Haydovchi qilish
                        </Button>
                        <Button
                          size="sm"
                          variant={c.accountStatus === 'active' ? 'danger' : 'primary'}
                          onClick={() =>
                            toggleStatusMutation.mutate({
                              id: c.id,
                              accountStatus: c.accountStatus === 'active' ? 'suspended' : 'active',
                            })
                          }
                        >
                          {c.accountStatus === 'active' ? 'Bloklash' : 'Faollashtirish'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between text-[13px] text-[#64748B]">
        <span className="tabular-nums">
          Sahifa {page} / {totalPages}
        </span>
        <div className="flex gap-[8px]">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Oldingi
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Keyingi
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ADMIN REPORTS & DISPUTES
// ============================================================

interface AdminReport {
  id: number;
  publicCode: string;
  category: string;
  estimatedRange: string;
  actualLiters: number | null;
  status: ReportStatus;
  address: string;
  approvedForReward: boolean;
  createdAt: string;
  citizenName: string;
  mfyName: string;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  aiVerdict: string | null;
  gpsAccuracy: number | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
}

const AiVerdictBadge: React.FC<{ raw: string | null }> = ({ raw }) => {
  if (!raw) return <span className="text-[12px] text-[#64748B]">AI tekshiruvi: mavjud emas</span>;
  let v: { isTrash?: boolean; isScreenPhoto?: boolean; confidence?: number; reason?: string } = {};
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  const ok = v.isTrash && !v.isScreenPhoto;
  return (
    <div className={`text-[13px] rounded-[10px] px-[10px] py-[6px] ${ok ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#FEF3C7] text-[#92400E]'}`}>
      <b>AI:</b> {v.isTrash ? 'chiqindi ✓' : 'chiqindi emas ✗'} · {v.isScreenPhoto ? 'ekrandan olingan ⚠' : 'haqiqiy surat ✓'} · ishonch{' '}
      {Math.round((v.confidence ?? 0) * 100)}%{v.reason ? ` — ${v.reason}` : ''}
    </div>
  );
};

const MODERATION_LABEL = { pending: 'Tekshiruv kutilmoqda', approved: 'Tasdiqlangan', rejected: 'Rad etilgan' } as const;

interface AdminDispute {
  id: number;
  reportId: number;
  reportCode: string;
  citizenName: string;
  reason: string;
  status: string;
  resolutionNote: string | null;
  createdAt: string;
}

export const AdminReportsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () =>
      apiRequest<{ reports: AdminReport[]; disputes: AdminDispute[]; total: number }>(
        '/api/admin/reports?page=1&pageSize=50'
      ),
  });

  const [openId, setOpenId] = useState<number | null>(null);
  const moderateMutation = useMutation({
    mutationFn: ({ id, decision, reason }: { id: number; decision: 'approve' | 'reject'; reason?: string }) =>
      apiRequest(`/api/admin/reports/${id}/moderate`, { method: 'POST', body: JSON.stringify({ decision, reason }) }),
    onSuccess: (_d, v) => {
      toastSuccess(v.decision === 'approve' ? 'Murojaat tasdiqlandi va haydovchiga yuborildi.' : 'Murojaat rad etildi.');
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  const approveRewardMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/admin/reports/${id}/approve-reward`, { method: 'POST' }),
    onSuccess: () => {
      toastSuccess('Foydali murojaat mukofoti tasdiqlandi.');
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'resolved' | 'rejected' }) =>
      apiRequest(`/api/admin/disputes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          resolutionNote: status === 'resolved' ? 'Ko‘rib chiqildi va hal qilindi.' : 'Asossiz deb topildi.',
        }),
      }),
    onSuccess: () => {
      toastSuccess('E’tiroz holati yangilandi.');
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Xatolik.'),
  });

  return (
    <div className="space-y-[24px]">
      <div>
        <h1 className="text-[24px] leading-[32px] font-bold">Murojaatlar va e’tirozlar</h1>
        <p className="mt-[4px] text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
          Jami murojaatlar: {data?.total ?? 0}. Foydali murojaat mukofoti faqat administrator tasdig‘i bilan beriladi.
        </p>
      </div>

      {isError && <ErrorAlert message={error instanceof Error ? error.message : 'Xatolik.'} />}

      <Card className="p-0 md:p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-[24px]">Yuklanmoqda...</div>
        ) : !data?.reports?.length ? (
          <EmptyState icon={<FileWarning />} title="Murojaatlar yo‘q" description="Hali murojaatlar yuborilmagan." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="h-[44px] border-b border-[var(--border-default)] text-[12px] font-semibold text-[#64748B] dark:text-[#A7B8AE]">
                  <th className="px-[20px]">Kod / Fuqaro</th>
                  <th className="px-[16px]">MFY / Kategoriya</th>
                  <th className="px-[16px]">Hajm</th>
                  <th className="px-[16px]">Holat</th>
                  <th className="px-[16px]">Tekshiruv</th>
                  <th className="px-[20px] text-right">Mukofot tasdig‘i</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] text-[14px]">
                {data.reports.map((r) => (
                  <React.Fragment key={r.id}>
                  <tr className="min-h-[60px]">
                    <td className="px-[20px] py-[12px]">
                      <div className="font-semibold tabular-nums">{r.publicCode}</div>
                      <div className="text-[12px] text-[#64748B]">{r.citizenName}</div>
                    </td>
                    <td className="px-[16px] py-[12px]">
                      <div>{r.mfyName}</div>
                      <div className="text-[12px] text-[#64748B]">{r.category}</div>
                    </td>
                    <td className="px-[16px] py-[12px] tabular-nums">
                      {r.actualLiters ? `${r.actualLiters} L (haqiqiy)` : `${r.estimatedRange} (taxmin)`}
                    </td>
                    <td className="px-[16px] py-[12px]">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-[16px] py-[12px]">
                      <div className="flex flex-col items-start gap-[6px]">
                        <StatusBadge
                          tone={r.moderationStatus === 'approved' ? 'mint' : r.moderationStatus === 'rejected' ? 'danger' : 'warning'}
                          label={MODERATION_LABEL[r.moderationStatus] ?? r.moderationStatus}
                        />
                        {r.moderationStatus === 'pending' && !['completed', 'cancelled'].includes(r.status) && (
                          <div className="flex gap-[6px]">
                            <Button size="sm" onClick={() => moderateMutation.mutate({ id: r.id, decision: 'approve' })}>
                              Tasdiqlash
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                const reason = window.prompt('Rad etish sababini yozing:');
                                if (reason && reason.trim().length >= 3) moderateMutation.mutate({ id: r.id, decision: 'reject', reason });
                              }}
                            >
                              Rad etish
                            </Button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setOpenId(openId === r.id ? null : r.id)}
                          className="text-[12px] font-semibold text-[#047857] dark:text-[#34D399] underline cursor-pointer"
                        >
                          {openId === r.id ? 'Yopish' : 'Rasm, GPS va izohlar'}
                        </button>
                      </div>
                    </td>
                    <td className="px-[20px] py-[12px] text-right">
                      {r.approvedForReward ? (
                        <span className="inline-flex items-center gap-[4px] text-[12px] font-semibold text-[#047857] dark:text-[#34D399]">
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          Tasdiqlangan
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => approveRewardMutation.mutate(r.id)}
                        >
                          Mukofotni tasdiqlash
                        </Button>
                      )}
                    </td>
                  </tr>
                  {openId === r.id && (
                    <tr>
                      <td colSpan={6} className="px-[20px] py-[16px] bg-[#F8FAFC] dark:bg-[#0F1D17]">
                        <div className="grid gap-[16px] md:grid-cols-2">
                          <div className="space-y-[8px]">
                            <ReportPhotoView reportId={r.id} />
                            <AiVerdictBadge raw={r.aiVerdict} />
                            <div className="text-[13px] text-[#334155] dark:text-[#CBD5E1]">
                              {r.address}
                              {r.description ? ` — ${r.description}` : ''}
                            </div>
                            {r.latitude != null && r.longitude != null ? (
                              <a
                                href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[13px] font-semibold text-[#047857] underline"
                              >
                                GPS: {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                                {r.gpsAccuracy ? ` (±${Math.round(r.gpsAccuracy)} m)` : ''} — xaritada ochish
                              </a>
                            ) : (
                              <div className="text-[13px] text-[#B45309]">GPS joylashuv yo‘q</div>
                            )}
                          </div>
                          <ReportComments reportId={r.id} />
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Disputes Queue */}
      <Card className="p-0 md:p-0 overflow-hidden">
        <div className="px-[20px] py-[16px] border-b border-[var(--border-default)]">
          <h2 className="text-[18px] font-semibold">E’tirozlar navbati</h2>
        </div>
        {!data?.disputes?.length ? (
          <div className="p-[24px] text-[14px] text-[#64748B]">Hozircha e’tirozlar yo‘q.</div>
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {data.disputes.map((d) => (
              <div key={d.id} className="p-[16px_20px] flex flex-wrap items-center justify-between gap-[12px]">
                <div>
                  <div className="flex items-center gap-[8px]">
                    <span className="font-semibold tabular-nums">{d.reportCode}</span>
                    <span className="text-[13px] text-[#64748B]">· {d.citizenName}</span>
                    <StatusBadge
                      tone={d.status === 'open' ? 'warning' : d.status === 'resolved' ? 'mint' : 'danger'}
                      label={d.status === 'open' ? 'Ochiq' : d.status === 'resolved' ? 'Hal qilindi' : 'Rad etildi'}
                    />
                  </div>
                  <p className="mt-[4px] text-[14px]">{d.reason}</p>
                  <div className="text-[12px] text-[#64748B] tabular-nums mt-[2px]">
                    {formatTashkentDateTime(d.createdAt)}
                  </div>
                </div>
                {d.status === 'open' && (
                  <div className="flex gap-[8px]">
                    <Button
                      size="sm"
                      onClick={() => resolveDisputeMutation.mutate({ id: d.id, status: 'resolved' })}
                    >
                      Hal qilish
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => resolveDisputeMutation.mutate({ id: d.id, status: 'rejected' })}
                    >
                      Rad etish
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
