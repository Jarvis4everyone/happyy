# Happy AI - Voice Call Management System

A sophisticated AI-powered voice call system built with Node.js, Twilio, Deepgram, and OpenAI GPT. This system enables automated voice calls with natural language processing, speech-to-text, and text-to-speech capabilities.

**Coded by: Shreshth Kaushik**

## 🌟 Features

- **AI-Powered Conversations**: Uses OpenAI GPT for intelligent, context-aware conversations in Hindi
- **Real-time Speech Recognition**: Deepgram STT for accurate speech-to-text transcription
- **Natural Voice Synthesis**: TTS support via Deepgram or Cartesia for natural-sounding speech
- **Web Dashboard**: Beautiful, responsive web interface for call management
- **Live Logs**: Real-time call logs and conversation monitoring
- **Pre-optimized Audio**: Pre-generated welcome message for instant call initiation
- **Smart Voice Detection**: Advanced silence detection to wait for complete user sentences
- **Call Management**: Start, stop, and monitor calls through the web interface

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Twilio Account with a phone number
- Deepgram API Key
- OpenAI API Key
- A publicly accessible server (for Twilio webhooks)

### Installation

1. **Clone or download this repository**

```bash
git clone <your-repo-url>
cd call-gpt-main
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Copy the example environment file and fill in your values:

```bash
# Copy the example file
cp .env.example .env
# Or on Windows, copy .env.example to .env manually
```

Then edit the `.env` file and add your actual API keys:

```env
# Server Configuration
PORT=3000
SERVER=your-ngrok-or-domain.com

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
FROM_NUMBER=+1234567890  # Your Twilio phone number

# Deepgram Configuration (for STT and optional TTS)
DEEPGRAM_API_KEY=your_deepgram_api_key
VOICE_MODEL=aura-asteria-en  # For Deepgram TTS

# OpenAI Configuration
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_openai_api_key

# TTS Provider (optional - default is Deepgram)
# TTS_PROVIDER=cartesia
# CARTESIA_API_KEY=your_cartesia_api_key
# CARTESIA_VOICE_ID=your_voice_id
# CARTESIA_LANGUAGE=hi

# Recording (optional)
RECORDING_ENABLED=false
```

4. **Start the server**

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

5. **Access the Web Dashboard**

Open your browser and navigate to:
```
http://localhost:3000
```

**Login Credentials:**
- Username: `admin`
- Password: `harry`

## 📖 Usage

### Making a Call via Web Dashboard

1. Log in to the web dashboard
2. Enter a 10-digit Indian phone number (without +91)
3. Click "Make Call" button
4. Watch live logs as the AI conversation progresses
5. Use "Stop Call" to end an active call
6. Use "New Call" to make another call

### Making a Call via API

```bash
curl -X POST http://localhost:3000/api/call \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919876543210"}'
```

### Stopping a Call

```bash
curl -X DELETE http://localhost:3000/api/call/{callSid}
```

## 🏗️ Project Structure

```
call-gpt-main/
├── app.js                      # Main application server
├── public/                     # Web dashboard files
│   ├── index.html             # Dashboard HTML
│   ├── style.css              # Dashboard styles
│   └── app.js                 # Dashboard JavaScript
├── services/                   # Core services
│   ├── gpt-service.js         # OpenAI GPT integration
│   ├── transcription-service.js # Deepgram STT service
│   ├── tts-service.js         # Text-to-speech service
│   ├── stream-service.js      # Twilio stream handler
│   └── recording-service.js   # Call recording service
├── functions/                  # Function tools for GPT
│   ├── function-manifest.js   # Available functions
│   ├── checkInventory.js
│   ├── checkPrice.js
│   ├── placeOrder.js
│   └── transferCall.js
├── scripts/                    # Utility scripts
│   ├── inbound-call.js
│   └── outbound-call.js
└── test/                       # Test files
```

## 🔧 Configuration

### TTS Provider Options

**Deepgram (Default)**
- Set `VOICE_MODEL` in `.env` (e.g., `aura-asteria-en`)
- Uses Deepgram TTS API

**Cartesia**
- Set `TTS_PROVIDER=cartesia` in `.env`
- Requires `CARTESIA_API_KEY` and `CARTESIA_VOICE_ID`
- Better quality for Hindi language

### Voice Detection Settings

The system is optimized to wait for complete user sentences before processing:

- `endpointing: 1000ms` - Delay before considering speech final
- `utterance_end_ms: 2000ms` - Wait time for utterance end
- Additional 1.5s delay after speech_final for complete sentences

These settings can be adjusted in `services/transcription-service.js`.

## 🎯 Key Features Explained

### Pre-generated Welcome Message
The welcome message audio is generated at server startup for instant playback when calls connect, eliminating initial delay.

### Smart Silence Detection
Advanced logic ensures the AI waits for users to finish speaking completely before responding, preventing interruptions and partial transcriptions.

### Live Log Streaming
All call events, transcriptions, and AI responses are streamed in real-time to the web dashboard via WebSocket connections.

### Responsive Web Interface
The dashboard is fully responsive and works seamlessly on desktop, tablet, and mobile devices.

## 🔐 Security Notes

- Change the default login credentials in `public/app.js`
- Use environment variables for all sensitive keys
- Ensure your server uses HTTPS in production
- Keep your API keys secure and never commit them to version control

## 📝 API Endpoints

### Web Dashboard
- `GET /` - Dashboard home page

### Call Management
- `POST /api/call` - Initiate an outbound call
- `DELETE /api/call/:callSid` - Terminate a call
- `GET /api/calls` - List active calls

### WebSocket
- `WS /logs` - Real-time log streaming

### Twilio Integration
- `POST /incoming` - Twilio webhook for incoming streams
- `WS /connection` - Twilio media stream WebSocket

## 🐛 Troubleshooting

### Calls not connecting
- Verify your `SERVER` URL is publicly accessible
- Check Twilio webhook configuration
- Ensure ngrok tunnel is active (if using ngrok)

### No audio in calls
- Verify TTS API keys are correct
- Check Deepgram/Cartesia API status
- Review console logs for TTS errors

### Transcription issues
- Verify Deepgram API key
- Check network connectivity
- Review Deepgram connection logs

### Web dashboard not loading
- Ensure `public` directory exists
- Check server is running on correct port
- Verify static file serving is enabled

## 🚀 Deployment to Render

This application is ready to deploy on Render. See [RENDER_DEPLOY.md](./RENDER_DEPLOY.md) for detailed deployment instructions.

### Quick Render Deployment Steps:

1. **Push code to GitHub**
2. **Create a new Web Service on Render**
   - Connect your GitHub repository
   - Choose "Docker" as the runtime
   - Set health check path: `/incoming`
3. **Set Environment Variables** in Render dashboard:
   ```
   NODE_ENV=production
   PORT=3000
   SERVER=your-service-name.onrender.com
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   FROM_NUMBER=+1234567890
   DEEPGRAM_API_KEY=your_deepgram_key
   OPENAI_API_KEY=your_openai_key
   OPENAI_MODEL=gpt-4o-mini
   VOICE_MODEL=aura-asteria-en
   ```
4. **After first deploy**, update `SERVER` with your actual Render URL (without https://)
5. **Update Twilio webhook** to: `https://your-service-name.onrender.com/incoming`

> **Note**: Render free tier services spin down after inactivity. Upgrade to paid plan for production use.

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Shreshth Kaushik**

## 🙏 Acknowledgments

- Built with [Twilio](https://www.twilio.com/) for voice calls
- Powered by [OpenAI](https://openai.com/) for AI conversations
- Speech recognition by [Deepgram](https://deepgram.com/)
- Voice synthesis by Deepgram and [Cartesia](https://cartesia.ai/)

---

**Note:** This codebase has been modified and enhanced from the original GitHub repository by Shreshth Kaushik.

