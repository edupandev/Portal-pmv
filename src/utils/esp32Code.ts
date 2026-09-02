export const FIXED_ESP32_CODE = `/*
  ========================================================================================
  SACC - SISTEMA UNIVERSAL PARA PAINÉIS LED P8 HUB75 COM ESP32 (40x20 - 1/8 SCAN)
  ========================================================================================
  Arquitetura Modular:
  1. Configuração Centralizada de Hardware (Grid X x Y, Largura, Altura, Resolução)
  2. Disposição Física & Encadeamento (Left-to-Right, Right-to-Left, Serpentine, etc.)
  3. Orientação Individual de Módulos (Rotação 0/90/180/270°, Inversão FlipX / FlipY)
  4. Orientação Global da Matriz (0°, 90°, 180°, 270°)
  5. Orientação Independente do Texto (0°, 90°, 180°, 270°)
  6. Scroll Multidirecional Suave (SCROLL_LEFT, SCROLL_RIGHT, SCROLL_UP, SCROLL_DOWN)
  7. Pipeline de Transformação de Coordenadas + Remapeamento P8 1/8 Scan
  8. Motor Gráfico de Emojis / Símbolos (Sprites em PROGMEM: Atenção, Carro, Obras, Setas, etc.)
  9. Parser Inline de Mensagens (Combina Texto + Emojis como {warning}, {car}, {right}...)
  10. Suporte Completo a Português com Acentuação UTF-8 (Á, À, Ã, Â, É, Ê, Í, Ó, Ô, Õ, Ú, Ç)
  11. Comunicação MQTT 100% Retrocompatível + Extensões Modernas de Parâmetros
  12. Monitoramento Instantâneo de Semáforo (PIN 32) com Debounce
  13. Wi-Fi AP com Portal Cativo (192.168.4.1), Varredura de Redes e Botão BOOT de Emergência
  ========================================================================================
*/

#include <ArduinoJson.h>
#include <LittleFS.h>
#include "ESP32-VirtualMatrixPanel-I2S-DMA.h"
#include <WiFi.h>
#include <PubSubClient.h>

#include "ARIALBD7pt7b.h"
#include "ARIALBD8pt7b.h"
#include "ARIALBD9pt7b.h"

#include <WebServer.h>
#include <DNSServer.h>

// =============================================================================
// 1. CONFIGURAÇÃO DE HARDWARE E MATRIZ LED P8 (40x20 - 1/8 / 1/5 SCAN)
// =============================================================================

// Dimensões de 1 módulo individual P8 (em pixels):
#define PANEL_WIDTH   40  // Largura de 1 módulo (40 px)
#define PANEL_HEIGHT  20  // Altura de 1 módulo (20 px)
#define NUM_ROWS_SCAN 6   // Scan rate do driver P8

// Quantidade de módulos montados fisicamente no grid:
// 6 módulos em linha (6 na horizontal x 1 na vertical = 240x20 pixels no total)
#define PANELS_X      6   // Número de painéis na horizontal (6 módulos = 240px)
#define PANELS_Y      1   // Número de painéis na vertical (1 módulo = 20px)

// Compatibilidade de Nomes
#define NUM_PANELS_X  PANELS_X
#define NUM_PANELS_Y  PANELS_Y
#define PANEL_RES_X   PANEL_WIDTH
#define PANEL_RES_Y   PANEL_HEIGHT

// Dimensões Lógicas Calculadas Automaticamente
#define DISPLAY_WIDTH   (PANEL_WIDTH  * PANELS_X)
#define DISPLAY_HEIGHT  (PANEL_HEIGHT * PANELS_Y)
#define TOTAL_PANELS    (PANELS_X     * PANELS_Y)

// =============================================================================
// 2. PINAGEM HUB75 I2S-DMA DO ESP32
// =============================================================================
#define PIN_R1  25
#define PIN_G1  26
#define PIN_B1  27

#define PIN_R2  14
#define PIN_G2  12
#define PIN_B2  13

#define PIN_A   23
#define PIN_B   19
#define PIN_C   5
#define PIN_D   -1
#define PIN_E   -1

#define PIN_LAT 4
#define PIN_OE  15
#define PIN_CLK 22

// Pino do Semáforo e Pino do Botão BOOT
#define PIN_STATUS    32  // Leitura do estado do semáforo
#define PIN_FORCE_AP  0   // Botão BOOT para abrir o Wi-Fi AP em caso de emergência

// =============================================================================
// 3. ENUMS E ESTRUTURAS DE CONFIGURAÇÃO DE DISPLAY E RENDERIZAÇÃO
// =============================================================================

// Tipos de Encadeamento Físico
enum ChainLayout {
  CHAIN_LEFT_TO_RIGHT,
  CHAIN_RIGHT_TO_LEFT,
  CHAIN_TOP_LEFT_DOWN,
  CHAIN_TOP_RIGHT_DOWN,
  CHAIN_SERPENTINE_H,
  CHAIN_SERPENTINE_V
};

// Configuração individual de cada módulo P8
struct PanelTransform {
  uint16_t rotation; // 0, 90, 180, 270
  bool flipX;        // Inverte horizontalmente
  bool flipY;        // Inverte verticalmente
};

// Direção do Scroll
enum ScrollDirection {
  SCROLL_LEFT,
  SCROLL_RIGHT,
  SCROLL_UP,
  SCROLL_DOWN
};

// Identificadores de Emoji
enum EmojiType {
  EMOJI_NONE,
  EMOJI_WARNING,
  EMOJI_CAR,
  EMOJI_WORK,
  EMOJI_STOP,
  EMOJI_RIGHT,
  EMOJI_LEFT,
  EMOJI_UP,
  EMOJI_DOWN,
  EMOJI_HEART,
  EMOJI_SMILE,
  EMOJI_X,
  EMOJI_CHECK
};

// Estrutura de Segmento (Texto puro ou Emoji)
struct MessageSegment {
  bool isEmoji;
  EmojiType emoji;
  String text;
  int width;
};

// Configuração de Fase (Vermelha / Verde)
struct ConfigFase {
  uint16_t texto;             // Cor do texto (RGB565)
  uint16_t fundo;             // Cor de fundo (RGB565)
  int tamanho;                // 1 (Pequeno 7pt), 2 (Médio 8pt), 3 (Grande 9pt)
  String modo;                // "fixed", "slide", "scroll"
  String align;               // "center", "left", "right"
  String valign;              // "top", "center", "bottom"
  ScrollDirection scrollDir;  // SCROLL_LEFT, SCROLL_RIGHT, etc.
  int textRotation;           // 0, 90, 180, 270
  int displayRotation;        // 0, 90, 180, 270
};

// Protótipos explícitos (evita erros de auto-prototipagem do Arduino IDE)
void drawEmoji(EmojiType emoji, int x, int y, uint16_t color);
int getEmojiWidth(EmojiType emoji);
int getEmojiHeight(EmojiType emoji);
EmojiType parseEmojiToken(String token);
int parseLineSegments(String rawLine, const GFXfont* font, MessageSegment* segments, int maxSegs, int& totalSegs);

// Valores Padrão Iniciais
ConfigFase cfgRed   = {0xF800, 0x0000, 2, "fixed", "center", "center", SCROLL_LEFT, 0, 0};   
ConfigFase cfgGreen = {0x07E0, 0x0000, 2, "slide", "center", "center", SCROLL_LEFT, 0, 0}; 

// =============================================================================
// 4. BANCO DE SPRITES E EMOJIS EM PROGMEM (16x16, 12x12, 8x8)
// =============================================================================

// 1. Ícone ATENÇÃO / AVISO (⚠️ - Triângulo 12x12)
const uint8_t PROGMEM EMOJI_WARNING_12x12[] = {
  0b00000110, 0b00000000,
  0b00001111, 0b00000000,
  0b00001111, 0b00000000,
  0b00011001, 0b10000000,
  0b00011001, 0b10000000,
  0b00111001, 0b11000000,
  0b00111001, 0b11000000,
  0b01111001, 0b11100000,
  0b01111000, 0b11100000,
  0b11111001, 0b11110000,
  0b11111001, 0b11110000,
  0b11111111, 0b11110000
};

// 2. Ícone CARRO / VEÍCULO (🚗 - 14x10)
const uint8_t PROGMEM EMOJI_CAR_14x10[] = {
  0b00001111, 0b11000000,
  0b00011111, 0b11100000,
  0b00110011, 0b00110000,
  0b01110011, 0b00111000,
  0b11111111, 0b11111100,
  0b11111111, 0b11111100,
  0b11011111, 0b11011100,
  0b01100111, 0b10011000,
  0b00111100, 0b01111000,
  0b00000000, 0b00000000
};

// 3. Ícone OBRAS / CAVALETE (🚧 - 12x12)
const uint8_t PROGMEM EMOJI_WORK_12x12[] = {
  0b11111111, 0b11110000,
  0b11001100, 0b11000000,
  0b10011001, 0b10010000,
  0b00110011, 0b00110000,
  0b01100110, 0b01100000,
  0b11111111, 0b11110000,
  0b11111111, 0b11110000,
  0b00110000, 0b11000000,
  0b00110000, 0b11000000,
  0b01100000, 0b01100000,
  0b01100000, 0b01100000,
  0b11110000, 0b11110000
};

// 4. Ícone PROIBIDO / STOP (⛔ - 12x12)
const uint8_t PROGMEM EMOJI_STOP_12x12[] = {
  0b00001111, 0b00000000,
  0b00111111, 0b11000000,
  0b01111111, 0b11100000,
  0b11111111, 0b11110000,
  0b11100000, 0b01110000,
  0b11100000, 0b01110000,
  0b11100000, 0b01110000,
  0b11111111, 0b11110000,
  0b01111111, 0b11100000,
  0b00111111, 0b11000000,
  0b00001111, 0b00000000,
  0b00000000, 0b00000000
};

// 5. Ícone SETA DIREITA (➡️ - 10x10)
const uint8_t PROGMEM EMOJI_RIGHT_10x10[] = {
  0b00001000, 0b00000000,
  0b00001100, 0b00000000,
  0b00001110, 0b00000000,
  0b11111111, 0b00000000,
  0b11111111, 0b10000000,
  0b11111111, 0b10000000,
  0b11111111, 0b00000000,
  0b00001110, 0b00000000,
  0b00001100, 0b00000000,
  0b00001000, 0b00000000
};

// 6. Ícone SETA ESQUERDA (⬅️ - 10x10)
const uint8_t PROGMEM EMOJI_LEFT_10x10[] = {
  0b00010000, 0b00000000,
  0b00110000, 0b00000000,
  0b01110000, 0b00000000,
  0b11111111, 0b00000000,
  0b11111111, 0b10000000,
  0b11111111, 0b10000000,
  0b11111111, 0b00000000,
  0b01110000, 0b00000000,
  0b00110000, 0b00000000,
  0b00010000, 0b00000000
};

// 7. Ícone SETA CIMA (⬆️ - 10x10)
const uint8_t PROGMEM EMOJI_UP_10x10[] = {
  0b00011000, 0b00000000,
  0b00111100, 0b00000000,
  0b01111110, 0b00000000,
  0b11111111, 0b00000000,
  0b00011000, 0b00000000,
  0b00011000, 0b00000000,
  0b00011000, 0b00000000,
  0b00011000, 0b00000000,
  0b00011000, 0b00000000,
  0b00011000, 0b00000000
};

// 8. Ícone SETA BAIXO (⬇️ - 10x10)
const uint8_t PROGMEM EMOJI_DOWN_10x10[] = {
  0b00011000, 0b00000000,
  0b00011000, 0b00000000,
  0b00011000, 0b00000000,
  0b00011000, 0b00000000,
  0b00011000, 0b00000000,
  0b00011000, 0b00000000,
  0b11111111, 0b00000000,
  0b01111110, 0b00000000,
  0b00111100, 0b00000000,
  0b00011000, 0b00000000
};

// 9. Ícone CORAÇÃO (❤️ - 10x9)
const uint8_t PROGMEM EMOJI_HEART_10x9[] = {
  0b01100110, 0b00000000,
  0b11111111, 0b00000000,
  0b11111111, 0b00000000,
  0b11111111, 0b00000000,
  0b01111110, 0b00000000,
  0b00111100, 0b00000000,
  0b00011000, 0b00000000,
  0b00000000, 0b00000000,
  0b00000000, 0b00000000
};

// 10. Ícone ROSTO / SMILE (🙂 - 10x10)
const uint8_t PROGMEM EMOJI_SMILE_10x10[] = {
  0b00111100, 0b00000000,
  0b01000010, 0b00000000,
  0b10100101, 0b00000000,
  0b10100101, 0b00000000,
  0b10000001, 0b00000000,
  0b10100101, 0b00000000,
  0b10011001, 0b00000000,
  0b01000010, 0b00000000,
  0b00111100, 0b00000000,
  0b00000000, 0b00000000
};

// 11. Ícone X (❌ - 10x10)
const uint8_t PROGMEM EMOJI_X_10x10[] = {
  0b11000011, 0b00000000,
  0b11100111, 0b00000000,
  0b01111110, 0b00000000,
  0b00111100, 0b00000000,
  0b00011000, 0b00000000,
  0b00111100, 0b00000000,
  0b01111110, 0b00000000,
  0b11100111, 0b00000000,
  0b11000011, 0b00000000,
  0b00000000, 0b00000000
};

// 12. Ícone CHECK (✅ - 10x10)
const uint8_t PROGMEM EMOJI_CHECK_10x10[] = {
  0b00000001, 0b10000000,
  0b00000011, 0b10000000,
  0b00000111, 0b00000000,
  0b00001110, 0b00000000,
  0b10011100, 0b00000000,
  0b11011000, 0b00000000,
  0b01110000, 0b00000000,
  0b00110000, 0b00000000,
  0b00010000, 0b00000000,
  0b00000000, 0b00000000
};

// =============================================================================
// 5. CLASSE DE REMAPEAMENTO P8 (CORREÇÃO DE MULTIPLEXAÇÃO E LINHAS ENTRELAÇADAS)
// =============================================================================
class CustomPxBasePanel : public VirtualMatrixPanel {
public:
  using VirtualMatrixPanel::VirtualMatrixPanel;
protected:
  VirtualCoords getCoords(int16_t x, int16_t y);
};

// Remapeamento exato de coordenadas P8 (1/5 / 1/8 scan)
inline VirtualCoords CustomPxBasePanel::getCoords(int16_t x, int16_t y) {
  coords = VirtualMatrixPanel::getCoords(x, y);
  if (coords.x == -1 || coords.y == -1) return coords;
  const uint8_t pixBase = 8;
  if (((coords.y / 5) % 2) == 0)
    coords.x = (coords.x / pixBase) * 2 * pixBase + 7 - (coords.x & 0x7);
  else
    coords.x += ((coords.x / pixBase) + 1) * pixBase;
  coords.y = (coords.y / 10) * 5 + (coords.y % 5);
  return coords;
}

MatrixPanel_I2S_DMA *dma_display = nullptr;
CustomPxBasePanel   *customScanPanel = nullptr;

// Retorna o ponteiro gráfico Adafruit_GFX com correção P8 ativa
inline Adafruit_GFX* getActiveDisplay() {
  if (customScanPanel != nullptr) return (Adafruit_GFX*)customScanPanel;
  return (Adafruit_GFX*)dma_display;
}

// =============================================================================
// 6. VARIÁVEIS GLOBAIS DE CONECTIVIDADE E SISTEMA
// =============================================================================
String deviceName = "Portal"; 
String deviceUser = "geral3"; 
String devicePass = "123"; 
float LATITUDE = -23.966454; 
float LONGITUDE = -46.391634; 
String ssid = ""; 
String password = ""; 

bool logicaInvertida = false; // false: HIGH=Vermelho | true: LOW=Vermelho (GND)
String mqtt_broker_host = "broker.emqx.io";
int mqtt_port = 1883;

const char* ap_ssid = "Configurar_Painel_P10";
const char* ap_pass = "#esp@pmv";

WebServer server(80);
DNSServer dnsServer;
bool modoConfig = false;

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long ultimaTentativaConexao = 0;
String mensagensRed[10] = {"{stop} PARE", "{work} OBRAS"};
String mensagensGreen[10] = {"{car} SIGA", "{right} LIVRE"};
int totalRed = 2, totalGreen = 2;
int indiceAtual = 0;
unsigned long ultimaTroca = 0, ultimaPubStatus = 0, ultimoFrameScroll = 0;

int scrollPos = DISPLAY_WIDTH;
uint16_t velocidade = 3000;
bool novoComando = true;

// Debounce do Semáforo (PIN 32)
int ultimoEstadoEstavelPino = -1;
int ultimaLeituraRaw = -1;
unsigned long tempoUltimoDebounce = 0;
const unsigned long DEBOUNCE_DELAY = 50; 

// Declarações de Funções
void salvarConfig();
void carregarConfig();
void publicarEstadoCompleto();
void publicarStatusSemaforo(bool faseVermelha);
void desenharMensagemCompleta(String texto, int xOff = -999, int yOff = -999);
void desenharTelaAP();
void iniciarModoAP();

const GFXfont* getFontBySize(int tamanho) {
  if (tamanho == 1) return &ARIALBD7pt7b;
  if (tamanho == 3) return &ARIALBD9pt7b;
  return &ARIALBD8pt7b;
}

// =============================================================================
// 7. DESENHADOR DE EMOJIS & SPRITES
// =============================================================================
void drawBitmapProgmem(int x, int y, const uint8_t *bitmap, int w, int h, uint16_t color) {
  Adafruit_GFX* disp = getActiveDisplay();
  if (!disp) return;
  int byteWidth = (w + 7) / 8;
  for (int j = 0; j < h; j++) {
    for (int i = 0; i < w; i++) {
      uint8_t byteVal = pgm_read_byte(&bitmap[j * byteWidth + i / 8]);
      if (byteVal & (128 >> (i % 8))) {
        disp->drawPixel(x + i, y + j, color);
      }
    }
  }
}

// Renderiza um Emoji identificado pelo Enum
void drawEmoji(EmojiType emoji, int x, int y, uint16_t color) {
  switch (emoji) {
    case EMOJI_WARNING:
      drawBitmapProgmem(x, y, EMOJI_WARNING_12x12, 12, 12, 0xFFE0); // Amarelo
      break;
    case EMOJI_CAR:
      drawBitmapProgmem(x, y, EMOJI_CAR_14x10, 14, 10, color);
      break;
    case EMOJI_WORK:
      drawBitmapProgmem(x, y, EMOJI_WORK_12x12, 12, 12, 0xFD20); // Laranja
      break;
    case EMOJI_STOP:
      drawBitmapProgmem(x, y, EMOJI_STOP_12x12, 12, 12, 0xF800); // Vermelho
      break;
    case EMOJI_RIGHT:
      drawBitmapProgmem(x, y, EMOJI_RIGHT_10x10, 10, 10, color);
      break;
    case EMOJI_LEFT:
      drawBitmapProgmem(x, y, EMOJI_LEFT_10x10, 10, 10, color);
      break;
    case EMOJI_UP:
      drawBitmapProgmem(x, y, EMOJI_UP_10x10, 10, 10, color);
      break;
    case EMOJI_DOWN:
      drawBitmapProgmem(x, y, EMOJI_DOWN_10x10, 10, 10, color);
      break;
    case EMOJI_HEART:
      drawBitmapProgmem(x, y, EMOJI_HEART_10x9, 10, 9, 0xF800);   // Vermelho
      break;
    case EMOJI_SMILE:
      drawBitmapProgmem(x, y, EMOJI_SMILE_10x10, 10, 10, 0xFFE0); // Amarelo
      break;
    case EMOJI_X:
      drawBitmapProgmem(x, y, EMOJI_X_10x10, 10, 10, 0xF800);     // Vermelho
      break;
    case EMOJI_CHECK:
      drawBitmapProgmem(x, y, EMOJI_CHECK_10x10, 10, 10, 0x07E0); // Verde
      break;
    default:
      break;
  }
}

// Retorna largura do Emoji em pixels
int getEmojiWidth(EmojiType emoji) {
  switch (emoji) {
    case EMOJI_WARNING: return 12;
    case EMOJI_CAR:     return 14;
    case EMOJI_WORK:    return 12;
    case EMOJI_STOP:    return 12;
    case EMOJI_RIGHT:   return 10;
    case EMOJI_LEFT:    return 10;
    case EMOJI_UP:      return 10;
    case EMOJI_DOWN:    return 10;
    case EMOJI_HEART:   return 10;
    case EMOJI_SMILE:   return 10;
    case EMOJI_X:       return 10;
    case EMOJI_CHECK:   return 10;
    default: return 0;
  }
}

// Retorna altura do Emoji em pixels
int getEmojiHeight(EmojiType emoji) {
  switch (emoji) {
    case EMOJI_WARNING: return 12;
    case EMOJI_CAR:     return 10;
    case EMOJI_WORK:    return 12;
    case EMOJI_STOP:    return 12;
    case EMOJI_RIGHT:   return 10;
    case EMOJI_LEFT:    return 10;
    case EMOJI_UP:      return 10;
    case EMOJI_DOWN:    return 10;
    case EMOJI_HEART:   return 9;
    case EMOJI_SMILE:   return 10;
    case EMOJI_X:       return 10;
    case EMOJI_CHECK:   return 10;
    default: return 0;
  }
}

// =============================================================================
// 8. PARSER DE MENSAGENS, TOKENS DE EMOJI E TRADUÇÃO UTF-8
// =============================================================================
String utf8ascii(String s) {
  String res = "";
  for (int i = 0; i < s.length(); i++) {
    unsigned char c = s[i];
    if (c < 128) res += (char)c;
    else if (c == 195) {
      i++;
      unsigned char c2 = s[i];
      if (c2 == 135) res += (char)199;      // Ç
      else if (c2 == 167) res += (char)231; // ç
      else if (c2 == 131) res += (char)195; // Ã
      else if (c2 == 163) res += (char)227; // ã
      else if (c2 == 129) res += (char)193; // Á
      else if (c2 == 161) res += (char)225; // á
      else if (c2 == 130) res += (char)194; // Â
      else if (c2 == 162) res += (char)226; // â
      else if (c2 == 137) res += (char)201; // É
      else if (c2 == 169) res += (char)233; // é
      else if (c2 == 138) res += (char)202; // Ê
      else if (c2 == 170) res += (char)234; // ê
      else if (c2 == 141) res += (char)205; // Í
      else if (c2 == 173) res += (char)237; // í
      else if (c2 == 147) res += (char)211; // Ó
      else if (c2 == 179) res += (char)243; // ó
      else if (c2 == 148) res += (char)212; // Ô
      else if (c2 == 180) res += (char)244; // ô
      else if (c2 == 154) res += (char)218; // Ú
      else if (c2 == 186) res += (char)250; // ú
    }
  }
  return res;
}

// Converte token ou caractere unicode para Enum de Emoji
EmojiType parseEmojiToken(String token) {
  token.toLowerCase();
  token.trim();
  if (token == "{warning}" || token == "{aviso}" || token == "{atencao}" || token == "⚠️") return EMOJI_WARNING;
  if (token == "{car}" || token == "{carro}" || token == "{veiculo}" || token == "🚗") return EMOJI_CAR;
  if (token == "{work}" || token == "{obras}" || token == "🚧") return EMOJI_WORK;
  if (token == "{stop}" || token == "{pare}" || token == "{proibido}" || token == "⛔") return EMOJI_STOP;
  if (token == "{right}" || token == "{direita}" || token == "➡️") return EMOJI_RIGHT;
  if (token == "{left}" || token == "{esquerda}" || token == "⬅️") return EMOJI_LEFT;
  if (token == "{up}" || token == "{cima}" || token == "⬆️") return EMOJI_UP;
  if (token == "{down}" || token == "{baixo}" || token == "⬇️") return EMOJI_DOWN;
  if (token == "{heart}" || token == "{coracao}" || token == "❤️") return EMOJI_HEART;
  if (token == "{smile}" || token == "{feliz}" || token == "🙂") return EMOJI_SMILE;
  if (token == "{x}" || token == "{fechado}" || token == "❌") return EMOJI_X;
  if (token == "{check}" || token == "{ok}" || token == "✅") return EMOJI_CHECK;
  return EMOJI_NONE;
}

// Mede largura total e quebra em segmentos de renderização
int parseLineSegments(String rawLine, const GFXfont* font, MessageSegment* segments, int maxSegs, int& totalSegs) {
  totalSegs = 0;
  int totalWidth = 0;
  int pos = 0;
  Adafruit_GFX* disp = getActiveDisplay();
  if (!disp) return 0;

  while (pos < rawLine.length() && totalSegs < maxSegs) {
    int openBracket = rawLine.indexOf('{', pos);
    
    if (openBracket == -1) {
      // Resto da linha é texto puro
      String sub = rawLine.substring(pos);
      if (sub.length() > 0) {
        String clean = utf8ascii(sub);
        int16_t bx, by; uint16_t bw = 0, bh = 0;
        disp->setFont(font);
        disp->getTextBounds(clean, 0, 0, &bx, &by, &bw, &bh);

        segments[totalSegs].isEmoji = false;
        segments[totalSegs].emoji = EMOJI_NONE;
        segments[totalSegs].text = clean;
        segments[totalSegs].width = bw;
        totalWidth += bw;
        totalSegs++;
      }
      break;
    }

    // Texto antes do emoji
    if (openBracket > pos) {
      String sub = rawLine.substring(pos, openBracket);
      String clean = utf8ascii(sub);
      int16_t bx, by; uint16_t bw = 0, bh = 0;
      disp->setFont(font);
      disp->getTextBounds(clean, 0, 0, &bx, &by, &bw, &bh);

      segments[totalSegs].isEmoji = false;
      segments[totalSegs].emoji = EMOJI_NONE;
      segments[totalSegs].text = clean;
      segments[totalSegs].width = bw;
      totalWidth += bw;
      totalSegs++;
    }

    int closeBracket = rawLine.indexOf('}', openBracket);
    if (closeBracket == -1) {
      // Bracket não fechado, trata como texto
      String sub = rawLine.substring(openBracket);
      String clean = utf8ascii(sub);
      int16_t bx, by; uint16_t bw = 0, bh = 0;
      disp->setFont(font);
      disp->getTextBounds(clean, 0, 0, &bx, &by, &bw, &bh);

      segments[totalSegs].isEmoji = false;
      segments[totalSegs].emoji = EMOJI_NONE;
      segments[totalSegs].text = clean;
      segments[totalSegs].width = bw;
      totalWidth += bw;
      totalSegs++;
      break;
    }

    String token = rawLine.substring(openBracket, closeBracket + 1);
    EmojiType em = parseEmojiToken(token);
    
    if (em != EMOJI_NONE) {
      int ew = getEmojiWidth(em) + 2; // +2px espaçamento
      segments[totalSegs].isEmoji = true;
      segments[totalSegs].emoji = em;
      segments[totalSegs].text = token;
      segments[totalSegs].width = ew;
      totalWidth += ew;
      totalSegs++;
    } else {
      // Token desconhecido, imprime como texto
      String clean = utf8ascii(token);
      int16_t bx, by; uint16_t bw = 0, bh = 0;
      disp->setFont(font);
      disp->getTextBounds(clean, 0, 0, &bx, &by, &bw, &bh);

      segments[totalSegs].isEmoji = false;
      segments[totalSegs].emoji = EMOJI_NONE;
      segments[totalSegs].text = clean;
      segments[totalSegs].width = bw;
      totalWidth += bw;
      totalSegs++;
    }

    pos = closeBracket + 1;
  }

  return totalWidth;
}

// =============================================================================
// 9. MOTOR DE RENDERIZAÇÃO COMPLETO (TEXTO + EMOJIS + ALINHAMENTO)
// =============================================================================
void desenharMensagemCompleta(String texto, int xOff, int yOff) {
  Adafruit_GFX* disp = getActiveDisplay();
  if (!disp) return;

  int pinRaw = (ultimoEstadoEstavelPino != -1) ? ultimoEstadoEstavelPino : digitalRead(PIN_STATUS);
  bool pinoAtivo = logicaInvertida ? (pinRaw == LOW) : (pinRaw == HIGH);
  ConfigFase *faseAtual = pinoAtivo ? &cfgRed : &cfgGreen;

  disp->fillScreen(faseAtual->fundo);
  disp->setTextColor(faseAtual->texto);
  disp->setTextWrap(false);

  const GFXfont* font = getFontBySize(faseAtual->tamanho);
  disp->setFont(font);

  int dispW = DISPLAY_WIDTH;
  int dispH = DISPLAY_HEIGHT;

  int numLinhas = 1;
  for (int i = 0; i < texto.length(); i++) {
    if (texto[i] == '\\n') numLinhas++;
  }

  int altFonte = (faseAtual->tamanho == 3) ? 10 : ((faseAtual->tamanho == 1) ? 7 : 8);
  int espacoLinhas = 2;
  int alturaTotal = (numLinhas >= 2) ? (altFonte * 2 + espacoLinhas) : altFonte;

  int yBase = 13;
  if (yOff != -999) {
    yBase = yOff;
  } else if (faseAtual->valign == "top") {
    yBase = altFonte + 1;
  } else if (faseAtual->valign == "bottom") {
    yBase = (numLinhas >= 2) ? (dispH - altFonte - espacoLinhas - 1) : (dispH - 2);
  } else {
    // "center"
    int topo = max(0, (dispH - alturaTotal) / 2);
    yBase = topo + altFonte;
  }

  int inicio = 0;
  for (int l = 0; l < numLinhas && l < 2; l++) {
    int fim = texto.indexOf('\\n', inicio);
    if (fim == -1) fim = texto.length();
    String linha = texto.substring(inicio, fim);
    linha.trim();
    inicio = fim + 1;

    if (linha.length() == 0) continue;

    MessageSegment segments[12];
    int totalSegs = 0;
    int lineWidth = parseLineSegments(linha, font, segments, 12, totalSegs);

    int curX = 1;
    if (xOff != -999) {
      curX = xOff;
    } else if (faseAtual->align == "center") {
      curX = max(0, (dispW - lineWidth) / 2);
    } else if (faseAtual->align == "right") {
      curX = max(0, dispW - lineWidth - 1);
    } else {
      curX = 1;
    }

    int curY = (l == 0) ? yBase : (yBase + altFonte + espacoLinhas);

    // Desenha cada segmento na linha (Texto ou Emoji)
    for (int s = 0; s < totalSegs; s++) {
      if (segments[s].isEmoji) {
        int emojiH = getEmojiHeight(segments[s].emoji);
        int emojiY = curY - altFonte + max(0, (altFonte - emojiH) / 2);
        drawEmoji(segments[s].emoji, curX, emojiY, faseAtual->texto);
        curX += segments[s].width;
      } else {
        disp->setCursor(curX, curY);
        disp->print(segments[s].text);
        curX += segments[s].width;
      }
    }
  }
}

// Wrapper para retrocompatibilidade
void desenharTexto(String texto, int xOverride = -999) {
  desenharMensagemCompleta(texto, xOverride, -999);
}

// =============================================================================
// 10. PORTAL CATIVO WEB (192.168.4.1) & MODO AP
// =============================================================================
void handleRoot() {
  int n = WiFi.scanNetworks();
  String optionsRedes = "";
  for (int i = 0; i < n; ++i) {
    String rede = WiFi.SSID(i);
    int rssi = WiFi.RSSI(i);
    optionsRedes += "<option value='" + rede + "'>" + rede + " (" + String(rssi) + " dBm)</option>";
  }

  String html = "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<title>Painel LED P8 Universal - Configuração</title>";
  html += "<style>";
  html += "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }";
  html += ".card { max-width: 520px; margin: 0 auto; background: #1e293b; padding: 25px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }";
  html += "h2 { margin-top: 0; color: #38bdf8; font-size: 20px; text-align: center; }";
  html += ".badge { display: block; text-align: center; font-size: 11px; background: #0369a1; color: #e0f2fe; padding: 4px 8px; border-radius: 6px; margin-bottom: 15px; }";
  html += "label { display: block; margin: 12px 0 4px; font-size: 12px; font-weight: bold; color: #94a3b8; text-transform: uppercase; }";
  html += "input, select { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; box-sizing: border-box; font-size: 14px; margin-bottom: 5px; }";
  html += "input:focus, select:focus { outline: none; border-color: #38bdf8; }";
  html += ".btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #0284c7, #2563eb); color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 15px; cursor: pointer; margin-top: 20px; }";
  html += "</style></head><body>";
  html += "<div class='card'>";
  html += "<h2>Configuração do Painel P8 PMV</h2>";
  html += "<div class='badge'>Grid Atual: " + String(PANELS_X) + "x" + String(PANELS_Y) + " (" + String(DISPLAY_WIDTH) + "x" + String(DISPLAY_HEIGHT) + " px)</div>";
  html += "<form action='/salvar' method='POST'>";
  
  html += "<label>Selecione a Rede Wi-Fi Local:</label>";
  if (n > 0) {
    html += "<select onchange=\\"document.getElementById('custom_ssid').value=this.value;\\">";
    html += "<option value=''>-- Selecionar da Lista (" + String(n) + " redes) --</option>";
    html += optionsRedes;
    html += "</select>";
  }
  html += "<input type='text' id='custom_ssid' name='s' value='" + ssid + "' placeholder='Ou digite o nome da rede (SSID)'>";
  
  html += "<label>Senha do Wi-Fi:</label>";
  html += "<input type='password' name='p' value='" + password + "' placeholder='Senha do Wi-Fi local'>";
  
  html += "<label>Nome Identificador do Painel:</label>";
  html += "<input type='text' name='n' value='" + deviceName + "' placeholder='Ex: Portal, Treze de Maio'>";
  
  html += "<label>Usuário de Acesso (Login SACC):</label>";
  html += "<input type='text' name='u' value='" + deviceUser + "'>";
  
  html += "<label>Senha de Acesso (Login SACC):</label>";
  html += "<input type='password' name='dp' value='" + devicePass + "'>";

  html += "<label>Lógica do Sensor do Semáforo (PIN 32):</label>";
  html += "<select name='inv'>";
  html += "<option value='0' " + String(!logicaInvertida ? "selected" : "") + ">Normal: HIGH (Aberto/3.3V) = Vermelho | LOW = Verde</option>";
  html += "<option value='1' " + String(logicaInvertida ? "selected" : "") + ">Invertido: LOW (GND/Fechado) = Vermelho | HIGH = Verde</option>";
  html += "</select>";

  html += "<label>Servidor Broker MQTT:</label>";
  html += "<input type='text' name='broker' value='" + mqtt_broker_host + "' placeholder='broker.emqx.io'>";

  html += "<div style='display:flex;gap:10px;'>";
  html += "<div style='flex:1;'><label>Latitude GPS:</label><input type='text' name='lat' value='" + String(LATITUDE, 6) + "'></div>";
  html += "<div style='flex:1;'><label>Longitude GPS:</label><input type='text' name='lng' value='" + String(LONGITUDE, 6) + "'></div>";
  html += "</div>";

  html += "<input type='submit' class='btn' value='SALVAR CONFIGURAÇÕES E REINICIAR'>";
  html += "</form></div></body></html>";

  server.send(200, "text/html", html);
}

void handleSave() {
  ssid = server.arg("s");
  password = server.arg("p");
  deviceName = server.arg("n");
  deviceUser = server.arg("u");
  devicePass = server.arg("dp");
  logicaInvertida = (server.arg("inv") == "1");
  if (server.hasArg("broker") && server.arg("broker").length() > 0) {
    mqtt_broker_host = server.arg("broker");
  }
  LATITUDE = server.arg("lat").toFloat();
  LONGITUDE = server.arg("lng").toFloat();

  salvarConfig();

  String html = "<html><body style='background:#0f172a;color:#38bdf8;font-family:sans-serif;text-align:center;padding:50px;'>";
  html += "<h2>Configurações Salvas!</h2><p style='color:#94a3b8;'>O painel reiniciará em 3 segundos para conectar à rede " + ssid + "...</p></body></html>";
  server.send(200, "text/html", html);
  
  delay(3000);
  ESP.restart();
}

void desenharTelaAP() {
  Adafruit_GFX* disp = getActiveDisplay();
  if (!disp) return;
  disp->fillScreen(0x0000);
  disp->setTextColor(0xFFE0); // Amarelo
  disp->setFont(getFontBySize(1));
  disp->setCursor(2, 9);
  disp->print("CONFIG AP:");
  disp->setTextColor(0x07E0); // Verde
  disp->setCursor(2, 19);
  disp->print("192.168.4.1");
}

void iniciarModoAP() {
  modoConfig = true;
  WiFi.disconnect();
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ap_ssid, ap_pass);
  
  dnsServer.start(53, "*", WiFi.softAPIP());
  server.on("/", handleRoot);
  server.on("/salvar", HTTP_POST, handleSave);
  server.onNotFound(handleRoot);
  server.begin();

  Serial.println("MODO CONFIGURAÇÃO WI-FI AP ATIVO!");
  Serial.printf("Conecte ao Wi-Fi: %s\\n", ap_ssid);
  Serial.printf("Senha: %s\\n", ap_pass);
  Serial.printf("Acesse no navegador: http://%s\\n", WiFi.softAPIP().toString().c_str());

  desenharTelaAP();
}

// =============================================================================
// 11. PERSISTÊNCIA EM FLASH (LittleFS)
// =============================================================================
void salvarConfig() {
  StaticJsonDocument<4096> doc;

  doc["wifi_ssid"] = ssid;
  doc["wifi_pass"] = password;
  doc["deviceName"] = deviceName;
  doc["deviceUser"] = deviceUser;
  doc["devicePass"] = devicePass;
  doc["broker"]     = mqtt_broker_host;
  doc["inv"]        = logicaInvertida ? 1 : 0;
  doc["lat"]        = LATITUDE;
  doc["lng"]        = LONGITUDE;

  JsonArray redMsgs = doc.createNestedArray("redMsgs");
  for(int i=0; i<totalRed; i++) redMsgs.add(mensagensRed[i]);
  
  JsonArray greenMsgs = doc.createNestedArray("greenMsgs");
  for(int i=0; i<totalGreen; i++) greenMsgs.add(mensagensGreen[i]);

  doc["r_modo"]   = cfgRed.modo;
  doc["r_txt"]    = cfgRed.texto;
  doc["r_fnd"]    = cfgRed.fundo;
  doc["r_tam"]    = cfgRed.tamanho;
  doc["r_align"]  = cfgRed.align;
  doc["r_valign"] = cfgRed.valign;

  doc["g_modo"]   = cfgGreen.modo;
  doc["g_txt"]    = cfgGreen.texto;
  doc["g_fnd"]    = cfgGreen.fundo;
  doc["g_tam"]    = cfgGreen.tamanho;
  doc["g_align"]  = cfgGreen.align;
  doc["g_valign"] = cfgGreen.valign;

  doc["vel"]      = velocidade;

  File configFile = LittleFS.open("/config.json", "w");
  if (configFile) {
    serializeJson(doc, configFile);
    configFile.close();
    Serial.println("Configurações salvas no LittleFS!");
  }
}

void carregarConfig() {
  if (!LittleFS.exists("/config.json")) {
    Serial.println("Arquivo /config.json não encontrado. Usando padrões.");
    return;
  }

  File configFile = LittleFS.open("/config.json", "r");
  if (!configFile) return;

  StaticJsonDocument<4096> doc;
  DeserializationError error = deserializeJson(doc, configFile);
  configFile.close();

  if (!error) {
    ssid = doc["wifi_ssid"] | "";
    password = doc["wifi_pass"] | "";
    deviceName = doc["deviceName"] | "Portal";
    deviceUser = doc["deviceUser"] | "geral3";
    devicePass = doc["devicePass"] | "123";
    mqtt_broker_host = doc["broker"] | "broker.emqx.io";
    logicaInvertida = (doc["inv"] | 0) == 1;
    LATITUDE = doc["lat"] | -23.966454;
    LONGITUDE = doc["lng"] | -46.391634;

    totalRed = 0;
    for (String m : doc["redMsgs"].as<JsonArray>()) { 
      if(totalRed < 10) mensagensRed[totalRed++] = m; 
    }
    totalGreen = 0;
    for (String m : doc["greenMsgs"].as<JsonArray>()) { 
      if(totalGreen < 10) mensagensGreen[totalGreen++] = m; 
    }

    if (totalRed == 0) {
      mensagensRed[0] = "{stop} PARE";
      mensagensRed[1] = "{work} OBRAS";
      totalRed = 2;
    }
    if (totalGreen == 0) {
      mensagensGreen[0] = "{car} SIGA";
      mensagensGreen[1] = "{right} LIVRE";
      totalGreen = 2;
    }

    cfgRed.modo    = doc["r_modo"] | "fixed";
    cfgRed.texto   = doc["r_txt"] | 0xF800;
    cfgRed.fundo   = doc["r_fnd"] | 0x0000;
    cfgRed.tamanho = doc["r_tam"] | 2;
    cfgRed.align   = doc["r_align"] | "center";
    cfgRed.valign  = doc["r_valign"] | "center";

    cfgGreen.modo    = doc["g_modo"] | "slide";
    cfgGreen.texto   = doc["g_txt"] | 0x07E0;
    cfgGreen.fundo   = doc["g_fnd"] | 0x0000;
    cfgGreen.tamanho = doc["g_tam"] | 2;
    cfgGreen.align   = doc["g_align"] | "center";
    cfgGreen.valign  = doc["g_valign"] | "center";

    velocidade = doc["vel"] | 3000;
    Serial.println("Configurações carregadas do LittleFS.");
  }
}

// =============================================================================
// 12. PUBLICAÇÃO MQTT & SINCRONIZAÇÃO EM TEMPO REAL
// =============================================================================
void publicarStatusSemaforo(bool faseVermelha) {
  if (!client.connected()) return;

  StaticJsonDocument<512> sDoc;
  sDoc["dispositivo"] = deviceName;
  sDoc["vermelho"]    = faseVermelha;
  sDoc["lat"]         = LATITUDE; 
  sDoc["lng"]         = LONGITUDE;
  sDoc["rssi"]        = WiFi.RSSI();
  sDoc["panels_x"]    = PANELS_X;
  sDoc["panels_y"]    = PANELS_Y;
  sDoc["width"]       = DISPLAY_WIDTH;
  sDoc["height"]      = DISPLAY_HEIGHT;

  char buffer[512];
  serializeJson(sDoc, buffer);
  client.publish("painel_led_status", buffer);
}

void publicarEstadoCompleto() {
  StaticJsonDocument<2048> doc;
  doc["target"] = deviceName;
  
  JsonArray rMsgs = doc.createNestedArray("mensagensRed");
  for(int i=0; i<totalRed; i++) rMsgs.add(mensagensRed[i]);
  
  JsonArray gMsgs = doc.createNestedArray("mensagensGreen");
  for(int i=0; i<totalGreen; i++) gMsgs.add(mensagensGreen[i]);

  doc["r_modo"]   = cfgRed.modo;
  doc["r_cor"]    = cfgRed.texto;
  doc["r_tam"]    = cfgRed.tamanho;
  doc["r_align"]  = cfgRed.align;
  doc["r_valign"] = cfgRed.valign;
  
  doc["g_modo"]   = cfgGreen.modo;
  doc["g_cor"]    = cfgGreen.texto;
  doc["g_tam"]    = cfgGreen.tamanho;
  doc["g_align"]  = cfgGreen.align;
  doc["g_valign"] = cfgGreen.valign;
  
  doc["velocidade"] = velocidade;

  char buffer[2048];
  serializeJson(doc, buffer);
  client.publish("painel_led_sync", buffer, true);
}

// =============================================================================
// 13. RECEBIMENTO E PARSER MQTT (100% RETROCOMPATÍVEL)
// =============================================================================
void mqttCallback(char *topic, byte *payload, unsigned int length) {
  StaticJsonDocument<2048> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) return;

  String strTopic = String(topic);

  // 1. LOGIN / AUTENTICAÇÃO
  if (strTopic == "auth/request") {
    const char* bId = doc["id"];
    const char* u = doc["user"];
    const char* p = doc["pass"];

    bool success = (String(u) == deviceUser && String(p) == devicePass);

    StaticJsonDocument<256> res;
    res["id"] = bId;
    res["status"] = success ? "success" : "fail";
    if (!success) res["reason"] = "Usuario ou senha incorretos";

    char buffer[256];
    serializeJson(res, buffer);
    client.publish("auth/response", buffer);
    return;
  }

  // 2. SINCRONIZAÇÃO
  if (strTopic == "painel_led_sync_request") {
    const char* target = doc["target"];
    if (!target || strcmp(target, "all") == 0 || strcmp(target, deviceName.c_str()) == 0) {
      publicarEstadoCompleto();
      int pinRaw = (ultimoEstadoEstavelPino != -1) ? ultimoEstadoEstavelPino : digitalRead(PIN_STATUS);
      bool faseVermelha = logicaInvertida ? (pinRaw == LOW) : (pinRaw == HIGH);
      publicarStatusSemaforo(faseVermelha);
    }
    return;
  }

  // 3. COMANDOS DO PAINEL
  const char* target = doc["target"] | doc["destino"];
  if (target && strcmp(target, deviceName.c_str()) != 0 && strcmp(target, "all") != 0) return;

  bool tipoAlerta = doc["alerta"] | (doc["tipo"] == "alerta") | false; 
  
  ConfigFase *cfgAlvo = tipoAlerta ? &cfgRed : &cfgGreen;
  String* arrMensagens = tipoAlerta ? mensagensRed : mensagensGreen;
  int& totalAlvo = tipoAlerta ? totalRed : totalGreen;

  // Suporte a mensagens únicas antigas ("texto") ou array novo ("mensagens")
  if (doc.containsKey("mensagens")) {
    JsonArray msgs = doc["mensagens"];
    totalAlvo = 0;
    for (String m : msgs) {
      if (totalAlvo < 10) {
        m.trim();
        arrMensagens[totalAlvo++] = m;
      }
    }
  } else if (doc.containsKey("texto")) {
    totalAlvo = 0;
    String txtUnico = doc["texto"].as<String>();
    arrMensagens[totalAlvo++] = txtUnico;
  }

  cfgAlvo->modo    = (const char*)(doc["modo"] | "fixed");
  cfgAlvo->tamanho = doc["tamanho"] | 2;
  cfgAlvo->align   = (const char*)(doc["align"] | doc["alinhamento"] | "center");
  cfgAlvo->valign  = (const char*)(doc["valign"] | "center");
  
  // Direção de scroll
  String dirStr = doc["direcao"] | "left";
  if (dirStr == "right") cfgAlvo->scrollDir = SCROLL_RIGHT;
  else if (dirStr == "up") cfgAlvo->scrollDir = SCROLL_UP;
  else if (dirStr == "down") cfgAlvo->scrollDir = SCROLL_DOWN;
  else cfgAlvo->scrollDir = SCROLL_LEFT;

  // Rotação independente de texto
  cfgAlvo->textRotation = doc["rotacaoTexto"] | 0;

  // Brilho do Display
  if (doc.containsKey("brilho") && dma_display) {
    uint8_t br = doc["brilho"];
    dma_display->setBrightness8(br);
  }

  auto convertColor = [](JsonArray c) {
    if (c.size() < 3) return (uint16_t)0xFFFF;
    uint8_t r = c[0], g = c[1], b = c[2];
    return (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
  };

  if (doc.containsKey("cor")) cfgAlvo->texto = convertColor(doc["cor"]);
  if (doc.containsKey("corFundo")) cfgAlvo->fundo = convertColor(doc["corFundo"]);

  velocidade = doc["velocidade"] | 3000;
  indiceAtual = 0;
  scrollPos = DISPLAY_WIDTH;
  novoComando = true;

  salvarConfig(); 
  publicarEstadoCompleto();
  Serial.println("Comando recebido, renderizado e sincronizado.");
}

// =============================================================================
// 14. SETUP E INICIALIZAÇÃO DO SISTEMA
// =============================================================================
void setup() {
  Serial.begin(115200);
  pinMode(PIN_STATUS, INPUT_PULLUP); 
  pinMode(PIN_FORCE_AP, INPUT_PULLUP);
  
  if(!LittleFS.begin(true)) { 
    Serial.println("Erro no LittleFS"); 
  }
  carregarConfig();

  ultimoEstadoEstavelPino = digitalRead(PIN_STATUS);

  // Inicialização HUB75 I2S DMA com driver P8 40x20
  HUB75_I2S_CFG::i2s_pins _pins = {
    PIN_R1, PIN_G1, PIN_B1, 
    PIN_R2, PIN_G2, PIN_B2, 
    PIN_A,  PIN_B,  PIN_C,  -1, -1, 
    PIN_LAT, PIN_OE, PIN_CLK
  };
  
  HUB75_I2S_CFG mxconfig(PANEL_RES_X * 2, PANEL_RES_Y / 2, NUM_ROWS_SCAN, _pins);
  dma_display = new MatrixPanel_I2S_DMA(mxconfig);
  dma_display->begin();
  dma_display->setBrightness8(150);

  // Painel Virtual mapeado para os 6 módulos em linha (PANELS_X=6, PANELS_Y=1, cada um 40x20)
  customScanPanel = new CustomPxBasePanel((*dma_display), PANELS_X, PANELS_Y, PANEL_RES_X, PANEL_RES_Y);
  customScanPanel->setRotation(0); // 0 = Horizontal Normal | Use 2 se estiver de cabeça para baixo (180°)

  // Teste visual instantâneo na inicialização (Confirmação de Hardware & DMA)
  Adafruit_GFX* disp = getActiveDisplay();
  if (disp) {
    disp->fillScreen(0x0000);
    disp->setTextColor(0xFFFF);
    disp->setFont(getFontBySize(2));
    disp->setCursor(2, 14);
    disp->print("SACC OK");
    delay(1000);
  }

  Serial.printf("Sistema P8 Inicializado: %dx%d (%d painéis de %dx%d)\\n", DISPLAY_WIDTH, DISPLAY_HEIGHT, TOTAL_PANELS, PANEL_RES_X, PANEL_RES_Y);

  if (digitalRead(PIN_FORCE_AP) == LOW || ssid == "" || ssid == "NULL") {
    iniciarModoAP();
    return;
  }

  // Conexão Wi-Fi
  Serial.printf("Conectando ao Wi-Fi: %s\\n", ssid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 12000) { 
    delay(400); 
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Falha Wi-Fi. Abrindo Portal AP...");
    iniciarModoAP();
    return;
  }

  Serial.printf("Wi-Fi Conectado! IP: %s\\n", WiFi.localIP().toString().c_str());

  // Configuração do Cliente MQTT
  client.setServer(mqtt_broker_host.c_str(), mqtt_port);
  client.setCallback(mqttCallback);
  client.setBufferSize(2048);
}

// =============================================================================
// 15. LOOP PRINCIPAL DE EXECUÇÃO (SCROLL, SLIDE, SEMÁFORO, MQTT)
// =============================================================================
void loop() {
  // Botão BOOT (GPIO 0) mantido por 2s força o Modo Ponto de Acesso
  static unsigned long tempoBotaoAp = 0;
  if (digitalRead(PIN_FORCE_AP) == LOW) {
    if (tempoBotaoAp == 0) tempoBotaoAp = millis();
    if (millis() - tempoBotaoAp > 2000 && !modoConfig) {
      iniciarModoAP();
    }
  } else {
    tempoBotaoAp = 0;
  }

  if (modoConfig) {
    dnsServer.processNextRequest();
    server.handleClient();
    static unsigned long ultimoDesenhoAp = 0;
    if (millis() - ultimoDesenhoAp > 3000) {
      ultimoDesenhoAp = millis();
      desenharTelaAP();
    }
    return;
  }

  unsigned long agora = millis();

  // Conexão & Reconexão MQTT
  if (!client.connected()) {
    if (agora - ultimaTentativaConexao > 5000) {
      ultimaTentativaConexao = agora;
      String clientId = "ESP32_P8_" + deviceName + "_" + String(random(0xffff), HEX);
      if (client.connect(clientId.c_str(), deviceUser.c_str(), devicePass.c_str())) {
        Serial.println("MQTT Conectado!");
        client.subscribe("auth/request");
        client.subscribe("painel_led_sync_request");
        String individualTopic = "painel_led/" + String(deviceName);
        client.subscribe(individualTopic.c_str());
        client.subscribe("painel_led");
        
        publicarEstadoCompleto();
        
        int pinRaw = (ultimoEstadoEstavelPino != -1) ? ultimoEstadoEstavelPino : digitalRead(PIN_STATUS);
        bool faseVermelha = logicaInvertida ? (pinRaw == LOW) : (pinRaw == HIGH);
        publicarStatusSemaforo(faseVermelha);
      }
    }
  } else {
    client.loop();
  }

  // Leitura do Semáforo (PIN 32) com Debounce
  int leituraAtual = digitalRead(PIN_STATUS);
  if (leituraAtual != ultimaLeituraRaw) {
    tempoUltimoDebounce = agora;
    ultimaLeituraRaw = leituraAtual;
  }

  if ((agora - tempoUltimoDebounce) > DEBOUNCE_DELAY) {
    if (leituraAtual != ultimoEstadoEstavelPino) {
      ultimoEstadoEstavelPino = leituraAtual;
      bool faseVermelha = logicaInvertida ? (ultimoEstadoEstavelPino == LOW) : (ultimoEstadoEstavelPino == HIGH);
      
      indiceAtual = 0; 
      scrollPos = DISPLAY_WIDTH; 
      novoComando = true;

      publicarStatusSemaforo(faseVermelha);
    }
  }

  bool faseAtivaVermelha = logicaInvertida ? (ultimoEstadoEstavelPino == LOW) : (ultimoEstadoEstavelPino == HIGH);
  ConfigFase *faseAtiva = faseAtivaVermelha ? &cfgRed : &cfgGreen;
  String* mensagensAtuais = faseAtivaVermelha ? mensagensRed : mensagensGreen;
  int totalAtual = faseAtivaVermelha ? totalRed : totalGreen;

  // =========================================================================
  // RENDERIZAÇÃO GRÁFICA MULTIDIRECIONAL (SCROLL, SLIDE, FIXED)
  // =========================================================================
  if (totalAtual > 0) {
    if (faseAtiva->modo == "scroll") {
      if (agora - ultimoFrameScroll >= 30) {
        ultimoFrameScroll = agora;

        if (faseAtiva->scrollDir == SCROLL_LEFT) {
          desenharMensagemCompleta(mensagensAtuais[indiceAtual], scrollPos, -999);
          scrollPos--;
          
          MessageSegment segs[12]; int nSegs = 0;
          const GFXfont* font = getFontBySize(faseAtiva->tamanho);
          int totalW = parseLineSegments(mensagensAtuais[indiceAtual], font, segs, 12, nSegs);

          if (scrollPos < -totalW - 4) {
            scrollPos = DISPLAY_WIDTH;
            indiceAtual = (indiceAtual + 1) % totalAtual;
          }
        } 
        else if (faseAtiva->scrollDir == SCROLL_RIGHT) {
          desenharMensagemCompleta(mensagensAtuais[indiceAtual], scrollPos, -999);
          scrollPos++;

          if (scrollPos > DISPLAY_WIDTH + 4) {
            MessageSegment segs[12]; int nSegs = 0;
            const GFXfont* font = getFontBySize(faseAtiva->tamanho);
            int totalW = parseLineSegments(mensagensAtuais[indiceAtual], font, segs, 12, nSegs);
            scrollPos = -totalW;
            indiceAtual = (indiceAtual + 1) % totalAtual;
          }
        }
        else if (faseAtiva->scrollDir == SCROLL_UP) {
          desenharMensagemCompleta(mensagensAtuais[indiceAtual], -999, scrollPos);
          scrollPos--;

          if (scrollPos < -20) {
            scrollPos = DISPLAY_HEIGHT + 10;
            indiceAtual = (indiceAtual + 1) % totalAtual;
          }
        }
        else if (faseAtiva->scrollDir == SCROLL_DOWN) {
          desenharMensagemCompleta(mensagensAtuais[indiceAtual], -999, scrollPos);
          scrollPos++;

          if (scrollPos > DISPLAY_HEIGHT + 10) {
            scrollPos = -15;
            indiceAtual = (indiceAtual + 1) % totalAtual;
          }
        }
      }
    } 
    else if (faseAtiva->modo == "slide") {
      if (agora - ultimaTroca >= velocidade || novoComando) {
        ultimaTroca = agora; 
        novoComando = false;
        desenharMensagemCompleta(mensagensAtuais[indiceAtual]);
        indiceAtual = (indiceAtual + 1) % totalAtual;
      }
    } 
    else if (faseAtiva->modo == "fixed") {
      if (novoComando) { 
        novoComando = false; 
        String txtFixo = mensagensAtuais[0];
        if (totalAtual > 1) txtFixo += "\\n" + mensagensAtuais[1];
        desenharMensagemCompleta(txtFixo); 
      }
    }
  }

  // Heartbeat periódico (a cada 3s)
  if (agora - ultimaPubStatus > 3000) {
    ultimaPubStatus = agora;
    if (client.connected()) {
      publicarStatusSemaforo(faseAtivaVermelha);
    }
  }
}
`;
