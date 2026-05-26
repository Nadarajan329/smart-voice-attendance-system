/**
 * VoiceTrack - Reusable Web Speech API Recognition Wrapper
 */

class SpeechRecognizer {
  constructor(options = {}) {
    this.recognition = null;
    this.state = 'idle'; // 'idle' | 'listening' | 'processing'
    this.continuous = options.continuous !== undefined ? options.continuous : false;
    this.interimResults = options.interimResults !== undefined ? options.interimResults : true;
    this.lang = options.lang || 'en-US';
    this.maxAlternatives = options.maxAlternatives || 3;

    // Callbacks
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onEndCallback = null;
    this.onStateChangeCallback = null;

    this.init();
  }

  /**
   * Check if SpeechRecognition is supported by the browser
   */
  static isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Initialize the Web Speech API recognition service
   */
  init() {
    if (!SpeechRecognizer.isSupported()) {
      console.warn('Web Speech API is not supported in this browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = this.continuous;
    this.recognition.interimResults = this.interimResults;
    this.recognition.lang = this.lang;
    this.recognition.maxAlternatives = this.maxAlternatives;

    // Bind event handlers
    this.recognition.onstart = () => this.handleStart();
    this.recognition.onresult = (event) => this.handleResult(event);
    this.recognition.onerror = (event) => this.handleError(event);
    this.recognition.onend = () => this.handleEnd();
  }

  /**
   * Update the internal state and trigger the state change callback
   */
  setState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(newState);
      }
    }
  }

  /**
   * Start listening for audio
   */
  start() {
    if (!this.recognition) {
      this.triggerError('not_supported', 'Speech recognition is not supported in this browser.');
      return;
    }
    if (this.state !== 'idle') {
      console.warn('Recognition is already active or processing.');
      return;
    }
    try {
      this.recognition.start();
    } catch (e) {
      console.error('Error starting recognition:', e);
      this.setState('idle');
    }
  }

  /**
   * Stop listening and start processing the final result
   */
  stop() {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
      this.setState('processing');
    } catch (e) {
      console.error('Error stopping recognition:', e);
    }
  }

  /**
   * Abort recognition immediately without firing results
   */
  abort() {
    if (!this.recognition) return;
    try {
      this.recognition.abort();
      this.setState('idle');
    } catch (e) {
      console.error('Error aborting recognition:', e);
    }
  }

  // Event handlers
  handleStart() {
    this.setState('listening');
  }

  handleResult(event) {
    let interimTranscript = '';
    let finalTranscript = '';
    let confidence = 0;

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
        confidence = result[0].confidence;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    if (this.onResultCallback) {
      this.onResultCallback({
        transcript: finalTranscript || interimTranscript,
        isFinal: !!finalTranscript,
        confidence: confidence || (event.results[0] ? event.results[0][0].confidence : 0)
      });
    }

    if (finalTranscript && !this.continuous) {
      this.setState('processing');
    }
  }

  handleError(event) {
    console.error('Speech recognition error:', event.error, event.message);
    this.setState('idle');
    if (this.onErrorCallback) {
      this.onErrorCallback({
        error: event.error,
        message: event.message || this.getFriendlyErrorMessage(event.error)
      });
    }
  }

  handleEnd() {
    // Recognition has fully ended — always return to idle so the user can record again
    this.setState('idle');
    if (this.onEndCallback) {
      this.onEndCallback();
    }
  }

  /**
   * Bind event listeners
   */
  onResult(callback) {
    this.onResultCallback = callback;
    return this;
  }

  onError(callback) {
    this.onErrorCallback = callback;
    return this;
  }

  onEnd(callback) {
    this.onEndCallback = callback;
    return this;
  }

  onStateChange(callback) {
    this.onStateChangeCallback = callback;
    return this;
  }

  /**
   * Helper to trigger manual error
   */
  triggerError(error, message) {
    if (this.onErrorCallback) {
      this.onErrorCallback({ error, message });
    }
  }

  /**
   * Get user-friendly error description
   */
  getFriendlyErrorMessage(errorType) {
    switch (errorType) {
      case 'no-speech':
        return 'No speech was detected. Please make sure your microphone is working.';
      case 'audio-capture':
        return 'No microphone was found. Please plug in a microphone.';
      case 'not-allowed':
        return 'Microphone access was denied. Please check your browser privacy permissions.';
      case 'network':
        return 'Network connection error. Speech recognition requires internet access on some browsers.';
      case 'aborted':
        return 'Speech recognition was aborted.';
      default:
        return `Speech recognition error: ${errorType}`;
    }
  }
}

// Attach to window global scope
window.SpeechRecognizer = SpeechRecognizer;
