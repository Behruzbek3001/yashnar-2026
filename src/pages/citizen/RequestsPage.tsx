import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Eye, AlertTriangle, XCircle } from 'lucide-react';
import { apiRequest, formatTashkentDateTime } from '../../lib/api';
import {
  CANCELLABLE_REPORT_STATUSES,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  WASTE_CATEGORIES,
  type ReportStatus,
} from '../../lib/domain';
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
  Textarea,
  useToast,
} from '../../components/ui/Primitives';

interface ReportRow {
  id: number;
  publicCode: string;
  category: string;
  estimatedRange: string;
  estimatedLiters: number;
  actualLiters: number | null;
  description: string;
  address: string;
  status: ReportStatus;
  createdAt: string;
}

interface ReportDetailResponse {
  report: ReportRow;
  timeline: Array<{
    id: number;
    status: ReportStatus;
    note: string;
    createdAt: string;
    actorName: string | null;
  }>;
  disputes: Array<{
    id: number;
    reason: string;
    status: string;
    resolutionNote: string;
    createdAt: string;
  }>;
}

export const RequestsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toastSuccess, toastError } = useToast();

  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (categoryFilter !== 'all') queryParams.set('category', categoryFilter);
  if (dateFrom) queryParams.set('dateFrom', dateFrom);
  if (dateTo) queryParams.set('dateTo', dateTo);

  const { data, isLoading, error } = useQuery({
    queryKey: ['citizen-reports', statusFilter, categoryFilter, dateFrom, dateTo],
    queryFn: () =>
      apiRequest<{ reports: ReportRow[] }>(`/api/citizen/reports?${queryParams.toString()}`),
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['citizen-report-detail', selectedId],
    queryFn: () => apiRequest<ReportDetailResponse>(`/api/citizen/reports/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/citizen/reports/${id}/cancel`, { method: 'POST', body: '{}' }),
    onSuccess: () => {
      toastSuccess('Murojaat bekor qilindi.');
      queryClient.invalidateQueries({ queryKey: ['citizen-reports'] });
      queryClient.invalidateQueries({ queryKey: ['citizen-report-detail', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['citizen-dashboard'] });
    },
    onError: (err) => toastError(err instanceof Error ? err.message : 'Bekor qilishda xatolik.'),
  });

  const disputeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiRequest(`/api/citizen/reports/${id}/dispute`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      toastSuccess('E’tirozingiz qabul qilindi.');
      setDisputeReason('');
      setDisputeError(null);
      queryClient.invalidateQueries({ queryKey: ['citizen-report-detail', selectedId] });
    },
    onError: (err) =>
      setDisputeError(err instanceof Error ? err.message : 'E’tiroz yuborishda xatolik.'),
  });

  const reports = data?.reports ?? [];

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] md:text-[30px] md:leading-[38px] font-bold">
            Mening murojaatlarim
          </h1>
          <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
            Yuborilgan chiqindi murojaatlari va ularning haqiqiy holat xronologiyasi.
          </p>
        </div>
        <Link to="/citizen/report">
          <Button>Yangi murojaat</Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <Card className="p-[16px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[12px]">
          <FormField label="Holat" htmlFor="filter-status">
            <Select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Barcha holatlar</option>
              {REPORT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {REPORT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Chiqindi toifasi" htmlFor="filter-cat">
            <Select
              id="filter-cat"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Barcha toifalar</option>
              {WASTE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Boshlanish sanasi" htmlFor="filter-from">
            <Input
              id="filter-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </FormField>

          <FormField label="Tugash sanasi" htmlFor="filter-to">
            <Input
              id="filter-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </FormField>
        </div>
      </Card>

      {error && <ErrorAlert message={error instanceof Error ? error.message : 'Xatolik.'} />}

      {isLoading ? (
        <Card className="py-[40px] text-center text-[14px] text-[#64748B]">Yuklanmoqda...</Card>
      ) : reports.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList />}
            title="Murojaatlar topilmadi"
            description="Tanlangan filtrlar bo‘yicha murojaat mavjud emas yoki hali xabar yubormagansiz."
            action={
              <Link to="/citizen/report">
                <Button size="sm">Chiqindi haqida xabar yuborish</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {/* DESKTOP TABLE (min 60px rows, 48x48 radius 8px thumbnails) */}
          <div className="hidden md:block card-surface overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="h-[44px] border-b border-[var(--border-default)] text-[12px] leading-[18px] font-semibold text-[#64748B] dark:text-[#A7B8AE]">
                  <th className="px-[16px]">Rasm</th>
                  <th className="px-[16px]">Kod va sana</th>
                  <th className="px-[16px]">Toifa</th>
                  <th className="px-[16px]">Hajm</th>
                  <th className="px-[16px]">Holat</th>
                  <th className="px-[16px] text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)] text-[13px] leading-[20px]">
                {reports.map((r) => (
                  <tr key={r.id} className="min-h-[60px] hover:bg-[#F8FAFC] dark:hover:bg-[#0F1D17]">
                    <td className="px-[16px] py-[8px]">
                      <img
                        src={`/api/storage/reports/${r.id}`}
                        alt={`${r.publicCode} rasmi`}
                        className="w-[48px] h-[48px] rounded-[8px] object-cover bg-[#F1F5F9] dark:bg-[#0F1D17]"
                      />
                    </td>
                    <td className="px-[16px] py-[8px]">
                      <div className="font-semibold tabular-nums">{r.publicCode}</div>
                      <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
                        {formatTashkentDateTime(r.createdAt)}
                      </div>
                    </td>
                    <td className="px-[16px] py-[8px]">{r.category}</td>
                    <td className="px-[16px] py-[8px] tabular-nums">
                      {r.actualLiters !== null
                        ? `${r.actualLiters} L (tasdiqlangan)`
                        : `${r.estimatedRange} (taxmin)`}
                    </td>
                    <td className="px-[16px] py-[8px]">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-[16px] py-[8px] text-right">
                      <Button variant="secondary" size="sm" onClick={() => setSelectedId(r.id)}>
                        <Eye className="w-4 h-4 inline mr-[4px]" />
                        Batafsil
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE STACKED CARDS (16px padding, 12px gap) */}
          <div className="md:hidden space-y-[12px]">
            {reports.map((r) => (
              <div key={r.id} className="card-surface p-[16px] space-y-[12px]">
                <div className="flex items-start gap-[12px]">
                  <img
                    src={`/api/storage/reports/${r.id}`}
                    alt={`${r.publicCode} rasmi`}
                    className="w-[48px] h-[48px] rounded-[8px] object-cover bg-[#F1F5F9] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-[8px]">
                      <span className="font-semibold text-[14px] tabular-nums">{r.publicCode}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="text-[13px] text-[#64748B] dark:text-[#A7B8AE] mt-[2px]">
                      {r.category} · {r.actualLiters !== null ? `${r.actualLiters} L` : r.estimatedRange}
                    </div>
                    <div className="text-[12px] text-[#64748B] mt-[2px] tabular-nums">
                      {formatTashkentDateTime(r.createdAt)}
                    </div>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedId(r.id)}
                >
                  Xronologiya va tafsilotlar
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* DETAIL & VERTICAL TIMELINE DIALOG */}
      <Dialog
        open={Boolean(selectedId)}
        onClose={() => {
          setSelectedId(null);
          setDisputeError(null);
          setDisputeReason('');
        }}
        title={detailData?.report?.publicCode ?? 'Murojaat tafsilotlari'}
      >
        {detailLoading || !detailData ? (
          <div className="py-[24px] text-center text-[14px] text-[#64748B]">Yuklanmoqda...</div>
        ) : (
          <div className="space-y-[20px]">
            <img
              src={`/api/storage/reports/${detailData.report.id}`}
              alt={`${detailData.report.publicCode} fotosurati`}
              className="w-full aspect-[4/3] rounded-[12px] object-cover bg-[#0F172A]"
            />

            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold">{detailData.report.category}</span>
              <StatusBadge status={detailData.report.status} />
            </div>

            <div className="text-[13px] leading-[20px] space-y-[4px] text-[#64748B] dark:text-[#A7B8AE]">
              <div>
                <strong>Manzil:</strong> {detailData.report.address}
              </div>
              <div>
                <strong>Foydalanuvchi taxmini:</strong> {detailData.report.estimatedRange} (~
                {detailData.report.estimatedLiters} L)
              </div>
              {detailData.report.actualLiters !== null && (
                <div className="text-[#065F46] dark:text-[#34D399] font-semibold">
                  Tasdiqlangan hajm: {detailData.report.actualLiters} L
                </div>
              )}
              {detailData.report.description && (
                <div>
                  <strong>Izoh:</strong> {detailData.report.description}
                </div>
              )}
            </div>

            {/* Vertical Timeline (10px node, 2px line, 24px gap, 13/20/600 label, 12/18 ts) */}
            <div>
              <h3 className="text-[14px] font-semibold mb-[12px]">Holatlar xronologiyasi</h3>
              <ol className="relative pl-[20px] space-y-[24px] before:content-[''] before:absolute before:left-[4px] before:top-[6px] before:bottom-[6px] before:w-[2px] before:bg-[#E2E8F0] dark:before:bg-[#294237]">
                {detailData.timeline.map((ev) => (
                  <li key={ev.id} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[20px] top-[5px] w-[10px] h-[10px] rounded-full bg-[#059669]"
                    />
                    <div className="text-[13px] leading-[20px] font-semibold">
                      {REPORT_STATUS_LABELS[ev.status] ?? ev.status}
                    </div>
                    {ev.note && (
                      <div className="text-[12px] leading-[18px] text-[#64748B] dark:text-[#A7B8AE]">
                        {ev.note}
                      </div>
                    )}
                    <div className="text-[12px] leading-[18px] text-[#64748B] tabular-nums">
                      {formatTashkentDateTime(ev.createdAt)}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Cancel eligible pre-collection request */}
            {CANCELLABLE_REPORT_STATUSES.has(detailData.report.status) && (
              <Button
                variant="danger"
                className="w-full"
                loading={cancelMutation.isPending}
                loadingLabel="Bekor qilinmoqda..."
                onClick={() => cancelMutation.mutate(detailData.report.id)}
              >
                <XCircle className="w-[18px] h-[18px] inline mr-[8px]" />
                Murojaatni bekor qilish
              </Button>
            )}

            {/* Dispute form (10-2000 chars) */}
            <div className="pt-[16px] border-t border-[var(--border-default)] space-y-[12px]">
              <h3 className="text-[14px] font-semibold flex items-center gap-[6px]">
                <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                E’tiroz bildirish
              </h3>
              {disputeError && <ErrorAlert message={disputeError} />}
              <Textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                maxLength={2000}
                placeholder="Muammo yoki e’tiroz sababini batafsil yozing (kamida 10 belgi)..."
              />
              <Button
                variant="secondary"
                size="sm"
                loading={disputeMutation.isPending}
                loadingLabel="Yuborilmoqda..."
                onClick={() => {
                  setDisputeError(null);
                  if (disputeReason.trim().length < 10) {
                    setDisputeError('E’tiroz sababi kamida 10 ta belgidan iborat bo‘lishi kerak.');
                    return;
                  }
                  disputeMutation.mutate({
                    id: detailData.report.id,
                    reason: disputeReason.trim(),
                  });
                }}
              >
                E’tiroz yuborish
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
