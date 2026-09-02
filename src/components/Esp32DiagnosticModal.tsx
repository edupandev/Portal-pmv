import React, { useState } from 'react';
import { FIXED_ESP32_CODE } from '../utils/esp32Code';
import {
  X,
  Copy,
  Check,
  AlertCircle,
  Cpu,
  Globe,
  Terminal,
  FileCode,
  Smartphone,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';

interface Esp32DiagnosticModalProps {
  onClose: () => void;
}

export const Esp32DiagnosticModal: React.FC<Esp32DiagnosticModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'ap_portal' | 'semaforo' | 'code' | 'diagnosis' | 'wiring'>('semaforo');

  const handleCopy = () => {
    navigator.clipboard.writeText(FIXED_ESP32_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Diagnóstico do Semáforo &amp; Código ESP32</h2>
              <p className="text-xs text-slate-500">
                Pino 32 (Fase Vermelha/Verde), Transmissão MQTT Instantânea e Portal Wi-Fi
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/60 px-6 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('semaforo')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'semaforo'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            1. Diagnóstico do Semáforo
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'code'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode className="w-4 h-4" />
            2. Código C++ &amp; Versão ESP32 Core
          </button>
          <button
            onClick={() => setActiveTab('ap_portal')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'ap_portal'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Radio className="w-4 h-4" />
            3. Wi-Fi AP &amp; Display Apagado (Guia)
          </button>
          <button
            onClick={() => setActiveTab('diagnosis')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'diagnosis'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            4. Diagnóstico MQTT
          </button>
          <button
            onClick={() => setActiveTab('wiring')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center gap-2 shrink-0 ${
              activeTab === 'wiring'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            5. Tópicos &amp; Pinagem
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 text-slate-700 text-sm space-y-4">
          {activeTab === 'semaforo' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 shadow-xs">
                <div className="font-bold flex items-center gap-2 text-base mb-1">
                  <SlidersHorizontal className="w-5 h-5 text-amber-600" />
                  Diagnóstico e Soluções Aplicadas para o Semáforo (PIN 32)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  O semáforo físico (sinal de trânsito ou relé de controle) é lido no <strong>GPIO 32</strong> do ESP32:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 shadow-xs">
                  <div className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                    1. Transmissão Instantânea
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Assim que o nível do <strong>PIN 32</strong> se altera, o ESP32 envia imediatamente o pacote MQTT para o site refletir em tempo real (0ms de atraso).
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 shadow-xs">
                  <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                    2. Filtro de Debounce (50ms)
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Relés e contatos secos causam ruído elétrico. Adicionamos um filtro de estabilidade de 50ms para evitar disparos falsos.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 shadow-xs">
                  <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                    3. Lógica Normal ou Invertida
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Se o relé conecta o PIN 32 ao <strong>GND</strong> para a fase vermelha, você pode alternar a polaridade diretamente no Portal <code className="text-blue-700 font-bold">192.168.4.1</code>.
                  </p>
                </div>
              </div>

              {/* Tabela de Ligação Elétrica do PIN 32 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3 shadow-xs">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Como Ligar o Pino 32 no Hardware:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1 font-mono shadow-xs">
                    <div className="text-rose-600 font-bold">FASE VERMELHA (PARE):</div>
                    <div className="text-slate-700">• Lógica Padrão: Pino 32 em <strong>HIGH (+3.3V ou Aberto)</strong></div>
                    <div className="text-slate-500">• Painel exibe mensagens da Fase Vermelha</div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1 font-mono shadow-xs">
                    <div className="text-emerald-700 font-bold">FASE VERDE (SIGA):</div>
                    <div className="text-slate-700">• Lógica Padrão: Pino 32 fechado ao <strong>GND (LOW / 0V)</strong></div>
                    <div className="text-slate-500">• Painel exibe mensagens da Fase Verde</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              {/* Alerta de Compatibilidade de Versão ESP32 Arduino Core */}
              <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-4 text-amber-900 shadow-xs space-y-2">
                <div className="font-bold flex items-center gap-2 text-sm text-amber-950">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  Como Resolver o Erro de Compilação no Arduino IDE (ESP32 Core 3.x vs 2.x):
                </div>
                <div className="text-xs text-slate-700 leading-relaxed space-y-1.5">
                  <p>
                    O erro <code className="bg-amber-100/80 text-amber-900 px-1 py-0.5 rounded font-mono font-bold">unknown type name 'i2s_dev_t'</code> acontece porque o seu <strong>Pacote de Placas ESP32</strong> foi atualizado para a versão <strong>3.x (ESP-IDF v5)</strong>, onde os registros internos de I2S foram alterados pela Espressif.
                  </p>
                  <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-2 font-mono text-[11px]">
                    <div className="text-blue-900 font-bold">SOLUÇÃO 1 (Recomendada e mais rápida - 1 minuto):</div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-700 font-sans">
                      <li>No Arduino IDE, vá em <strong>Ferramentas → Placa → Gerenciador de Placas</strong> (ou <em>Tools → Board → Boards Manager</em>).</li>
                      <li>Procure por <strong>esp32</strong> (da <em>Espressif Systems</em>).</li>
                      <li>No menu suspenso de versão, selecione <strong>2.0.17</strong> (ou qualquer versão <strong>2.0.x</strong>) e clique em <strong>Instalar / Reverter</strong>.</li>
                      <li>Feito isso, a biblioteca DMA compila instantaneamente e com 100% de estabilidade!</li>
                    </ol>
                    <div className="text-blue-900 font-bold pt-1">SOLUÇÃO 2 (Se quiser manter ESP32 Core 3.x):</div>
                    <p className="font-sans text-slate-700">
                      Atualize a biblioteca <strong>ESP32-HUB75-MatrixPanel-I2S-DMA</strong> no Gerenciador de Bibliotecas para a versão <strong>v3.0.12 ou superior</strong> (desenvolvida por <em>mrfaptastic</em>), que inclui compatibilidade nativa com o novo driver I2S do Core 3.x.
                    </p>
                  </div>
                </div>
              </div>

              {/* Guia de Configuração de Múltiplos Painéis e Emojis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 text-blue-950 space-y-2 shadow-xs">
                  <div className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-blue-900">
                    <span>📐</span>
                    Como Adicionar Mais Painéis no Código:
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    No topo do código <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono text-blue-800">p10ESP32.ino</code>, ajuste apenas estas linhas para qualquer grid:
                  </p>
                  <pre className="bg-white p-2.5 rounded-xl border border-blue-200 font-mono text-[10px] text-slate-800 space-y-0.5">
                    <div>#define PANEL_WIDTH   40  // Largura P8 (40 px)</div>
                    <div>#define PANEL_HEIGHT  20  // Altura P8 (20 px)</div>
                    <div>#define PANELS_X      6   // 6 módulos na linha = 240px de largura</div>
                    <div>#define PANELS_Y      1   // 1 módulo de altura = 20px</div>
                  </pre>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-emerald-950 space-y-2 shadow-xs">
                  <div className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-emerald-900">
                    <span>✨</span>
                    Tags de Emojis &amp; Símbolos Suportadas:
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Você pode digitar estas tags no texto da mensagem que o ESP32 desenha o ícone colorido no display:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] text-slate-700">
                    <span className="bg-white px-2 py-1 rounded border border-emerald-200"><code className="text-emerald-700 font-bold">{"{car}"}</code> 🚗 Carro</span>
                    <span className="bg-white px-2 py-1 rounded border border-emerald-200"><code className="text-emerald-700 font-bold">{"{stop}"}</code> ⛔ Pare</span>
                    <span className="bg-white px-2 py-1 rounded border border-emerald-200"><code className="text-emerald-700 font-bold">{"{work}"}</code> 🚧 Obras</span>
                    <span className="bg-white px-2 py-1 rounded border border-emerald-200"><code className="text-emerald-700 font-bold">{"{warning}"}</code> ⚠️ Aviso</span>
                    <span className="bg-white px-2 py-1 rounded border border-emerald-200"><code className="text-emerald-700 font-bold">{"{right}"}</code> ➡️ Direita</span>
                    <span className="bg-white px-2 py-1 rounded border border-emerald-200"><code className="text-emerald-700 font-bold">{"{check}"}</code> ✅ OK</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">Arquivo: p10ESP32.ino (HUB75 P8 / P10 DMA)</span>
                <button
                  onClick={handleCopy}
                  className="py-1.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'CÓDIGO COPIADO!' : 'COPIAR CÓDIGO ATUALIZADO'}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono border border-slate-800 overflow-x-auto max-h-[460px] leading-relaxed shadow-inner">
                <code>{FIXED_ESP32_CODE}</code>
              </pre>
            </div>
          )}

          {activeTab === 'ap_portal' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-xs">
                <h3 className="text-base font-bold text-blue-900 flex items-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  Como Configurar o Wi-Fi pelo Celular ou Notebook
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  O código do ESP32 gera automaticamente uma rede Wi-Fi própria quando não encontra a rede gravada ou quando você aciona o botão de configuração.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center mb-3">
                      1
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Conecte no Wi-Fi do ESP32</h4>
                    <p className="text-xs text-slate-500 mb-3">
                      No celular ou notebook, procure a rede gerada pelo painel:
                    </p>
                    <div className="bg-white p-2.5 rounded-lg font-mono text-xs text-slate-800 border border-slate-200 space-y-1 shadow-xs">
                      <div>Rede: <strong>Configurar_Painel_P10</strong></div>
                      <div>Senha: <strong>#esp@pmv</strong></div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center mb-3">
                      2
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Abra a Página de Configuração</h4>
                    <p className="text-xs text-slate-500 mb-3">
                      A maioria dos celulares abre a página automaticamente. Se não abrir, digite no navegador:
                    </p>
                    <div className="bg-white p-2.5 rounded-lg font-mono text-xs text-emerald-700 font-bold border border-slate-200 shadow-xs">
                      http://192.168.4.1
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center mb-3">
                      3
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Salve e Conecte</h4>
                    <p className="text-xs text-slate-500">
                      O formulário varre as redes locais. Selecione o Wi-Fi do local, digite a senha, nome do painel e salve. O ESP32 reiniciará e conectará ao site via MQTT!
                    </p>
                  </div>
                </div>
              </div>

              {/* Botão de Forçar Modo AP */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-start gap-3 shadow-xs">
                <Radio className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">
                    Como Reabrir o Wi-Fi AP a Qualquer Momento (Botão BOOT - GPIO 0)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Se você já configurou o Wi-Fi e precisar trocar de rede depois, basta <strong>segurar o botão BOOT do ESP32 por 2 segundos</strong> (ou ligar o ESP32 com o botão BOOT pressionado). Ele entrará no Modo AP e a tela P10 exibirá <code className="text-amber-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono">CONFIG WIFI AP: 192.168.4.1</code>.
                  </p>
                </div>
              </div>

              {/* Checklist de Resolução: Display Apagado / Não Acende */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-rose-950 space-y-2.5 shadow-xs">
                <h4 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2 text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  Checklist Rápido: O que fazer se o Display P8 / P10 estiver apagado?
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
                  <div className="bg-white p-3 rounded-xl border border-rose-100 space-y-1">
                    <span className="font-bold text-rose-800">1. Alimentação Externa 5V:</span>
                    <p className="text-[11px] leading-relaxed">
                      Painéis P8/P10 exigem fonte externa de 5V (4A a 10A). A porta USB do computador não fornece corrente suficiente. O GND da fonte 5V deve estar conectado ao GND do ESP32.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-rose-100 space-y-1">
                    <span className="font-bold text-rose-800">2. Pino OE (Output Enable):</span>
                    <p className="text-[11px] leading-relaxed">
                      O pino <strong>OE (GPIO 15)</strong> é o habilitador dos LEDs. Se o pino 15 estiver solto ou mal conectado, o painel fica 100% apagado.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-rose-100 space-y-1">
                    <span className="font-bold text-rose-800">3. Conexão HUB75 (IN vs OUT):</span>
                    <p className="text-[11px] leading-relaxed">
                      O cabo flat que sai do ESP32 deve ser ligado no conector <strong>HUB75 INPUT (seta apontando para dentro do painel)</strong>, e não no OUTPUT.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'diagnosis' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-900 shadow-xs">
                <div className="font-bold flex items-center gap-2 text-base mb-1">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  Conexão MQTT Unificada (EMQX)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tanto o site quanto o ESP32 estão padronizados para o broker <strong>broker.emqx.io</strong> (Porta 1883 no ESP32 e Porta 8084 WSS no navegador).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="font-bold text-xs text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> Endereços do Broker
                  </div>
                  <ul className="text-xs space-y-1.5 text-slate-700 font-mono">
                    <li>• ESP32: <span className="text-blue-700 font-bold">broker.emqx.io:1883</span></li>
                    <li>• Site: <span className="text-emerald-700 font-bold">wss://broker.emqx.io:8084/mqtt</span></li>
                  </ul>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="font-bold text-xs text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Radio className="w-4 h-4" /> Sincronização Automática
                  </div>
                  <p className="text-xs text-slate-600">
                    Ao abrir o site, ele envia <code className="text-blue-700 font-mono font-semibold">painel_led_sync_request</code> e o ESP32 responde imediatamente com suas mensagens salvas e a fase do semáforo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'wiring' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="font-bold text-sm text-slate-900 mb-2">Tabela de Tópicos MQTT Utilizados</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-2">Tópico</th>
                        <th className="pb-2">Direção</th>
                        <th className="pb-2">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-2 text-blue-700 font-bold">auth/request</td>
                        <td className="py-2 text-amber-700 font-semibold">Site → ESP32</td>
                        <td className="py-2 text-slate-600">Envio de usuário e senha para login</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-blue-700 font-bold">auth/response</td>
                        <td className="py-2 text-emerald-700 font-semibold">ESP32 → Site</td>
                        <td className="py-2 text-slate-600">Confirmação de autenticação</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-blue-700 font-bold">painel_led_status</td>
                        <td className="py-2 text-emerald-700 font-semibold">ESP32 → Site</td>
                        <td className="py-2 text-slate-600">Heartbeat (GPS, fase vermelha/verde, RSSI) e instantâneo na troca</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-blue-700 font-bold">painel_led_sync</td>
                        <td className="py-2 text-emerald-700 font-semibold">ESP32 → Site</td>
                        <td className="py-2 text-slate-600">Estado atual das mensagens e modos salvos no LittleFS</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-blue-700 font-bold">painel_led/&lt;NomePainel&gt;</td>
                        <td className="py-2 text-amber-700 font-semibold">Site → ESP32</td>
                        <td className="py-2 text-slate-600">Comando para atualizar mensagens e configurações</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-blue-700 font-bold">painel_led_sync_request</td>
                        <td className="py-2 text-amber-700 font-semibold">Site → ESP32</td>
                        <td className="py-2 text-slate-600">Solicitação do site para o ESP32 reenviar seu estado</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="font-bold text-sm text-slate-900 mb-2">Pinagem Física P10 (HUB75) &amp; Status</h3>
                <ul className="space-y-1.5 text-slate-700 font-mono">
                  <li>• <strong className="text-slate-900">PIN 32 (STATUS):</strong> Entrada do Semáforo com PULL-UP (Fase Vermelha / Verde)</li>
                  <li>• <strong className="text-slate-900">PIN 0 (BOOT):</strong> Segurar 2 segundos para forçar o Modo AP (192.168.4.1)</li>
                  <li>• <strong className="text-slate-900">Pinos HUB75:</strong> 25, 26, 27, 14, 12, 13, 23, 19, 5, 4, 15, 22</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="py-2 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition border border-slate-200 shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
