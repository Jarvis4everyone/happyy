require('dotenv').config();
require('colors');
const { Buffer } = require('node:buffer');
const { WaveFile } = require('wavefile');
const EventEmitter = require('events');
const fetch = require('node-fetch');

class TextToSpeechService extends EventEmitter {
  constructor() {
    super();
    this.nextExpectedIndex = 0;
    this.speechBuffer = {};
    this.queue = [];
    this.inFlight = 0;
    this.maxConcurrent = (process.env.TTS_PROVIDER === 'cartesia') ? 1 : 3;
    this.preGeneratedWelcomeAudio = null; // Store pre-generated welcome message audio
  }
  
  // Pre-generate welcome message audio (called at server startup)
  async preGenerateWelcomeMessage(welcomeText) {
    try {
      console.log('Pre-generating welcome message audio...'.green);
      const base64Audio = await this.generateAudioForText(welcomeText);
      this.preGeneratedWelcomeAudio = base64Audio;
      console.log('Welcome message audio pre-generated successfully!'.green);
      return base64Audio;
    } catch (err) {
      console.error('Failed to pre-generate welcome message:', err);
      this.preGeneratedWelcomeAudio = null;
      return null;
    }
  }
  
  // Extract the audio generation logic to a reusable method
  async generateAudioForText(text) {
    let response;

    if (process.env.TTS_PROVIDER === 'cartesia') {
      const modelId = process.env.CARTESIA_MODEL_ID || 'sonic-3';
      const DEFAULT_VOICE_ID = '1259b7e3-cb8a-43df-9446-30971a46b8b0';
      const envVoice = process.env.CARTESIA_VOICE_ID || '';
      const voiceId = envVoice && !envVoice.includes('or your chosen voice') ? envVoice : DEFAULT_VOICE_ID;
      const language = process.env.CARTESIA_LANGUAGE || 'hi';

      if (!process.env.CARTESIA_API_KEY) {
        throw new Error('Cartesia TTS selected but CARTESIA_API_KEY or CARTESIA_VOICE_ID is missing');
      }

      const payload = {
        model_id: modelId,
        transcript: text,
        voice: { mode: 'id', id: voiceId },
        output_format: {
          container: 'wav',
          encoding: 'pcm_s16le',
          sample_rate: 8000,
        },
        language,
        speed: 'normal',
        generation_config: {
          speed: Number(process.env.CARTESIA_SPEED || '1.0'),
          volume: Number(process.env.CARTESIA_VOLUME || '1.0'),
          emotion: process.env.CARTESIA_EMOTION || 'content',
        },
      };

      response = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: {
          'Cartesia-Version': '2024-06-10',
          'X-API-Key': process.env.CARTESIA_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } else {
      // Default: Deepgram TTS
      response = await fetch(
        `https://api.deepgram.com/v1/speak?model=${process.env.VOICE_MODEL}&encoding=mulaw&sample_rate=8000&container=none`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
          }),
        }
      );
    }

    if (response.status === 200) {
      const arrayBuffer = await response.arrayBuffer();
      let base64String;

      if (process.env.TTS_PROVIDER === 'cartesia') {
        const wav = new WaveFile();
        wav.fromBuffer(Buffer.from(arrayBuffer));
        if (wav.fmt?.sampleRate !== 8000) {
          throw new Error('Cartesia WAV sample rate not 8000 Hz');
        }
        const pcm16 = wav.getSamples(true, Int16Array);
        const mu = new Uint8Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
          mu[i] = linearToMuLawSample(pcm16[i]);
        }
        base64String = Buffer.from(mu).toString('base64');
      } else {
        base64String = Buffer.from(arrayBuffer).toString('base64');
      }
      return base64String;
    } else {
      const errText = await response.text();
      throw new Error(`TTS API error ${response.status}: ${errText}`);
    }
  }

  async generate(gptReply, interactionCount) {
    const { partialResponseIndex, partialResponse } = gptReply;

    if (!partialResponse) { return; }
    
    // For welcome message (index null), check if we have pre-generated audio
    if (partialResponseIndex === null && this.preGeneratedWelcomeAudio) {
      console.log('Using pre-generated welcome message audio (instant playback)'.green);
      // Emit immediately with pre-generated audio
      this.emit('speech', null, this.preGeneratedWelcomeAudio, partialResponse, interactionCount);
      return;
    }
    
    // For welcome message (index null), prioritize by adding to front of queue
    if (partialResponseIndex === null) {
      this.queue.unshift({ partialResponseIndex, partialResponse, interactionCount });
    } else {
      // Queue other requests to avoid provider 429s
      this.queue.push({ partialResponseIndex, partialResponse, interactionCount });
    }
    this.processQueue();
  }

  async processQueue() {
    if (this.inFlight >= this.maxConcurrent) { return; }
    const job = this.queue.shift();
    if (!job) { return; }
    this.inFlight += 1;

    const { partialResponseIndex, partialResponse, interactionCount } = job;
    try {
      // Use the reusable method to generate audio
      try {
        const base64String = await this.generateAudioForText(partialResponse);
        this.emit('speech', partialResponseIndex, base64String, partialResponse, interactionCount);
      } catch (err) {
        console.error('Error generating TTS audio:', err);
      }
    } catch (err) {
      console.error('Error occurred in TextToSpeech service');
      console.error(err);
    }
    // Small delay to prevent hammering provider when many chunks
    setTimeout(() => {
      this.inFlight -= 1;
      this.processQueue();
    }, (process.env.TTS_PROVIDER === 'cartesia') ? 50 : 0);
  }
}

// Convert 16-bit linear PCM to 8-bit μ-law
function linearToMuLawSample(sample) {
  // Standard ITU-T G.711 µ-law encoder
  const BIAS = 0x84; // 132
  const CLIP = 32635; // 0x7F7B

  let sign = (sample < 0) ? 0x80 : 0x00;
  if (sample < 0) { sample = -sample; }
  if (sample > CLIP) { sample = CLIP; }

  // Add bias
  sample = sample + BIAS;

  // Determine exponent
  let exponent = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) {
    exponent--;
  }

  // Determine mantissa
  const mantissa = (sample >> (exponent + 3)) & 0x0F;

  // Assemble byte and invert all bits
  const muLawByte = ~(sign | (exponent << 4) | mantissa) & 0xFF;
  return muLawByte;
}

module.exports = { TextToSpeechService };