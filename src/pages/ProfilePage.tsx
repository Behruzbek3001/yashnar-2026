import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapPin, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../lib/api';
import { Button, Card, FormField, Input, StatusBadge, useToast } from '../components/ui/Primitives';

export const ProfilePage: React.FC = () => {
  const { user, theme, toggleTheme, refreshUser } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [publicLeaderboardName, setPublicLeaderboardName] = useState(
    user?.publicLeaderboardName ?? ''
  );
  const [leaderboardVisible, setLeaderboardVisible] = useState(
    user?.leaderboardVisible ?? true
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          publicLeaderboardName: publicLeaderboardName.trim(),
          leaderboardVisible,
        }),
      }),
    onSuccess: async () => {
      await refreshUser();
      toastSuccess('Profil ma’lumotlari saqlandi.');
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : 'Profilni saqlashda xatolik.');
    },
  });

  return (
    <div className="max-w-[760px] space-y-[24px]">
      <div>
        <h1 className="text-[24px] leading-[32px] font-bold text-[#0F172A] dark:text-[#F1F5F9]">
          Profil sozlamalari
        </h1>
        <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
          Shaxsiy ma’lumotlar, maxfiylik va ko‘rinish sozlamalari.
        </p>
      </div>

      <Card className="space-y-[20px]">
        <div className="flex flex-wrap items-center justify-between gap-[12px] pb-[16px] border-b border-[var(--border-default)]">
          <div>
            <div className="text-[16px] font-semibold">{user?.email}</div>
            <div className="text-[13px] text-[#64748B] dark:text-[#A7B8AE] mt-[2px]">
              Rol: {user?.role === 'driver' ? 'Haydovchi' : user?.role === 'admin' ? 'Administrator' : 'Fuqaro'}
            </div>
          </div>
          {user?.driver && (
            <StatusBadge
              tone={user.driver.approvalStatus === 'approved' ? 'mint' : 'warning'}
              label={`Avto: ${user.driver.vehiclePlate}`}
            />
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-[20px]"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
            <FormField label="To‘liq ism" htmlFor="prof-name" required>
              <Input
                id="prof-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Telefon raqam" htmlFor="prof-phone" required>
              <Input
                id="prof-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </FormField>
          </div>

          {user?.role === 'citizen' && (
            <>
              <FormField
                label="Reytingda ko‘rinadigan ism"
                htmlFor="prof-lb-name"
                helper="To‘liq ismingiz o‘rniga reytingda ko‘rsatiladigan qisqa nom."
              >
                <Input
                  id="prof-lb-name"
                  value={publicLeaderboardName}
                  onChange={(e) => setPublicLeaderboardName(e.target.value)}
                  maxLength={60}
                />
              </FormField>

              <label className="flex items-start gap-[12px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={leaderboardVisible}
                  onChange={(e) => setLeaderboardVisible(e.target.checked)}
                  className="mt-[3px] w-[18px] h-[18px] accent-[#059669]"
                />
                <span className="text-[14px] leading-[22px] text-[#0F172A] dark:text-[#F1F5F9]">
                  Tuman reytingida ishtirok etishga ruxsat beraman
                </span>
              </label>
            </>
          )}

          <div className="flex justify-end">
            <Button type="submit" loading={saveMutation.isPending} loadingLabel="Saqlanmoqda...">
              O‘zgarishlarni saqlash
            </Button>
          </div>
        </form>
      </Card>

      {/* Geography & Appearance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
        {user?.role === 'citizen' && (
          <Card className="space-y-[12px]">
            <div className="flex items-center gap-[10px]">
              <MapPin className="w-5 h-5 text-[#059669]" aria-hidden="true" />
              <h2 className="text-[16px] font-semibold">Mahalla (MFY)</h2>
            </div>
            <p className="text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
              {user.regionName} · {user.districtName || 'Tanlanmagan'} · {user.mfyName || 'Tanlanmagan'}
            </p>
            <Link to="/onboarding">
              <Button variant="secondary" size="sm">
                Mahallani o‘zgartirish
              </Button>
            </Link>
          </Card>
        )}

        <Card className="space-y-[12px]">
          <div className="flex items-center gap-[10px]">
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-[#34D399]" aria-hidden="true" />
            ) : (
              <Sun className="w-5 h-5 text-[#059669]" aria-hidden="true" />
            )}
            <h2 className="text-[16px] font-semibold">Ko‘rinish mavzusi</h2>
          </div>
          <p className="text-[14px] text-[#64748B] dark:text-[#A7B8AE]">
            Joriy mavzu: {theme === 'dark' ? 'Tungi (Dark)' : 'Yorug‘ (Light)'}
          </p>
          <Button variant="secondary" size="sm" onClick={toggleTheme}>
            {theme === 'dark' ? 'Yorug‘ mavzuga o‘tish' : 'Tungi mavzuga o‘tish'}
          </Button>
        </Card>
      </div>
    </div>
  );
};
