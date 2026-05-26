/**
 * VoiceTrack - Dashboard Page JavaScript Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const statEnrolledCount = document.getElementById('statEnrolledCount');
  const statSessionsCount = document.getElementById('statSessionsCount');
  const statAttendanceRate = document.getElementById('statAttendanceRate');
  const statAlertsCount = document.getElementById('statAlertsCount');
  const statAttendanceBar = document.getElementById('statAttendanceBar');
  const activeSessionsList = document.getElementById('activeSessionsList');
  const recentActivityBody = document.getElementById('recentActivityBody');
  const refreshActivityBtn = document.getElementById('dashboardRefreshActivity');
  const lastUpdatedText = document.getElementById('dashboardLastUpdated');

  let trendsChartInstance = null;

  // Initialize
  const currentUser = window.getCurrentUser();
  const isAdmin = currentUser && currentUser.role === 'admin';
  const isInstructor = currentUser && currentUser.role === 'instructor';

  // Load Dashboard Data
  loadDashboardData();

  // Refresh handlers
  if (refreshActivityBtn) {
    refreshActivityBtn.addEventListener('click', () => {
      loadRecentActivity();
      loadActiveSessions();
      lastUpdatedText.textContent = `Updated at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    });
  }

  // Auto-refresh active sessions and activity every 30 seconds
  setInterval(() => {
    loadActiveSessions();
    loadRecentActivity();
  }, 30000);

  /**
   * Load all dashboard components
   */
  function loadDashboardData() {
    if (isAdmin) {
      loadSummary();
    } else {
      // Hide or stub admin-only cards
      const enrolledCard = document.getElementById('statCardEnrolled');
      const alertsCard = document.getElementById('statCardAlerts');
      if (enrolledCard) enrolledCard.classList.add('opacity-50');
      if (alertsCard) alertsCard.classList.add('opacity-50');
    }

    if (isAdmin || isInstructor) {
      loadTrends();
      loadActiveSessions();
      loadRecentActivity();
    }
  }

  /**
   * Fetch system-wide summary (Admin only)
   */
  async function loadSummary() {
    try {
      const response = await window.apiRequest('/api/dashboard/summary');
      if (response.ok) {
        const data = await response.json();
        const summary = data.summary || {};

        animateCounter(statEnrolledCount, summary.totalUsers || 0);
        animateCounter(statSessionsCount, summary.activeSessions || 0);
        animateCounter(statAlertsCount, summary.pendingAlerts || 0);
        
        const rate = summary.todayAttendanceRate !== undefined ? Math.round(summary.todayAttendanceRate) : 0;
        animateCounter(statAttendanceRate, rate);
        
        if (statAttendanceBar) {
          statAttendanceBar.style.width = `${rate}%`;
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    }
  }

  /**
   * Fetch attendance trends and render Chart.js
   */
  async function loadTrends() {
    try {
      const response = await window.apiRequest('/api/dashboard/trends');
      if (response.ok) {
        const data = await response.json();
        const trends = data.trends || [];

        renderTrendsChart(trends);
      }
    } catch (err) {
      console.error('Error fetching attendance trends:', err);
    }
  }

  /**
   * Fetch currently live sessions
   */
  async function loadActiveSessions() {
    try {
      const response = await window.apiRequest('/api/dashboard/active-sessions');
      if (response.ok) {
        const data = await response.json();
        const sessions = data.sessions || [];

        activeSessionsList.innerHTML = '';

        if (sessions.length === 0) {
          activeSessionsList.innerHTML = `
            <div class="p-6 text-center rounded-xl border border-white/[0.04] bg-white/[0.02]">
              <p class="text-xs text-slate-500 font-medium">No live sessions at the moment</p>
              <a href="/sessions" class="mt-2.5 inline-block text-xs font-semibold text-indigo-400 hover:text-indigo-300">Launch a session</a>
            </div>
          `;
          return;
        }

        sessions.forEach(session => {
          const instructorName = session.instructorId ? `${session.instructorId.firstName} ${session.instructorId.lastName}` : 'Instructor';
          const totalMarked = session.stats ? session.stats.totalMarked : 0;
          const eligibleCount = session.stats ? session.stats.eligibleCount : 0;
          const percentage = eligibleCount > 0 ? Math.round((totalMarked / eligibleCount) * 100) : 0;

          const sessionDiv = document.createElement('div');
          sessionDiv.className = 'p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] transition-all relative overflow-hidden group';
          sessionDiv.innerHTML = `
            <div class="flex items-start justify-between mb-2">
              <div>
                <h4 class="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">${session.title}</h4>
                <p class="text-[11px] text-slate-500 mt-0.5">Instructor: ${instructorName} | Dept: ${session.department}</p>
              </div>
              <span class="badge badge-success text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1">
                <span class="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                Live
              </span>
            </div>
            <div class="flex items-center justify-between text-xs text-slate-400 mt-3">
              <span>Attendance Rate</span>
              <span class="font-bold text-white">${totalMarked} / ${eligibleCount} (${percentage}%)</span>
            </div>
            <div class="mt-1.5 w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
              <div class="h-full bg-emerald-500 rounded-full" style="width: ${percentage}%"></div>
            </div>
          `;
          activeSessionsList.appendChild(sessionDiv);
        });
      }
    } catch (err) {
      console.error('Error fetching active sessions:', err);
    }
  }

  /**
   * Fetch recent activity logs
   */
  async function loadRecentActivity() {
    try {
      const response = await window.apiRequest('/api/attendance?limit=10');
      if (response.ok) {
        const data = await response.json();
        const logs = data.logs || [];

        recentActivityBody.innerHTML = '';

        if (logs.length === 0) {
          recentActivityBody.innerHTML = `
            <tr>
              <td colspan="4" class="py-8 text-center text-xs text-slate-600">
                No recent activity recorded
              </td>
            </tr>
          `;
          return;
        }

        logs.forEach(log => {
          const userObj = log.userId || {};
          const sessionObj = log.sessionId || {};
          const studentName = userObj.firstName ? `${userObj.firstName} ${userObj.lastName}` : 'Student';
          const sessionTitle = sessionObj.title || 'Session';
          const time = new Date(log.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const date = new Date(log.markedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });

          const statusClasses = {
            present: 'badge-success',
            late: 'badge-warning',
            absent: 'badge-danger',
            excused: 'badge-neutral'
          };

          const row = document.createElement('tr');
          row.className = 'border-b border-white/[0.04] hover:bg-white/[0.01] transition-all';
          row.innerHTML = `
            <td class="py-3 px-4">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                  ${(userObj.firstName || 'S').charAt(0)}${(userObj.lastName || '').charAt(0)}
                </div>
                <div>
                  <p class="font-semibold text-white text-xs">${studentName}</p>
                  <p class="text-[10px] text-slate-500">${userObj.department || ''}</p>
                </div>
              </div>
            </td>
            <td class="py-3 px-4 text-xs font-medium text-slate-300">${sessionTitle}</td>
            <td class="py-3 px-4">
              <span class="badge ${statusClasses[log.status] || 'badge-neutral'} text-[9px] px-2 py-0.5 rounded-full capitalize">${log.status}</span>
            </td>
            <td class="py-3 px-4 text-xs text-slate-500">
              <p class="font-medium text-slate-400">${time}</p>
              <p class="text-[9px]">${date}</p>
            </td>
          `;
          recentActivityBody.appendChild(row);
        });
      }
    } catch (err) {
      console.error('Error fetching recent activity:', err);
      recentActivityBody.innerHTML = `
        <tr>
          <td colspan="4" class="py-8 text-center text-xs text-red-400">
            Error loading recent activity logs
          </td>
        </tr>
      `;
    }
  }

  /**
   * Helper to animate numeric counters
   */
  function animateCounter(element, target) {
    if (!element) return;
    
    let current = 0;
    const duration = 800; // ms
    const stepTime = 15; // ms
    const increment = Math.ceil(target / (duration / stepTime));

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        clearInterval(timer);
        element.textContent = target.toLocaleString();
      } else {
        element.textContent = current.toLocaleString();
      }
    }, stepTime);
  }

  /**
   * Render Chart.js line graph for attendance trends
   */
  function renderTrendsChart(trends) {
    const ctx = document.getElementById('trendsChart');
    if (!ctx) return;

    const labels = trends.map(t => {
      const d = new Date(t.date);
      return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    });
    
    const presentData = trends.map(t => t.present + t.late);
    const absentData = trends.map(t => t.absent);

    if (trendsChartInstance) {
      trendsChartInstance.destroy();
    }

    const gridColor = 'rgba(255, 255, 255, 0.05)';
    const labelColor = '#94a3b8';

    trendsChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Present/Late',
            data: presentData,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointBackgroundColor: '#6366f1',
            pointBorderColor: 'rgba(255, 255, 255, 0.8)',
            pointBorderWidth: 1.5,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Absent',
            data: absentData,
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.05)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            borderDash: [5, 5],
            pointBackgroundColor: '#f43f5e',
            pointBorderColor: 'rgba(255, 255, 255, 0.8)',
            pointBorderWidth: 1.5,
            pointRadius: 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#fff',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(99, 102, 241, 0.2)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            boxPadding: 6,
            usePointStyle: true
          }
        },
        scales: {
          x: {
            grid: {
              color: gridColor,
              drawBorder: false
            },
            ticks: {
              color: labelColor,
              font: {
                family: 'Inter',
                size: 10
              }
            }
          },
          y: {
            grid: {
              color: gridColor,
              drawBorder: false
            },
            ticks: {
              color: labelColor,
              stepSize: 1,
              font: {
                family: 'Inter',
                size: 10
              }
            },
            beginAtZero: true
          }
        }
      }
    });
  }
});
