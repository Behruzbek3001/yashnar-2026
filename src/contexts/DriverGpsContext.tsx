import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';
import { shouldSendGpsUpdate } from '../lib/domain';
import { useAuth } from './AuthContext';

type GpsPoint = { lat: number; lng: number; timestampMs: number };

interface DriverGpsState {
  sharingGps: boolean;
  gpsError: string | null;
  lastSentAt: string | null;
  startWatching: () => void;
  stopWatching: () => void;
}

const DriverGpsContext = createContext<DriverGpsState>({
  sharingGps: false,
  gpsError: null,
  lastSentAt: null,
  startWatching: () => {},
  stopWatching: () => {},
});

export const useDriverGps = () => useContext(DriverGpsContext);

/**
 * Keeps the driver's GPS sharing alive on every page while a trip is active,
 * instead of only while the map page is open.
 */
export const DriverGpsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isDriver = user?.role === 'driver';
  const [sharingGps, setSharingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<GpsPoint | null>(null);
  const userStoppedRef = useRef(false);

  const { data } = useQuery({
    queryKey: ['driver-map'],
    queryFn: () => apiRequest<{ activeTrip: { id: number } | null }>('/api/driver/map'),
    enabled: isDriver,
    refetchInterval: 15000,
  });
  const activeTripId = data?.activeTrip?.id ?? null;

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setSharingGps(false);
  }, []);

  const sendLocation = useCallback(
    async (lat: number, lng: number, accuracy: number) => {
      const nowMs = Date.now();
      const candidate: GpsPoint = { lat, lng, timestampMs: nowMs };
      if (!shouldSendGpsUpdate(lastPointRef.current, candidate).allow) return;
      try {
        const res = await apiRequest<{ accepted: boolean; receivedAt?: string }>('/api/driver/location', {
          method: 'POST',
          body: JSON.stringify({
            latitude: lat,
            longitude: lng,
            accuracyMeters: accuracy,
            recordedAt: new Date(nowMs).toISOString(),
          }),
        });
        if (res.accepted) {
          lastPointRef.current = candidate;
          setLastSentAt(res.receivedAt ?? new Date(nowMs).toISOString());
          setGpsError(null);
          queryClient.invalidateQueries({ queryKey: ['driver-map'] });
        }
      } catch (err) {
        setGpsError(err instanceof Error ? err.message : 'GPS yuborishda xatolik.');
      }
    },
    [queryClient]
  );

  const beginWatch = useCallback(() => {
    if (watchIdRef.current !== null) return;
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Ushbu qurilmada GPS (Geolocation) qo‘llab-quvvatlanmaydi.');
      return;
    }
    setSharingGps(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      (geoErr) => {
        setGpsError(
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Joylashuvga ruxsat berilmadi. Brauzer sozlamalaridan GPS ruxsatini yoqing.'
            : 'GPS signalini olishda xatolik yuz berdi.'
        );
        if (geoErr.code === geoErr.PERMISSION_DENIED) stopWatching();
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }, [sendLocation, stopWatching]);

  const startWatching = useCallback(() => {
    userStoppedRef.current = false;
    beginWatch();
  }, [beginWatch]);

  const manualStop = useCallback(() => {
    userStoppedRef.current = true;
    stopWatching();
  }, [stopWatching]);

  // Auto-start while a trip is active; auto-stop when it ends or the user logs out.
  useEffect(() => {
    if (isDriver && activeTripId && !userStoppedRef.current) {
      beginWatch();
    } else if (!activeTripId || !isDriver) {
      userStoppedRef.current = false;
      lastPointRef.current = null;
      stopWatching();
    }
  }, [isDriver, activeTripId, beginWatch, stopWatching]);

  useEffect(() => () => stopWatching(), [stopWatching]);

  return (
    <DriverGpsContext.Provider value={{ sharingGps, gpsError, lastSentAt, startWatching, stopWatching: manualStop }}>
      {children}
    </DriverGpsContext.Provider>
  );
};
