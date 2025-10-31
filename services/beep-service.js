require('colors');
const fs = require('fs');
const path = require('path');
const { WaveFile } = require('wavefile');

let beepAudioBase64 = null;

// Convert 16-bit linear PCM to 8-bit μ-law (same as in tts-service.js)
function linearToMuLawSample(sample) {
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

/**
 * Convert WAV to MULAW 8kHz base64 audio
 * @returns {Promise<string|null>} Base64 encoded MULAW audio or null if conversion fails
 */
async function convertBeepToMulaw() {
  // Try beep.wav first (pre-converted), fallback to beep.mp3 if not found
  const beepWavPath = path.join(__dirname, '..', 'beep.wav');
  const beepMp3Path = path.join(__dirname, '..', 'beep.mp3');
  
  let wavPath;
  if (fs.existsSync(beepWavPath)) {
    wavPath = beepWavPath;
    console.log('Beep Service -> Using pre-converted beep.wav'.green);
  } else if (fs.existsSync(beepMp3Path)) {
    console.warn('Beep Service -> beep.wav not found, beep.mp3 requires FFmpeg conversion (may fail on some systems)'.yellow);
    return null; // MP3 conversion requires FFmpeg which may not work on all systems
  } else {
    console.error('Beep Service -> beep.wav or beep.mp3 not found'.yellow);
    return null;
  }

  try {
    // Read WAV file
    const wavBuffer = fs.readFileSync(wavPath);
    const wav = new WaveFile();
    wav.fromBuffer(wavBuffer);
    
    // Verify format
    if (wav.fmt?.sampleRate !== 8000) {
      console.warn(`Beep Service -> WAV sample rate is ${wav.fmt?.sampleRate}Hz, expected 8000Hz`.yellow);
    }
    
    // Get PCM samples
    const pcm16 = wav.getSamples(false, Int16Array);
    
    // Convert to MULAW
    const mu = new Uint8Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      mu[i] = linearToMuLawSample(pcm16[i]);
    }
    
    // Convert to base64
    const base64String = Buffer.from(mu).toString('base64');
    
    console.log('Beep Service -> Beep audio converted successfully'.green);
    return base64String;
  } catch (error) {
    console.error('Beep Service -> Error processing WAV:'.yellow, error);
    return null;
  }
}

/**
 * Load and convert beep audio at startup
 */
async function initializeBeep() {
  try {
    beepAudioBase64 = await convertBeepToMulaw();
    if (beepAudioBase64) {
      console.log('Beep Service -> Beep audio ready'.green);
    } else {
      console.warn('Beep Service -> Beep audio not available - beep sounds will be skipped'.yellow);
    }
  } catch (error) {
    console.error('Beep Service -> Error initializing beep:'.yellow, error);
    beepAudioBase64 = null;
  }
}

/**
 * Get the beep audio as base64 MULAW
 * @returns {string|null} Base64 encoded MULAW audio or null if not available
 */
function getBeepAudio() {
  return beepAudioBase64;
}

module.exports = {
  initializeBeep,
  getBeepAudio
};

