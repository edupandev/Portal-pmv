import React, { useState, useEffect, useRef } from 'react';
import { MqttPacketLog } from '../types/pmv';
import { mqttService } from '../services/mqttService';
import { Terminal, ArrowDownLeft, ArrowUpRight, Trash2, Send, Filter } from 'lucide-react';

interface MqttConsoleProps {
  onClose: () => void;
}

export const MqttConsole: React.FC<MqttConsoleProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<MqttPacketLog[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [manualTopic, setManualTopic] = useState('auth/request');
  const [manualPayload, setManualPayload] = useState('{"id":"TEST_01","user":"geral3","pass":"123"}');
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = mqttService.onPacket((pkt) => {
      setLogs((prev) => [...prev.slice(-100), pkt]);
    });
    return unsub;
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSendManual = () => {
    if (!manualTopic.trim()) return;
    mqttService.publish(manualTopic.trim(), manualPayload.trim(), 'other');
  };

  const filteredLogs = logs.filter((log) => {
    if (filterType === 'all') return true;
    return log.type === filterType;
  });

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Inspetor de Tráfego MQTT em Tempo Real</h2>
              <p className="text-xs text-slate-500">Monitore pacotes enviados e recebidos pelo Broker</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLogs([])}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition border border-transparent hover:border-rose-200"
              title="Limpar Logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition border border-slate-200 shadow-xs"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-2.5 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600 font-semibold">Filtrar:</span>
            {['all', 'status', 'sync', 'auth', 'command'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-md uppercase text-[10px] font-bold transition shadow-xs ${
                  filterType === t
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Total gravado: <strong className="text-slate-900">{filteredLogs.length}</strong> pacotes
          </div>
        </div>

        {/* Packet Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-900 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Terminal className="w-8 h-8 opacity-40 text-slate-300" />
              <span>Nenhum pacote MQTT registrado no momento.</span>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isOut = log.direction === 'out';
              return (
                <div
                  key={log.id}
                  className={`p-2.5 rounded-lg border flex flex-col gap-1 transition ${
                    isOut
                      ? 'bg-blue-950/40 border-blue-800/50 text-blue-300'
                      : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-bold">
                      {isOut ? (
                        <span className="flex items-center gap-1 text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded">
                          <ArrowUpRight className="w-3 h-3" /> OUT (SITE)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                          <ArrowDownLeft className="w-3 h-3" /> IN (ESP32)
                        </span>
                      )}
                      <span className="text-slate-200">{log.topic}</span>
                    </div>
                    <span className="text-slate-400 text-[10px]">{log.timestamp}</span>
                  </div>
                  <pre className="text-[11px] text-slate-200 overflow-x-auto whitespace-pre-wrap break-all bg-black/40 p-2 rounded">
                    {log.payload}
                  </pre>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Manual Message Publisher (Test tool) */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/90 space-y-2">
          <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-blue-600" />
            Transmissão Manual de Teste (Injetar pacote MQTT):
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={manualTopic}
              onChange={(e) => setManualTopic(e.target.value)}
              placeholder="Tópico (ex: auth/request)"
              className="sm:w-1/3 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-xs"
            />
            <input
              type="text"
              value={manualPayload}
              onChange={(e) => setManualPayload(e.target.value)}
              placeholder="Payload JSON"
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-xs"
            />
            <button
              onClick={handleSendManual}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" /> Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
