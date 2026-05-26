/**
 * Roster Manager — Client-side logic for roster management page
 */
document.addEventListener('DOMContentLoaded', () => {
  // ─── State ────────────────────────────────────────────────────────────────
  let allUsers = [];
  let filteredUsers = [];
  let currentPage = 1;
  const pageSize = 15;
  let selectedUsers = new Set();
  let overrideTargetUser = null;

  // ─── DOM Elements ─────────────────────────────────────────────────────────
  const tableBody = document.getElementById('rosterTableBody');
  const searchInput = document.getElementById('rosterSearch');
  const deptFilter = document.getElementById('deptFilter');
  const statusFilter = document.getElementById('statusFilter');
  const searchBtn = document.getElementById('searchBtn');
  const selectAllCheckbox = document.getElementById('selectAll');
  const totalCountEl = document.getElementById('totalCount');
  const overridePanel = document.getElementById('overridePanel');
  const overrideClose = document.getElementById('overrideClose');
  const overrideForm = document.getElementById('overrideForm');
  const overrideUserName = document.getElementById('overrideUserName');
  const overrideSession = document.getElementById('overrideSession');
  const exportCsvBtn = document.getElementById('exportCsv');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  const pageInfo = document.getElementById('pageInfo');

  // ─── Fetch Users ──────────────────────────────────────────────────────────
  async function fetchUsers() {
    try {
      const res = await window.apiRequest('/api/users?limit=500&role=student');
      if (res.ok) {
        const data = await res.json();
        if (data && data.users) {
          allUsers = data.users;
          filteredUsers = [...allUsers];
          updateTotalCount();
          renderTable();
        }
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-[#64748b]">Failed to load roster data</td></tr>`;
      }
    }
  }

  // ─── Filter ───────────────────────────────────────────────────────────────
  function applyFilters() {
    const search = (searchInput?.value || '').toLowerCase().trim();
    const dept = deptFilter?.value || '';
    const status = statusFilter?.value || '';

    filteredUsers = allUsers.filter(user => {
      const matchesSearch = !search ||
        (user.firstName + ' ' + user.lastName).toLowerCase().includes(search) ||
        (user.employeeId || '').toLowerCase().includes(search) ||
        (user.email || '').toLowerCase().includes(search);
      const matchesDept = !dept || user.department === dept;
      const matchesStatus = !status || user.enrollmentStatus === status;
      return matchesSearch && matchesDept && matchesStatus;
    });

    currentPage = 1;
    updateTotalCount();
    renderTable();
  }

  // ─── Render Table ─────────────────────────────────────────────────────────
  function renderTable() {
    if (!tableBody) return;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageUsers = filteredUsers.slice(start, end);

    if (pageUsers.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-[#64748b]">No students found</td></tr>`;
      updatePagination();
      return;
    }

    tableBody.innerHTML = pageUsers.map(user => {
      const name = `${user.firstName} ${user.lastName}`;
      const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();
      const isSelected = selectedUsers.has(user._id);

      const statusBadge = getStatusBadge(user.enrollmentStatus);
      const attendancePct = user.attendancePercentage != null
        ? `${Math.round(user.attendancePercentage)}%`
        : '—';
      const lastAttendance = user.lastAttendance
        ? new Date(user.lastAttendance).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

      return `
        <tr class="group">
          <td>
            <input type="checkbox" class="user-checkbox rounded border-[#334155] bg-transparent accent-[#6366f1]"
                   data-id="${user._id}" ${isSelected ? 'checked' : ''}
                   onchange="window.rosterManager.toggleUser('${user._id}')">
          </td>
          <td>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-xs font-bold text-white">
                ${initials}
              </div>
              <div>
                <div class="font-medium text-[#e2e8f0]">${name}</div>
                <div class="text-xs text-[#64748b]">${user.email || ''}</div>
              </div>
            </div>
          </td>
          <td class="text-[#94a3b8] font-mono text-sm">${user.employeeId || '—'}</td>
          <td class="text-[#94a3b8]">${user.department || '—'}</td>
          <td>${statusBadge}</td>
          <td class="font-semibold ${getAttendanceColor(user.attendancePercentage)}">${attendancePct}</td>
          <td class="text-[#94a3b8] text-sm">${lastAttendance}</td>
          <td>
            <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick="window.rosterManager.viewUser('${user._id}')"
                      class="p-1.5 rounded-lg hover:bg-[#6366f1]/10 text-[#a5b4fc] transition-colors" title="View">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </button>
              <button onclick="window.rosterManager.resetVoice('${user._id}', '${name}')"
                      class="p-1.5 rounded-lg hover:bg-[#f59e0b]/10 text-[#fbbf24] transition-colors" title="Reset Voice">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              </button>
              <button onclick="window.rosterManager.openOverride('${user._id}', '${name}')"
                      class="p-1.5 rounded-lg hover:bg-[#6366f1]/10 text-[#a5b4fc] transition-colors" title="Manual Override">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    updatePagination();
  }

  function getStatusBadge(status) {
    const map = {
      enrolled: '<span class="badge badge-success">Enrolled</span>',
      voice_pending: '<span class="badge badge-warning">Voice Pending</span>',
      pending: '<span class="badge badge-info">Pending</span>',
      suspended: '<span class="badge badge-danger">Suspended</span>'
    };
    return map[status] || '<span class="badge badge-neutral">Unknown</span>';
  }

  function getAttendanceColor(pct) {
    if (pct == null) return 'text-[#64748b]';
    if (pct >= 75) return 'text-[#34d399]';
    if (pct >= 50) return 'text-[#fbbf24]';
    return 'text-[#fb7185]';
  }

  function updateTotalCount() {
    if (totalCountEl) totalCountEl.textContent = filteredUsers.length;
  }

  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
  }

  // ─── User Selection ───────────────────────────────────────────────────────
  window.rosterManager = {
    toggleUser(id) {
      if (selectedUsers.has(id)) selectedUsers.delete(id);
      else selectedUsers.add(id);
    },

    viewUser(id) {
      window.location.href = `/profile?id=${id}`;
    },

    async resetVoice(userId, name) {
      if (!confirm(`Reset voice template for ${name}? They will need to re-enroll.`)) return;
      try {
        await window.apiRequest(`/api/voice/template/${userId}`, { method: 'DELETE' });
        alert(`Voice template reset for ${name}`);
        fetchUsers();
      } catch (err) {
        alert('Failed to reset voice template');
      }
    },

    openOverride(userId, name) {
      overrideTargetUser = userId;
      if (overrideUserName) overrideUserName.textContent = name;
      if (overridePanel) {
        overridePanel.classList.remove('translate-x-full');
        overridePanel.classList.add('translate-x-0');
      }
      loadSessions();
    },

    closeOverride() {
      if (overridePanel) {
        overridePanel.classList.remove('translate-x-0');
        overridePanel.classList.add('translate-x-full');
      }
      overrideTargetUser = null;
    }
  };

  // ─── Override Panel ───────────────────────────────────────────────────────
  async function loadSessions() {
    try {
      const res = await window.apiRequest('/api/sessions?status=active');
      if (res.ok) {
        const data = await res.json();
        if (overrideSession && data && data.sessions) {
          overrideSession.innerHTML = '<option value="">Select Session</option>' +
            data.sessions.map(s => `<option value="${s._id}">${s.title}</option>`).join('');
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }

  if (overrideClose) {
    overrideClose.addEventListener('click', () => window.rosterManager.closeOverride());
  }

  if (overrideForm) {
    overrideForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!overrideTargetUser) return;

      const sessionId = overrideSession?.value;
      const status = document.querySelector('input[name="overrideStatus"]:checked')?.value;
      const reason = document.getElementById('overrideReason')?.value || '';

      if (!sessionId || !status) {
        alert('Please select a session and status');
        return;
      }

      try {
        await window.apiRequest('/api/attendance/override', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: overrideTargetUser, sessionId, status, reason })
        });
        alert('Attendance override saved');
        window.rosterManager.closeOverride();
        fetchUsers();
      } catch (err) {
        alert('Failed to save override');
      }
    });
  }

  // ─── Export CSV ────────────────────────────────────────────────────────────
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const headers = ['Name', 'Employee ID', 'Department', 'Email', 'Status', 'Attendance %'];
      const rows = filteredUsers.map(u => [
        `${u.firstName} ${u.lastName}`,
        u.employeeId || '',
        u.department || '',
        u.email || '',
        u.enrollmentStatus || '',
        u.attendancePercentage != null ? Math.round(u.attendancePercentage) : ''
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roster_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // ─── Event Listeners ──────────────────────────────────────────────────────
  if (searchBtn) searchBtn.addEventListener('click', applyFilters);
  if (searchInput) searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') applyFilters(); });
  if (deptFilter) deptFilter.addEventListener('change', applyFilters);
  if (statusFilter) statusFilter.addEventListener('change', applyFilters);

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.user-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
        const id = cb.dataset.id;
        if (e.target.checked) selectedUsers.add(id);
        else selectedUsers.delete(id);
      });
    });
  }

  if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
  if (nextPageBtn) nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredUsers.length / pageSize);
    if (currentPage < totalPages) { currentPage++; renderTable(); }
  });

  // ─── Init ─────────────────────────────────────────────────────────────────
  fetchUsers();
});
