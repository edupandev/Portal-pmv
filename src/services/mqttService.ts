import mqtt, { MqttClient } from 'mqtt';
import { BrokerOption, DeviceStatus, MqttPacketLog, SyncPayload } from '../types/pmv';

export const BROKER_OPTIONS: BrokerOption[] = [
  {
    id: 'emqx',
    name: 'EMQX Public Broker (Recomendado)',
    webUrl: 'wss://broker.emqx.io:8084/mqtt',
    esp32Host: 'broker.emqx.io',
    esp32Port: 1883,
    description: 'Suporta WebSockets TLS (8084) e TCP (1883) com alta estabilidade.',
  },
  {
    id: 'hivemq',
    name: 'HiveMQ Public Broker',
    webUrl: 'wss://broker.hivemq.com:8884/mqtt',
    esp32Host: 'broker.hivemq.com',
    esp32Port: 1883,
    description: 'Broker gratuito do HiveMQ. WebSockets WSS na porta 8884.',
  },
  {
    id: 'mosquitto',
    name: 'Eclipse Mosquitto Test Broker',
    webUrl: 'wss://test.mosquitto.org:8081/mqtt',
    esp32Host: 'test.mosquitto.org',
    esp32Port: 1883,
    description: 'Broker público do projeto Eclipse Mosquitto.',
  },
];

type StatusListener = (status: 'disconnected' | 'connecting' | 'connected' | 'error', errorMsg?: string) => void;
type PacketListener = (packet: MqttPacketLog) => void;
type DeviceStatusListener = (status: DeviceStatus) => void;
type SyncListener = (sync: SyncPayload) => void;
type AuthResponseListener = (res: { id: string; status: 'success' | 'fail'; reason?: string }) => void;

class MqttService {
  private client: MqttClient | null = null;
  private currentBroker: BrokerOption = BROKER_OPTIONS[0];
  private browserId = 'WEB_' + Math.random().toString(16).slice(2, 8);
  private statusListeners: Set<StatusListener> = new Set();
  private packetListeners: Set<PacketListener> = new Set();
  private deviceStatusListeners: Set<DeviceStatusListener> = new Set();
  private syncListeners: Set<SyncListener> = new Set();
  private authListeners: Set<AuthResponseListener> = new Set();
  public connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  public lastError: string | null = null;

  constructor() {
    // We can auto-initiate connection
    this.connect(this.currentBroker);
  }

  public isConnected(): boolean {
    return Boolean(this.client && this.client.connected && !(this.client as any).disconnecting);
  }

  public getBrowserId(): string {
    return this.browserId;
  }

  public getCurrentBroker(): BrokerOption {
    return this.currentBroker;
  }

  public onStatusChange(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.connectionStatus, this.lastError || undefined);
    return () => this.statusListeners.delete(listener);
  }

  public onPacket(listener: PacketListener) {
    this.packetListeners.add(listener);
    return () => this.packetListeners.delete(listener);
  }

  public onDeviceStatus(listener: DeviceStatusListener) {
    this.deviceStatusListeners.add(listener);
    return () => this.deviceStatusListeners.delete(listener);
  }

  public onSync(listener: SyncListener) {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  public onAuth(listener: AuthResponseListener) {
    this.authListeners.add(listener);
    return () => this.authListeners.delete(listener);
  }

  private notifyStatus(status: 'disconnected' | 'connecting' | 'connected' | 'error', errorMsg?: string) {
    this.connectionStatus = status;
    this.lastError = errorMsg || null;
    this.statusListeners.forEach((fn) => fn(status, errorMsg));
  }

  private logPacket(topic: string, direction: 'in' | 'out', payload: string, type: MqttPacketLog['type']) {
    const log: MqttPacketLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
      topic,
      direction,
      payload,
      type,
    };
    this.packetListeners.forEach((fn) => fn(log));
  }

  public connect(broker: BrokerOption) {
    if (this.client) {
      try {
        const prevClient = this.client;
        this.client = null;
        prevClient.removeAllListeners();
        prevClient.end(true);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    this.currentBroker = broker;
    this.notifyStatus('connecting');

    try {
      const client = mqtt.connect(broker.webUrl, {
        clientId: `PMV_WebClient_${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 4000,
        resubscribe: true,
      });

      this.client = client;

      client.on('connect', () => {
        if (this.client !== client) return;
        this.notifyStatus('connected');

        client.subscribe(
          ['painel_led_status', 'painel_led_sync', 'auth/response', 'painel_led_sync_request'],
          { qos: 0 },
          (err) => {
            if (err && !err.message?.includes('disconnecting') && !err.message?.includes('offline')) {
              console.warn('MQTT subscription error:', err.message);
            }
          }
        );

        // Broadcast initial sync request after a brief delay
        setTimeout(() => {
          if (this.isConnected()) {
            this.requestSync('all');
          }
        }, 300);
      });

      client.on('error', (err) => {
        if (this.client !== client) return;
        console.warn('MQTT connection notice:', err.message);
        this.notifyStatus('error', err.message);
      });

      client.on('offline', () => {
        if (this.client !== client) return;
        this.notifyStatus('disconnected');
      });

      client.on('close', () => {
        if (this.client !== client) return;
        if (this.connectionStatus === 'connected') {
          this.notifyStatus('disconnected');
        }
      });

      client.on('reconnect', () => {
        if (this.client !== client) return;
        this.notifyStatus('connecting');
      });

      client.on('message', (topic, message) => {
        if (this.client !== client) return;
        const payloadStr = message.toString();

        let type: MqttPacketLog['type'] = 'other';
        if (topic.includes('status')) type = 'status';
        else if (topic.includes('sync')) type = 'sync';
        else if (topic.includes('auth')) type = 'auth';
        else if (topic.startsWith('painel_led/')) type = 'command';

        this.logPacket(topic, 'in', payloadStr, type);

        try {
          const parsed = JSON.parse(payloadStr);

          if (topic === 'auth/response') {
            this.authListeners.forEach((fn) => fn(parsed));
          } else if (topic === 'painel_led_status') {
            const isRed =
              parsed.vermelho === true ||
              parsed.vermelho === 1 ||
              parsed.vermelho === '1' ||
              parsed.vermelho === 'true' ||
              parsed.vermelho === 'TRUE' ||
              parsed.vermelho === 'high' ||
              parsed.vermelho === 'HIGH';

            const devStatus: DeviceStatus = {
              dispositivo: parsed.dispositivo || 'PMV-Desconhecido',
              vermelho: isRed,
              lat: typeof parsed.lat === 'number' ? parsed.lat : -23.966454,
              lng: typeof parsed.lng === 'number' ? parsed.lng : -46.391634,
              rssi: parsed.rssi,
              lastSeen: Date.now(),
            };
            this.deviceStatusListeners.forEach((fn) => fn(devStatus));
          } else if (topic === 'painel_led_sync') {
            this.syncListeners.forEach((fn) => fn(parsed));
          }
        } catch (err) {
          console.warn('Error parsing JSON from topic', topic, err);
        }
      });
    } catch (e: any) {
      this.notifyStatus('error', e?.message || 'Falha ao instanciar cliente MQTT');
    }
  }

  public sendAuthRequest(user: string, pass: string) {
    const payload = JSON.stringify({
      id: this.browserId,
      user,
      pass,
    });
    this.publish('auth/request', payload, 'auth');
  }

  public requestSync(target: string = 'all') {
    const payload = JSON.stringify({ target });
    this.publish('painel_led_sync_request', payload, 'sync');
  }

  public sendDeviceCommand(deviceId: string, payloadObj: any) {
    const topic = `painel_led/${deviceId}`;
    const payload = JSON.stringify(payloadObj);
    return this.publish(topic, payload, 'command');
  }

  public publish(topic: string, payload: string, type: MqttPacketLog['type'] = 'other', retain: boolean = false): boolean {
    if (!this.isConnected()) {
      return false;
    }
    this.logPacket(topic, 'out', payload, type);
    try {
      this.client?.publish(topic, payload, { qos: 0, retain }, (err) => {
        if (err && !err.message?.includes('disconnecting') && !err.message?.includes('offline')) {
          console.warn(`MQTT publish error on ${topic}:`, err.message);
        }
      });
      return true;
    } catch (err: any) {
      if (!err?.message?.includes('disconnecting') && !err?.message?.includes('offline')) {
        console.warn('MQTT publish exception:', err);
      }
      return false;
    }
  }
}

export const mqttService = new MqttService();
