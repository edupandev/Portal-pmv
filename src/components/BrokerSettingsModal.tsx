import React, { useState } from 'react';
import { BrokerOption } from '../types/pmv';
import { BROKER_OPTIONS } from '../services/mqttService';
import { X, Server, Check, Globe } from 'lucide-react';

interface BrokerSettingsModalProps {
  currentBroker: BrokerOption;
  onSelectBroker: (broker: BrokerOption) => void;
  onClose: () => void;
}

export const BrokerSettingsModal: React.FC<BrokerSettingsModalProps> = ({
  currentBroker,
  onSelectBroker,
  onClose,
}) => {
  const [selectedId, setSelectedId] = useState(currentBroker.id);
  const [customWebUrl, setCustomWebUrl] = useState('wss://broker.hivemq.com:8884/mqtt');
  const [customHost, setCustomHost] = useState('broker.hivemq.com');
  const [customPort, setCustomPort] = useState(1883);

  const handleSave = () => {
    if (selectedId === 'custom') {
      const customBroker: BrokerOption = {
        id: 'custom',
        name: 'Broker Personalizado',
        webUrl: customWebUrl,
        esp32Host: customHost,
        esp32Port: customPort,
        description: 'Servidor MQTT personalizado configurado pelo usuário.',
        isCustom: true,
      };
      onSelectBroker(customBroker);
    } else {
      const found = BROKER_OPTIONS.find((b) => b.id === selectedId);
      if (found) {
        onSelectBroker(found);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Configuração do Broker MQTT</h2>
              <p className="text-xs text-slate-500">
                Selecione o servidor MQTT compartilhado entre o Site e o ESP32
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="space-y-3">
            {BROKER_OPTIONS.map((broker) => {
              const isSelected = selectedId === broker.id;
              return (
                <div
                  key={broker.id}
                  onClick={() => setSelectedId(broker.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-400 text-slate-900 shadow-xs ring-1 ring-blue-200'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                      <Globe className="w-4 h-4 text-blue-600" />
                      {broker.name}
                    </div>
                    <p className="text-slate-500 text-xs">{broker.description}</p>
                    <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-600">
                      <span>• Web WSS: <strong className="text-emerald-700">{broker.webUrl}</strong></span>
                      <span>• ESP32 Host: <strong className="text-blue-700">{broker.esp32Host}:{broker.esp32Port}</strong></span>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>
              );
            })}

            {/* Custom option */}
            <div
              onClick={() => setSelectedId('custom')}
              className={`p-4 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                selectedId === 'custom'
                  ? 'bg-blue-50/90 border-blue-400 text-slate-900 shadow-xs ring-1 ring-blue-200'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <div className="space-y-2 w-full">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <Server className="w-4 h-4 text-blue-600" />
                  Broker MQTT Personalizado (Servidor Próprio / Mosquitto local)
                </div>
                {selectedId === 'custom' && (
                  <div className="pt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        URL WebSocket Web (WSS):
                      </label>
                      <input
                        type="text"
                        value={customWebUrl}
                        onChange={(e) => setCustomWebUrl(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Host ESP32 (TCP):
                        </label>
                        <input
                          type="text"
                          value={customHost}
                          onChange={(e) => setCustomHost(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Porta TCP ESP32:
                        </label>
                        <input
                          type="number"
                          value={customPort}
                          onChange={(e) => setCustomPort(parseInt(e.target.value, 10))}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  selectedId === 'custom' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                }`}
              >
                {selectedId === 'custom' && <Check className="w-3.5 h-3.5" />}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition border border-slate-200 shadow-xs"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="py-2 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20"
          >
            Salvar e Reconectar
          </button>
        </div>
      </div>
    </div>
  );
};
