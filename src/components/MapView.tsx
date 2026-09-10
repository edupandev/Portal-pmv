import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { DeviceStatus } from '../types/pmv';
import { Wifi, Radio, AlertTriangle } from 'lucide-react';

interface MapViewProps {
  devices: Record<string, DeviceStatus>;
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({ devices, selectedDeviceId, onSelectDevice }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.CircleMarker>>({});
  const initialViewSetRef = useRef(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([-23.966454, -46.391634], 14);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Free OpenStreetMap standard tiles (No API key required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const now = Date.now();
    const deviceList = Object.values(devices) as DeviceStatus[];

    if (deviceList.length > 0 && !initialViewSetRef.current) {
      const first = deviceList[0];
      map.setView([first.lat, first.lng], 15);
      initialViewSetRef.current = true;
    }

    deviceList.forEach((dev) => {
      const isOffline = now - dev.lastSeen > 9000;
      const isSelected = selectedDeviceId === dev.dispositivo;
      const color = isOffline ? '#94a3b8' : dev.vermelho ? '#ef4444' : '#10b981';

      if (!markersRef.current[dev.dispositivo]) {
        const marker = L.circleMarker([dev.lat, dev.lng], {
          radius: isSelected ? 16 : 13,
          fillColor: color,
          color: '#ffffff',
          weight: isSelected ? 4 : 2.5,
          opacity: 1,
          fillOpacity: 0.95,
        }).addTo(map);

        marker.on('click', () => {
          onSelectDevice(dev.dispositivo);
        });

        markersRef.current[dev.dispositivo] = marker;
      } else {
        const marker = markersRef.current[dev.dispositivo];
        marker.setLatLng([dev.lat, dev.lng]);
        marker.setStyle({
          radius: isSelected ? 16 : 13,
          fillColor: color,
          weight: isSelected ? 4 : 2.5,
          color: isSelected ? '#2563eb' : '#ffffff',
        });
      }
    });
  }, [devices, selectedDeviceId, onSelectDevice]);

  // Pan to selected device
  useEffect(() => {
    if (!selectedDeviceId || !mapInstanceRef.current || !devices[selectedDeviceId]) return;
    const dev = devices[selectedDeviceId];
    mapInstanceRef.current.panTo([dev.lat, dev.lng], { animate: true, duration: 0.8 });
  }, [selectedDeviceId, devices]);

  const deviceCount = Object.keys(devices).length;

  return (
    <div className="relative w-full h-full bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Devices List Overlay */}
      <div className="absolute top-20 left-6 z-[1000] flex flex-col gap-2 max-w-sm">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 text-slate-900 p-4 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5 font-bold text-slate-800">
              <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
              Painéis PMV Conectados
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200/60">
              {deviceCount} {deviceCount === 1 ? 'painel' : 'painéis'}
            </span>
          </div>

          {deviceCount === 0 ? (
            <div className="pt-3 pb-1 text-xs text-slate-500 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>Aguardando sinal MQTT dos painéis... Certifique-se de que o ESP32 está conectado ao mesmo Broker.</span>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              {(Object.values(devices) as DeviceStatus[]).map((dev) => {
                const isOffline = Date.now() - dev.lastSeen > 9000;
                const isSelected = selectedDeviceId === dev.dispositivo;
                return (
                  <button
                    key={dev.dispositivo}
                    onClick={() => onSelectDevice(dev.dispositivo)}
                    className={`flex items-center justify-between p-3 rounded-xl text-left text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-50/90 border border-blue-300 text-blue-950 shadow-xs ring-1 ring-blue-200'
                        : 'bg-slate-50 hover:bg-slate-100/90 border border-slate-200/70 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-3.5 h-3.5 rounded-full ring-2 ring-white shrink-0 shadow-xs ${
                          isOffline ? 'bg-slate-400' : dev.vermelho ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
                        }`}
                      />
                      <div>
                        <div className="font-bold text-slate-900">{dev.dispositivo}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          GPS: {dev.lat.toFixed(4)}, {dev.lng.toFixed(4)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isOffline
                            ? 'bg-slate-100 text-slate-500 border border-slate-200'
                            : dev.vermelho
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isOffline ? 'OFFLINE' : dev.vermelho ? 'VERMELHO' : 'VERDE'}
                      </span>
                      {dev.rssi !== undefined && (
                        <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-end gap-1 font-mono">
                          <Wifi className="w-2.5 h-2.5" />
                          {dev.rssi} dBm
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
