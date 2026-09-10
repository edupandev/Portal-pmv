export interface PhaseConfig {
  text: string;
  modo: 'fixed' | 'slide' | 'scroll';
  tamanho: '1' | '2' | '3'; // 1=Pequeno (7pt), 2=Médio (8pt), 3=Grande (9pt)
  cor: string; // Hex e.g. "#ffff00"
  fundo: string; // Hex e.g. "#000000"
  align: 'left' | 'center';
  valign: 'top' | 'center' | 'bottom';
  direcao?: 'left' | 'right' | 'up' | 'down';
  rotacaoTexto?: 0 | 90 | 180 | 270;
  brilho?: number;
}

export interface DeviceMemoryConfig {
  red: PhaseConfig;
  green: PhaseConfig;
  velocidade?: number;
}

export interface DeviceStatus {
  dispositivo: string;
  vermelho: boolean;
  lat: number;
  lng: number;
  rssi?: number;
  lastSeen: number;
}

export interface SyncPayload {
  target: string;
  mensagensRed: string[];
  mensagensGreen: string[];
  r_modo: 'fixed' | 'slide' | 'scroll';
  r_cor: number; // RGB565 integer
  r_fnd?: number; // RGB565 integer
  r_tam: number;
  r_align?: 'left' | 'center';
  r_valign?: 'top' | 'center' | 'bottom';
  g_modo: 'fixed' | 'slide' | 'scroll';
  g_cor: number; // RGB565 integer
  g_fnd?: number; // RGB565 integer
  g_tam: number;
  g_align?: 'left' | 'center';
  g_valign?: 'top' | 'center' | 'bottom';
  velocidade: number;
}

export interface MqttPacketLog {
  id: string;
  timestamp: string;
  topic: string;
  direction: 'in' | 'out';
  payload: string;
  type: 'status' | 'sync' | 'auth' | 'command' | 'other';
}

export interface BrokerOption {
  id: string;
  name: string;
  webUrl: string;
  esp32Host: string;
  esp32Port: number;
  description: string;
  isCustom?: boolean;
}
