# SACC - Controle PMV P10 (Painel de Mensagens Variáveis via MQTT)

Sistema Web moderno para controle, monitoramento e configuração em tempo real de painéis de LED PMV P10 (HUB75) via MQTT com ESP32.

---

## 🚀 Como Subir para a Vercel

### Opção 1: Via GitHub (Recomendado)
1. Crie um repositório no seu GitHub (ex: `sacc-pmv-controller`).
2. Faça o push dos arquivos deste projeto para o GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - SACC PMV Controller"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```
3. Acesse [vercel.com](https://vercel.com) e faça login.
4. Clique em **"Add New..."** > **"Project"**.
5. Selecione o repositório que você acabou de subir.
6. A Vercel detectará automaticamente o framework **Vite**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
7. Clique em **"Deploy"**. Em menos de 1 minuto seu site estará online com HTTPS gratuito!

---

### Opção 2: Via Vercel CLI (Direto do Terminal)
1. Instale a CLI da Vercel globalmente (caso não tenha):
   ```bash
   npm i -g vercel
   ```
2. Na pasta do projeto, execute:
   ```bash
   vercel
   ```
3. Siga as instruções no terminal (selecione as opções padrão).
4. Para o deploy final em produção:
   ```bash
   vercel --prod
   ```

---

## 📡 Configuração MQTT do ESP32 & Web

| Parâmetro | ESP32 (Hardware) | Site Web (Vercel) |
| :--- | :--- | :--- |
| **Broker Padrão** | `broker.emqx.io` | `wss://broker.emqx.io:8084/mqtt` |
| **Porta** | `1883` (TCP) | `8084` (WSS Seguro) |
| **Tópico Status** | `painel_led_status` (Publish) | `painel_led_status` (Subscribe) |
| **Tópico Sync** | `painel_led_sync` (Publish) | `painel_led_sync` (Subscribe) |
| **Tópico Comandos** | `painel_led/<Nome>` (Subscribe) | `painel_led/<Nome>` (Publish) |

---

## 🛠️ Tecnologias Utilizadas
- **React 19** + **TypeScript**
- **Vite 6** (Build ultrarrápido)
- **Tailwind CSS 4**
- **MQTT.js** (Comunicação WebSocket em tempo real)
- **Leaflet & OpenStreetMap** (Mapa georreferenciado)
- **HTML5 Canvas 2D** (Emulação fiel da matriz de LEDs P10 112×40)
