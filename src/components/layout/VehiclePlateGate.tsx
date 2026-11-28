import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input } from '../ui/Primitives';

/** First-time drivers must enter their own vehicle number before using the app. */
export const VehiclePlateGate: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [plate, setPlate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ['driver-vehicle'],
    queryFn: () => apiRequest<{ vehiclePlate: string; confirmed: boolean }>('/api/driver/vehicle'),
    enabled: user?.role === 'driver' && user?.driver?.approvalStatus === 'approved',
  });
  if (!data || data.confirmed) return null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/api/driver/vehicle', { method: 'PATCH', body: JSON.stringify({ vehiclePlate: plate }) });
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['driver-vehicle'] });
      queryClient.invalidateQueries({ queryKey: ['driver-dashboard'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saqlab bo‘lmadi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-[16px]" role="dialog" aria-modal="true">
      <form
        className="w-full max-w-[420px] rounded-[16px] bg-[var(--bg-card)] p-[24px] space-y-[14px]"
        style={{ boxShadow: 'var(--shadow-dialog)' }}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="w-[48px] h-[48px] rounded-full bg-[#D1FAE5] text-[#065F46] flex items-center justify-center">
          <Truck className="w-[24px] h-[24px]" aria-hidden="true" />
        </div>
        <h2 className="text-[20px] font-bold">Avtomobil raqamingizni kiriting</h2>
        <p className="text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
          Ishni boshlashdan oldin o‘z mashinangiz davlat raqamini kiriting. Fuqarolar sizni shu raqam orqali taniydi.
        </p>
        <Input
          autoFocus
          aria-label="Avtomobil raqami"
          placeholder="Masalan: 50 A 123 BC"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          className="uppercase text-[18px] tracking-[0.05em]"
        />
        {error && <div className="text-[13px] font-semibold text-[#B91C1C]">{error}</div>}
        <Button type="submit" loading={busy} disabled={plate.trim().length < 5} className="w-full">
          Saqlash va davom etish
        </Button>
      </form>
    </div>
  );
};
