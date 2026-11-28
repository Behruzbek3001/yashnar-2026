import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Camera,
  ClipboardList,
  QrCode,
  MapPin,
  Trophy,
  Award,
  ShoppingBag,
  Wallet,
  User,
  Truck,
  Map,
  Navigation,
  ScanLine,
  History,
  BarChart3,
  Building2,
  Users,
  FileWarning,
  BookOpen,
  Gift,
  Receipt,
  Sparkles,
  ShieldCheck,
  Settings,
  Bell,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiRequest, formatTashkentDateTime } from '../../lib/api';
import { pushSupported, syncPushSubscription } from '../../lib/push';
import { PhoneVerificationBanner } from './PhoneVerificationBanner';
import { cn, YashnarLogo } from '../ui/Primitives';
import { PWAInstallButton, OfflineIndicator } from '../pwa/PWAControls';

export interface NavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  mobilePrimary?: boolean;
}

const CITIZEN_NAV: NavItem[] = [
  { to: '/citizen', label: 'Bosh sahifa', shortLabel: 'Asosiy', icon: LayoutDashboard, mobilePrimary: true },
  { to: '/citizen/report', label: 'Xabar yuborish', shortLabel: 'Xabar', icon: Camera, mobilePrimary: true },
  { to: '/citizen/requests', label: 'Murojaatlar', icon: ClipboardList, mobilePrimary: true },
  { to: '/citizen/qr', label: 'Mening QR', shortLabel: 'QR kod', icon: QrCode, mobilePrimary: true },
  { to: '/citizen/map', label: 'Haydovchi xaritasi', icon: MapPin },
  { to: '/citizen/quests', label: 'Topshiriqlar', icon: Award },
  { to: '/citizen/leaderboard', label: 'Reyting', icon: Trophy },
  { to: '/citizen/market', label: 'Eco Market', icon: ShoppingBag },
  { to: '/citizen/wallet', label: 'Hamyon', icon: Wallet },
  { to: '/citizen/profile', label: 'Profil', icon: User },
];

const DRIVER_NAV: NavItem[] = [
  { to: '/driver', label: 'Bosh panel', shortLabel: 'Panel', icon: LayoutDashboard, mobilePrimary: true },
  { to: '/driver/mfys', label: 'MFYlar', icon: Building2, mobilePrimary: true },
  { to: '/driver/map', label: 'Xarita va GPS', shortLabel: 'Xarita', icon: Map, mobilePrimary: true },
  { to: '/driver/reports', label: 'Murojaatlar', icon: ClipboardList },
  { to: '/driver/scan', label: 'QR skaner', shortLabel: 'Skaner', icon: ScanLine, mobilePrimary: true },
  { to: '/driver/trips', label: 'Reyslar', icon: Navigation },
  { to: '/driver/history', label: 'Tarix', icon: History },
  { to: '/driver/profile', label: 'Profil', icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Umumiy ko‘rinish', shortLabel: 'Asosiy', icon: LayoutDashboard, mobilePrimary: true },
  { to: '/admin/analytics', label: 'Analitika', icon: BarChart3, mobilePrimary: true },
  { to: '/admin/mfys', label: 'MFY va tumanlar', shortLabel: 'MFYlar', icon: Building2, mobilePrimary: true },
  { to: '/admin/ai', label: 'YASHNAR AI', shortLabel: 'AI', icon: Sparkles, mobilePrimary: true },
  { to: '/admin/map', label: 'Jonli xarita', icon: Map },
  { to: '/admin/drivers', label: 'Haydovchilar', icon: Truck },
  { to: '/admin/citizens', label: 'Fuqarolar', icon: Users },
  { to: '/admin/reports', label: 'Murojaatlar', icon: FileWarning },
  { to: '/admin/quests', label: 'Topshiriqlar', icon: Award },
  { to: '/admin/eco-facts', label: 'Eko-faktlar', icon: BookOpen },
  { to: '/admin/rewards', label: 'Sovrinlar', icon: Gift },
  { to: '/admin/redemptions', label: 'Buyurtmalar', icon: Receipt },
  { to: '/admin/audit', label: 'Audit jurnali', icon: ShieldCheck },
  { to: '/admin/settings', label: 'Sozlamalar', icon: Settings },
];

interface NotificationRecord {
  id: number;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, theme, toggleTheme, logout, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    syncPushSubscription(false).then(setPushOn).catch(() => setPushOn(false));
  }, [user?.id]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const navItems = useMemo(() => {
    if (user?.role === 'admin') return ADMIN_NAV;
    if (user?.role === 'driver') return DRIVER_NAV;
    return CITIZEN_NAV;
  }, [user?.role]);

  const roleRootLabel =
    user?.role === 'admin' ? 'Admin' : user?.role === 'driver' ? 'Haydovchi' : 'Fuqaro';

  const activeNavItem = useMemo(() => {
    return (
      navItems.find((item) => item.to === location.pathname) ??
      navItems.find(
        (item) =>
          item.to !== '/citizen' &&
          item.to !== '/driver' &&
          item.to !== '/admin' &&
          location.pathname.startsWith(item.to)
      ) ??
      navItems[0]
    );
  }, [navItems, location.pathname]);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiRequest<{ notifications: NotificationRecord[] }>('/api/notifications'),
    enabled: Boolean(user) && notifOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: () => apiRequest('/api/notifications/read', { method: 'POST', body: '{}' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      refreshUser();
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const firstInitial = (user?.fullName?.trim()?.[0] || user?.email?.[0] || 'Y').toUpperCase();
  const mobilePrimaryItems = navItems.filter((i) => i.mobilePrimary).slice(0, 4);

  const isRouteActive = (to: string) => {
    if (to === '/citizen' || to === '/driver' || to === '/admin') {
      return location.pathname === to;
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* DESKTOP SIDEBAR >=1280px (248px) & SMALL DESKTOP ICON RAIL 1024-1279px (80px) */}
      <aside
        aria-label="Asosiy navigatsiya"
        className="hidden lg:flex fixed top-0 left-0 h-[100dvh] z-30 flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-default)] lg:w-[80px] xl:w-[248px] lg:px-[16px] transition-all duration-150"
      >
        {/* Brand Row 72px */}
        <div className="h-[72px] flex items-center lg:justify-center xl:justify-start gap-[10px] shrink-0">
          <YashnarLogo size={36} />
          <span className="hidden xl:inline text-[22px] leading-[28px] font-extrabold tracking-tight text-[#065F46] dark:text-[#34D399]">
            YASHNAR
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-[8px] flex flex-col gap-[4px]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center rounded-[10px] transition-colors duration-150',
                  'lg:w-[48px] lg:h-[48px] lg:justify-center lg:mx-auto',
                  'xl:w-full xl:h-[44px] xl:px-[12px] xl:justify-start xl:gap-[12px]',
                  active
                    ? 'bg-[#D1FAE5] dark:bg-[#059669]/20 text-[#065F46] dark:text-[#34D399] font-semibold'
                    : 'bg-transparent text-[#64748B] dark:text-[#A7B8AE] font-medium hover:bg-[#F1F5F9] dark:hover:bg-[#1A2F27] hover:text-[#0F172A] dark:hover:text-[#F1F5F9]'
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-[8px] bottom-[8px] w-[3px] rounded-r-[3px] bg-[#059669] dark:bg-[#34D399]"
                  />
                )}
                <Icon className="lg:w-[22px] lg:h-[22px] xl:w-[20px] xl:h-[20px] shrink-0" />
                <span className="hidden xl:inline text-[14px] leading-[20px] truncate">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom PWA Install & Logout */}
        <div className="py-[16px] border-t border-[var(--border-default)] flex flex-col gap-[8px]">
          <div className="hidden xl:block">
            <PWAInstallButton />
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Chiqish"
            aria-label="Hisobdan chiqish"
            className={cn(
              'flex items-center rounded-[10px] text-[#64748B] dark:text-[#A7B8AE] hover:bg-[#FEE2E2] hover:text-[#991B1B] dark:hover:bg-red-950/40 dark:hover:text-red-300 transition-colors duration-150 cursor-pointer',
              'lg:w-[48px] lg:h-[48px] lg:justify-center lg:mx-auto',
              'xl:w-full xl:h-[44px] xl:px-[12px] xl:justify-start xl:gap-[12px]'
            )}
          >
            <LogOut className="w-[20px] h-[20px] shrink-0" />
            <span className="hidden xl:inline text-[14px] leading-[20px] font-medium">Chiqish</span>
          </button>
        </div>
      </aside>

      {/* TOP HEADER (64px mobile/tablet, 72px desktop) */}
      <header
        className="fixed top-0 right-0 left-0 lg:left-[80px] xl:left-[248px] h-[64px] xl:h-[72px] z-20 bg-[var(--bg-sidebar)] border-b border-[var(--border-default)] px-[16px] md:px-[24px] xl:px-[32px] flex items-center justify-between gap-[12px]"
      >
        <div className="flex items-center gap-[12px] min-w-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Navigatsiya menyusini ochish"
            className="lg:hidden w-[44px] h-[44px] -ml-[8px] rounded-[10px] flex items-center justify-center text-[#0F172A] dark:text-[#F1F5F9] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2F27] cursor-pointer shrink-0"
          >
            <Menu className="w-[22px] h-[22px]" />
          </button>
          <nav aria-label="Breadcrumb" className="flex items-center gap-[8px] min-w-0 text-[14px] leading-[20px]">
            <span className="hidden sm:inline text-[#64748B] dark:text-[#A7B8AE] whitespace-nowrap">
              {roleRootLabel}
            </span>
            <span className="hidden sm:inline text-[#CBD5E1] dark:text-[#294237]" aria-hidden="true">
              /
            </span>
            <span className="font-semibold text-[#0F172A] dark:text-[#F1F5F9] truncate">
              {activeNavItem?.label ?? 'Bosh sahifa'}
            </span>
          </nav>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-[4px] md:gap-[8px] shrink-0">
          <span className="hidden md:inline-block text-[13px] font-medium text-[#64748B] dark:text-[#A7B8AE] mr-[8px] whitespace-nowrap">
            {user?.regionName || 'Namangan viloyati'}
          </span>

          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={async () => {
                setRefreshing(true);
                try {
                  await queryClient.invalidateQueries();
                  await queryClient.refetchQueries({ type: 'active' });
                } finally {
                  setRefreshing(false);
                }
              }}
              disabled={refreshing}
              aria-label="Yangilash"
              title="Yangilash"
              className="w-[44px] h-[44px] rounded-[10px] flex items-center justify-center text-[#64748B] dark:text-[#A7B8AE] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2F27] cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={cn('w-[20px] h-[20px]', refreshing && 'animate-spin')} />
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Yorug‘ mavzuga o‘tish' : 'Tungi mavzuga o‘tish'}
            className="w-[44px] h-[44px] rounded-[10px] flex items-center justify-center text-[#64748B] dark:text-[#A7B8AE] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2F27] cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-[20px] h-[20px]" /> : <Moon className="w-[20px] h-[20px]" />}
          </button>

          {/* Notifications button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((p) => !p)}
              aria-label="Bildirishnomalar"
              aria-expanded={notifOpen}
              className="relative w-[44px] h-[44px] rounded-[10px] flex items-center justify-center text-[#64748B] dark:text-[#A7B8AE] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2F27] cursor-pointer"
            >
              <Bell className="w-[20px] h-[20px]" />
              {user && user.unreadNotifications > 0 && (
                <span className="absolute top-[6px] right-[6px] min-w-[18px] h-[18px] px-[4px] rounded-[999px] bg-[#059669] text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
                  {user.unreadNotifications > 99 ? '99+' : user.unreadNotifications}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                className="absolute right-0 mt-[8px] w-[min(340px,calc(100vw-32px))] rounded-[16px] bg-[var(--bg-card)] border border-[var(--border-default)] overflow-hidden z-40"
                style={{ boxShadow: 'var(--shadow-dialog)' }}
              >
                <div className="px-[16px] py-[12px] border-b border-[var(--border-default)] flex items-center justify-between">
                  <span className="text-[14px] font-semibold">Bildirishnomalar</span>
                  <button
                    type="button"
                    onClick={() => markReadMutation.mutate()}
                    className="text-[12px] font-medium text-[#047857] dark:text-[#34D399] hover:underline cursor-pointer"
                  >
                    Barchasini o‘qilgan qilish
                  </button>
                </div>
                {pushSupported() && !pushOn && (
                  <div className="px-[16px] py-[10px] border-b border-[var(--border-default)] bg-[#ECFDF5] dark:bg-[#11211B]">
                    <button
                      type="button"
                      disabled={pushBusy}
                      onClick={async () => {
                        setPushBusy(true);
                        try {
                          const ok = await syncPushSubscription(true);
                          setPushOn(ok);
                          if (!ok) {
                            alert(
                              Notification.permission === 'denied'
                                ? 'Bildirishnomalar brauzer sozlamalarida bloklangan. Sayt sozlamalaridan ruxsat bering.'
                                : 'Bildirishnomalarni yoqib bo‘lmadi.'
                            );
                          }
                        } catch {
                          alert('Bildirishnomalarni yoqib bo‘lmadi.');
                        } finally {
                          setPushBusy(false);
                        }
                      }}
                      className="w-full text-left text-[13px] font-semibold text-[#047857] dark:text-[#34D399] hover:underline cursor-pointer disabled:opacity-60"
                    >
                      🔔 Telefon bildirishnomalarini yoqish
                    </button>
                    <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE]">
                      Ilova yopiq bo‘lsa ham haydovchi yo‘lga chiqqanini bilib olasiz.
                    </div>
                  </div>
                )}
                <div className="max-h-[320px] overflow-y-auto divide-y divide-[var(--border-default)]">
                  {!notifData?.notifications?.length ? (
                    <div className="p-[24px] text-center text-[13px] text-[#64748B] dark:text-[#A7B8AE]">
                      Hozircha bildirishnomalar yo‘q.
                    </div>
                  ) : (
                    notifData.notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          'p-[12px_16px] text-[13px] leading-[20px]',
                          !n.isRead && 'bg-[#D1FAE5]/25 dark:bg-[#059669]/10'
                        )}
                      >
                        <div className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">{n.title}</div>
                        <div className="text-[#64748B] dark:text-[#A7B8AE] mt-[2px]">{n.body}</div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#A7B8AE] mt-[4px] tabular-nums">
                          {formatTashkentDateTime(n.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Avatar 36x36 inside 44x44 target */}
          <Link
            to={
              user?.role === 'driver'
                ? '/driver/profile'
                : user?.role === 'admin'
                ? '/admin/settings'
                : '/citizen/profile'
            }
            aria-label={user?.fullName ? `Profil: ${user.fullName}` : 'Profil'}
            className="w-[44px] h-[44px] rounded-[10px] flex items-center justify-center hover:bg-[#F1F5F9] dark:hover:bg-[#1A2F27]"
          >
            <span className="w-[36px] h-[36px] rounded-full bg-[#064E3B] text-white text-[14px] font-bold flex items-center justify-center">
              {firstInitial}
            </span>
          </Link>
        </div>
      </header>

      {/* MOBILE / TABLET DRAWER (width min(280px, 85vw)) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className="w-[min(280px,85vw)] h-full bg-[var(--bg-sidebar)] border-r border-[var(--border-default)] flex flex-col px-[16px] transition-transform duration-[220ms]">
            <div className="h-[64px] flex items-center justify-between">
              <div className="flex items-center gap-[10px]">
                <YashnarLogo size={32} />
                <span className="text-[20px] font-extrabold text-[#065F46] dark:text-[#34D399]">
                  YASHNAR
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Menyuni yopish"
                className="w-[44px] h-[44px] rounded-[10px] flex items-center justify-center text-[#64748B] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-[12px] py-[8px] mb-[8px] rounded-[10px] bg-[#F8FAFC] dark:bg-[#13231D] border border-[var(--border-default)]">
              <div className="text-[14px] font-semibold truncate">{user?.fullName}</div>
              <div className="text-[12px] text-[#64748B] dark:text-[#A7B8AE] truncate">
                {user?.mfyName ? `${user.districtName} · ${user.mfyName}` : user?.email}
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto flex flex-col gap-[4px]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      'relative flex items-center h-[44px] px-[12px] gap-[12px] rounded-[10px] text-[14px]',
                      active
                        ? 'bg-[#D1FAE5] dark:bg-[#059669]/20 text-[#065F46] dark:text-[#34D399] font-semibold'
                        : 'text-[#64748B] dark:text-[#A7B8AE] font-medium hover:bg-[#F1F5F9] dark:hover:bg-[#1A2F27]'
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-[8px] bottom-[8px] w-[3px] rounded-r-[3px] bg-[#059669]"
                      />
                    )}
                    <Icon className="w-[20px] h-[20px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="py-[16px] border-t border-[var(--border-default)] flex flex-col gap-[8px]">
              <PWAInstallButton />
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center h-[44px] px-[12px] gap-[12px] rounded-[10px] text-[14px] font-medium text-[#991B1B] dark:text-red-300 hover:bg-[#FEE2E2] dark:hover:bg-red-950/40 cursor-pointer"
              >
                <LogOut className="w-[20px] h-[20px]" />
                <span>Chiqish</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main
        className="pt-[64px] xl:pt-[72px] lg:ml-[80px] xl:ml-[248px] min-h-[100dvh]"
        onClick={() => {
          if (notifOpen) setNotifOpen(false);
        }}
      >
        <div
          className="mx-auto max-w-[1440px] px-[16px] pt-[16px] pb-[calc(96px+env(safe-area-inset-bottom))] md:p-[24px] xl:p-[32px]"
        >
          <PhoneVerificationBanner />
          {children}
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION <=767px (72px + safe-area, 4 destinations + Ko‘proq) */}
      <nav
        aria-label="Mobil pastki navigatsiya"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--bg-sidebar)] border-t border-[var(--border-default)] px-[8px]"
        style={{
          height: 'calc(72px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="grid grid-cols-5 h-[72px] items-center">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'min-h-[44px] flex flex-col items-center justify-center gap-[4px] rounded-[10px] px-[4px]',
                  active
                    ? 'text-[#047857] dark:text-[#34D399] font-semibold'
                    : 'text-[#64748B] dark:text-[#A7B8AE]'
                )}
              >
                <Icon className="w-[22px] h-[22px] shrink-0" />
                <span className="text-[11px] leading-[14px] truncate max-w-full">
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="min-h-[44px] flex flex-col items-center justify-center gap-[4px] rounded-[10px] px-[4px] text-[#64748B] dark:text-[#A7B8AE] cursor-pointer"
          >
            <MoreHorizontal className="w-[22px] h-[22px]" />
            <span className="text-[11px] leading-[14px]">Ko‘proq</span>
          </button>
        </div>
      </nav>

      <OfflineIndicator />
    </div>
  );
};
