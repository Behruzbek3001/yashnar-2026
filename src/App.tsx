import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, YashnarLogo } from './components/ui/Primitives';
import { AppShell } from './components/layout/AppShell';

import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ProfilePage } from './pages/ProfilePage';

import { CitizenDashboard } from './pages/citizen/CitizenDashboard';
import { WasteReportPage } from './pages/citizen/WasteReportPage';
import { RequestsPage } from './pages/citizen/RequestsPage';
import { PersonalQrPage } from './pages/citizen/PersonalQrPage';
import { CitizenMapPage } from './pages/citizen/CitizenMapPage';
import { QuestsPage } from './pages/citizen/QuestsPage';
import { LeaderboardPage } from './pages/citizen/LeaderboardPage';
import { EcoMarketPage } from './pages/citizen/EcoMarketPage';
import { WalletPage } from './pages/citizen/WalletPage';

import { DriverDashboardPage } from './pages/driver/DriverDashboardPage';
import { DriverMfysPage } from './pages/driver/DriverMfysPage';
import { DriverMapPage } from './pages/driver/DriverMapPage';
import { DriverScanPage } from './pages/driver/DriverScanPage';
import { DriverHistoryPage, DriverTripsPage } from './pages/driver/DriverTripsAndHistoryPages';

import {
  AdminAnalyticsPage,
  AdminMapPage,
  AdminOverviewPage,
} from './pages/admin/AdminOverviewAndAnalyticsPages';
import {
  AdminCitizensPage,
  AdminDriversPage,
  AdminMfysPage,
  AdminReportsPage,
} from './pages/admin/AdminOperationsPages';
import {
  AdminAuditPage,
  AdminEcoFactsPage,
  AdminQuestsPage,
  AdminRedemptionsPage,
  AdminRewardsPage,
  AdminSettingsPage,
} from './pages/admin/AdminContentAndMarketPages';
import { AdminAiPage } from './pages/admin/AdminAiPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

function getHomePath(user: { role: string; onboardingCompleted: boolean } | null): string {
  if (!user) return '/';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'driver') return '/driver';
  if (!user.onboardingCompleted) return '/onboarding';
  return '/citizen';
}

const FullscreenLoader: React.FC = () => (
  <div className="min-h-[100dvh] bg-[var(--bg-page)] flex flex-col items-center justify-center gap-[12px]">
    <YashnarLogo size={44} />
    <span className="text-[14px] font-medium text-[#64748B] dark:text-[#A7B8AE]">
      YASHNAR yuklanmoqda...
    </span>
  </div>
);

const AuthRoute: React.FC<{ initialMode?: 'login' | 'register' }> = ({ initialMode = 'login' }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (user) return <Navigate to={getHomePath(user)} replace />;
  return <AuthPage initialMode={initialMode} />;
};

const OnboardingRoute: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'driver') return <Navigate to="/driver" replace />;
  return <OnboardingPage />;
};

const RoleShellRoute: React.FC<{
  allowedRole: 'citizen' | 'driver' | 'admin';
  children: React.ReactNode;
}> = ({ allowedRole, children }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== allowedRole) return <Navigate to={getHomePath(user)} replace />;
  if (user.role === 'citizen' && !user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }
  return <AppShell>{children}</AppShell>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    {/* Auth & Onboarding (No marketing landing page) */}
    <Route path="/" element={<AuthRoute initialMode="login" />} />
    <Route path="/login" element={<AuthRoute initialMode="login" />} />
    <Route path="/register" element={<AuthRoute initialMode="register" />} />
    <Route path="/onboarding" element={<OnboardingRoute />} />

    {/* Citizen Routes */}
    <Route path="/citizen" element={<RoleShellRoute allowedRole="citizen"><CitizenDashboard /></RoleShellRoute>} />
    <Route path="/citizen/report" element={<RoleShellRoute allowedRole="citizen"><WasteReportPage /></RoleShellRoute>} />
    <Route path="/citizen/requests" element={<RoleShellRoute allowedRole="citizen"><RequestsPage /></RoleShellRoute>} />
    <Route path="/citizen/qr" element={<RoleShellRoute allowedRole="citizen"><PersonalQrPage /></RoleShellRoute>} />
    <Route path="/citizen/map" element={<RoleShellRoute allowedRole="citizen"><CitizenMapPage /></RoleShellRoute>} />
    <Route path="/citizen/quests" element={<RoleShellRoute allowedRole="citizen"><QuestsPage /></RoleShellRoute>} />
    <Route path="/citizen/leaderboard" element={<RoleShellRoute allowedRole="citizen"><LeaderboardPage /></RoleShellRoute>} />
    <Route path="/citizen/market" element={<RoleShellRoute allowedRole="citizen"><EcoMarketPage /></RoleShellRoute>} />
    <Route path="/citizen/wallet" element={<RoleShellRoute allowedRole="citizen"><WalletPage /></RoleShellRoute>} />
    <Route path="/citizen/profile" element={<RoleShellRoute allowedRole="citizen"><ProfilePage /></RoleShellRoute>} />

    {/* Driver Routes */}
    <Route path="/driver" element={<RoleShellRoute allowedRole="driver"><DriverDashboardPage /></RoleShellRoute>} />
    <Route path="/driver/mfys" element={<RoleShellRoute allowedRole="driver"><DriverMfysPage /></RoleShellRoute>} />
    <Route path="/driver/map" element={<RoleShellRoute allowedRole="driver"><DriverMapPage /></RoleShellRoute>} />
    <Route path="/driver/trips" element={<RoleShellRoute allowedRole="driver"><DriverTripsPage /></RoleShellRoute>} />
    <Route path="/driver/scan" element={<RoleShellRoute allowedRole="driver"><DriverScanPage /></RoleShellRoute>} />
    <Route path="/driver/history" element={<RoleShellRoute allowedRole="driver"><DriverHistoryPage /></RoleShellRoute>} />
    <Route path="/driver/profile" element={<RoleShellRoute allowedRole="driver"><ProfilePage /></RoleShellRoute>} />

    {/* Admin Routes */}
    <Route path="/admin" element={<RoleShellRoute allowedRole="admin"><AdminOverviewPage /></RoleShellRoute>} />
    <Route path="/admin/analytics" element={<RoleShellRoute allowedRole="admin"><AdminAnalyticsPage /></RoleShellRoute>} />
    <Route path="/admin/map" element={<RoleShellRoute allowedRole="admin"><AdminMapPage /></RoleShellRoute>} />
    <Route path="/admin/mfys" element={<RoleShellRoute allowedRole="admin"><AdminMfysPage /></RoleShellRoute>} />
    <Route path="/admin/drivers" element={<RoleShellRoute allowedRole="admin"><AdminDriversPage /></RoleShellRoute>} />
    <Route path="/admin/citizens" element={<RoleShellRoute allowedRole="admin"><AdminCitizensPage /></RoleShellRoute>} />
    <Route path="/admin/reports" element={<RoleShellRoute allowedRole="admin"><AdminReportsPage /></RoleShellRoute>} />
    <Route path="/admin/quests" element={<RoleShellRoute allowedRole="admin"><AdminQuestsPage /></RoleShellRoute>} />
    <Route path="/admin/eco-facts" element={<RoleShellRoute allowedRole="admin"><AdminEcoFactsPage /></RoleShellRoute>} />
    <Route path="/admin/rewards" element={<RoleShellRoute allowedRole="admin"><AdminRewardsPage /></RoleShellRoute>} />
    <Route path="/admin/redemptions" element={<RoleShellRoute allowedRole="admin"><AdminRedemptionsPage /></RoleShellRoute>} />
    <Route path="/admin/audit" element={<RoleShellRoute allowedRole="admin"><AdminAuditPage /></RoleShellRoute>} />
    <Route path="/admin/settings" element={<RoleShellRoute allowedRole="admin"><AdminSettingsPage /></RoleShellRoute>} />
    <Route path="/admin/ai" element={<RoleShellRoute allowedRole="admin"><AdminAiPage /></RoleShellRoute>} />

    {/* Fallback */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
