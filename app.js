require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');
const path = require('path');
const twilio = require('twilio');

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');
const { recordingService } = require('./services/recording-service');

const VoiceResponse = require('twilio').twiml.VoiceResponse;

const app = express();
ExpressWs(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active calls and log listeners
const activeCalls = new Map(); // callSid -> { phoneNumber, startTime }
const logListeners = new Set(); // WebSocket connections for logs

// Helper function to broadcast logs
function broadcastLog(message, type = 'info', callSid = null) {
    const logData = {
        message,
        type,
        time: new Date().toLocaleTimeString(),
        callSid
    };
    logListeners.forEach(ws => {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify(logData));
        }
    });
}

const PORT = process.env.PORT || 3000;

// Pre-generate welcome message audio at server startup for instant playback
const welcomeMessageText = 'नमस्ते! मैं Happy बोल रहा हूँ • मैं मनोज यादव जी की टीम से हूँ • JDU पार्टी की ओर से आपसे बात कर रहा हूँ • आपके इलाके में कौन-सी समस्याएँ हैं? • जैसे सड़क • बिजली • पानी • शिक्षा • नौकरी • या स्वास्थ्य सेवाएँ?';
let preGeneratedWelcomeAudio = null;

// Initialize TTS service for pre-generation
const preGenTtsService = new TextToSpeechService({});
preGenTtsService.preGenerateWelcomeMessage(welcomeMessageText).then((audio) => {
  preGeneratedWelcomeAudio = audio;
  console.log('✓ Welcome message pre-generated and ready for instant playback'.green);
}).catch((err) => {
  console.error('Failed to pre-generate welcome message:', err);
});

// Pre-warm Deepgram connection (establish connection early to reduce delay on first call)
console.log('Pre-warming Deepgram connection...'.yellow);
const preWarmTranscriptionService = new TranscriptionService();
// Let it connect in background - each call will get its own instance, but this helps warm up the connection pool
setTimeout(() => {
  if (preWarmTranscriptionService.ready) {
    console.log('✓ Deepgram connection pre-warmed'.green);
  } else {
    console.log('Deepgram connection still initializing...'.yellow);
  }
}, 2000);

// WebSocket endpoint for live logs
app.ws('/logs', (ws) => {
    logListeners.add(ws);
    broadcastLog('Client connected to live logs', 'success');
    
    ws.on('close', () => {
        logListeners.delete(ws);
    });
    
    ws.on('error', (err) => {
        console.error('Logs WebSocket error:', err);
        logListeners.delete(ws);
    });
});

// API endpoint to make outbound call
app.post('/api/call', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber || !phoneNumber.startsWith('+91')) {
            return res.status(400).json({ error: 'Phone number must start with +91' });
        }

        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        const call = await client.calls.create({
            url: `https://${process.env.SERVER}/incoming`,
            to: phoneNumber,
            from: process.env.FROM_NUMBER
        });

        activeCalls.set(call.sid, {
            phoneNumber,
            startTime: new Date()
        });

        broadcastLog(`Outbound call initiated to ${phoneNumber}`, 'success', call.sid);
        broadcastLog(`Call SID: ${call.sid}`, 'info', call.sid);

        res.json({ callSid: call.sid, status: 'initiated' });
    } catch (error) {
        console.error('Error making call:', error);
        broadcastLog(`Error making call: ${error.message}`, 'error');
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to stop/end a call
app.delete('/api/call/:callSid', async (req, res) => {
    try {
        const { callSid } = req.params;
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        await client.calls(callSid).update({ status: 'completed' });
        
        activeCalls.delete(callSid);
        broadcastLog(`Call ${callSid} terminated`, 'warning', callSid);

        res.json({ success: true, message: 'Call terminated' });
    } catch (error) {
        console.error('Error stopping call:', error);
        broadcastLog(`Error stopping call: ${error.message}`, 'error');
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get active calls
app.get('/api/calls', (req, res) => {
    const calls = Array.from(activeCalls.entries()).map(([sid, data]) => ({
        callSid: sid,
        ...data
    }));
    res.json({ calls });
});

app.post('/incoming', (req, res) => {
  try {
    const response = new VoiceResponse();
    const connect = response.connect();
    connect.stream({ url: `wss://${process.env.SERVER}/connection` });
  
    res.type('text/xml');
    // Log the exact TwiML so we can validate the Stream URL
    console.log(response.toString());
    res.end(response.toString());
  } catch (err) {
    console.log(err);
  }
});

// Helpful for manual verification via browser/curl GET
app.get('/incoming', (req, res) => {
  try {
    const response = new VoiceResponse();
    const connect = response.connect();
    connect.stream({ url: `wss://${process.env.SERVER}/connection` });

    res.type('text/xml');
    res.end(response.toString());
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
});

app.ws('/connection', (ws) => {
  try {
    ws.on('error', console.error);
    // Filled in from start message
    let streamSid;
    let callSid;

    const gptService = new GptService();
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});
    
    // Set pre-generated welcome audio if available
    if (preGeneratedWelcomeAudio) {
      ttsService.preGeneratedWelcomeAudio = preGeneratedWelcomeAudio;
    }
  
    let marks = [];
    let interactionCount = 0;
  
    // Incoming from MediaStream
    ws.on('message', function message(data) {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        
        streamService.setStreamSid(streamSid);
        gptService.setCallSid(callSid);

        const logMsg = `Twilio -> Starting Media Stream for ${streamSid}`;
        console.log(logMsg.underline.red);
        broadcastLog(logMsg, 'info', callSid);
        
        // Send welcome message IMMEDIATELY when call connects (uses pre-generated audio if available)
        const welcomeMsg = 'Sending welcome message immediately...';
        console.log(welcomeMsg.green);
        broadcastLog(welcomeMsg, 'success', callSid);
        ttsService.generate({partialResponseIndex: null, partialResponse: welcomeMessageText}, 0);
        
        // Note: Deepgram STT connection happens in parallel (in background) and does not block welcome message

        // Set RECORDING_ENABLED='true' in .env to record calls (run in background, don't block welcome message)
        // Recording message (if any) will be queued after welcome message
        recordingService(ttsService, callSid).catch((err) => {
          console.error('Recording service error:', err);
        });
      } else if (msg.event === 'media') {
        transcriptionService.send(msg.media.payload);
      } else if (msg.event === 'mark') {
        const label = msg.mark.name;
        const logMsg = `Twilio -> Audio completed mark (${msg.sequenceNumber}): ${label}`;
        console.log(logMsg.red);
        broadcastLog(logMsg, 'system', callSid);
        marks = marks.filter(m => m !== msg.mark.name);
      } else if (msg.event === 'stop') {
        const logMsg = `Twilio -> Media stream ${streamSid} ended.`;
        console.log(logMsg.underline.red);
        broadcastLog(logMsg, 'warning', callSid);
        activeCalls.delete(callSid);
      }
    });
  
    transcriptionService.on('utterance', async (text) => {
      // This is a bit of a hack to filter out empty utterances
      if(marks.length > 0 && text?.length > 5) {
        const logMsg = 'Twilio -> Interruption, Clearing stream';
        console.log(logMsg.red);
        broadcastLog(logMsg, 'warning', callSid);
        ws.send(
          JSON.stringify({
            streamSid,
            event: 'clear',
          })
        );
      }
    });
  
    transcriptionService.on('transcription', async (text) => {
      if (!text) { return; }
      const logMsg = `Interaction ${interactionCount} – STT -> GPT: ${text}`;
      console.log(logMsg.yellow);
      broadcastLog(logMsg, 'info', callSid);
      gptService.completion(text, interactionCount);
      interactionCount += 1;
    });
    
    gptService.on('gptreply', async (gptReply, icount) => {
      const logMsg = `Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`;
      console.log(logMsg.green);
      broadcastLog(logMsg, 'success', callSid);
      ttsService.generate(gptReply, icount);
    });
  
    ttsService.on('speech', (responseIndex, audio, label, icount) => {
      const logMsg = `Interaction ${icount}: TTS -> TWILIO: ${label}`;
      console.log(logMsg.blue);
      broadcastLog(logMsg, 'system', callSid);
      streamService.buffer(responseIndex, audio);
    });
  
    streamService.on('audiosent', (markLabel) => {
      marks.push(markLabel);
    });
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);
