/**
 * VoiceTrack - Attendance Station JavaScript Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const sessionSelector = document.getElementById('sessionSelector');
  const sessionStatusBadge = document.getElementById('sessionStatusBadge');
  const speechApiWarning = document.getElementById('speechApiWarning');
  const micButton = document.getElementById('micButton');
  const micIcon = document.getElementById('micIcon');
  const micSpinner = document.getElementById('micSpinner');
  const micSuccess = document.getElementById('micSuccess');
  const micError = document.getElementById('micError');
  const micStateText = document.getElementById('micStateText');
  const processingTime = document.getElementById('processingTime');
  const processingTimeValue = document.getElementById('processingTimeValue');
  
  const transcriptDisplay = document.getElementById('transcriptDisplay');
  const interimText = document.getElementById('interimText');
  const finalText = document.getElementById('finalText');

  const validationPanel = document.getElementById('validationPanel');
  const validationSuccess = document.getElementById('validationSuccess');
  const validationUserName = document.getElementById('validationUserName');
  const validationConfidence = document.getElementById('validationConfidence');
  const validationRetry = document.getElementById('validationRetry');
  const validationAttemptCount = document.getElementById('validationAttemptCount');
  const validationRetryBtn = document.getElementById('validationRetryBtn');
  const validationError = document.getElementById('validationError');
  const validationErrorRetryBtn = document.getElementById('validationErrorRetryBtn');

  const recentVerificationsContainer = document.getElementById('recentVerifications');

  let recognizer = null;
  let attemptCount = 0;
  let resetTimeout = null;

  // Check Web Speech API Support
  if (!window.SpeechRecognizer.isSupported()) {
    speechApiWarning.classList.remove('hidden');
    micButton.disabled = true;
    micStateText.textContent = 'Voice recognition not supported';
    return;
  }

  // Initialize SpeechRecognizer
  recognizer = new window.SpeechRecognizer({
    continuous: false,
    interimResults: true,
    maxAlternatives: 3,
    lang: 'en-US'
  });

  // Bind Recognizer events
  recognizer.onStateChange((state) => {
    updateMicButtonUI(state);
  });

  recognizer.onResult(({ transcript, isFinal, confidence }) => {
    transcriptDisplay.classList.remove('hidden');
    if (isFinal) {
      interimText.textContent = '';
      finalText.textContent = transcript;
      
      // Stop and submit
      recognizer.stop();
      submitVoiceVerification(transcript);
    } else {
      interimText.textContent = transcript;
    }
  });

  recognizer.onError(({ error, message }) => {
    console.error('Speech error:', error, message);
    showMicStatus('error', message || 'Error capturing voice');
    showValidationFeedback('error');
    scheduleReset(5000);
  });

  // Fetch active sessions on load
  loadActiveSessions();

  // Session selector change handler
  sessionSelector.addEventListener('change', () => {
    const sessionId = sessionSelector.value;
    if (sessionId) {
      micButton.disabled = false;
      sessionStatusBadge.classList.remove('hidden');
      micStateText.textContent = 'Tap the microphone to speak your name';
      attemptCount = 0;
      loadSessionAttendance(sessionId);
    } else {
      micButton.disabled = true;
      sessionStatusBadge.classList.add('hidden');
      micStateText.textContent = 'Select a session to begin';
      recentVerificationsContainer.innerHTML = '<p class="text-center text-xs text-slate-600 py-4">No verifications yet for this session</p>';
    }
    resetUI();
  });

  // Mic button click handler
  micButton.addEventListener('click', () => {
    if (recognizer.state === 'idle') {
      clearTimeout(resetTimeout);
      resetUI();
      recognizer.start();
    } else if (recognizer.state === 'listening') {
      recognizer.stop();
    }
  });

  // Retry buttons
  if (validationRetryBtn) {
    validationRetryBtn.addEventListener('click', () => {
      resetUI();
      recognizer.start();
    });
  }
  if (validationErrorRetryBtn) {
    validationErrorRetryBtn.addEventListener('click', () => {
      attemptCount = 0;
      resetUI();
      recognizer.start();
    });
  }

  /**
   * Load active sessions from API
   */
  async function loadActiveSessions() {
    try {
      const response = await window.apiRequest('/api/sessions');
      if (response.ok) {
        const data = await response.json();
        // The API returns paginated sessions or an array
        const sessions = data.sessions || data;
        
        // Filter for active sessions
        const activeSessions = Array.isArray(sessions) ? sessions.filter(s => s.status === 'active') : [];

        // Clear existing, keep default
        sessionSelector.innerHTML = '<option value="" class="bg-[#1e293b]">Select a session...</option>';
        
        activeSessions.forEach(session => {
          const option = document.createElement('option');
          option.value = session._id;
          option.className = 'bg-[#1e293b]';
          option.textContent = `${session.title} (${session.department})`;
          sessionSelector.appendChild(option);
        });

        if (activeSessions.length === 0) {
          micStateText.textContent = 'No active attendance sessions available';
        }
      }
    } catch (err) {
      console.error('Error fetching active sessions:', err);
      micStateText.textContent = 'Error loading sessions';
    }
  }

  /**
   * Submit Voice Transcript to Matching API
   */
  async function submitVoiceVerification(transcript) {
    const sessionId = sessionSelector.value;
    if (!sessionId) return;

    try {
      const response = await window.apiRequest('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, sessionId })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        if (result.matched) {
          // Success match
          showMicStatus('success', 'Matched!');
          
          if (processingTime) {
            processingTime.classList.remove('hidden');
            processingTimeValue.textContent = result.processingTimeMs || 0;
          }

          showValidationFeedback('success', {
            name: result.userName,
            confidence: `${Math.round(result.score)}%`
          });

          // Refresh logs
          loadSessionAttendance(sessionId);
          scheduleReset(5000);
        } else {
          // No match, handle retry up to 3 times
          attemptCount++;
          if (attemptCount < 3) {
            showMicStatus('error', 'Match failed');
            showValidationFeedback('retry');
          } else {
            showMicStatus('error', 'Not recognized');
            showValidationFeedback('error');
          }
          scheduleReset(6000);
        }
      } else {
        showMicStatus('error', result.message || 'Error marking attendance');
        showValidationFeedback('error');
        scheduleReset(5000);
      }
    } catch (err) {
      console.error('Error submitting verification:', err);
      showMicStatus('error', 'Network error. Please try again.');
      showValidationFeedback('error');
      scheduleReset(5000);
    }
  }

  /**
   * Load session attendance logs
   */
  async function loadSessionAttendance(sessionId) {
    try {
      const response = await window.apiRequest(`/api/attendance/session/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        const logs = data.logs || [];
        
        // Filter for present/late logs
        const presentLogs = logs.filter(log => log.status === 'present' || log.status === 'late');

        if (presentLogs.length === 0) {
          recentVerificationsContainer.innerHTML = '<p class="text-center text-xs text-slate-600 py-4">No verifications yet for this session</p>';
          return;
        }

        // Sort descending by markedAt
        presentLogs.sort((a, b) => new Date(b.markedAt) - new Date(a.markedAt));

        // Take top 5
        const top5 = presentLogs.slice(0, 5);

        recentVerificationsContainer.innerHTML = '';
        top5.forEach(log => {
          const formattedTime = new Date(log.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const userObj = log.userId || {};
          const userName = userObj.firstName ? `${userObj.firstName} ${userObj.lastName}` : 'Student';
          const dept = userObj.department || '';
          
          const verificationDiv = document.createElement('div');
          verificationDiv.className = 'flex items-center justify-between p-3 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-all';
          verificationDiv.innerHTML = `
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-xs font-bold text-indigo-400">
                ${(userObj.firstName || 'S').charAt(0)}${(userObj.lastName || '').charAt(0)}
              </div>
              <div>
                <p class="text-xs font-bold text-white">${userName}</p>
                <p class="text-[10px] text-slate-500">${dept}</p>
              </div>
            </div>
            <div class="text-right">
              <span class="badge ${log.status === 'present' ? 'badge-success' : 'badge-warning'} text-[10px] px-2 py-0.5 rounded-full capitalize">${log.status}</span>
              <p class="text-[9px] text-slate-500 mt-0.5">${formattedTime}</p>
            </div>
          `;
          recentVerificationsContainer.appendChild(verificationDiv);
        });
      }
    } catch (err) {
      console.error('Error loading attendance logs:', err);
    }
  }

  /**
   * Helper to update UI state on Mic Button
   */
  function updateMicButtonUI(state) {
    micButton.className = 'mic-button relative w-[140px] h-[140px] rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none';
    
    // Hide all icons
    micIcon.classList.add('hidden');
    micSpinner.classList.add('hidden');
    micSuccess.classList.add('hidden');
    micError.classList.add('hidden');
    
    // Pulse rings
    const rings = document.querySelectorAll('.mic-pulse-ring');

    if (state === 'listening') {
      micButton.classList.add('listening', 'bg-gradient-to-br', 'from-emerald-500', 'to-teal-600', 'shadow-emerald-500/30');
      micIcon.classList.remove('hidden');
      micStateText.textContent = 'Listening... Speak your name';
      micStateText.className = 'text-lg font-semibold text-emerald-400 mb-2';
      rings.forEach(r => r.classList.remove('opacity-0'));
    } else if (state === 'processing') {
      micButton.classList.add('processing', 'bg-gradient-to-br', 'from-amber-500', 'to-orange-600', 'shadow-amber-500/30');
      micSpinner.classList.remove('hidden');
      micStateText.textContent = 'Processing name matching...';
      micStateText.className = 'text-lg font-semibold text-amber-400 mb-2';
      rings.forEach(r => r.classList.add('opacity-0'));
    } else {
      // Idle
      micButton.classList.add('bg-gradient-to-br', 'from-indigo-500', 'to-violet-600', 'shadow-indigo-500/30', 'hover:scale-105', 'active:scale-95');
      micIcon.classList.remove('hidden');
      micStateText.textContent = 'Tap the microphone to speak your name';
      micStateText.className = 'text-lg font-semibold text-slate-400 mb-2';
      rings.forEach(r => r.classList.add('opacity-0'));
    }
  }

  /**
   * Set explicit success/error mic button icon
   */
  function showMicStatus(status, text) {
    micButton.className = 'mic-button relative w-[140px] h-[140px] rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none';
    
    micIcon.classList.add('hidden');
    micSpinner.classList.add('hidden');
    micSuccess.classList.add('hidden');
    micError.classList.add('hidden');
    
    const rings = document.querySelectorAll('.mic-pulse-ring');
    rings.forEach(r => r.classList.add('opacity-0'));

    if (status === 'success') {
      micButton.classList.add('success', 'shadow-emerald-500/50');
      micSuccess.classList.remove('hidden');
      micStateText.textContent = text;
      micStateText.className = 'text-lg font-semibold text-emerald-400 mb-2';
    } else if (status === 'error') {
      micButton.classList.add('error', 'shadow-red-500/50');
      micError.classList.remove('hidden');
      micStateText.textContent = text;
      micStateText.className = 'text-lg font-semibold text-red-400 mb-2';
    }
  }

  /**
   * Display feedback cards
   */
  function showValidationFeedback(type, data = {}) {
    validationPanel.classList.remove('hidden');
    validationSuccess.classList.add('hidden');
    validationRetry.classList.add('hidden');
    validationError.classList.add('hidden');

    if (type === 'success') {
      validationSuccess.classList.remove('hidden');
      validationUserName.textContent = data.name || 'Student';
      validationConfidence.textContent = data.confidence || '100%';
    } else if (type === 'retry') {
      validationRetry.classList.remove('hidden');
      validationAttemptCount.textContent = attemptCount;
    } else if (type === 'error') {
      validationError.classList.remove('hidden');
    }
  }

  /**
   * Schedule reset of UI after a success/failure
   */
  function scheduleReset(ms) {
    clearTimeout(resetTimeout);
    resetTimeout = setTimeout(() => {
      resetUI();
      if (attemptCount >= 3) {
        attemptCount = 0;
      }
    }, ms);
  }

  /**
   * Reset everything to default (idle) state
   */
  function resetUI() {
    updateMicButtonUI('idle');
    transcriptDisplay.classList.add('hidden');
    interimText.textContent = '';
    finalText.textContent = '';
    validationPanel.classList.add('hidden');
    validationSuccess.classList.add('hidden');
    validationRetry.classList.add('hidden');
    validationError.classList.add('hidden');
    processingTime.classList.add('hidden');
  }
});
