#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <LittleFS.h>
#include <Adafruit_GFX.h>
#include <ArduinoJson.h>

#include "ESP32-VirtualMatrixPanel-I2S-DMA.h"

// Fontes (certifique-se de que os arquivos .h das fontes estão na mesma pasta do sketch)
#if __has_include("ARIALBD7pt7b.h")
  #include "ARIALBD7pt7b.h"
  #include "ARIALBD8pt7b.h"
  #include "ARIALBD9pt7b.h"
  #define HAS_CUSTOM_FONTS 1
#else
  #include <Fonts/FreeSansBold9pt7b.h>
  #define HAS_CUSTOM_FONTS 0
#endif

// ===================== PALETA DE CORES RGB565 =====================
#define CLR_BLACK   0x0000
#define CLR_WHITE   0xFFFF
#define CLR_RED     0xF800
#define CLR_GREEN   0x07E0
#define CLR_YELLOW  0xFFE0
#define CLR_ORANGE  0xFD20
#define CLR_SKY     0x5DDF
#define CLR_GRAY    0x8410
#define CLR_DARK    0x2104

// ===================== ESTRUTURAS E ENUMS =====================
enum EmojiType {
  EMOJI_NONE, EMOJI_WARNING, EMOJI_CAR, EMOJI_WORK, EMOJI_STOP,
  EMOJI_RIGHT, EMOJI_LEFT, EMOJI_UP, EMOJI_DOWN, EMOJI_HEART,
  EMOJI_SMILE, EMOJI_X, EMOJI_CHECK
};

struct Segmento {
  bool isEmoji;
  String texto;
  EmojiType emoji;
  int largura;
};

struct ConfigFase {
  uint16_t texto;
  uint16_t fundo;
  int tamanho;
  String modo;
};

// ===================== PROTÓTIPOS EXPLÍCITOS =====================
void salvarConfig();
void carregarConfig();
void publicarEstadoCompleto();
void desenharTexto(String texto, int xOverride = -999);
int calcularLarguraTotal(String texto, int tamanho);
int extrairSegmentos(String raw, const GFXfont* font, Segmento* segs, int maxSegs, int& totalSegs);
void drawEmojiRealColor(EmojiType emoji, int x, int y);
void drawBitmap(int x, int y, const uint8_t *bmp, int w, int h, uint16_t color);
int getEmojiWidth(EmojiType emoji);
int getEmojiHeight(EmojiType emoji);
EmojiType parseEmojiToken(String token);
String normalizarEmojis(String raw);
String utf8ascii(String s);
const GFXfont* getFontBySize(int tamanho);

// --- Identificação do Dispositivo ---
String deviceName = "Portal"; 
String deviceUser = "geral3"; 
String devicePass = "123"; 
float LATITUDE = -23.966454; 
float LONGITUDE = -46.391634; 
String ssid = ""; 
String password = ""; 

// --- Portal de Configuração AP ---
const char* ap_ssid = "Configurar_Painel_P10";
const char* ap_pass = "#esp@pmv";

WebServer server(80);
DNSServer dnsServer;
bool modoConfig = false;

// ===================== BROKER MQTT =====================
const char* mqtt_broker  = "broker.emqx.io";
const int   mqtt_port    = 1883;
#define PIN_STATUS 32

WiFiClient espClient;
PubSubClient client(espClient);
unsigned long ultimaTentativaConexao = 0;
String mensagensRed[10];
String mensagensGreen[10];
int totalRed = 0, totalGreen = 0;
int indiceAtual = 0;
unsigned long ultimaTroca = 0, ultimaPubStatus = 0, ultimoFrameScroll = 0;
int xScroll = 240;

uint16_t velocidade = 2000;
bool novoComando = true;
bool ultimoEstadoPino = -1;

ConfigFase cfgRed = {CLR_RED, CLR_BLACK, 2, "fixed"};   
ConfigFase cfgGreen = {CLR_GREEN, CLR_BLACK, 2, "slide"}; 

// ===================== HARDWARE PAINEL P10 / P8 (240x20) =====================
#define PANEL_RES_X 40
#define PANEL_RES_Y 20
#define NUM_ROWS 6
#define TOTAL_WIDTH 240
#define TOTAL_HEIGHT 20

class CustomPxBasePanel : public VirtualMatrixPanel {
public:
  using VirtualMatrixPanel::VirtualMatrixPanel;
protected:
  VirtualCoords getCoords(int16_t x, int16_t y) override {
    VirtualCoords c = VirtualMatrixPanel::getCoords(x, y);
    if (c.x == -1 || c.y == -1) return c;
    const uint8_t pixBase = 8;
    if (((c.y / 5) % 2) == 0)
      c.x = (c.x / pixBase) * 2 * pixBase + 7 - (c.x & 0x7);
    else
      c.x += ((c.x / pixBase) + 1) * pixBase;
    c.y = (c.y / 10) * 5 + (c.y % 5);
    return c;
  }
};

MatrixPanel_I2S_DMA *dma_display = nullptr;
CustomPxBasePanel *customScanPanel = nullptr;

const GFXfont* getFontBySize(int tamanho) {
#if HAS_CUSTOM_FONTS
  if (tamanho == 1) return &ARIALBD7pt7b;
  if (tamanho == 3) return &ARIALBD9pt7b;
  return &ARIALBD8pt7b;
#else
  return &FreeSansBold9pt7b;
#endif
}

// ===================== BITMAPS DE ALTA RESOLUÇÃO =====================
const uint8_t PROGMEM EMOJI_WARN_BASE[] = {
  0x06, 0x00, 0x0F, 0x00, 0x1F, 0x80, 0x1F, 0x80, 0x3F, 0xC0, 0x3F, 0xC0,
  0x7F, 0xE0, 0x7F, 0xE0, 0xFF, 0xF0, 0xFF, 0xF0, 0xFF, 0xF0, 0xFF, 0xF0
};
const uint8_t PROGMEM EMOJI_WARN_EXCL[] = {
  0x00, 0x00, 0x00, 0x00, 0x06, 0x00, 0x06, 0x00, 0x06, 0x00, 0x06, 0x00,
  0x06, 0x00, 0x00, 0x00, 0x06, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00
};

const uint8_t PROGMEM EMOJI_CAR_BODY[] = {
  0x0F, 0xC0, 0x1F, 0xE0, 0x3F, 0xF0, 0x7F, 0xF8, 0xFF, 0xFC, 0xFF, 0xFC,
  0xFF, 0xFC, 0xDF, 0xDC, 0x67, 0x98, 0x00, 0x00
};
const uint8_t PROGMEM EMOJI_CAR_GLASS[] = {
  0x00, 0x00, 0x0C, 0x60, 0x18, 0x30, 0x30, 0x18, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};

const uint8_t PROGMEM EMOJI_STOP_BASE[] = {
  0x0F, 0x00, 0x3F, 0xC0, 0x7F, 0xE0, 0xFF, 0xF0, 0xFF, 0xF0, 0xFF, 0xF0,
  0xFF, 0xF0, 0xFF, 0xF0, 0x7F, 0xE0, 0x3F, 0xC0, 0x0F, 0x00, 0x00, 0x00
};
const uint8_t PROGMEM EMOJI_STOP_BAR[] = {
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x7F, 0xE0, 0x7F, 0xE0,
  0x7F, 0xE0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};

const uint8_t PROGMEM EMOJI_WORK_BASE[] = {
  0xFF, 0xF0, 0xCC, 0xC0, 0x99, 0x90, 0x33, 0x30, 0x66, 0x60, 0xFF, 0xF0,
  0xFF, 0xF0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};
const uint8_t PROGMEM EMOJI_WORK_FEET[] = {
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x30, 0xC0, 0x30, 0xC0, 0x60, 0x60, 0x60, 0x60, 0xF0, 0xF0
};

const uint8_t PROGMEM EMOJI_RIGHT_10x10[] = {
  0x08, 0x00, 0x0C, 0x00, 0x0E, 0x00, 0xFF, 0x00, 0xFF, 0x80, 0xFF, 0x80,
  0xFF, 0x00, 0x0E, 0x00, 0x0C, 0x00, 0x08, 0x00
};
const uint8_t PROGMEM EMOJI_LEFT_10x10[] = {
  0x10, 0x00, 0x30, 0x00, 0x70, 0x00, 0xFF, 0x00, 0xFF, 0x80, 0xFF, 0x80,
  0xFF, 0x00, 0x70, 0x00, 0x30, 0x00, 0x10, 0x00
};
const uint8_t PROGMEM EMOJI_UP_10x10[] = {
  0x18, 0x00, 0x3C, 0x00, 0x7E, 0x00, 0xFF, 0x00, 0x18, 0x00, 0x18, 0x00,
  0x18, 0x00, 0x18, 0x00, 0x18, 0x00, 0x18, 0x00
};
const uint8_t PROGMEM EMOJI_DOWN_10x10[] = {
  0x18, 0x00, 0x18, 0x00, 0x18, 0x00, 0x18, 0x00, 0x18, 0x00, 0x18, 0x00,
  0xFF, 0x00, 0x7E, 0x00, 0x3C, 0x00, 0x18, 0x00
};
const uint8_t PROGMEM EMOJI_HEART_10x9[] = {
  0x66, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0x7E, 0x00, 0x3C, 0x00,
  0x18, 0x00, 0x00, 0x00, 0x00, 0x00
};
const uint8_t PROGMEM EMOJI_SMILE_10x10[] = {
  0x3C, 0x00, 0x42, 0x00, 0xA5, 0x00, 0xA5, 0x00, 0x81, 0x00, 0xA5, 0x00,
  0x99, 0x00, 0x42, 0x00, 0x3C, 0x00, 0x00, 0x00
};
const uint8_t PROGMEM EMOJI_X_10x10[] = {
  0xC3, 0x00, 0xE7, 0x00, 0x7E, 0x00, 0x3C, 0x00, 0x18, 0x00, 0x3C, 0x00,
  0x7E, 0x00, 0xE7, 0x00, 0xC3, 0x00, 0x00, 0x00
};
const uint8_t PROGMEM EMOJI_CHECK_10x10[] = {
  0x01, 0x80, 0x03, 0x80, 0x07, 0x00, 0x0E, 0x00, 0x9C, 0x00, 0xD8, 0x00,
  0x70, 0x00, 0x30, 0x00, 0x10, 0x00, 0x00, 0x00
};

void drawBitmap(int x, int y, const uint8_t *bmp, int w, int h, uint16_t color) {
  if (!customScanPanel) return;
  int bytesPerRow = (w + 7) / 8;
  for (int j = 0; j < h; j++) {
    for (int i = 0; i < w; i++) {
      uint8_t byteVal = pgm_read_byte(&bmp[j * bytesPerRow + (i / 8)]);
      if (byteVal & (0x80 >> (i % 8))) {
        customScanPanel->drawPixel(x + i, y + j, color);
      }
    }
  }
}

int getEmojiWidth(EmojiType emoji) {
  if (emoji == EMOJI_CAR) return 15;
  if (emoji == EMOJI_WARNING || emoji == EMOJI_WORK || emoji == EMOJI_STOP) return 13;
  if (emoji != EMOJI_NONE) return 11;
  return 0;
}

int getEmojiHeight(EmojiType emoji) {
  if (emoji == EMOJI_CAR) return 10;
  if (emoji == EMOJI_WARNING || emoji == EMOJI_WORK || emoji == EMOJI_STOP) return 12;
  if (emoji == EMOJI_HEART) return 9;
  if (emoji != EMOJI_NONE) return 10;
  return 0;
}

void drawEmojiRealColor(EmojiType emoji, int x, int y) {
  switch (emoji) {
    case EMOJI_WARNING:
      drawBitmap(x, y, EMOJI_WARN_BASE, 12, 12, CLR_YELLOW);
      drawBitmap(x, y, EMOJI_WARN_EXCL, 12, 12, CLR_BLACK);
      break;
    case EMOJI_CAR:
      drawBitmap(x, y, EMOJI_CAR_BODY, 14, 10, CLR_RED);
      drawBitmap(x, y, EMOJI_CAR_GLASS, 14, 10, CLR_SKY);
      break;
    case EMOJI_STOP:
      drawBitmap(x, y, EMOJI_STOP_BASE, 12, 12, CLR_RED);
      drawBitmap(x, y, EMOJI_STOP_BAR, 12, 12, CLR_WHITE);
      break;
    case EMOJI_WORK:
      drawBitmap(x, y, EMOJI_WORK_BASE, 12, 12, CLR_YELLOW);
      drawBitmap(x, y, EMOJI_WORK_FEET, 12, 12, CLR_ORANGE);
      break;
    case EMOJI_RIGHT:
      drawBitmap(x, y, EMOJI_RIGHT_10x10, 10, 10, CLR_YELLOW);
      break;
    case EMOJI_LEFT:
      drawBitmap(x, y, EMOJI_LEFT_10x10, 10, 10, CLR_YELLOW);
      break;
    case EMOJI_UP:
      drawBitmap(x, y, EMOJI_UP_10x10, 10, 10, CLR_YELLOW);
      break;
    case EMOJI_DOWN:
      drawBitmap(x, y, EMOJI_DOWN_10x10, 10, 10, CLR_YELLOW);
      break;
    case EMOJI_HEART:
      drawBitmap(x, y, EMOJI_HEART_10x9, 10, 9, CLR_RED);
      break;
    case EMOJI_SMILE:
      drawBitmap(x, y, EMOJI_SMILE_10x10, 10, 10, CLR_YELLOW);
      break;
    case EMOJI_CHECK:
      drawBitmap(x, y, EMOJI_CHECK_10x10, 10, 10, CLR_GREEN);
      break;
    case EMOJI_X:
      drawBitmap(x, y, EMOJI_X_10x10, 10, 10, CLR_RED);
      break;
    default:
      break;
  }
}

EmojiType parseEmojiToken(String token) {
  token.toLowerCase();
  token.trim();
  if (token == "{car}" || token == "{carro}") return EMOJI_CAR;
  if (token == "{warning}" || token == "{atencao}" || token == "{alerta}") return EMOJI_WARNING;
  if (token == "{work}" || token == "{obras}" || token == "{obra}") return EMOJI_WORK;
  if (token == "{stop}" || token == "{pare}") return EMOJI_STOP;
  if (token == "{right}" || token == "{direita}") return EMOJI_RIGHT;
  if (token == "{left}" || token == "{esquerda}") return EMOJI_LEFT;
  if (token == "{up}" || token == "{cima}") return EMOJI_UP;
  if (token == "{down}" || token == "{baixo}") return EMOJI_DOWN;
  if (token == "{heart}" || token == "{coracao}") return EMOJI_HEART;
  if (token == "{smile}" || token == "{sorriso}") return EMOJI_SMILE;
  if (token == "{x}" || token == "{erro}") return EMOJI_X;
  if (token == "{check}" || token == "{ok}") return EMOJI_CHECK;
  return EMOJI_NONE;
}

String normalizarEmojis(String raw) {
  raw.replace("🚗", "{car}");
  raw.replace("⚠️", "{warning}");
  raw.replace("🚧", "{work}");
  raw.replace("⛔", "{stop}");
  raw.replace("➡️", "{right}");
  raw.replace("⬅️", "{left}");
  raw.replace("⬆️", "{up}");
  raw.replace("⬇️", "{down}");
  raw.replace("❤️", "{heart}");
  raw.replace("🙂", "{smile}");
  raw.replace("❌", "{x}");
  raw.replace("✅", "{check}");
  return raw;
}

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
    }
  }
  return res;
}

int extrairSegmentos(String raw, const GFXfont* font, Segmento* segs, int maxSegs, int& totalSegs) {
  totalSegs = 0;
  raw = normalizarEmojis(raw);
  int totalWidth = 0;
  int pos = 0;
  int len = raw.length();

  while (pos < len && totalSegs < maxSegs) {
    int openTag = raw.indexOf('{', pos);
    if (openTag == -1) {
      String remaining = raw.substring(pos);
      if (remaining.length() > 0) {
        int16_t x1, y1; uint16_t w, h;
        if (customScanPanel) {
          customScanPanel->setFont(font);
          customScanPanel->getTextBounds(utf8ascii(remaining), 0, 0, &x1, &y1, &w, &h);
        } else {
          w = remaining.length() * 8;
        }
        segs[totalSegs] = {false, remaining, EMOJI_NONE, (int)w};
        totalWidth += (int)w;
        totalSegs++;
      }
      break;
    }

    if (openTag > pos) {
      String txt = raw.substring(pos, openTag);
      int16_t x1, y1; uint16_t w, h;
      if (customScanPanel) {
        customScanPanel->setFont(font);
        customScanPanel->getTextBounds(utf8ascii(txt), 0, 0, &x1, &y1, &w, &h);
      } else {
        w = txt.length() * 8;
      }
      segs[totalSegs] = {false, txt, EMOJI_NONE, (int)w};
      totalWidth += (int)w;
      totalSegs++;
      if (totalSegs >= maxSegs) break;
    }

    int closeTag = raw.indexOf('}', openTag);
    if (closeTag != -1) {
      String tag = raw.substring(openTag, closeTag + 1);
      EmojiType emo = parseEmojiToken(tag);
      if (emo != EMOJI_NONE) {
        int eW = getEmojiWidth(emo) + 3; // Largura + espaço
        segs[totalSegs] = {true, "", emo, eW};
        totalWidth += eW;
        totalSegs++;
      } else {
        int16_t x1, y1; uint16_t w, h;
        if (customScanPanel) {
          customScanPanel->setFont(font);
          customScanPanel->getTextBounds(utf8ascii(tag), 0, 0, &x1, &y1, &w, &h);
        } else {
          w = tag.length() * 8;
        }
        segs[totalSegs] = {false, tag, EMOJI_NONE, (int)w};
        totalWidth += (int)w;
        totalSegs++;
      }
      pos = closeTag + 1;
    } else {
      String remaining = raw.substring(openTag);
      int16_t x1, y1; uint16_t w, h;
      if (customScanPanel) {
        customScanPanel->setFont(font);
        customScanPanel->getTextBounds(utf8ascii(remaining), 0, 0, &x1, &y1, &w, &h);
      } else {
        w = remaining.length() * 8;
      }
      segs[totalSegs] = {false, remaining, EMOJI_NONE, (int)w};
      totalWidth += (int)w;
      totalSegs++;
      break;
    }
  }
  return totalWidth;
}

// ===================== DESENHO COM ALINHAMENTO CENTRALIZADO PERFEITO =====================
void desenharTexto(String texto, int xOverride) {
  if (!customScanPanel) return;
  bool pinoAtivo = (digitalRead(PIN_STATUS) == HIGH); 
  ConfigFase *faseAtual = pinoAtivo ? &cfgRed : &cfgGreen;

  customScanPanel->fillScreen(faseAtual->fundo);
  customScanPanel->setTextColor(faseAtual->texto);
  customScanPanel->setTextWrap(false);
  
  const GFXfont* font = getFontBySize(faseAtual->tamanho);
  customScanPanel->setFont(font);

  Segmento segs[16];
  int totalSegs = 0;
  int totalWidth = extrairSegmentos(texto, font, segs, 16, totalSegs);

  // ALINHAMENTO CENTRALIZADO PERFEITO
  int curX = (xOverride == -999) ? ((TOTAL_WIDTH - totalWidth) / 2) : xOverride;
  if (xOverride == -999 && curX < 0) curX = 0; // Evita corte se texto for longo
  int curY = 13; 

  for (int s = 0; s < totalSegs; s++) {
    if (segs[s].isEmoji) {
      int eH = getEmojiHeight(segs[s].emoji);
      int emojiY = (TOTAL_HEIGHT - eH) / 2;
      drawEmojiRealColor(segs[s].emoji, curX, emojiY);
      curX += segs[s].largura;
    } else {
      String textoLimpo = utf8ascii(segs[s].texto);
      customScanPanel->setFont(font);
      customScanPanel->setCursor(curX, curY);

      for (int i = 0; i < textoLimpo.length(); i++) {
        uint8_t c = (uint8_t)textoLimpo[i];
        int charX = customScanPanel->getCursorX();
        int charY = customScanPanel->getCursorY();
        
        if (c == 199 || c == 231) { 
          customScanPanel->print(c == 199 ? "C" : "c");
          int oy = (c == 231) ? -1 : 1; 
          customScanPanel->drawPixel(charX + 3, charY + oy,     faseAtual->texto);
          customScanPanel->drawPixel(charX + 3, charY + oy + 1, faseAtual->texto);
          customScanPanel->drawPixel(charX + 4, charY + oy + 1, faseAtual->texto);
          customScanPanel->drawPixel(charX + 4, charY + oy + 2, faseAtual->texto);
          customScanPanel->drawPixel(charX + 3, charY + oy + 2, faseAtual->texto);
          customScanPanel->drawPixel(charX + 2, charY + oy + 3, faseAtual->texto);
          customScanPanel->drawPixel(charX + 1, charY + oy + 3, faseAtual->texto);
        } 
        else if (c == 195 || c == 227) { 
          customScanPanel->print(c == 195 ? "A" : "a");
          int ty = (c == 195) ? -11 : -8; 
          customScanPanel->drawPixel(charX + 2, charY + ty,     faseAtual->texto);
          customScanPanel->drawPixel(charX + 3, charY + ty,     faseAtual->texto);
          customScanPanel->drawPixel(charX + 3, charY + ty - 1, faseAtual->texto);
          customScanPanel->drawPixel(charX + 4, charY + ty - 1, faseAtual->texto);
          customScanPanel->drawPixel(charX + 5, charY + ty,     faseAtual->texto);
        }
        else {
          customScanPanel->print((char)c);
        }
      }
      curX = customScanPanel->getCursorX();
    }
  }
}

int calcularLarguraTotal(String texto, int tamanho) {
  const GFXfont* font = getFontBySize(tamanho);
  Segmento segs[16];
  int totalSegs = 0;
  return extrairSegmentos(texto, font, segs, 16, totalSegs);
}

// ===================== PORTAL WEB / LITTLEFS =====================
void handleRoot() {
  String html = "<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<style>body{font-family:sans-serif;padding:20px;background:#111;color:#fff;} input{width:100%;padding:10px;margin:5px 0;border-radius:4px;border:1px solid #444;background:#222;color:#fff;box-sizing:border-box;}</style></head>";
  html += "<body><h2>⚙️ Configuração do Painel P10</h2><form action='/salvar' method='POST'>";
  html += "NOME DA REDE WI-FI:<br><input type='text' name='s' value='"+ssid+"'><br>";
  html += "SENHA DO WI-FI:<br><input type='password' name='p'><br>";
  html += "NOME DO PAINEL (Identificador):<br><input type='text' name='n' value='"+deviceName+"'><br>";
  html += "USUÁRIO DE ACESSO:<br><input type='text' name='u' value='"+deviceUser+"'><br>";
  html += "SENHA DE ACESSO:<br><input type='password' name='dp'><br>";
  html += "LATITUDE GPS:<br><input type='text' name='lat' value='"+String(LATITUDE, 6)+"'><br>";
  html += "LONGITUDE GPS:<br><input type='text' name='lng' value='"+String(LONGITUDE, 6)+"'><br>";
  html += "<input type='submit' value='SALVAR E REINICIAR' style='background:#07e000;color:white;border:none;cursor:pointer;font-weight:bold;margin-top:15px;padding:12px;'>";
  html += "</form></body></html>";
  server.send(200, "text/html", html);
}

void handleSave() {
  ssid = server.arg("s");
  password = server.arg("p");
  deviceName = server.arg("n");
  deviceUser = server.arg("u");
  devicePass = server.arg("dp");
  LATITUDE = server.arg("lat").toFloat();
  LONGITUDE = server.arg("lng").toFloat();

  salvarConfig();
  server.send(200, "text/plain", "Dados salvos com sucesso! Reiniciando em 3 segundos...");
  delay(3000);
  ESP.restart();
}

void salvarConfig() {
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<4096> doc;
#endif

  doc["wifi_ssid"] = ssid;
  doc["wifi_pass"] = password;
  doc["deviceName"] = deviceName;
  doc["deviceUser"] = deviceUser;
  doc["devicePass"] = devicePass;
  doc["lat"] = LATITUDE;
  doc["lng"] = LONGITUDE;

  JsonArray redMsgs = doc["redMsgs"].to<JsonArray>();
  for(int i=0; i<totalRed; i++) redMsgs.add(mensagensRed[i]);
  
  JsonArray greenMsgs = doc["greenMsgs"].to<JsonArray>();
  for(int i=0; i<totalGreen; i++) greenMsgs.add(mensagensGreen[i]);

  doc["r_modo"] = cfgRed.modo;
  doc["r_txt"]  = cfgRed.texto;
  doc["r_fnd"]  = cfgRed.fundo;
  doc["r_tam"]  = cfgRed.tamanho;
  doc["g_modo"] = cfgGreen.modo;
  doc["g_txt"]  = cfgGreen.texto;
  doc["g_fnd"]  = cfgGreen.fundo;
  doc["g_tam"]  = cfgGreen.tamanho;
  doc["vel"]    = velocidade;

  File configFile = LittleFS.open("/config.json", "w");
  if (configFile) {
    serializeJson(doc, configFile);
    configFile.close();
  }
}

void carregarConfig() {
  if (!LittleFS.exists("/config.json")) return;

  File configFile = LittleFS.open("/config.json", "r");
  if (!configFile) return;

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<4096> doc;
#endif
  DeserializationError error = deserializeJson(doc, configFile);
  configFile.close();

  if (!error) {
    ssid = doc["wifi_ssid"] | "";
    password = doc["wifi_pass"] | "";
    deviceName = doc["deviceName"] | "Portal";
    deviceUser = doc["deviceUser"] | "geral3";
    devicePass = doc["devicePass"] | "123";
    LATITUDE = doc["lat"] | -23.966454;
    LONGITUDE = doc["lng"] | -46.391634;

    totalRed = 0;
    JsonArray rArr = doc["redMsgs"].as<JsonArray>();
    for (JsonVariant v : rArr) { 
      if(totalRed < 10) mensagensRed[totalRed++] = v.as<String>(); 
    }
    
    totalGreen = 0;
    JsonArray gArr = doc["greenMsgs"].as<JsonArray>();
    for (JsonVariant v : gArr) { 
      if(totalGreen < 10) mensagensGreen[totalGreen++] = v.as<String>(); 
    }

    cfgRed.modo = doc["r_modo"] | "fixed";
    cfgRed.texto = doc["r_txt"] | CLR_RED;
    cfgRed.fundo = doc["r_fnd"] | CLR_BLACK;
    cfgRed.tamanho = doc["r_tam"] | 2;
    cfgGreen.modo = doc["g_modo"] | "slide";
    cfgGreen.texto = doc["g_txt"] | CLR_GREEN;
    cfgGreen.fundo = doc["g_fnd"] | CLR_BLACK;
    cfgGreen.tamanho = doc["g_tam"] | 2;
    velocidade = doc["vel"] | 2000;
  }
}

void publicarEstadoCompleto() {
  if (!client.connected()) return;
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<2048> doc;
#endif

  doc["target"] = deviceName;
  
  JsonArray rMsgs = doc["mensagensRed"].to<JsonArray>();
  for(int i=0; i<totalRed; i++) rMsgs.add(mensagensRed[i]);
  
  JsonArray gMsgs = doc["mensagensGreen"].to<JsonArray>();
  for(int i=0; i<totalGreen; i++) gMsgs.add(mensagensGreen[i]);

  doc["r_modo"] = cfgRed.modo;
  doc["r_cor"]  = cfgRed.texto;
  doc["r_tam"]  = cfgRed.tamanho;
  
  doc["g_modo"] = cfgGreen.modo;
  doc["g_cor"]  = cfgGreen.texto;
  doc["g_tam"]  = cfgGreen.tamanho;
  
  doc["velocidade"] = velocidade;

  char buffer[2048];
  serializeJson(doc, buffer);
  client.publish("painel_led_sync", buffer, true);
}

// ===================== PROCESSAMENTO MQTT =====================
void mqttCallback(char *topic, byte *payload, unsigned int length) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<2048> doc;
#endif
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) return;

  String strTopic = String(topic);

  if (strTopic == "auth/request") {
    const char* bId = doc["id"];
    const char* u = doc["user"];
    const char* p = doc["pass"];

    bool success = (String(u) == deviceUser && String(p) == devicePass);

#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument res;
#else
    StaticJsonDocument<256> res;
#endif
    res["id"] = bId;
    res["status"] = success ? "success" : "fail";
    if (!success) res["reason"] = "Usuario ou senha incorretos";

    char buffer[256];
    serializeJson(res, buffer);
    client.publish("auth/response", buffer);
    return;
  }

  if (strTopic == "painel_led_sync_request") {
    const char* target = doc["target"];
    if (!target || strcmp(target, "all") == 0 || strcmp(target, deviceName.c_str()) == 0) {
      publicarEstadoCompleto();
    }
    return;
  }

  const char* target = doc["target"];
  if (target && strcmp(target, deviceName.c_str()) != 0 && strcmp(target, "all") != 0) return;

  bool tipoAlerta = doc["alerta"] | false; 
  JsonArray msgs = doc["mensagens"].as<JsonArray>();
  ConfigFase *cfgAlvo = tipoAlerta ? &cfgRed : &cfgGreen;
  String* arrMensagens = tipoAlerta ? mensagensRed : mensagensGreen;
  int& totalAlvo = tipoAlerta ? totalRed : totalGreen;

  totalAlvo = 0;
  for (JsonVariant m : msgs) {
    if (totalAlvo < 10) {
      String strM = m.as<String>();
      strM.trim();
      arrMensagens[totalAlvo++] = strM;
    }
  }

  cfgAlvo->modo = (const char*)(doc["modo"] | "fixed");
  cfgAlvo->tamanho = doc["tamanho"] | 2;

  auto convertColor = [](JsonArray c) {
    if (c.size() < 3) return (uint16_t)0xFFFF;
    uint8_t r = c[0], g = c[1], b = c[2];
    return (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
  };

  if (doc.containsKey("cor")) cfgAlvo->texto = convertColor(doc["cor"].as<JsonArray>());
  if (doc.containsKey("corFundo")) cfgAlvo->fundo = convertColor(doc["corFundo"].as<JsonArray>());

  velocidade = doc["velocidade"] | 2000;
  indiceAtual = 0;
  xScroll = 240;
  novoComando = true;

  salvarConfig(); 
  publicarEstadoCompleto();
}

// ===================== SETUP E LOOP =====================
void setup() {
  Serial.begin(115200);
  pinMode(PIN_STATUS, INPUT_PULLUP); 
  
  if(!LittleFS.begin(true)) { Serial.println("Erro LittleFS"); }
  carregarConfig();

  if (ssid == "" || ssid == "NULL") {
    modoConfig = true;
    WiFi.softAP(ap_ssid, ap_pass);
    dnsServer.start(53, "*", WiFi.softAPIP());
    server.on("/", handleRoot);
    server.on("/salvar", HTTP_POST, handleSave);
    server.onNotFound(handleRoot);
    server.begin();
    return;
  }

  WiFi.begin(ssid.c_str(), password.c_str());
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) { delay(500); }

  if (WiFi.status() != WL_CONNECTED) {
    ssid = ""; 
    salvarConfig(); 
    ESP.restart();
  }

  HUB75_I2S_CFG::i2s_pins _pins = {25, 26, 27, 14, 12, 13, 23, 19, 5, -1, -1, 4, 15, 22};
  HUB75_I2S_CFG mxconfig(PANEL_RES_X * 2, PANEL_RES_Y / 2, NUM_ROWS, _pins);
  mxconfig.i2sspeed = HUB75_I2S_CFG::HZ_8M;
  mxconfig.latch_blanking = 64;
  mxconfig.clkphase = false;

  dma_display = new MatrixPanel_I2S_DMA(mxconfig);
  dma_display->begin();
  dma_display->setBrightness8(130);
  customScanPanel = new CustomPxBasePanel((*dma_display), NUM_ROWS, 1, 40, 20, true, true);
  customScanPanel->setRotate(true);

  client.setBufferSize(4096);
  client.setServer(mqtt_broker, mqtt_port);
  client.setCallback(mqttCallback);
}

void loop() {
  if (modoConfig) {
    dnsServer.processNextRequest();
    server.handleClient();
    return;
  }

  unsigned long agora = millis();

  if (!client.connected()) {
    if (agora - ultimaTentativaConexao > 5000) {
      ultimaTentativaConexao = agora;
      String clientId = "ESP32_PMV_" + deviceName + "_" + String(random(0xffff), HEX);
      if (client.connect(clientId.c_str(), deviceUser.c_str(), devicePass.c_str())) {
        client.subscribe("auth/request");
        client.subscribe("painel_led_sync_request");
        client.subscribe("painel_led_test");
        String individualTopic = "painel_led/" + String(deviceName);
        client.subscribe(individualTopic.c_str());
        
        publicarEstadoCompleto(); 
      }
    }
  } else {
    client.loop();
  }

  agora = millis();
  bool pinoAtual = (digitalRead(PIN_STATUS) == HIGH);

  if ((int)pinoAtual != (int)ultimoEstadoPino) {
    ultimoEstadoPino = pinoAtual;
    indiceAtual = 0; 
    xScroll = 240; 
    novoComando = true;
  }

  ConfigFase *faseAtiva = pinoAtual ? &cfgRed : &cfgGreen;
  String* mensagensAtuais = pinoAtual ? mensagensRed : mensagensGreen;
  int totalAtual = pinoAtual ? totalRed : totalGreen;

  if (totalAtual > 0) {
    if (faseAtiva->modo == "scroll") {
      if (agora - ultimoFrameScroll >= 35) {
        ultimoFrameScroll = agora;
        desenharTexto(mensagensAtuais[indiceAtual], xScroll);
        xScroll--;
        int w = calcularLarguraTotal(mensagensAtuais[indiceAtual], faseAtiva->tamanho);
        if (xScroll < -(int)w - 5) { 
          xScroll = 240; 
          indiceAtual = (indiceAtual + 1) % totalAtual; 
        }
      }
    } 
    else if (faseAtiva->modo == "slide") {
      if (agora - ultimaTroca >= velocidade || novoComando) {
        ultimaTroca = agora; 
        novoComando = false;
        desenharTexto(mensagensAtuais[indiceAtual]);
        indiceAtual = (indiceAtual + 1) % totalAtual;
      }
    } 
    else if (faseAtiva->modo == "fixed") {
      if (novoComando) { 
        novoComando = false; 
        String txtFixo = mensagensAtuais[0];
        if (totalAtual > 1) txtFixo += "\n" + mensagensAtuais[1];
        desenharTexto(txtFixo); 
      }
    }
  }

  if (agora - ultimaPubStatus > 2000) {
    ultimaPubStatus = agora;
    if (client.connected()) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
      JsonDocument sDoc;
#else
      StaticJsonDocument<512> sDoc;
#endif
      sDoc["dispositivo"] = deviceName;
      sDoc["vermelho"] = (pinoAtual == HIGH);
      sDoc["lat"] = LATITUDE; 
      sDoc["lng"] = LONGITUDE;
      sDoc["rssi"] = WiFi.RSSI();
      char buffer[512];
      serializeJson(sDoc, buffer);
      client.publish("painel_led_status", buffer);
    }
  }
}
