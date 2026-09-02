import React from 'react';
import { BrokerOption } from '../types/pmv';
import {
  Server,
  Terminal,
  Cpu,
  LogOut,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { virtualEsp32 } from '../services/virtualEsp32';
import { mqttService } from '../services/mqttService';

interface HeaderProps {
  currentBroker: BrokerOption;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  isSimRunning: boolean;
  onToggleSimulator: () => void;
  onOpenBrokerSettings: () => void;
  onOpenDiagnostics: () => void;
  onOpenConsole: () => void;
  onLogout: () => void;
  currentUser: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentBroker,
  connectionStatus,
  isSimRunning,
  onToggleSimulator,
  onOpenBrokerSettings,
  onOpenDiagnostics,
  onOpenConsole,
  onLogout,
  currentUser,
}) => {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            MQTT Conectado
          </span>
        );
      case 'connecting':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            Conectando...
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Desconectado
          </span>
        );
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 z-[1500] px-4 sm:px-6 flex items-center justify-between shadow-xs">
      {/* Brand & App Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-blue-500/20">
            P10
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black tracking-wider text-base text-slate-900">SACC</span>
              <span className="font-semibold text-[11px] text-blue-700 uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200/60">
                PMV CONTROLLER
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">Painel de Mensagens Variáveis • ESP32 Matrix</p>
          </div>
        </div>
      </div>

      {/* Right Controls & Navigation */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Connection status indicator */}
        <div className="hidden md:flex">{getStatusBadge()}</div>

        {/* Sync request trigger button */}
        <button
          onClick={() => mqttService.requestSync('all')}
          title="Requisitar Sincronização de todos os painéis"
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition shadow-xs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Hardware Simulator Toggle */}
        <button
          onClick={onToggleSimulator}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition border shadow-xs ${
            isSimRunning
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
          }`}
          title="Simula um ESP32 virtual para testar o site sem o hardware físico"
        >
          <Radio className={`w-3.5 h-3.5 ${isSimRunning ? 'text-indigo-600 animate-pulse' : ''}`} />
          <span className="hidden lg:inline">Simulador ESP32:</span>
          <span>{isSimRunning ? 'LIGADO' : 'DESLIGADO'}</span>
        </button>

        {/* If simulator is running, allow toggling physical PIN 32 (Red/Green Phase) */}
        {isSimRunning && (
          <button
            onClick={() => virtualEsp32.togglePhase()}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition shadow-xs ${
              virtualEsp32.isRedPhase
                ? 'bg-rose-50 border-rose-300 text-rose-700'
                : 'bg-emerald-50 border-emerald-300 text-emerald-700'
            }`}
            title="Alterna o pino físico PIN_STATUS do simulador"
          >
            Fase: {virtualEsp32.isRedPhase ? 'Vermelha' : 'Verde'}
          </button>
        )}

        {/* MQTT Broker Settings */}
        <button
          onClick={onOpenBrokerSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition shadow-xs"
          title="Configurações do Servidor MQTT"
        >
          <Server className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Broker:</span>
          <span className="font-mono font-bold text-blue-700">{currentBroker.id.toUpperCase()}</span>
        </button>

        {/* MQTT Inspector Console */}
        <button
          onClick={onOpenConsole}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition shadow-xs"
          title="Abrir Console MQTT em tempo real"
        >
          <Terminal className="w-4 h-4 text-emerald-600" />
        </button>

        {/* ESP32 Code & Diagnosis */}
        <button
          onClick={onOpenDiagnostics}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold transition shadow-xs"
          title="Ver o código C++ corrigido do ESP32"
        >
          <Cpu className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden sm:inline">Código ESP32</span>
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 border border-slate-200 transition shadow-xs"
          title={`Sair (${currentUser})`}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
