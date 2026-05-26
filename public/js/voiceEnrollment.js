/**
 * VoiceTrack - Voice Enrollment Wizard JavaScript Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Wizard steps
  const stepContent1 = document.getElementById('enrollStepContent1');
  const stepContent2 = document.getElementById('enrollStepContent2');
  const stepContent3 = document.getElementById('enrollStepContent3');

  // Step Indicators
  const progressLine = document.getElementById('enrollProgressLine');
  const step1Circle = document.getElementById('enrollStep1Circle');
  const step2Circle = document.getElementById('enrollStep2Circle');
  const step3Circle = document.getElementById('enrollStep3Circle');
  const step1Label = document.getElementById('enrollStep1Label');
  const step2Label = document.getElementById('enrollStep2Label');
  const step3Label = document.getElementById('enrollStep3Label');

  // Interactive controls
  const startBtn = document.getElementById('enrollStartBtn');
  const micBtn = document.getElementById('enrollMicBtn');
  const recordStateText = document.getElementById('enrollRecordState');
  const currentSampleText = document.getElementById('enrollCurrentSample');
  const waveformBars = document.querySelectorAll('.waveform-bar');

  // Attempt rows
  const attempts = [
    {
      row: document.getElementById('enrollAttempt1'),
      icon: document.getElementById('enrollAttempt1Icon'),
      text: document.getElementById('enrollAttempt1Text')
    },
    {
      row: document.getElementById('enrollAttempt2'),
      icon: document.getElementById('enrollAttempt2Icon'),
      text: document.getElementById('enrollAttempt2Text')
    },
    {
      row: document.getElementById('enrollAttempt3'),
      icon: document.getElementById('enrollAttempt3Icon'),
      text: document.getElementById('enrollAttempt3Text')
    }
  ];

  // Final Results
  const resultPhrase = document.getElementById('enrollResultPhrase');
  const resultConfidence = document.getElementById('enrollResultConfidence');
  const resultSamples = document.getElementById('enrollResultSamples');

  let recognizer = null;
  let currentStep = 1;
  let successfulSamples = 0;
  let confidences = [];
  let phrases = [];

  // Check Web Speech API Support
  if (!window.SpeechRecognizer.isSupported()) {
    if (startBtn) startBtn.disabled = true;
    const warning = document.createElement('div');
    warning.className = 'alert alert-warning mb-6 max-w-md mx-auto';
    warning.innerHTML = `
      <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      <span>Your browser does not support Web Speech API. Please switch to Chrome, Edge, or Safari.</span>
    `;
    stepContent1.insertBefore(warning, stepContent1.firstChild);
    return;
  }

  // Initialize SpeechRecognizer
  recognizer = new window.SpeechRecognizer({
    continuous: false,
    interimResults: true,
    maxAlternatives: 3,
    lang: 'en-US'
  });

  // Start enrollment step 1 -> step 2
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      goToStep(2);
    });
  }

  // Bind recognizer events
  recognizer.onStateChange((state) => {
    if (state === 'listening') {
      recordStateText.textContent = 'Speak your full name now...';
      recordStateText.className = 'text-sm font-semibold text-emerald-400 mb-6 animate-pulse';
      micBtn.className = 'mic-button w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-95 transition-all duration-300';
      
      // Animate waveform
      waveformBars.forEach(bar => {
        bar.classList.add('animating');
        bar.style.backgroundColor = '#34d399'; // Green color for recording
      });
    } else if (state === 'processing') {
      recordStateText.textContent = 'Processing recording...';
      recordStateText.className = 'text-sm font-semibold text-amber-400 mb-6';
      micBtn.className = 'mic-button w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 transition-all duration-300';
      
      // Stop waveform animation
      waveformBars.forEach(bar => {
        bar.classList.remove('animating');
        bar.style.backgroundColor = '#fbbf24'; // Amber color for processing
      });
    } else {
      // Idle
      recordStateText.textContent = `Tap the mic to record Sample ${successfulSamples + 1}`;
      recordStateText.className = 'text-sm font-semibold text-slate-400 mb-6';
      micBtn.className = 'mic-button w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 hover:scale-105 active:scale-95 transition-all duration-300';
      
      waveformBars.forEach(bar => {
        bar.classList.remove('animating');
        bar.style.backgroundColor = 'rgba(99, 102, 241, 0.3)'; // Indigo base
      });
    }
  });

  recognizer.onResult(({ transcript, isFinal, confidence }) => {
    if (isFinal) {
      recognizer.stop();
      saveVoiceSample(transcript, confidence);
    }
  });

  recognizer.onError(({ error, message }) => {
    console.error('Enrollment mic error:', error, message);
    window.showToast(message || 'Error recording voice sample.', 'error');
    recognizer.abort();
  });

  // Handle mic click
  if (micBtn) {
    micBtn.addEventListener('click', () => {
      if (recognizer.state === 'idle') {
        recognizer.start();
      } else if (recognizer.state === 'listening') {
        recognizer.stop();
      }
    });
  }

  /**
   * Save recorded voice sample via API
   */
  async function saveVoiceSample(transcript, confidence) {
    if (!transcript) return;

    try {
      const response = await window.apiRequest('/api/voice/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, confidence })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Track the statistics
        confidences.push(confidence || 0.95);
        phrases.push(transcript);

        // Update the attempt feedback row
        const currentAttemptIndex = successfulSamples;
        const attempt = attempts[currentAttemptIndex];
        
        if (attempt) {
          attempt.row.className = 'flex items-center gap-3 p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-all duration-300';
          attempt.icon.className = 'w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 border border-emerald-500/20';
          attempt.icon.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>';
          attempt.text.className = 'text-sm font-semibold text-white';
          attempt.text.textContent = `Sample ${currentAttemptIndex + 1} - Recorded: "${transcript}"`;
        }

        successfulSamples++;

        if (successfulSamples < 3) {
          currentSampleText.textContent = successfulSamples + 1;
          window.showToast(`Sample ${successfulSamples} recorded successfully!`, 'success');
        } else {
          // Finished enrollment
          window.showToast('All voice samples recorded successfully!', 'success');
          setTimeout(() => {
            goToStep(3);
          }, 1500);
        }
      } else {
        window.showToast(data.message || 'Error processing voice sample. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Error saving voice sample:', err);
      window.showToast('Network error while saving voice sample.', 'error');
    }
  }

  /**
   * Transition between wizard steps
   */
  function goToStep(step) {
    currentStep = step;
    
    // Hide all steps
    stepContent1.classList.add('hidden');
    stepContent2.classList.add('hidden');
    stepContent3.classList.add('hidden');

    // Reset indicator classes
    step1Circle.className = 'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 border';
    step2Circle.className = 'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 border';
    step3Circle.className = 'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 border';

    step1Label.className = 'mt-2 text-xs font-semibold';
    step2Label.className = 'mt-2 text-xs font-semibold';
    step3Label.className = 'mt-2 text-xs font-semibold';

    if (step === 1) {
      stepContent1.classList.remove('hidden');
      progressLine.style.width = '0%';

      step1Circle.classList.add('bg-gradient-to-br', 'from-indigo-500', 'to-violet-600', 'border-indigo-500/20', 'text-white', 'shadow-lg', 'shadow-indigo-500/30');
      step1Label.classList.add('text-indigo-400');
      
      step2Circle.classList.add('bg-white/[0.06]', 'border-white/[0.1]', 'text-slate-500');
      step2Label.classList.add('text-slate-500');
      
      step3Circle.classList.add('bg-white/[0.06]', 'border-white/[0.1]', 'text-slate-500');
      step3Label.classList.add('text-slate-500');
    } 
    else if (step === 2) {
      stepContent2.classList.remove('hidden');
      progressLine.style.width = '50%';

      step1Circle.classList.add('bg-indigo-500/10', 'border-indigo-500/30', 'text-indigo-400');
      step1Circle.innerHTML = '<svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>';
      step1Label.classList.add('text-slate-400');

      step2Circle.classList.add('bg-gradient-to-br', 'from-indigo-500', 'to-violet-600', 'border-indigo-500/20', 'text-white', 'shadow-lg', 'shadow-indigo-500/30');
      step2Label.classList.add('text-indigo-400');

      step3Circle.classList.add('bg-white/[0.06]', 'border-white/[0.1]', 'text-slate-500');
      step3Label.classList.add('text-slate-500');

      successfulSamples = 0;
      confidences = [];
      phrases = [];
      currentSampleText.textContent = '1';

      // Reset attempts
      attempts.forEach((att, idx) => {
        att.row.className = 'flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] transition-all duration-300';
        att.icon.className = 'w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-slate-500';
        att.icon.textContent = idx + 1;
        att.text.className = 'text-sm text-slate-500';
        att.text.textContent = `Sample ${idx + 1} - Waiting`;
      });
    } 
    else if (step === 3) {
      stepContent3.classList.remove('hidden');
      progressLine.style.width = '100%';

      step1Circle.classList.add('bg-indigo-500/10', 'border-indigo-500/30', 'text-indigo-400');
      step1Circle.innerHTML = '<svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>';
      step1Label.classList.add('text-slate-400');

      step2Circle.classList.add('bg-indigo-500/10', 'border-indigo-500/30', 'text-indigo-400');
      step2Circle.innerHTML = '<svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>';
      step2Label.classList.add('text-slate-400');

      step3Circle.classList.add('bg-gradient-to-br', 'from-emerald-500', 'to-green-600', 'border-emerald-500/20', 'text-white', 'shadow-lg', 'shadow-emerald-500/30');
      step3Circle.innerHTML = '3';
      step3Label.classList.add('text-emerald-400');

      // Populate final screen
      const avgConfidence = confidences.length > 0 ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) : 95;
      const primaryPhrase = phrases.length > 0 ? phrases[0] : 'Full Name';

      resultPhrase.textContent = primaryPhrase;
      resultConfidence.textContent = `${avgConfidence}%`;
      resultSamples.textContent = '3 / 3';

      // Update user info in localStorage if possible
      const currentUser = window.getCurrentUser();
      if (currentUser) {
        currentUser.enrollmentStatus = 'enrolled';
        localStorage.setItem('voicetrack_user', JSON.stringify(currentUser));
      }
    }
  }
});
