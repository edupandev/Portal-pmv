import { mqttService } from './mqttService';
import { hexToRgb565 } from '../utils/colors';

class VirtualEsp32Hardware {
  public isRunning = false;
  public deviceName = 'Portal';
  public deviceUser = 'geral3';
  public devicePass = '123';
  public isRedPhase = true; // Pin 32 HIGH = Red, LOW = Green
  public lat = -23.966454;
  public lng = -46.391634;
  public rssi = -64;

  public redMsgs: string[] = ['PARE', 'OBRAS NA PISTA'];
  public greenMsgs: string[] = ['SIGA LIVRE', 'VELOCIDADE 50KM'];
  public r_modo: 'fixed' | 'slide' | 'scroll' = 'fixed';
  public r_cor = hexToRgb565('#ff8c00'); // 0xF800
  public r_tam = 2;
  public r_align: 'left' | 'center' = 'center';
  public r_valign: 'top' | 'center' | 'bottom' = 'center';

  public g_modo: 'fixed' | 'slide' | 'scroll' = 'slide';
  public g_cor = hexToRgb565('#00ff00'); // 0x07E0
  public g_tam = 2;
  public g_align: 'left' | 'center' = 'center';
  public g_valign: 'top' | 'center' | 'bottom' = 'center';
  
  public velocidade = 3000;

  private timer: number | null = null;
  private unsubscribePacket: (() => void) | null = null;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Send initial sync
    this.publishSync();

    // Heartbeat every 2.5s
    this.timer = window.setInterval(() => {
      this.publishHeartbeat();
    }, 2500);

    // Listen for incoming commands from MQTT
    this.unsubscribePacket = mqttService.onPacket((packet) => {
      if (packet.direction !== 'out') return;

      // 1. Auth Request
      if (packet.topic === 'auth/request') {
        try {
          const req = JSON.parse(packet.payload);
          const isSuccess = req.user === this.deviceUser && req.pass === this.devicePass;
          const res = {
            id: req.id,
            status: isSuccess ? 'success' : 'fail',
            reason: isSuccess ? undefined : 'Usuario ou senha incorretos (Simulador)',
          };
          setTimeout(() => {
            mqttService.publish('auth/response', JSON.stringify(res), 'auth');
          }, 300);
        } catch (e) {}
      }

      // 2. Sync Request
      if (packet.topic === 'painel_led_sync_request') {
        try {
          const req = JSON.parse(packet.payload);
          if (!req.target || req.target === 'all' || req.target === this.deviceName) {
            setTimeout(() => {
              this.publishSync();
            }, 200);
          }
        } catch (e) {}
      }

      // 3. Command to this device
      if (packet.topic === `painel_led/${this.deviceName}`) {
        try {
          const cmd = JSON.parse(packet.payload);
          if (cmd.alerta) {
            // Red phase
            this.redMsgs = cmd.mensagens || [];
            this.r_modo = cmd.modo || 'fixed';
            this.r_tam = cmd.tamanho || 2;
            if (cmd.align) this.r_align = cmd.align;
            if (cmd.valign) this.r_valign = cmd.valign;
          } else {
            // Green phase
            this.greenMsgs = cmd.mensagens || [];
            this.g_modo = cmd.modo || 'slide';
            this.g_tam = cmd.tamanho || 2;
            if (cmd.align) this.g_align = cmd.align;
            if (cmd.valign) this.g_valign = cmd.valign;
          }
          if (cmd.velocidade) this.velocidade = cmd.velocidade;
          this.publishSync();
        } catch (e) {}
      }
    });
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.unsubscribePacket) {
      this.unsubscribePacket();
      this.unsubscribePacket = null;
    }
  }

  public togglePhase() {
    this.isRedPhase = !this.isRedPhase;
    this.publishHeartbeat();
  }

  public publishHeartbeat() {
    const payload = JSON.stringify({
      dispositivo: this.deviceName,
      vermelho: this.isRedPhase,
      lat: this.lat,
      lng: this.lng,
      rssi: this.rssi,
    });
    mqttService.publish('painel_led_status', payload, 'status');
  }

  public publishSync() {
    const payload = JSON.stringify({
      target: this.deviceName,
      mensagensRed: this.redMsgs,
      mensagensGreen: this.greenMsgs,
      r_modo: this.r_modo,
      r_cor: this.r_cor,
      r_tam: this.r_tam,
      r_align: this.r_align,
      r_valign: this.r_valign,
      g_modo: this.g_modo,
      g_cor: this.g_cor,
      g_tam: this.g_tam,
      g_align: this.g_align,
      g_valign: this.g_valign,
      velocidade: this.velocidade,
    });
    mqttService.publish('painel_led_sync', payload, 'sync', true);
  }
}

export const virtualEsp32 = new VirtualEsp32Hardware();
