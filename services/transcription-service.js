require('colors');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const { Buffer } = require('node:buffer');
const EventEmitter = require('events');


class TranscriptionService extends EventEmitter {
  constructor() {
    super();
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.finalResult = '';
    this.speechFinal = false; // used to determine if we have seen speech_final=true indicating that deepgram detected a natural pause in the speakers speech. 
    this.ready = false; // Deepgram websocket open status
    this.pendingPayloads = []; // audio chunks to send after ready
    this.lastInterim = '';
    this.silenceTimer = null;
    this.reconnecting = false;
    this.listeningPaused = false; // Track if listening is paused
    
    // Initialize connection
    this.connect();
  }
  
  // Pause listening (stop processing audio)
  pauseListening() {
    this.listeningPaused = true;
  }
  
  // Resume listening (start processing audio again)
  resumeListening() {
    this.listeningPaused = false;
  }

  connect() {
    if (this.ready) {
      return; // Already connected, no need to reconnect
    }

    try {
      this.dgConnection = this.deepgram.listen.live({
        encoding: 'mulaw',
        sample_rate: '8000',
        model: 'nova-2',
        language: 'hi',
        punctuate: true,
        interim_results: true,
        endpointing: 1000, // Wait longer before considering speech final (increased to ensure complete sentences)
        utterance_end_ms: 2000 // Wait for utterance end (increased to ensure user finishes speaking)
      });

      this.setupEventHandlers();
    } catch (error) {
      console.error('STT -> Error creating Deepgram connection:'.yellow, error);
      this.reconnecting = false;
      // Retry connection after error
      setTimeout(() => {
        if (!this.ready) {
          this.reconnect();
        }
      }, 2000);
    }
  }

  setupEventHandlers() {
    this.dgConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('STT -> Deepgram connection OPEN'.yellow);
      this.ready = true;
      this.reconnecting = false;
      // Flush any buffered audio
      if (this.pendingPayloads.length > 0) {
        try {
          for (const payload of this.pendingPayloads) {
            this.dgConnection.send(Buffer.from(payload, 'base64'));
          }
        } finally {
          this.pendingPayloads = [];
        }
      }
    });

    this.dgConnection.on(LiveTranscriptionEvents.Transcript, (transcriptionEvent) => {
        const alternatives = transcriptionEvent.channel?.alternatives;
        let text = '';
        if (alternatives) {
          text = alternatives[0]?.transcript;
        }
        
        // if we receive an UtteranceEnd and speech_final has not already happened then we should consider this the end of of the human speech and emit the transcription
        if (transcriptionEvent.type === 'UtteranceEnd') {
          if (!this.speechFinal && this.finalResult.trim().length > 0) {
            // Wait a bit even for UtteranceEnd to ensure complete sentence
            if (this.silenceTimer) { clearTimeout(this.silenceTimer); }
            this.silenceTimer = setTimeout(() => {
              console.log(`STT -> UtteranceEnd received, emitting after delay: ${this.finalResult.trim()}`.yellow);
              this.emit('transcription', this.finalResult.trim());
              this.finalResult = '';
              this.lastInterim = '';
              this.silenceTimer = null;
            }, 1500); // Wait 1.5 seconds even for UtteranceEnd
            return;
          } else {
            console.log('STT -> Speech was already final when UtteranceEnd received'.yellow);
            return;
          }
        }
    
        // console.log(text, "is_final: ", transcription?.is_final, "speech_final: ", transcription.speech_final);
        // if is_final that means that this chunk of the transcription is accurate and we need to add it to the finalResult 
        if (transcriptionEvent.is_final === true && text.trim().length > 0) {
          this.finalResult += ` ${text}`;
          // if speech_final and is_final that means this text is accurate and it's a natural pause in the speakers speech. 
          // We need to wait an additional delay before sending to LLM to ensure user has finished speaking
          if (transcriptionEvent.speech_final === true) {
            this.speechFinal = true; // this will prevent a utterance end which shows up after speechFinal from sending another response
            // Clear any existing silence timer
            if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
            // Wait additional delay after speech_final to ensure user has completely stopped speaking
            this.silenceTimer = setTimeout(() => {
              if (this.finalResult.trim().length > 0) {
                console.log(`STT -> Emitting complete transcription after silence: ${this.finalResult.trim()}`.yellow);
                this.emit('transcription', this.finalResult.trim());
                this.finalResult = '';
                this.lastInterim = '';
              }
              this.silenceTimer = null;
            }, 1500); // Wait 1.5 seconds after speech_final to ensure user has finished complete sentence
          } else {
            // if we receive a message without speechFinal, user might be continuing to speak
            // Cancel any pending speech_final timer since user is still speaking
            if (this.speechFinal && this.silenceTimer) {
              clearTimeout(this.silenceTimer);
              this.silenceTimer = null;
            }
            // Reset speechFinal to false, this will allow any subsequent utteranceEnd messages to properly indicate the end of a message
            this.speechFinal = false;
          }
        } else {
          // Interim speech: bubble up for barge-in and also start a silence timer to force emission if DG doesn't finalize
          this.emit('utterance', text);
          if (text && text.trim().length > 0) {
            this.lastInterim = text;
            // User is still speaking - cancel any pending speech_final timer
            if (this.speechFinal && this.silenceTimer) {
              clearTimeout(this.silenceTimer);
              this.silenceTimer = null;
              this.speechFinal = false;
            }
            // Only set a timer for interim results if we haven't received any final results yet
            // This prevents emitting partial transcriptions when we're waiting for speech_final
            if (!this.speechFinal) {
              // Clear existing timer and start a new one - wait at least 2.5 seconds after user stops speaking
              if (this.silenceTimer) { clearTimeout(this.silenceTimer); }
              this.silenceTimer = setTimeout(() => {
                // Only emit if we still haven't received speech_final (meaning DG isn't confident)
                if (!this.speechFinal) {
                  const candidate = `${this.finalResult} ${this.lastInterim}`.trim();
                  if (candidate.length > 0) {
                    console.log(`STT -> Emitting transcription from interim silence: ${candidate}`.yellow);
                    this.emit('transcription', candidate);
                    this.finalResult = '';
                    this.lastInterim = '';
                  }
                }
                this.silenceTimer = null;
              }, 2500); // Wait 2.5 seconds after interim results stop to ensure complete sentence
            }
          }
        }
      });

    this.dgConnection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('STT -> deepgram error'.yellow);
      console.error(error);
      this.ready = false;
      // Attempt to reconnect on error
      this.reconnect();
    });

    this.dgConnection.on(LiveTranscriptionEvents.Warning, (warning) => {
      console.error('STT -> deepgram warning'.yellow);
      console.error(warning);
    });

    this.dgConnection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
      // Only log if it's not the expected metadata message (normal metadata is expected)
      if (metadata.type !== 'Metadata') {
        console.log('STT -> deepgram metadata'.yellow);
        console.log(metadata);
      }
    });

    this.dgConnection.on(LiveTranscriptionEvents.Close, () => {
      console.log('STT -> Deepgram connection CLOSED'.yellow);
      this.ready = false;
      // Attempt to reconnect when connection closes unexpectedly
      this.reconnect();
    });
  }

  reconnect() {
    if (this.reconnecting || this.ready) {
      return; // Already reconnecting or already connected
    }
    this.reconnecting = true;
    this.ready = false;
    console.log('STT -> Attempting to reconnect Deepgram in 1 second...'.yellow);
    
    // Wait 1 second before reconnecting to avoid rapid reconnection attempts
    setTimeout(() => {
      if (!this.ready) {
        console.log('STT -> Reconnecting Deepgram...'.yellow);
        this.reconnecting = false; // Reset flag before attempting connection
        this.connect();
      } else {
        this.reconnecting = false;
      }
    }, 1000);
  }

  /**
   * Send the payload to Deepgram
   * @param {String} payload A base64 MULAW/8000 audio stream
   */
  send(payload) {
    // Don't send audio if listening is paused
    if (this.listeningPaused) {
      return;
    }
    
    if (!this.dgConnection) {
      // Connection not initialized yet, buffer the payload
      this.pendingPayloads.push(payload);
      const MAX_FRAMES = 60;
      if (this.pendingPayloads.length > MAX_FRAMES) {
        this.pendingPayloads.splice(0, this.pendingPayloads.length - MAX_FRAMES);
      }
      console.warn(`STT -> Deepgram connection not initialized, buffering audio chunk`.yellow);
      return;
    }

    const readyState = this.dgConnection.getReadyState();
    if (this.ready && readyState === 1) {
      this.dgConnection.send(Buffer.from(payload, 'base64'));
      return;
    }
    // Buffer early audio so first user words are not lost
    this.pendingPayloads.push(payload);
    // Cap buffer to avoid memory bloat (approx ~1s of audio @ 20ms frames)
    const MAX_FRAMES = 60;
    if (this.pendingPayloads.length > MAX_FRAMES) {
      this.pendingPayloads.splice(0, this.pendingPayloads.length - MAX_FRAMES);
    }
    console.warn(`STT -> Deepgram not ready (state=${readyState}), buffering audio chunk`.yellow);
  }
}

module.exports = { TranscriptionService };