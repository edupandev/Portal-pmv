import React, { useEffect, useRef, useState } from 'react';
import { PhaseConfig } from '../types/pmv';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';

interface P10PreviewProps {
  config: PhaseConfig;
  speed?: number; // ms for slide
  isLiveActive?: boolean;
}

const LED_COLS = 120; // 3 painéis P8 (40x3) = 120 cols
const LED_ROWS = 40;  // 2 painéis P8 (20x2) = 40 rows
const LED_PX = 6;
const ALTURA_GRANDE = 14;
const ALTURA_MEDIO = 12;
const ALTURA_PEQUENO = 10;

const ACENTO_MAP: Record<string, { base: string; tipo: number; M: boolean }> = {
  'À': { base: 'A', tipo: 3, M: true },
  'Á': { base: 'A', tipo: 2, M: true },
  'Â': { base: 'A', tipo: 1, M: true },
  'Ã': { base: 'A', tipo: 4, M: true },
  'Ç': { base: 'C', tipo: 5, M: true },
  'È': { base: 'E', tipo: 3, M: true },
  'É': { base: 'E', tipo: 2, M: true },
  'Ê': { base: 'E', tipo: 1, M: true },
  'Ì': { base: 'I', tipo: 3, M: true },
  'Í': { base: 'I', tipo: 2, M: true },
  'Î': { base: 'I', tipo: 1, M: true },
  'Ò': { base: 'O', tipo: 3, M: true },
  'Ó': { base: 'O', tipo: 2, M: true },
  'Ô': { base: 'O', tipo: 1, M: true },
  'Õ': { base: 'O', tipo: 4, M: true },
  'Ù': { base: 'U', tipo: 3, M: true },
  'Ú': { base: 'U', tipo: 2, M: true },
  'Û': { base: 'U', tipo: 1, M: true },
  'à': { base: 'a', tipo: 3, M: false },
  'á': { base: 'a', tipo: 2, M: false },
  'â': { base: 'a', tipo: 1, M: false },
  'ã': { base: 'a', tipo: 4, M: false },
  'ç': { base: 'c', tipo: 5, M: false },
  'è': { base: 'e', tipo: 3, M: false },
  'é': { base: 'e', tipo: 2, M: false },
  'ê': { base: 'e', tipo: 1, M: false },
  'ì': { base: 'i', tipo: 3, M: false },
  'í': { base: 'i', tipo: 2, M: false },
  'î': { base: 'i', tipo: 1, M: false },
  'ò': { base: 'o', tipo: 3, M: false },
  'ó': { base: 'o', tipo: 2, M: false },
  'ô': { base: 'o', tipo: 1, M: false },
  'õ': { base: 'o', tipo: 4, M: false },
  'ù': { base: 'u', tipo: 3, M: false },
  'ú': { base: 'u', tipo: 2, M: false },
  'û': { base: 'u', tipo: 1, M: false },
};

export const P10Preview: React.FC<P10PreviewProps> = ({ config, speed = 3000, isLiveActive = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [slideProgress, setSlideProgress] = useState(0);
  const scrollPosRef = useRef(LED_COLS);

  const rawLines = (config.text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const totalSlides = rawLines.length > 0 ? rawLines.length : 1;
  const currentSlide = rawLines.length > 0 ? slideIndex % totalSlides : 0;

  useEffect(() => {
    scrollPosRef.current = config.direcao === 'right' ? -50 : (config.direcao === 'up' ? LED_ROWS + 10 : (config.direcao === 'down' ? -15 : LED_COLS));
    setSlideIndex(0);
    setSlideProgress(0);
  }, [config.text, config.modo, config.direcao]);

  useEffect(() => {
    if (config.modo !== 'slide' || isPaused || rawLines.length <= 1) return;

    const intervalTime = Math.max(1000, speed || 3000);
    const stepTime = 50;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += stepTime;
      setSlideProgress(Math.min(100, (elapsed / intervalTime) * 100));

      if (elapsed >= intervalTime) {
        elapsed = 0;
        setSlideIndex((prev) => (prev + 1) % rawLines.length);
        setSlideProgress(0);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [config.modo, isPaused, speed, rawLines.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = LED_COLS;
    offCanvas.height = LED_ROWS;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return;

    let animId: number;

    function getFontSpec(tamanho: string) {
      if (tamanho === '3') return { size: 14, bold: true, alt: ALTURA_GRANDE };
      if (tamanho === '1') return { size: 10, bold: false, alt: ALTURA_PEQUENO };
      return { size: 12, bold: true, alt: ALTURA_MEDIO };
    }

    function calcYSingle(valign: string, altLetra: number) {
      if (valign === 'top') {
        return altLetra + 2;
      } else if (valign === 'bottom') {
        return LED_ROWS - 3;
      } else {
        return Math.floor((LED_ROWS - altLetra) / 2) + altLetra;
      }
    }

    function calcYDual(valign: string, altLetra: number) {
      const espaco = 2;
      const bloco = altLetra * 2 + espaco;
      let topo = 0;

      if (valign === 'top') {
        topo = 2;
      } else if (valign === 'bottom') {
        topo = LED_ROWS - bloco - 2;
      } else {
        topo = Math.floor((LED_ROWS - bloco) / 2);
      }

      return {
        y1: topo + altLetra,
        y2: topo + altLetra * 2 + espaco,
      };
    }

    function desenharAcento(tipo: number, bx: number, by: number, maiuscula: boolean, cor: string) {
      if (!offCtx) return;
      const oy = maiuscula ? -10 : -7;
      offCtx.fillStyle = cor;
      switch (tipo) {
        case 1:
          offCtx.fillRect(bx + 2, by + oy, 1, 1);
          offCtx.fillRect(bx + 1, by + oy + 1, 1, 1);
          offCtx.fillRect(bx + 3, by + oy + 1, 1, 1);
          break;
        case 2:
          offCtx.fillRect(bx + 2, by + oy, 1, 1);
          offCtx.fillRect(bx + 1, by + oy + 1, 1, 1);
          break;
        case 3:
          offCtx.fillRect(bx + 1, by + oy, 1, 1);
          offCtx.fillRect(bx + 2, by + oy + 1, 1, 1);
          break;
        case 4:
          offCtx.fillRect(bx + 1, by + oy, 1, 1);
          offCtx.fillRect(bx + 3, by + oy, 1, 1);
          offCtx.fillRect(bx + 2, by + oy + 1, 1, 1);
          break;
        case 5:
          offCtx.fillRect(bx + 3, by + 1, 1, 1);
          offCtx.fillRect(bx + 3, by + 2, 1, 1);
          offCtx.fillRect(bx + 4, by + 2, 1, 1);
          offCtx.fillRect(bx + 4, by + 3, 1, 1);
          offCtx.fillRect(bx + 3, by + 3, 1, 1);
          offCtx.fillRect(bx + 2, by + 4, 1, 1);
          offCtx.fillRect(bx + 1, by + 4, 1, 1);
          break;
      }
    }

    function drawEmojiSprite(emojiToken: string, x: number, y: number, textColor: string) {
      if (!offCtx) return 10;
      const token = emojiToken.toLowerCase().trim();

      if (token === '{warning}' || token === '{aviso}' || token === '{atencao}' || token === '⚠️') {
        offCtx.fillStyle = '#facc15'; // Amarelo
        offCtx.beginPath();
        offCtx.moveTo(x + 6, y - 10);
        offCtx.lineTo(x + 12, y + 1);
        offCtx.lineTo(x, y + 1);
        offCtx.closePath();
        offCtx.fill();
        offCtx.fillStyle = '#000000';
        offCtx.fillRect(x + 5, y - 7, 2, 4);
        offCtx.fillRect(x + 5, y - 1, 2, 2);
        return 14;
      }
      if (token === '{car}' || token === '{carro}' || token === '{veiculo}' || token === '🚗') {
        offCtx.fillStyle = textColor;
        offCtx.fillRect(x + 2, y - 6, 10, 4);
        offCtx.fillRect(x, y - 2, 14, 4);
        offCtx.fillStyle = '#000000';
        offCtx.fillRect(x + 2, y + 1, 3, 2);
        offCtx.fillRect(x + 9, y + 1, 3, 2);
        return 16;
      }
      if (token === '{work}' || token === '{obras}' || token === '🚧') {
        offCtx.fillStyle = '#f97316'; // Laranja
        offCtx.fillRect(x, y - 8, 12, 8);
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(x + 2, y - 8, 2, 8);
        offCtx.fillRect(x + 7, y - 8, 2, 8);
        offCtx.fillStyle = '#94a3b8';
        offCtx.fillRect(x + 1, y, 2, 2);
        offCtx.fillRect(x + 9, y, 2, 2);
        return 14;
      }
      if (token === '{stop}' || token === '{pare}' || token === '{proibido}' || token === '⛔') {
        offCtx.fillStyle = '#ef4444'; // Vermelho
        offCtx.beginPath();
        offCtx.arc(x + 6, y - 4, 5.5, 0, Math.PI * 2);
        offCtx.fill();
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(x + 2, y - 5, 8, 2);
        return 14;
      }
      if (token === '{right}' || token === '{direita}' || token === '➡️') {
        offCtx.fillStyle = textColor;
        offCtx.fillRect(x, y - 5, 6, 3);
        offCtx.beginPath();
        offCtx.moveTo(x + 6, y - 8);
        offCtx.lineTo(x + 11, y - 3.5);
        offCtx.lineTo(x + 6, y + 1);
        offCtx.closePath();
        offCtx.fill();
        return 13;
      }
      if (token === '{left}' || token === '{esquerda}' || token === '⬅️') {
        offCtx.fillStyle = textColor;
        offCtx.fillRect(x + 5, y - 5, 6, 3);
        offCtx.beginPath();
        offCtx.moveTo(x + 5, y - 8);
        offCtx.lineTo(x, y - 3.5);
        offCtx.lineTo(x + 5, y + 1);
        offCtx.closePath();
        offCtx.fill();
        return 13;
      }
      if (token === '{up}' || token === '{cima}' || token === '⬆️') {
        offCtx.fillStyle = textColor;
        offCtx.fillRect(x + 3.5, y - 5, 3, 6);
        offCtx.beginPath();
        offCtx.moveTo(x, y - 4);
        offCtx.lineTo(x + 5, y - 9);
        offCtx.lineTo(x + 10, y - 4);
        offCtx.closePath();
        offCtx.fill();
        return 12;
      }
      if (token === '{down}' || token === '{baixo}' || token === '⬇️') {
        offCtx.fillStyle = textColor;
        offCtx.fillRect(x + 3.5, y - 8, 3, 6);
        offCtx.beginPath();
        offCtx.moveTo(x, y - 3);
        offCtx.lineTo(x + 5, y + 2);
        offCtx.lineTo(x + 10, y - 3);
        offCtx.closePath();
        offCtx.fill();
        return 12;
      }
      if (token === '{heart}' || token === '{coracao}' || token === '❤️') {
        offCtx.fillStyle = '#ef4444';
        offCtx.beginPath();
        offCtx.moveTo(x + 5, y - 2);
        offCtx.lineTo(x + 1, y - 6);
        offCtx.arc(x + 3, y - 7, 2, Math.PI, 0);
        offCtx.arc(x + 7, y - 7, 2, Math.PI, 0);
        offCtx.closePath();
        offCtx.fill();
        return 12;
      }
      if (token === '{smile}' || token === '{feliz}' || token === '🙂') {
        offCtx.fillStyle = '#facc15';
        offCtx.beginPath();
        offCtx.arc(x + 5, y - 4, 5, 0, Math.PI * 2);
        offCtx.fill();
        offCtx.fillStyle = '#000000';
        offCtx.fillRect(x + 3, y - 6, 1.5, 1.5);
        offCtx.fillRect(x + 6, y - 6, 1.5, 1.5);
        offCtx.fillRect(x + 3, y - 2, 4, 1);
        return 12;
      }
      if (token === '{x}' || token === '{fechado}' || token === '❌') {
        offCtx.fillStyle = '#ef4444';
        offCtx.beginPath();
        offCtx.moveTo(x + 1, y - 8); offCtx.lineTo(x + 9, y);
        offCtx.moveTo(x + 9, y - 8); offCtx.lineTo(x + 1, y);
        offCtx.lineWidth = 2;
        offCtx.stroke();
        return 12;
      }
      if (token === '{check}' || token === '{ok}' || token === '✅') {
        offCtx.fillStyle = '#22c55e';
        offCtx.beginPath();
        offCtx.moveTo(x + 1, y - 4);
        offCtx.lineTo(x + 4, y - 1);
        offCtx.lineTo(x + 10, y - 7);
        offCtx.lineWidth = 2;
        offCtx.strokeStyle = '#22c55e';
        offCtx.stroke();
        return 12;
      }

      return 0;
    }

    function parseLineParts(line: string) {
      const parts: { isEmoji: boolean; token: string; text: string }[] = [];
      const regex = /(\{[a-zA-Z0-9_-]+\}|⚠️|🚗|🚧|⛔|➡️|⬅️|⬆️|⬇️|❤️|🙂|❌|✅)/g;
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ isEmoji: false, token: '', text: line.substring(lastIndex, match.index) });
        }
        parts.push({ isEmoji: true, token: match[0], text: '' });
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < line.length) {
        parts.push({ isEmoji: false, token: '', text: line.substring(lastIndex) });
      }

      return parts;
    }

    function measureLineWithEmojis(line: string): number {
      if (!offCtx) return 0;
      const parts = parseLineParts(line);
      let totalW = 0;
      for (const p of parts) {
        if (p.isEmoji) {
          totalW += 14;
        } else {
          totalW += offCtx.measureText(p.text).width;
        }
      }
      return totalW;
    }

    function drawLineWithEmojis(line: string, x: number, y: number, cor: string) {
      if (!offCtx) return;
      const parts = parseLineParts(line);
      let curX = x;

      for (const p of parts) {
        if (p.isEmoji) {
          const w = drawEmojiSprite(p.token, curX, y, cor);
          curX += w;
        } else {
          offCtx.textAlign = 'left';
          for (const ch of p.text) {
            const ai = ACENTO_MAP[ch];
            if (ai) {
              const bx = curX;
              offCtx.fillStyle = cor;
              offCtx.fillText(ai.base, curX, y);
              curX += offCtx.measureText(ai.base).width;
              desenharAcento(ai.tipo, bx, y, ai.M, cor);
            } else {
              offCtx.fillStyle = cor;
              offCtx.fillText(ch, curX, y);
              curX += offCtx.measureText(ch).width;
            }
          }
        }
      }
    }

    function calculateX(line: string, align: string) {
      if (!offCtx) return 2;
      const lineWidth = measureLineWithEmojis(line);
      if (align === 'center') {
        return Math.max(0, Math.round((LED_COLS - lineWidth) / 2));
      } else if (align === 'right') {
        return Math.max(0, Math.round(LED_COLS - lineWidth - 2));
      } else {
        return 2;
      }
    }

    const renderLoop = () => {
      const modo = config.modo || 'fixed';
      const align = config.align || 'center';
      const valign = config.valign || 'center';
      const corTxt = config.cor || '#ffff00';
      const corFnd = config.fundo || '#000000';
      const tam = config.tamanho || '2';
      const dir = config.direcao || 'left';
      const fSpec = getFontSpec(tam);

      offCtx.fillStyle = corFnd;
      offCtx.fillRect(0, 0, LED_COLS, LED_ROWS);

      offCtx.font = `${fSpec.bold ? 'bold ' : ''}${fSpec.size}px monospace, Arial, sans-serif`;
      offCtx.textBaseline = 'alphabetic';

      if (rawLines.length > 0) {
        if (modo === 'scroll') {
          const joinedText = rawLines.join('   •   ');
          const totalW = measureLineWithEmojis(joinedText);

          if (dir === 'left') {
            const y1 = calcYSingle(valign, fSpec.alt);
            drawLineWithEmojis(joinedText, scrollPosRef.current, y1, corTxt);
            scrollPosRef.current -= 0.65;
            if (scrollPosRef.current < -(totalW + 16)) {
              scrollPosRef.current = LED_COLS;
            }
          } else if (dir === 'right') {
            const y1 = calcYSingle(valign, fSpec.alt);
            drawLineWithEmojis(joinedText, scrollPosRef.current, y1, corTxt);
            scrollPosRef.current += 0.65;
            if (scrollPosRef.current > LED_COLS + 10) {
              scrollPosRef.current = -totalW;
            }
          } else if (dir === 'up') {
            const x1 = calculateX(joinedText, align);
            drawLineWithEmojis(joinedText, x1, scrollPosRef.current, corTxt);
            scrollPosRef.current -= 0.45;
            if (scrollPosRef.current < -15) {
              scrollPosRef.current = LED_ROWS + 10;
            }
          } else if (dir === 'down') {
            const x1 = calculateX(joinedText, align);
            drawLineWithEmojis(joinedText, x1, scrollPosRef.current, corTxt);
            scrollPosRef.current += 0.45;
            if (scrollPosRef.current > LED_ROWS + 15) {
              scrollPosRef.current = -15;
            }
          }
        } else if (modo === 'slide') {
          const slideText = rawLines[currentSlide] || '';
          const y1 = calcYSingle(valign, fSpec.alt);
          const x1 = calculateX(slideText, align);
          drawLineWithEmojis(slideText, x1, y1, corTxt);
        } else {
          // fixed mode
          if (rawLines.length === 1) {
            const y1 = calcYSingle(valign, fSpec.alt);
            const x1 = calculateX(rawLines[0], align);
            drawLineWithEmojis(rawLines[0], x1, y1, corTxt);
          } else {
            const { y1, y2 } = calcYDual(valign, fSpec.alt);
            const x1 = calculateX(rawLines[0], align);
            drawLineWithEmojis(rawLines[0], x1, y1, corTxt);
            const x2 = calculateX(rawLines[1], align);
            drawLineWithEmojis(rawLines[1], x2, y2, corTxt);
          }
        }
      }

      // Convert offscreen canvas into realistic circular LED matrix
      const imgData = offCtx.getImageData(0, 0, LED_COLS, LED_ROWS);
      const data = imgData.data;

      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const rLED = LED_PX / 2;
      const pad = 1.2;

      for (let row = 0; row < LED_ROWS; row++) {
        for (let col = 0; col < LED_COLS; col++) {
          const idx = (row * LED_COLS + col) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          const cx = col * (LED_PX + pad) + rLED + 6;
          const cy = row * (LED_PX + pad) + rLED + 6;

          ctx.beginPath();
          ctx.arc(cx, cy, rLED - 0.5, 0, Math.PI * 2);

          if (a > 30 && (r > 20 || g > 20 || b > 20)) {
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.shadowColor = `rgba(${r},${g},${b},0.6)`;
            ctx.shadowBlur = 4;
            ctx.fill();
            ctx.shadowBlur = 0;
          } else {
            ctx.fillStyle = '#151c28';
            ctx.fill();
          }
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [config, currentSlide, rawLines]);

  return (
    <div className="space-y-3">
      {/* Header with Title and Live Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-800 tracking-wider uppercase font-mono">
            SIMULAÇÃO MATRIZ P8 (120×40 PX - 6 MÓDULOS)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {config.modo === 'slide' && rawLines.length > 1 && (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              Tela {currentSlide + 1} de {totalSlides}
            </span>
          )}
          {config.fundo && config.fundo.toLowerCase() !== '#000000' && (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
              Fundo Ativo
            </span>
          )}
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
            {config.modo?.toUpperCase() || 'FIXO'} • {config.align?.toUpperCase() || 'CENTRO'}
          </span>
        </div>
      </div>

      {/* Realistic Matrix Canvas Container */}
      <div className="relative rounded-2xl p-3.5 bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col items-center justify-center">
        <div className="overflow-x-auto w-full flex justify-center">
          <canvas
            ref={canvasRef}
            width={LED_COLS * (LED_PX + 1.2) + 12}
            height={LED_ROWS * (LED_PX + 1.2) + 12}
            className="rounded-lg shadow-inner max-w-full"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Slide Mode Navigation & Progress Bar */}
        {config.modo === 'slide' && rawLines.length > 1 && (
          <div className="w-full mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-slate-400 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setSlideIndex((prev) => (prev > 0 ? prev - 1 : rawLines.length - 1));
                  setSlideProgress(0);
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                title="Tela Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPaused(!isPaused)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[11px] flex items-center gap-1 transition"
                title={isPaused ? 'Reproduzir Slides' : 'Pausar'}
              >
                {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-amber-400" />}
                {isPaused ? 'PLAY' : 'PAUSA'}
              </button>

              <button
                onClick={() => {
                  setSlideIndex((prev) => (prev + 1) % rawLines.length);
                  setSlideProgress(0);
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                title="Próxima Tela"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 mx-3">
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-75"
                  style={{ width: `${slideProgress}%` }}
                />
              </div>
            </div>

            <div className="font-mono text-[11px] text-slate-400">
              {Math.round((speed || 3000) / 1000)}s / tela
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
