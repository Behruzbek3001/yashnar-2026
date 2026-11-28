import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Image as ImageIcon, MapPin, Phone } from 'lucide-react';
import { apiRequest, formatTashkentDateTime, getSessionToken } from '../../lib/api';
import { REPORT_STATUS_LABELS, type ReportStatus } from '../../lib/domain';
import { Button, Card, EmptyState, ErrorAlert, StatusBadge } from '../../components/ui/Primitives';

interface DriverReport {
  id: number;
  publicCode: string;
  category: string;
  estimatedRange: string | null;
  estimatedLiters: number | null;
  actualLiters: number | null;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ReportStatus;
  hasPhoto: boolean;
  createdAt: string;
  mfyName: string;
  citizenName: string;
  citizenPhone: string;
}

const toneFor = (s: ReportStatus) =>
  s === 'completed' ? 'mint' : s === 'cancelled' ? 'neutral' : s === 'submitted' || s === 'reviewing' ? 'warning' : 'info';

const ReportPhoto: React.FC<{ id: number }> = ({ id }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (url) return <img src={url} alt="Murojaat rasmi" className="mt-[8px] max-h-[320px] rounded-[12px] border border-[var(--border-default)]" />;
  return (
    <div>
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const token = getSessionToken();
            const r = await fetch(`/api/driver/reports/${id}/photo`, {
              credentials: 'include',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!r.ok) throw new Error('Rasm topilmadi.');
            setUrl(URL.createObjectURL(await r.blob()));
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Rasm yuklanmadi.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <ImageIcon className="w-4 h-4" aria-hidden="true" /> Rasmni ko‘rish
      </Button>
      {err && <span className="ml-[8px] text-[12px] text-[#B91C1C]">{err}</span>}
    </div>
  );
};

export const DriverReportsPage: React.FC = () => {
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['driver-reports', scope],
    queryFn: () => apiRequest<{ reports: DriverReport[] }>(`/api/driver/reports?scope=${scope}`),
    refetchInterval: 30000,
  });
  const reports = data?.reports ?? [];

  return (
    <div className="space-y-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">Murojaatlar</h1>
          <p className="mt-[4px] text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
            Sizga biriktirilgan MFYlardagi fuqarolar murojaatlari.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-[6px] p-[4px] rounded-[10px] bg-[#F1F5F9] dark:bg-[#0F1D17] border border-[#E2E8F0] dark:border-[#294237]">
          {(['active', 'all'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={scope === k}
              onClick={() => setScope(k)}
              className={`min-h-[36px] px-[14px] rounded-[8px] text-[13px] font-semibold cursor-pointer ${
                scope === k
                  ? 'bg-white dark:bg-[#13231D] text-[#065F46] dark:text-[#34D399] shadow-xs'
                  : 'text-[#64748B] dark:text-[#A7B8AE]'
              }`}
            >
              {k === 'active' ? 'Kutilayotgan' : 'Hammasi'}
            </button>
          ))}
        </div>
      </div>

      {isError && <ErrorAlert message={error instanceof Error ? error.message : 'Xatolik.'} />}

      {isLoading ? (
        <Card>Yuklanmoqda...</Card>
      ) : !reports.length ? (
        <Card>
          <EmptyState
            icon={<ClipboardList />}
            title="Murojaatlar yo‘q"
            description={scope === 'active' ? 'Hozircha kutilayotgan murojaatlar yo‘q.' : 'Hali murojaatlar bo‘lmagan.'}
          />
        </Card>
      ) : (
        <div className="space-y-[12px]">
          {reports.map((r) => (
            <Card key={r.id} className="space-y-[8px]">
              <div className="flex flex-wrap items-center justify-between gap-[8px]">
                <div className="font-bold text-[16px]">
                  {r.publicCode} <span className="font-normal text-[#64748B] dark:text-[#A7B8AE]">· {r.mfyName}</span>
                </div>
                <StatusBadge tone={toneFor(r.status)} label={REPORT_STATUS_LABELS[r.status] ?? r.status} />
              </div>
              <div className="text-[14px]">
                {r.category} · {r.estimatedRange || `${r.estimatedLiters ?? 0} L`}
                {r.actualLiters ? ` · yig‘ildi: ${r.actualLiters} L` : ''}
              </div>
              {r.description && <div className="text-[14px] text-[#334155] dark:text-[#CBD5E1]">{r.description}</div>}
              <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[4px] text-[13px] text-[#64748B] dark:text-[#A7B8AE]">
                <span>{r.citizenName}</span>
                {r.citizenPhone && (
                  <a href={`tel:${r.citizenPhone}`} className="inline-flex items-center gap-[4px] font-semibold text-[#047857] dark:text-[#34D399] underline">
                    <Phone className="w-[14px] h-[14px]" aria-hidden="true" />
                    {r.citizenPhone}
                  </a>
                )}
                {r.address && <span>{r.address}</span>}
                <span>{formatTashkentDateTime(r.createdAt)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-[8px]">
                {r.latitude != null && r.longitude != null && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${r.latitude},${r.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-[6px] rounded-[10px] bg-[#047857] text-white px-[12px] py-[8px] text-[13px] font-semibold"
                  >
                    <MapPin className="w-4 h-4" aria-hidden="true" /> Yo‘nalish
                  </a>
                )}
                {r.hasPhoto && <ReportPhoto id={r.id} />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
