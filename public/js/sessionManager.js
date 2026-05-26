/**
 * VoiceTrack - Session Management JavaScript Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const createForm = document.getElementById('createSessionForm');
  const titleInput = document.getElementById('sessionTitle');
  const departmentSelect = document.getElementById('sessionDepartment');
  const dateInput = document.getElementById('sessionDate');
  const startTimeInput = document.getElementById('sessionStartTime');
  const endTimeInput = document.getElementById('sessionEndTime');
  
  // Student Search / Multiselect
  const studentSearch = document.getElementById('sessionStudentSearch');
  const studentsList = document.getElementById('sessionStudentsList');
  const selectedStudentsDiv = document.getElementById('sessionSelectedStudents');
  
  // Recurrence
  const recurrenceToggle = document.getElementById('sessionRecurrenceToggle');
  const recurrenceOptions = document.getElementById('sessionRecurrenceOptions');
  const recurrencePattern = document.getElementById('sessionRecurrencePattern');
  
  // Settings
  const lateThresholdInput = document.getElementById('sessionLateThreshold');
  const manualOverrideToggle = document.getElementById('sessionManualOverrideToggle');
  const autoCloseToggle = document.getElementById('sessionAutoCloseToggle');
  
  // Upcoming / History
  const upcomingList = document.getElementById('upcomingSessionsList');
  const refreshBtn = document.getElementById('sessionRefreshBtn');
  const historyBody = document.getElementById('sessionHistoryBody');

  let selectedStudents = []; // Array of student user objects { id, name }
  let allStudents = []; // Cache of all students fetched

  // Initialize
  init();

  function init() {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    if (dateInput) dateInput.value = today;

    // Load active sessions lists
    loadSessions();

    // Load all students for the dropdown select search
    fetchStudents();

    // Bind event listeners
    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadSessions);
    }

    if (studentSearch) {
      studentSearch.addEventListener('focus', () => {
        showStudentDropdown(studentSearch.value);
      });
      studentSearch.addEventListener('input', (e) => {
        showStudentDropdown(e.target.value);
      });
      document.addEventListener('click', (e) => {
        if (studentsList && !studentsList.contains(e.target) && e.target !== studentSearch) {
          studentsList.classList.add('hidden');
        }
      });
    }

    // Toggle Switches Event Bindings
    setupToggles();

    // Handle Form Submit
    if (createForm) {
      createForm.addEventListener('submit', handleCreateSession);
    }
  }

  /**
   * Set up behavior for custom UI toggle switches
   */
  function setupToggles() {
    const handleToggleClick = (toggle, hasOptionsElement) => {
      const isChecked = toggle.classList.contains('active');
      const pin = toggle.querySelector('div');
      
      if (isChecked) {
        toggle.classList.remove('active', 'bg-indigo-500', 'border-indigo-400/30');
        toggle.classList.add('bg-white/[0.08]', 'border-white/[0.1]');
        toggle.setAttribute('aria-checked', 'false');
        if (pin) {
          pin.className = 'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-slate-400 shadow transition-all duration-200';
        }
        if (hasOptionsElement) hasOptionsElement.classList.add('hidden');
      } else {
        toggle.classList.add('active', 'bg-indigo-500', 'border-indigo-400/30');
        toggle.classList.remove('bg-white/[0.08]', 'border-white/[0.1]');
        toggle.setAttribute('aria-checked', 'true');
        if (pin) {
          pin.className = 'absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200';
        }
        if (hasOptionsElement) hasOptionsElement.classList.remove('hidden');
      }
    };

    if (recurrenceToggle) {
      recurrenceToggle.addEventListener('click', () => {
        handleToggleClick(recurrenceToggle, recurrenceOptions);
      });
    }

    if (manualOverrideToggle) {
      manualOverrideToggle.addEventListener('click', () => {
        handleToggleClick(manualOverrideToggle);
      });
    }

    if (autoCloseToggle) {
      autoCloseToggle.addEventListener('click', () => {
        handleToggleClick(autoCloseToggle);
      });
    }
  }

  /**
   * Fetch students list from server
   */
  async function fetchStudents() {
    try {
      const response = await window.apiRequest('/api/users?role=student&limit=100');
      if (response.ok) {
        const data = await response.json();
        allStudents = data.users || [];
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  }

  /**
   * Show searchable student multiselect dropdown
   */
  function showStudentDropdown(searchTerm = '') {
    if (!studentsList) return;
    
    const query = searchTerm.toLowerCase();
    const filtered = allStudents.filter(student => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      const idStr = (student.employeeId || '').toLowerCase();
      const isAlreadySelected = selectedStudents.some(s => s._id === student._id);
      
      return !isAlreadySelected && (fullName.includes(query) || idStr.includes(query));
    });

    studentsList.innerHTML = '';
    
    if (filtered.length === 0) {
      studentsList.innerHTML = '<div class="p-3 text-xs text-slate-500 text-center">No students found</div>';
    } else {
      filtered.forEach(student => {
        const item = document.createElement('div');
        item.className = 'p-2.5 text-xs text-white hover:bg-indigo-500/20 cursor-pointer border-b border-white/[0.04] transition-colors';
        item.textContent = `${student.firstName} ${student.lastName} (${student.employeeId || student.department})`;
        item.addEventListener('click', () => {
          addSelectedStudent(student);
          studentsList.classList.add('hidden');
          studentSearch.value = '';
        });
        studentsList.appendChild(item);
      });
    }
    
    studentsList.classList.remove('hidden');
  }

  /**
   * Add student to selected list and render badge
   */
  function addSelectedStudent(student) {
    if (selectedStudents.some(s => s._id === student._id)) return;
    
    selectedStudents.push(student);
    renderSelectedBadges();
  }

  /**
   * Remove student from selected list
   */
  function removeSelectedStudent(id) {
    selectedStudents = selectedStudents.filter(s => s._id !== id);
    renderSelectedBadges();
  }

  /**
   * Render student badges on UI
   */
  function renderSelectedBadges() {
    if (!selectedStudentsDiv) return;
    selectedStudentsDiv.innerHTML = '';
    
    selectedStudents.forEach(student => {
      const badge = document.createElement('span');
      badge.className = 'badge badge-info inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      badge.innerHTML = `
        <span>${student.firstName} ${student.lastName}</span>
        <button type="button" class="hover:text-white transition-colors cursor-pointer select-none font-bold" data-id="${student._id}">&times;</button>
      `;
      
      badge.querySelector('button').addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        removeSelectedStudent(id);
      });
      
      selectedStudentsDiv.appendChild(badge);
    });
  }

  /**
   * Load upcoming sessions and history logs
   */
  async function loadSessions() {
    try {
      const response = await window.apiRequest('/api/sessions?limit=100');
      if (response.ok) {
        const data = await response.json();
        const sessions = data.sessions || data || [];

        renderSessions(sessions);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  }

  /**
   * Render upcoming sessions and past history table
   */
  function renderSessions(sessions) {
    if (!upcomingList || !historyBody) return;

    upcomingList.innerHTML = '';
    historyBody.innerHTML = '';

    // Split into upcoming and past sessions
    const upcoming = sessions.filter(s => s.status === 'scheduled' || s.status === 'active');
    const history = sessions.filter(s => s.status === 'closed' || s.status === 'cancelled');

    // Render Upcoming
    if (upcoming.length === 0) {
      upcomingList.innerHTML = `
        <div class="p-8 text-center rounded-xl border border-white/[0.04] bg-white/[0.02]">
          <p class="text-xs text-slate-500 font-medium">No active or scheduled sessions</p>
        </div>
      `;
    } else {
      upcoming.forEach(session => {
        const dateStr = new Date(session.scheduledDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        const start = new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const end = new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const isLive = session.status === 'active';
        
        const card = document.createElement('div');
        card.className = `p-5 rounded-xl border ${isLive ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : 'border-white/[0.06] bg-white/[0.02]'} transition-all hover:bg-white/[0.04]`;
        
        card.innerHTML = `
          <div class="flex items-start justify-between mb-3">
            <div>
              <h4 class="text-sm font-bold text-white">${session.title}</h4>
              <p class="text-[11px] text-slate-500 mt-0.5">Dept: ${session.department} | ${dateStr}</p>
              <p class="text-[11px] text-indigo-400 font-semibold mt-0.5">${start} - ${end}</p>
            </div>
            <span class="badge ${isLive ? 'badge-success' : 'badge-warning'} text-[10px] px-2 py-0.5 rounded-full capitalize">${session.status}</span>
          </div>
          
          <div class="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/[0.04]">
            ${!isLive ? `
              <button class="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 active:scale-95 transition-all activate-btn" data-id="${session._id}">Activate</button>
            ` : `
              <button class="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/25 active:scale-95 transition-all close-btn" data-id="${session._id}">Close</button>
            `}
            <button class="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-white transition-all delete-btn" data-id="${session._id}">Delete</button>
          </div>
        `;

        // Event Listeners
        const activateBtn = card.querySelector('.activate-btn');
        const closeBtn = card.querySelector('.close-btn');
        const deleteBtn = card.querySelector('.delete-btn');

        if (activateBtn) {
          activateBtn.addEventListener('click', () => updateSessionStatus(session._id, 'activate'));
        }
        if (closeBtn) {
          closeBtn.addEventListener('click', () => updateSessionStatus(session._id, 'close'));
        }
        if (deleteBtn) {
          deleteBtn.addEventListener('click', () => deleteSession(session._id));
        }

        upcomingList.appendChild(card);
      });
    }

    // Render History
    if (history.length === 0) {
      historyBody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-xs text-slate-600">No past sessions recorded</td>
        </tr>
      `;
    } else {
      history.forEach(session => {
        const dateStr = new Date(session.scheduledDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const start = new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const end = new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let duration = '---';
        if (session.actualStartTime && session.actualEndTime) {
          const diffMin = Math.round((new Date(session.actualEndTime) - new Date(session.actualStartTime)) / 60000);
          duration = `${diffMin} mins`;
        }

        const totalEligible = session.stats ? session.stats.totalEligible : 0;
        const totalPresent = session.stats ? session.stats.totalPresent : 0;
        const attendanceStr = `${totalPresent} / ${totalEligible}`;

        const row = document.createElement('tr');
        row.className = 'border-b border-white/[0.04] hover:bg-white/[0.01] transition-all';
        row.innerHTML = `
          <td class="py-3 px-4 font-semibold text-white text-xs">${session.title}</td>
          <td class="py-3 px-4 text-xs text-slate-400">
            <p>${dateStr}</p>
            <p class="text-[10px] text-slate-500 mt-0.5">${start} - ${end}</p>
          </td>
          <td class="py-3 px-4 text-xs text-slate-500 hidden sm:table-cell">${duration}</td>
          <td class="py-3 px-4 text-xs text-slate-300 font-bold">${attendanceStr}</td>
          <td class="py-3 px-4">
            <span class="badge ${session.status === 'closed' ? 'badge-neutral' : 'badge-danger'} text-[9px] px-2 py-0.5 rounded-full capitalize">${session.status}</span>
          </td>
        `;
        historyBody.appendChild(row);
      });
    }
  }

  /**
   * PUT / PATCH Session status
   */
  async function updateSessionStatus(id, action) {
    try {
      const response = await window.apiRequest(`/api/sessions/${id}/${action}`, {
        method: 'PATCH'
      });

      if (response.ok) {
        window.showToast(`Session ${action === 'activate' ? 'activated' : 'closed'} successfully!`, 'success');
        loadSessions();
      } else {
        const errData = await response.json();
        window.showToast(errData.message || `Error attempting to ${action} session.`, 'error');
      }
    } catch (err) {
      console.error(`Error in ${action} session:`, err);
      window.showToast('Network error updating session status.', 'error');
    }
  }

  /**
   * DELETE Session
   */
  async function deleteSession(id) {
    if (!confirm('Are you sure you want to cancel and delete this session?')) return;

    try {
      const response = await window.apiRequest(`/api/sessions/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        window.showToast('Session cancelled successfully!', 'success');
        loadSessions();
      } else {
        const errData = await response.json();
        window.showToast(errData.message || 'Error deleting session.', 'error');
      }
    } catch (err) {
      console.error('Error deleting session:', err);
      window.showToast('Network error deleting session.', 'error');
    }
  }

  /**
   * Create Session
   */
  async function handleCreateSession(e) {
    e.preventDefault();

    const title = titleInput.value.trim();
    const department = departmentSelect.value;
    const dateVal = dateInput.value;
    const startVal = startTimeInput.value;
    const endVal = endTimeInput.value;
    
    if (!title || !department || !dateVal || !startVal || !endVal) {
      window.showToast('Please fill out all required fields.', 'warning');
      return;
    }

    // Combine date and time
    const startTime = new Date(`${dateVal}T${startVal}`).toISOString();
    const endTime = new Date(`${dateVal}T${endVal}`).toISOString();

    if (new Date(endTime) <= new Date(startTime)) {
      window.showToast('End time must be after start time.', 'warning');
      return;
    }

    const isRecurring = recurrenceToggle.classList.contains('active');
    const pattern = isRecurring ? recurrencePattern.value : null;

    const body = {
      title,
      department,
      scheduledDate: new Date(dateVal).toISOString(),
      startTime,
      endTime,
      eligibleUsers: selectedStudents.map(student => student._id),
      recurrence: {
        isRecurring,
        pattern
      },
      settings: {
        lateThresholdMinutes: parseInt(lateThresholdInput.value, 10) || 15,
        allowManualOverride: manualOverrideToggle.classList.contains('active'),
        autoCloseEnabled: autoCloseToggle.classList.contains('active')
      }
    };

    try {
      const response = await window.apiRequest('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        window.showToast('Session created successfully!', 'success');
        
        // Reset form and multiselect
        createForm.reset();
        selectedStudents = [];
        renderSelectedBadges();
        
        // Reload toggles state back to default
        if (recurrenceToggle.classList.contains('active')) recurrenceToggle.click();
        
        loadSessions();
      } else {
        const errData = await response.json();
        window.showToast(errData.message || 'Error creating session.', 'error');
      }
    } catch (err) {
      console.error('Error creating session:', err);
      window.showToast('Network error creating session.', 'error');
    }
  }
});
