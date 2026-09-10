import React from 'react';
import { BrokerOption } from '../types/pmv';
import {
  Server,
  LogOut,
  RefreshCw,
  MapPin,
  Sliders,
} from 'lucide-react';
import { mqttService } from '../services/mqttService';

interface HeaderProps {
  currentBroker: BrokerOption;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  selectedDeviceId: string | null;
  onOpenBrokerSettings: () => void;
  onBackToMap: () => void;
  onLogout: () => void;
  currentUser: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentBroker,
  connectionStatus,
  selectedDeviceId,
  onOpenBrokerSettings,
  onBackToMap,
  onLogout,
  currentUser,
}) => {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Conectado
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
    <header className="fixed top-0 inset-x-0 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 z-[1500] px-4 sm:px-6 flex items-center justify-between shadow-xs">
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
            <p className="text-[11px] text-slate-500 hidden sm:block">Painel de Mensagens Variáveis • Central do Operador</p>
          </div>
        </div>
      </div>

      {/* Navigation / View state tabs */}
      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          onClick={onBackToMap}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            !selectedDeviceId
              ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          <span>Mapa de PMVs</span>
        </button>

        {selectedDeviceId && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-blue-700 shadow-xs border border-slate-200/60 animate-in fade-in">
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span>Configurando: {selectedDeviceId}</span>
          </div>
        )}
      </div>

      {/* Right Controls & Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Connection status indicator */}
        <div className="hidden md:flex">{getStatusBadge()}</div>

        {/* Sync request trigger button */}
        <button
          onClick={() => mqttService.requestSync('all')}
          title="Requisitar Sincronização dos painéis"
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition shadow-xs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

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

        {/* User Badge & Logout */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-700 px-2 hidden sm:inline">
            {currentUser}
          </span>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition"
            title={`Sair (${currentUser})`}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

