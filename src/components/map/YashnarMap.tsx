import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Truck } from 'lucide-react';
import { distanceKm } from '../../lib/eta';
import { formatTashkentDateTime } from '../../lib/api';
import { REPORT_STATUS_LABELS, type ReportStatus } from '../../lib/domain';

export interface MapDriverPoint {
  tripId: number;
  driverId: number;
  driverName: string;
  vehiclePlate?: string;
  driverPhone?: string;
  mfyName?: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  receivedAt: string;
  isStale: boolean;
  etaLabel?: string;
}

export interface MapPickupPoint {
  id: number;
  publicCode: string;
  category: string;
  estimatedRange?: string;
  estimatedLiters?: number;
  status: string;
  address?: string;
  mfyName?: string;
  citizenName?: string;
  latitude: number | null;
  longitude: number | null;
}

// Namangan center coordinates
const NAMANGAN_CENTER: [number, number] = [40.9983, 71.6726];

function createDriverIcon(selected: boolean) {
  const outline = selected ? 'outline: 3px solid #0F172A; outline-offset: 2px;' : '';
  return L.divIcon({
    className: 'yashnar-driver-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `<div style="width:40px;height:40px;border-radius:999px;background:#059669;border:3px solid #FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(15,23,42,0.22);${outline}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
        <path d="M15 18H9"/>
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
        <circle cx="17" cy="18" r="2"/>
        <circle cx="7" cy="18" r="2"/>
      </svg>
    </div>`,
  });
}

function createPickupIcon(selected: boolean) {
  const outline = selected ? 'outline: 3px solid #0F172A; outline-offset: 2px;' : '';
  return L.divIcon({
    className: 'yashnar-pickup-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div style="width:24px;height:24px;border-radius:999px;background:#F59E0B;border:3px solid #FFFFFF;box-shadow:0 2px 8px rgba(15,23,42,0.2);${outline}"></div>`,
  });
}

/** Visit order: always go to the nearest remaining pickup next. */
function orderByNearest(start: [number, number], pts: MapPickupPoint[]): MapPickupPoint[] {
  const left = [...pts];
  const out: MapPickupPoint[] = [];
  let cur = start;
  while (left.length) {
    let bi = 0;
    let bd = Infinity;
    left.forEach((p, i) => {
      const d = distanceKm(cur[0], cur[1], p.latitude!, p.longitude!);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const [next] = left.splice(bi, 1);
    out.push(next);
    cur = [next.latitude!, next.longitude!];
  }
  return out;
}

export const YashnarMap: React.FC<{
  drivers: MapDriverPoint[];
  pickups: MapPickupPoint[];
  emptyMessage?: string;
  /** Draw the driving route from the first driver through all pickups (nearest first). */
  showRoute?: boolean;
  /** Draw a circle of this radius around the first driver and count pickups inside it. */
  areaRadiusMeters?: number;
}> = ({
  drivers,
  pickups,
  emptyMessage = 'Hozircha faol haydovchi joylashuvi mavjud emas.',
  showRoute = false,
  areaRadiusMeters,
}) => {
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(
    drivers[0]?.tripId ?? null
  );
  const [selectedPickupId, setSelectedPickupId] = useState<number | null>(null);

  const validPickups = useMemo(
    () => pickups.filter((p) => p.latitude !== null && p.longitude !== null),
    [pickups]
  );

  const center: [number, number] = useMemo(() => {
    if (drivers.length > 0) return [drivers[0].latitude, drivers[0].longitude];
    if (validPickups.length > 0) return [validPickups[0].latitude!, validPickups[0].longitude!];
    return NAMANGAN_CENTER;
  }, [drivers, validPickups]);

  const selectedDriver = drivers.find((d) => d.tripId === selectedDriverId) ?? drivers[0] ?? null;

  const routeStart: [number, number] | null = drivers[0] ? [drivers[0].latitude, drivers[0].longitude] : null;
  const ordered = useMemo(
    () => (showRoute && routeStart ? orderByNearest(routeStart, validPickups).slice(0, 20) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showRoute, routeStart?.[0], routeStart?.[1], validPickups]
  );
  const routeKey = routeStart ? [routeStart, ...ordered.map((p) => [p.latitude, p.longitude])].map(String).join('|') : '';
  const [roadPath, setRoadPath] = useState<[number, number][] | null>(null);
  const [roadInfo, setRoadInfo] = useState<{ km: number; min: number } | null>(null);
  useEffect(() => {
    setRoadPath(null);
    setRoadInfo(null);
    if (!routeStart || !ordered.length) return;
    const coords = [routeStart, ...ordered.map((p) => [p.latitude!, p.longitude!] as [number, number])]
      .map(([la, ln]) => `${ln.toFixed(6)},${la.toFixed(6)}`)
      .join(';');
    const ctrl = new AbortController();
    fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        const route = j?.routes?.[0];
        if (!route) return;
        setRoadPath(route.geometry.coordinates.map(([ln, la]: [number, number]) => [la, ln]));
        setRoadInfo({ km: route.distance / 1000, min: Math.round(route.duration / 60) });
      })
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);
  const straightPath: [number, number][] = routeStart
    ? [routeStart, ...ordered.map((p) => [p.latitude!, p.longitude!] as [number, number])]
    : [];
  const googleNavUrl =
    routeStart && ordered.length
      ? `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${routeStart[0]},${routeStart[1]}&destination=${ordered[ordered.length - 1].latitude},${ordered[ordered.length - 1].longitude}` +
        (ordered.length > 1
          ? `&waypoints=${ordered
              .slice(0, -1)
              .slice(0, 9)
              .map((p) => `${p.latitude},${p.longitude}`)
              .join('|')}`
          : '')
      : null;
  const insideCircle =
    areaRadiusMeters && routeStart
      ? validPickups.filter((p) => distanceKm(routeStart[0], routeStart[1], p.latitude!, p.longitude!) * 1000 <= areaRadiusMeters)
      : [];

  return (
    <div className="space-y-[16px]">
      <div
        className="w-full overflow-hidden rounded-[16px] border border-[var(--border-default)] relative"
        style={{ height: 'clamp(320px, calc(100svh - 300px), 620px)' }}
      >
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {areaRadiusMeters && routeStart && (
            <Circle
              center={routeStart}
              radius={areaRadiusMeters}
              pathOptions={{ color: '#059669', weight: 2, fillColor: '#10B981', fillOpacity: 0.08 }}
            />
          )}
          {showRoute && straightPath.length > 1 && (
            <Polyline
              positions={roadPath ?? straightPath}
              pathOptions={roadPath ? { color: '#2563EB', weight: 5, opacity: 0.85 } : { color: '#2563EB', weight: 3, dashArray: '6 8' }}
            />
          )}
          {drivers.map((drv) => (
            <Marker
              key={`driver-${drv.tripId}`}
              position={[drv.latitude, drv.longitude]}
              icon={createDriverIcon(selectedDriver?.tripId === drv.tripId)}
              eventHandlers={{
                click: () => {
                  setSelectedDriverId(drv.tripId);
                  setSelectedPickupId(null);
                },
              }}
            >
              <Popup>
                <div className="text-[13px] leading-[18px]">
                  <div className="font-semibold">{drv.driverName}</div>
                  {drv.vehiclePlate && <div>Avto: {drv.vehiclePlate}</div>}
                  {drv.driverPhone && (
                    <div>
                      Tel:{' '}
                      <a href={`tel:${drv.driverPhone}`} className="font-semibold text-[#047857] underline">
                        {drv.driverPhone}
                      </a>
                    </div>
                  )}
                  <div>Aniqlik: ±{Math.round(drv.accuracyMeters)} m</div>
                  <div>Yangilandi: {formatTashkentDateTime(drv.receivedAt)}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {validPickups.map((p) => (
            <Marker
              key={`pickup-${p.id}`}
              position={[p.latitude!, p.longitude!]}
              icon={createPickupIcon(selectedPickupId === p.id)}
              eventHandlers={{
                click: () => setSelectedPickupId(p.id),
              }}
            >
              <Popup>
                <div className="text-[13px] leading-[18px]">
                  <div className="font-semibold">
                    {showRoute && ordered.findIndex((o) => o.id === p.id) >= 0 ? `${ordered.findIndex((o) => o.id === p.id) + 1}. ` : ''}
                    {p.publicCode}
                  </div>
                  <div>{p.category} · {p.estimatedRange || `${p.estimatedLiters ?? 0} L`}</div>
                  <div>Holat: {REPORT_STATUS_LABELS[p.status as ReportStatus] ?? p.status}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {(showRoute || areaRadiusMeters) && routeStart && (
        <div className="card-surface p-[16px] flex flex-wrap items-center justify-between gap-[12px] text-[14px]">
          <div className="space-y-[2px]">
            {areaRadiusMeters ? (
              <div>
                <b>{(areaRadiusMeters / 1000).toFixed(1)} km</b> atrofda kutayotgan murojaatlar: <b>{insideCircle.length} ta</b>
                {' '}(jami: {validPickups.length} ta)
              </div>
            ) : null}
            {showRoute && ordered.length ? (
              <div className="text-[#64748B] dark:text-[#A7B8AE]">
                Yo‘nalish: {ordered.length} ta nuqta (eng yaqinidan boshlab)
                {roadInfo ? ` · ${roadInfo.km.toFixed(1)} km · ≈ ${roadInfo.min} daqiqa` : ''}
              </div>
            ) : showRoute ? (
              <div className="text-[#64748B] dark:text-[#A7B8AE]">Manzili ko‘rsatilgan kutayotgan murojaatlar yo‘q.</div>
            ) : null}
          </div>
          {googleNavUrl && (
            <a
              href={googleNavUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-[6px] rounded-[10px] bg-[#047857] text-white px-[14px] py-[10px] font-semibold"
            >
              <Navigation className="w-[16px] h-[16px]" aria-hidden="true" />
              Navigatorda ochish
            </a>
          )}
        </div>
      )}

      {/* Driver Info Card (20px pad, 44x44 icon, 16/24/600 name, 12/18 supporting) */}
      {selectedDriver ? (
        <div className="card-surface p-[20px] flex flex-wrap items-center justify-between gap-[16px]">
          <div className="flex items-center gap-[12px]">
            <div className="w-[44px] h-[44px] rounded-full bg-[#D1FAE5] text-[#065F46] flex items-center justify-center shrink-0">
              <Truck className="w-[22px] h-[22px]" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[16px] leading-[24px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                {selectedDriver.driverName}
              </div>
              {selectedDriver.driverPhone && (
                <a
                  href={`tel:${selectedDriver.driverPhone}`}
                  className="inline-block text-[14px] font-semibold text-[#047857] dark:text-[#34D399] underline"
                >
                  📞 {selectedDriver.driverPhone}
                </a>
              )}
              <div className="text-[12px] leading-[18px] text-[#64748B] dark:text-[#A7B8AE] flex flex-wrap items-center gap-x-[8px]">
                {selectedDriver.vehiclePlate && <span>{selectedDriver.vehiclePlate}</span>}
                {selectedDriver.mfyName && <span>· {selectedDriver.mfyName}</span>}
                <span>· Oxirgi signal: {formatTashkentDateTime(selectedDriver.receivedAt)}</span>
                <span>· Aniqlik: ±{Math.round(selectedDriver.accuracyMeters)} m</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12px] leading-[18px] font-medium text-[#0F172A] dark:text-[#F1F5F9]">
              {selectedDriver.isStale
                ? 'Signal eskirgan (>120 soniya)'
                : selectedDriver.etaLabel || 'Yetib kelish vaqti aniqlanmoqda.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="card-surface p-[20px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
          {emptyMessage}
        </div>
      )}
    </div>
  );
};
