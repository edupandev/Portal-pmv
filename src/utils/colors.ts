// RGB565 to Hex string converter
export function rgb565ToHex(c: number): string {
  const r = Math.floor(((c >> 11) & 0x1f) * 255 / 31);
  const g = Math.floor(((c >> 5) & 0x3f) * 255 / 63);
  const b = Math.floor((c & 0x1f) * 255 / 31);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Hex string to [R, G, B] array (0-255)
export function hexToRgb(h: string): [number, number, number] {
  const clean = h.replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Hex string to RGB565 16-bit unsigned integer (as used in ESP32)
export function hexToRgb565(h: string): number {
  const [r, g, b] = hexToRgb(h);
  return (((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)) & 0xffff;
}

export const PALETTE = [
  { hex: '#000000', label: 'Preto (Desligado)', border: '#334155' },
  { hex: '#ffffff', label: 'Branco', border: '#cbd5e1' },
  { hex: '#ffff00', label: 'Amarelo P10', border: '#ca8a04' },
  { hex: '#ff8c00', label: 'Laranja Âmbar', border: '#ea580c' },
  { hex: '#00ff00', label: 'Verde Puro', border: '#16a34a' },
  { hex: '#ff0000', label: 'Vermelho Alerta', border: '#dc2626' },
  { hex: '#0080ff', label: 'Azul Sinalização', border: '#0284c7' },
  { hex: '#ff00ff', label: 'Magenta', border: '#c026d3' },
];
