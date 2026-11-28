import React, { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Input, useToast } from './Primitives';

/** Shows a vehicle plate with an edit pencil; saves via PATCH to `endpoint`. */
export const PlateEditor: React.FC<{ plate: string; endpoint: string; onSaved?: (plate: string) => void }> = ({
  plate,
  endpoint,
  onSaved,
}) => {
  const { toastSuccess, toastError } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(plate);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = await apiRequest<{ vehiclePlate: string }>(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ vehiclePlate: value }),
      });
      toastSuccess('Avtomobil raqami saqlandi.');
      setEditing(false);
      onSaved?.(res.vehiclePlate);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Saqlab bo‘lmadi.');
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-[4px]">
        Avto: <b className="font-semibold">{plate || '—'}</b>
        <button
          type="button"
          title="Avtomobil raqamini o‘zgartirish"
          aria-label="Avtomobil raqamini o‘zgartirish"
          onClick={() => {
            setValue(plate);
            setEditing(true);
          }}
          className="p-[4px] rounded-[6px] text-[#94A3B8] hover:text-[#047857] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2F27] cursor-pointer"
        >
          <Pencil className="w-[14px] h-[14px]" />
        </button>
      </span>
    );
  }

  return (
    <form
      className="inline-flex items-center gap-[6px]"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Input
        autoFocus
        aria-label="Avtomobil raqami"
        placeholder="50 A 123 BC"
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        className="min-h-[34px] h-[34px] w-[140px] py-[4px] px-[8px] uppercase"
      />
      <button type="submit" disabled={busy} aria-label="Saqlash" title="Saqlash" className="p-[6px] rounded-[8px] text-[#047857] hover:bg-[#ECFDF5] cursor-pointer disabled:opacity-50">
        <Check className="w-[18px] h-[18px]" />
      </button>
      <button type="button" aria-label="Bekor qilish" title="Bekor qilish" onClick={() => setEditing(false)} className="p-[6px] rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer">
        <X className="w-[18px] h-[18px]" />
      </button>
    </form>
  );
};
