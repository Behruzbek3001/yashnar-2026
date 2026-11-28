import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Smartphone } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input } from '../ui/Primitives';

type Status = { state: 'verified' | 'no_phone' | 'selected' | 'sent' | 'waiting'; phone?: string; maskedPhone?: string };

const RECAPTCHA_ID = 'yashnar-daily-phone-recaptcha';

/** Daily phone check: up to 10 users per day are picked and get exactly one SMS (no resend, no number change). */
export const PhoneVerificationBanner: React.FC = () => {
  const { user, sendPhoneSmsCode, confirmOwnPhoneCode } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'idle' | 'code' | 'done'>('idle');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['phone-verification', user?.id],
    queryFn: () => apiRequest<Status>('/api/phone-verification/status'),
    enabled: Boolean(user) && user?.role !== 'admin',
    staleTime: 5 * 60 * 1000,
  });

  if (!data || step === 'done') {
    return step === 'done' ? (
      <div className="mb-[16px] rounded-[12px] bg-[#ECFDF5] border border-[#A7F3D0] p-[12px] text-[14px] font-semibold text-[#065F46]">
        ✅ Telefon raqamingiz tasdiqlandi. Rahmat!
      </div>
    ) : null;
  }
  if (data.state === 'sent' && step !== 'code') {
    return (
      <div className="mb-[16px] rounded-[12px] bg-[#FFFBEB] border border-[#FDE68A] p-[12px] text-[13px] text-[#92400E]">
        Bugungi SMS allaqachon yuborilgan. Qayta yuborib bo‘lmaydi — keyingi kunlarda yana tanlanishingiz mumkin.
      </div>
    );
  }
  if (data.state !== 'selected' && step !== 'code') return null;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const { phone } = await apiRequest<{ phone: string }>('/api/phone-verification/start', { method: 'POST' });
      await sendPhoneSmsCode(phone, RECAPTCHA_ID);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SMS yuborilmadi.');
      queryClient.invalidateQueries({ queryKey: ['phone-verification'] });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmOwnPhoneCode(code);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['phone-verification'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod tasdiqlanmadi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-[16px] rounded-[14px] border-2 border-[#047857] bg-[#ECFDF5] dark:bg-[#11211B] p-[16px]">
      <div className="flex items-start gap-[12px]">
        <Smartphone className="w-[24px] h-[24px] text-[#047857] shrink-0 mt-[2px]" aria-hidden="true" />
        <div className="flex-1 space-y-[8px]">
          <div className="text-[15px] font-bold text-[#065F46] dark:text-[#6EE7B7]">
            Bugun siz telefon raqamingizni tasdiqlash uchun tanlandingiz
          </div>
          <ul className="text-[13px] leading-[20px] text-[#065F46] dark:text-[#A7B8AE] list-disc pl-[18px]">
            <li>
              SMS kod <b>{data.maskedPhone}</b> raqamiga yuboriladi. Raqamni o‘zgartirib bo‘lmaydi.
            </li>
            <li>
              SMS <b>faqat 1 marta</b> yuboriladi — qayta yuborish yo‘q. Sahifani yopmang.
            </li>
            <li>
              SMS kelmasa, telefoningizdagi <b>“Spam”</b> bo‘limini tekshiring.
            </li>
          </ul>
          {step === 'code' ? (
            <div className="flex flex-wrap items-center gap-[8px]">
              <Input
                inputMode="numeric"
                maxLength={6}
                aria-label="SMS kod"
                placeholder="6 xonali kod"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-[160px]"
              />
              <Button onClick={confirm} loading={busy} disabled={code.length !== 6}>
                Tasdiqlash
              </Button>
            </div>
          ) : (
            <Button onClick={send} loading={busy}>
              SMS kod yuborish
            </Button>
          )}
          {error && <div className="text-[13px] font-semibold text-[#B91C1C]">{error}</div>}
          <div id={RECAPTCHA_ID} />
        </div>
      </div>
    </div>
  );
};
