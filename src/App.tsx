import React, { useState, useEffect } from 'react';
import { BrokerOption, DeviceMemoryConfig, DeviceStatus, SyncPayload } from './types/pmv';
import { BROKER_OPTIONS, mqttService } from './services/mqttService';
import { virtualEsp32 } from './services/virtualEsp32';
import { rgb565ToHex } from './utils/colors';

import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { ControlPanel } from './components/ControlPanel';
import { LoginModal } from './components/LoginModal';
import { BrokerSettingsModal } from './components/BrokerSettingsModal';
import { Esp32DiagnosticModal } from './components/Esp32DiagnosticModal';
import { MqttConsole } from './components/MqttConsole';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('sacc_auth') === 'true';
  });
  const [currentUser, setCurrentUser] = useState<string>(() => {
    return localStorage.getItem('sacc_user') || 'geral3';
  });

  const [currentBroker, setCurrentBroker] = useState<BrokerOption>(BROKER_OPTIONS[0]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('connecting');

  // Modals & Panels
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [showConsoleModal, setShowConsoleModal] = useState(false);
  const [isSimRunning, setIsSimRunning] = useState(false);

  // Devices & Memory
  const [devices, setDevices] = useState<Record<string, DeviceStatus>>({});
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [devicesMemory, setDevicesMemory] = useState<Record<string, DeviceMemoryConfig>>(() => {
    try {
      const saved = localStorage.getItem('pmv_multi_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      Portal: {
        red: {
          text: 'PARE\nOBRAS',
          modo: 'fixed',
          tamanho: '2',
          cor: '#ff8c00',
          fundo: '#000000',
          align: 'center',
          valign: 'center',
        },
        green: {
          text: 'SIGA\nLIVRE',
          modo: 'slide',
          tamanho: '2',
          cor: '#00ff00',
          fundo: '#000000',
          align: 'center',
          valign: 'center',
        },
        velocidade: 3000,
      },
    };
  });

  // Track connection status
  useEffect(() => {
    const unsub = mqttService.onStatusChange((status) => {
      setConnectionStatus(status);
    });
    return unsub;
  }, []);

  // Track incoming Device Status
  useEffect(() => {
    const unsubStatus = mqttService.onDeviceStatus((devStatus) => {
      setDevices((prev) => ({
        ...prev,
        [devStatus.dispositivo]: devStatus,
      }));

      // Initialize default memory if not present
      setDevicesMemory((prev) => {
        if (!prev[devStatus.dispositivo]) {
          const updated = {
            ...prev,
            [devStatus.dispositivo]: {
              red: {
                text: 'PARE\nOBRAS',
                modo: 'fixed',
                tamanho: '2',
                cor: '#ff8c00',
                fundo: '#000000',
                align: 'center',
                valign: 'center',
              },
              green: {
                text: 'SIGA\nLIVRE',
                modo: 'slide',
                tamanho: '2',
                cor: '#00ff00',
                fundo: '#000000',
                align: 'center',
                valign: 'center',
              },
              velocidade: 3000,
            },
          };
          localStorage.setItem('pmv_multi_v1', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    });

    return unsubStatus;
  }, []);

  // Track Sync payload from hardware
  useEffect(() => {
    const unsubSync = mqttService.onSync((sync: SyncPayload) => {
      const id = sync.target;
      if (!id) return;

      const rText = Array.isArray(sync.mensagensRed) ? sync.mensagensRed.join('\n') : '';
      const gText = Array.isArray(sync.mensagensGreen) ? sync.mensagensGreen.join('\n') : '';

      setDevicesMemory((prev) => {
        const existing = prev[id] || {
          red: { text: '', modo: 'fixed', tamanho: '2', cor: '#ff8c00', fundo: '#000000', align: 'center', valign: 'center' },
          green: { text: '', modo: 'slide', tamanho: '2', cor: '#00ff00', fundo: '#000000', align: 'center', valign: 'center' },
        };

        const updated = {
          ...prev,
          [id]: {
            ...existing,
            red: {
              ...existing.red,
              text: rText || existing.red.text,
              modo: sync.r_modo || existing.red.modo,
              tamanho: (String(sync.r_tam || existing.red.tamanho) as any),
              cor: sync.r_cor ? rgb565ToHex(sync.r_cor) : existing.red.cor,
              align: sync.r_align || existing.red.align || 'center',
              valign: sync.r_valign || existing.red.valign || 'center',
            },
            green: {
              ...existing.green,
              text: gText || existing.green.text,
              modo: sync.g_modo || existing.green.modo,
              tamanho: (String(sync.g_tam || existing.green.tamanho) as any),
              cor: sync.g_cor ? rgb565ToHex(sync.g_cor) : existing.green.cor,
              align: sync.g_align || existing.green.align || 'center',
              valign: sync.g_valign || existing.green.valign || 'center',
            },
            velocidade: sync.velocidade || existing.velocidade || 3000,
          },
        };

        localStorage.setItem('pmv_multi_v1', JSON.stringify(updated));
        return updated;
      });
    });

    return unsubSync;
  }, []);

  const handleLoginSuccess = (user: string) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('sacc_auth', 'true');
    localStorage.setItem('sacc_user', user);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('sacc_auth');
  };

  const handleSelectBroker = (broker: BrokerOption) => {
    setCurrentBroker(broker);
    mqttService.connect(broker);
  };

  const handleToggleSimulator = () => {
    if (isSimRunning) {
      virtualEsp32.stop();
      setIsSimRunning(false);
    } else {
      virtualEsp32.start();
      setIsSimRunning(true);
    }
  };

  const handleUpdateMemory = (newMem: DeviceMemoryConfig) => {
    if (!selectedDeviceId) return;
    setDevicesMemory((prev) => {
      const updated = {
        ...prev,
        [selectedDeviceId]: newMem,
      };
      localStorage.setItem('pmv_multi_v1', JSON.stringify(updated));
      return updated;
    });
  };

  const selectedDeviceStatus = selectedDeviceId ? devices[selectedDeviceId] : undefined;
  const currentDeviceMem: DeviceMemoryConfig = (selectedDeviceId && devicesMemory[selectedDeviceId]) || {
    red: { text: 'PARE\nOBRAS', modo: 'fixed', tamanho: '2', cor: '#ff8c00', fundo: '#000000', align: 'center', valign: 'center' },
    green: { text: 'SIGA\nLIVRE', modo: 'slide', tamanho: '2', cor: '#00ff00', fundo: '#000000', align: 'center', valign: 'center' },
    velocidade: 3000,
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        currentBroker={currentBroker}
        connectionStatus={connectionStatus}
        isSimRunning={isSimRunning}
        onToggleSimulator={handleToggleSimulator}
        onOpenBrokerSettings={() => setShowBrokerModal(true)}
        onOpenDiagnostics={() => setShowDiagnosticModal(true)}
        onOpenConsole={() => setShowConsoleModal(true)}
        onLogout={handleLogout}
        currentUser={currentUser}
      />

      {/* Main Map Canvas Area */}
      <main className="flex-1 w-full h-full relative pt-16">
        <MapView
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={(id) => setSelectedDeviceId(id)}
        />

        {/* Selected Device Drawer Panel */}
        {selectedDeviceId && (
          <ControlPanel
            deviceId={selectedDeviceId}
            deviceStatus={selectedDeviceStatus}
            memory={currentDeviceMem}
            onUpdateMemory={handleUpdateMemory}
            onClose={() => setSelectedDeviceId(null)}
          />
        )}
      </main>

      {/* Login Screen (Modal) */}
      {!isAuthenticated && (
        <LoginModal
          currentBroker={currentBroker}
          onSuccess={handleLoginSuccess}
          onOpenBrokerSettings={() => setShowBrokerModal(true)}
          onOpenDiagnostics={() => setShowDiagnosticModal(true)}
        />
      )}

      {/* Broker Settings Modal */}
      {showBrokerModal && (
        <BrokerSettingsModal
          currentBroker={currentBroker}
          onSelectBroker={handleSelectBroker}
          onClose={() => setShowBrokerModal(false)}
        />
      )}

      {/* ESP32 Diagnostic & Complete Code Modal */}
      {showDiagnosticModal && (
        <Esp32DiagnosticModal onClose={() => setShowDiagnosticModal(false)} />
      )}

      {/* MQTT Packet Inspector Console */}
      {showConsoleModal && (
        <MqttConsole onClose={() => setShowConsoleModal(false)} />
      )}
    </div>
  );
}
