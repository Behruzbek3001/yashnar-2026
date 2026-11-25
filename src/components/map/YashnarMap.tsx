import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Truck } from 'lucide-react';
import { formatTashkentDateTime } from '../../lib/api';
import { REPORT_STATUS_LABELS, type ReportStatus } from '../../lib/domain';

export interface MapDriverPoint {
  tripId: number;
  driverId: number;
  driverName: string;
  vehiclePlate?: string;
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

export const YashnarMap: React.FC<{
  drivers: MapDriverPoint[];
  pickups: MapPickupPoint[];
  emptyMessage?: string;
}> = ({
  drivers,
  pickups,
  emptyMessage = 'Hozircha faol haydovchi joylashuvi mavjud emas.',
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
                  <div className="font-semibold">{p.publicCode}</div>
                  <div>{p.category} · {p.estimatedRange || `${p.estimatedLiters ?? 0} L`}</div>
                  <div>Holat: {REPORT_STATUS_LABELS[p.status as ReportStatus] ?? p.status}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

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
