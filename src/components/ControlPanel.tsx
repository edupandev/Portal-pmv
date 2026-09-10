import React, { useState, useRef } from 'react';
import { DeviceMemoryConfig, DeviceStatus, PhaseConfig } from '../types/pmv';
import { P10Preview } from './P10Preview';
import { hexToRgb, PALETTE } from '../utils/colors';
import { mqttService } from '../services/mqttService';
import { X, Send, Sliders, Type, Palette, Paintbrush, AlignCenter, Clock, CheckCircle2, Smile, ArrowRight, RotateCw, ArrowLeft, Lock, ShieldAlert } from 'lucide-react';

interface ControlPanelProps {
  deviceId: string;
  deviceStatus?: DeviceStatus;
  memory: DeviceMemoryConfig;
  onUpdateMemory: (newMemory: DeviceMemoryConfig) => void;
  onClose: () => void;
}

const EMOJI_BUTTONS = [
  { label: '⚠️ Atenção', emoji: '⚠️' },
  { label: '🚗 Carro', emoji: '🚗' },
  { label: '🚧 Obras', emoji: '🚧' },
  { label: '⛔ Pare', emoji: '⛔' },
  { label: '➡️ Direita', emoji: '➡️' },
  { label: '⬅️ Esquerda', emoji: '⬅️' },
  { label: '⬆️ Cima', emoji: '⬆️' },
  { label: '⬇️ Baixo', emoji: '⬇️' },
  { label: '❤️ Coração', emoji: '❤️' },
  { label: '🙂 Feliz', emoji: '🙂' },
  { label: '❌ X', emoji: '❌' },
  { label: '✅ OK', emoji: '✅' },
];

const EMOJI_TOKEN_MAP: Record<string, string> = {
  '{warning}': '⚠️',
  '{atencao}': '⚠️',
  '{aviso}': '⚠️',
  '{alerta}': '⚠️',
  '{car}': '🚗',
  '{carro}': '🚗',
  '{veiculo}': '🚗',
  '{work}': '🚧',
  '{obras}': '🚧',
  '{obra}': '🚧',
  '{stop}': '⛔',
  '{pare}': '⛔',
  '{proibido}': '⛔',
  '{right}': '➡️',
  '{direita}': '➡️',
  '{left}': '⬅️',
  '{esquerda}': '⬅️',
  '{up}': '⬆️',
  '{cima}': '⬆️',
  '{down}': '⬇️',
  '{baixo}': '⬇️',
  '{heart}': '❤️',
  '{coracao}': '❤️',
  '{smile}': '🙂',
  '{feliz}': '🙂',
  '{sorriso}': '🙂',
  '{x}': '❌',
  '{erro}': '❌',
  '{fechado}': '❌',
  '{check}': '✅',
  '{ok}': '✅',
  '{certo}': '✅',
};

const normalizeTokensToEmojis = (text: string): string => {
  if (!text) return '';
  let result = text;
  for (const [token, emoji] of Object.entries(EMOJI_TOKEN_MAP)) {
    result = result.split(token).join(emoji);
    result = result.split(token.toUpperCase()).join(emoji);
  }
  return result;
};

export const ControlPanel: React.FC<ControlPanelProps> = ({
  deviceId,
  deviceStatus,
  memory,
  onUpdateMemory,
  onClose,
}) => {
  const [editingPhase, setEditingPhase] = useState<'red' | 'green'>('red');
  const [isSending, setIsSending] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const rawConfig: PhaseConfig = memory[editingPhase] || {
    text: editingPhase === 'red' ? '⛔ PARE\n🚧 OBRAS' : '🚗 SIGA LIVRE\n➡️ DESVIO',
    modo: editingPhase === 'red' ? 'fixed' : 'slide',
    tamanho: '2',
    cor: editingPhase === 'red' ? '#ff8c00' : '#00ff00',
    fundo: '#000000',
    align: 'center',
    valign: 'center',
    direcao: 'left',
    rotacaoTexto: 0,
  };

  const phaseConfig: PhaseConfig = {
    ...rawConfig,
    text: normalizeTokensToEmojis(rawConfig.text || ''),
  };

  const updatePhase = (updates: Partial<PhaseConfig>) => {
    const updatedPhase = { ...phaseConfig, ...updates };
    const newMem: DeviceMemoryConfig = {
      ...memory,
      [editingPhase]: updatedPhase,
    };
    onUpdateMemory(newMem);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = normalizeTokensToEmojis(e.target.value);
    const modo = phaseConfig.modo;
    const MAX = 22;

    if (modo === 'scroll') {
      updatePhase({ text: val });
      return;
    }

    const lines = val.split('\n');
    const newLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let l = lines[i];
      while (l.length > MAX) {
        let cut = l.lastIndexOf(' ', MAX);
        if (cut <= 0) cut = MAX;
        newLines.push(l.slice(0, cut).trimEnd());
        l = l.slice(cut).trimStart();
      }
      newLines.push(l);
    }

    updatePhase({ text: newLines.join('\n') });
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const cur = phaseConfig.text || '';

    if (textarea) {
      const start = textarea.selectionStart ?? cur.length;
      const end = textarea.selectionEnd ?? cur.length;
      const before = cur.substring(0, start);
      const after = cur.substring(end);

      const needsSpaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
      const prefix = needsSpaceBefore ? ' ' : '';
      const insertion = `${prefix}${emoji} `;

      const newText = `${before}${insertion}${after}`;
      updatePhase({ text: newText });

      setTimeout(() => {
        textarea.focus();
        const newPos = start + insertion.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 20);
    } else {
      const newText = cur ? `${cur} ${emoji}` : emoji;
      updatePhase({ text: newText });
    }
  };

  const isHardwareRed = deviceStatus ? deviceStatus.vermelho : true;
  const isOffline = deviceStatus ? Date.now() - deviceStatus.lastSeen > 9000 : true;

  const handleSendMqtt = () => {
    setIsSending(true);

    const lines = (phaseConfig.text || '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const payload = {
      target: deviceId,
      destino: deviceId,
      alerta: editingPhase === 'red',
      modo: phaseConfig.modo,
      align: phaseConfig.align,
      alinhamento: phaseConfig.align,
      valign: phaseConfig.valign,
      direcao: phaseConfig.direcao || 'left',
      rotacaoTexto: phaseConfig.rotacaoTexto || 0,
      mensagens: lines,
      texto: lines.join('\n'),
      tamanho: parseInt(phaseConfig.tamanho, 10),
      cor: hexToRgb(phaseConfig.cor),
      corFundo: hexToRgb(phaseConfig.fundo),
      velocidade: memory.velocidade || 3000,
    };

    mqttService.sendDeviceCommand(deviceId, payload);

    setTimeout(() => {
      setIsSending(false);
      setSuccessToast(`Comando transmitido para "${deviceId}" via MQTT!`);
      setTimeout(() => setSuccessToast(null), 4000);
    }, 400);
  };

  const textLines = (phaseConfig.text || '').split('\n');
  const maxLineLength = textLines.reduce((max, l) => Math.max(max, l.length), 0);

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 text-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition shadow-xs"
            >
              <ArrowLeft className="w-4 h-4 text-blue-600" />
              <span>Voltar ao Mapa</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 tracking-wide uppercase">CONFIGURAÇÃO DO PAINEL</h2>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200/60">
                  {deviceId}
                </span>
              </div>
              <p className="text-xs text-slate-500">Controle Centralizado • Textos, Sprites P8 e LED</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Hardware Status Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="flex flex-col gap-1.5 p-2 bg-slate-900 rounded-xl border border-slate-800 shadow-inner">
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                    isHardwareRed ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-slate-700'
                  }`}
                />
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                    !isHardwareRed ? 'bg-emerald-500 shadow-[0_0_10px_#22c55e]' : 'bg-slate-700'
                  }`}
                />
              </div>
              <div>
                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">ESTADO DO SEMÁFORO (PIN 32)</div>
                <div className="text-sm font-bold text-slate-900">
                  {isOffline ? 'DESCONECTADO' : isHardwareRed ? 'FASE VERMELHA ATIVA (ALTERAÇÕES LIBERADAS)' : 'FASE VERDE ATIVA (SINAL ABERTO)'}
                </div>
                <div className="text-[11px] font-mono mt-0.5 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOffline ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'
                    }`}
                  />
                  <span className={isOffline ? 'text-slate-500' : 'text-emerald-700 font-bold'}>
                    {isOffline ? '● OFFLINE' : '● ONLINE (MQTT)'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              {deviceStatus?.rssi && (
                <div className="font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-xs">
                  Sinal: {deviceStatus.rssi} dBm
                </div>
              )}
            </div>
          </div>

        {/* Live Matrix Canvas Preview */}
        <div>
          <P10Preview config={phaseConfig} speed={memory.velocidade || 3000} isLiveActive={!isOffline} />
        </div>

        {/* Phase Selector Buttons */}
        <div>
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
            FASE EM EDIÇÃO:
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setEditingPhase('red')}
              className={`p-3.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs ${
                editingPhase === 'red'
                  ? 'bg-rose-50 border-rose-400 text-rose-800 ring-1 ring-rose-300'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              FASE VERMELHA (PARE)
            </button>
            <button
              onClick={() => setEditingPhase('green')}
              className={`p-3.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs ${
                editingPhase === 'green'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-1 ring-emerald-300'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              FASE VERDE (SIGA)
            </button>
          </div>
        </div>

        {/* Emoji / Symbols Toolbar */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Smile className="w-3.5 h-3.5 text-blue-600" /> Inserir Emojis / Símbolos Rápidos:
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Sprites P8</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_BUTTONS.map((em) => (
              <button
                key={em.emoji}
                type="button"
                onClick={() => insertEmoji(em.emoji)}
                className="px-2.5 py-1.5 bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-200 rounded-lg text-xs font-semibold transition shadow-2xs hover:border-blue-300 flex items-center gap-1.5 active:scale-95"
              >
                <span className="text-sm">{em.emoji}</span>
                <span className="text-[11px] text-slate-600">{em.label.replace(em.emoji, '').trim()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-blue-600" />
              MENSAGENS (ENTER = NOVA LINHA / TELA)
            </label>
            <span
              className={`text-[11px] font-mono font-medium ${
                phaseConfig.modo === 'scroll'
                  ? 'text-slate-500'
                  : maxLineLength >= 20
                  ? 'text-amber-600 font-bold'
                  : 'text-slate-500'
              }`}
            >
              {phaseConfig.modo === 'scroll' ? 'Scroll livre' : `${maxLineLength}/20 caracteres max`}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={phaseConfig.text || ''}
            onChange={handleTextChange}
            rows={4}
            placeholder="Digite mensagens ou clique nos emojis acima&#10;Ex: ⚠️ ATENÇÃO&#10;🚗 REDUZA A VELOCIDADE"
            className="w-full bg-white border border-slate-300 rounded-xl p-3.5 text-sm text-slate-900 font-sans placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-xs"
          />
        </div>

        {/* Display Mode & Font Size */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1.5 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-blue-600" /> Modo de Exibição
            </label>
            <select
              value={phaseConfig.modo}
              onChange={(e) => updatePhase({ modo: e.target.value as any })}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-xs"
            >
              <option value="fixed">Fixo (Estático)</option>
              <option value="slide">Slide (Alternado)</option>
              <option value="scroll">Scroll (Corrido)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1.5 flex items-center gap-1">
              <Type className="w-3.5 h-3.5 text-blue-600" /> Tamanho da Fonte
            </label>
            <select
              value={phaseConfig.tamanho}
              onChange={(e) => updatePhase({ tamanho: e.target.value as any })}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-xs"
            >
              <option value="1">Pequeno (7pt)</option>
              <option value="2">Médio (8pt - Padrão)</option>
              <option value="3">Grande (9pt)</option>
            </select>
          </div>
        </div>

        {/* Scroll Direction & Text Rotation (if Scroll) */}
        {phaseConfig.modo === 'scroll' && (
          <div className="grid grid-cols-2 gap-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
            <div>
              <label className="text-xs font-bold text-blue-900 block mb-1.5 flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5 text-blue-600" /> Direção do Scroll
              </label>
              <select
                value={phaseConfig.direcao || 'left'}
                onChange={(e) => updatePhase({ direcao: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 shadow-xs"
              >
                <option value="left">Da Direita para Esquerda (←)</option>
                <option value="right">Da Esquerda para Direita (→)</option>
                <option value="up">De Baixo para Cima (↑)</option>
                <option value="down">De Cima para Baixo (↓)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-blue-900 block mb-1.5 flex items-center gap-1">
                <RotateCw className="w-3.5 h-3.5 text-blue-600" /> Rotação do Texto
              </label>
              <select
                value={phaseConfig.rotacaoTexto || 0}
                onChange={(e) => updatePhase({ rotacaoTexto: parseInt(e.target.value, 10) as any })}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 shadow-xs"
              >
                <option value={0}>0° (Horizontal Padrão)</option>
                <option value={90}>90° (Vertical)</option>
                <option value={180}>180° (Invertido)</option>
                <option value={270}>270° (Vertical Invertido)</option>
              </select>
            </div>
          </div>
        )}

        {/* Alignments */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1.5 flex items-center gap-1">
              <AlignCenter className="w-3.5 h-3.5 text-blue-600" /> Alinhamento Horizontal
            </label>
            <select
              value={phaseConfig.align || 'center'}
              onChange={(e) => updatePhase({ align: e.target.value as any })}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-xs"
            >
              <option value="center">Centralizado</option>
              <option value="left">Alinhado à Esquerda</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1.5 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-blue-600" /> Posição Vertical
            </label>
            <select
              value={phaseConfig.valign || 'center'}
              onChange={(e) => updatePhase({ valign: e.target.value as any })}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-xs"
            >
              <option value="top">Topo</option>
              <option value="center">Centro</option>
              <option value="bottom">Rodapé</option>
            </select>
          </div>
        </div>

        {/* Cores: Texto e Fundo da Matriz */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Text Color Picker */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-blue-600" /> Cor dos LEDs (Texto)
                </label>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  {PALETTE.find((p) => p.hex.toLowerCase() === phaseConfig.cor?.toLowerCase())?.label || phaseConfig.cor}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {PALETTE.filter((p) => p.hex !== '#000000').map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    title={p.label}
                    onClick={() => updatePhase({ cor: p.hex })}
                    style={{ backgroundColor: p.hex }}
                    className={`w-7 h-7 rounded-lg transition-transform border-2 ${
                      phaseConfig.cor?.toLowerCase() === p.hex.toLowerCase()
                        ? 'border-blue-600 scale-110 shadow-md ring-2 ring-blue-300'
                        : 'border-slate-300 hover:scale-105 shadow-xs'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Background Color Picker */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Paintbrush className="w-3.5 h-3.5 text-indigo-600" /> Cor de Fundo (Matriz)
                </label>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  {(phaseConfig.fundo || '#000000').toLowerCase() === '#000000'
                    ? 'Preto (Apagado)'
                    : PALETTE.find((p) => p.hex.toLowerCase() === phaseConfig.fundo?.toLowerCase())?.label || phaseConfig.fundo}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {PALETTE.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    title={p.hex === '#000000' ? 'Preto (LEDs de fundo desligados - Padrão)' : p.label}
                    onClick={() => updatePhase({ fundo: p.hex })}
                    style={{ backgroundColor: p.hex }}
                    className={`w-7 h-7 rounded-lg transition-transform border-2 relative flex items-center justify-center ${
                      (phaseConfig.fundo || '#000000').toLowerCase() === p.hex.toLowerCase()
                        ? 'border-indigo-600 scale-110 shadow-md ring-2 ring-indigo-300'
                        : 'border-slate-300 hover:scale-105 shadow-xs'
                    }`}
                  >
                    {p.hex === '#000000' && (
                      <span className="text-[8px] font-bold text-slate-500 select-none">OFF</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Aviso se texto e fundo forem iguais */}
          {phaseConfig.cor?.toLowerCase() === (phaseConfig.fundo || '#000000').toLowerCase() && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
              <span className="font-bold">⚠️ Atenção:</span> A cor do texto e a cor de fundo estão idênticas. O texto pode ficar invisível no painel.
            </div>
          )}
        </div>

        {/* Speed setting */}
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1.5 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-600" /> Intervalo / Velocidade ({memory.velocidade || 3000} ms)
          </label>
          <input
            type="range"
            min="1000"
            max="8000"
            step="500"
            value={memory.velocidade || 3000}
            onChange={(e) => onUpdateMemory({ ...memory, velocidade: parseInt(e.target.value, 10) })}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>

        {successToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}
      </div>

      {/* Footer Send Action */}
      <div className="p-5 border-t border-slate-200 bg-slate-50/90">
        <button
          onClick={handleSendMqtt}
          disabled={isSending}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 text-sm"
        >
          {isSending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {isSending ? 'PUBLICANDO MQTT...' : `SALVAR & TRANSMITIR PARA ${deviceId.toUpperCase()}`}
        </button>
      </div>
    </div>
  </div>
  );
};
