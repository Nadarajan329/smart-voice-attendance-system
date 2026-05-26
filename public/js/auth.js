/**
 * VoiceTrack - Client-Side Authentication Manager
 */

(function () {
  // Selectors
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const passwordToggle = document.getElementById('loginPasswordToggle');
  const eyeOpenIcon = document.getElementById('passwordEyeOpen');
  const eyeClosedIcon = document.getElementById('passwordEyeClosed');
  const errorContainer = document.getElementById('loginError');
  const errorText = document.getElementById('loginErrorText');
  const submitBtn = document.getElementById('loginSubmitBtn');
  const btnText = document.getElementById('loginBtnText');
  const btnLoading = document.getElementById('loginBtnLoading');

  // Token storage keys
  const ACCESS_TOKEN_KEY = 'voicetrack_access_token';
  const REFRESH_TOKEN_KEY = 'voicetrack_refresh_token';
  const USER_KEY = 'voicetrack_user';

  /**
   * Helper to set access and refresh tokens
   */
  window.setAuthSession = function (accessToken, refreshToken, user) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    // Also set tokens in cookies for view rendering (server-side check)
    document.cookie = `accessToken=${accessToken}; path=/; max-age=86400; SameSite=Strict; Secure`;
    document.cookie = `refreshToken=${refreshToken}; path=/; max-age=604800; SameSite=Strict; Secure`;
  };

  /**
   * Helper to clear auth session
   */
  window.clearAuthSession = function () {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; Secure';
    document.cookie = 'refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; Secure';
  };

  /**
   * Getters for token and user
   */
  window.getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
  window.getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
  window.getCurrentUser = () => {
    const userStr = localStorage.getItem(USER_KEY);
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      return null;
    }
  };

  /**
   * Custom apiRequest wrapper that handles Bearer tokens and automatic JWT renewal on 401
   */
  window.apiRequest = async function (url, options = {}) {
    options.headers = options.headers || {};
    const token = window.getAccessToken();
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(url, options);

    // If unauthorized, attempt to refresh token
    if (response.status === 401) {
      const refreshToken = window.getRefreshToken();
      if (refreshToken) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            const user = window.getCurrentUser();
            window.setAuthSession(data.accessToken, data.refreshToken, user);

            // Retry the original request with the new access token
            options.headers['Authorization'] = `Bearer ${data.accessToken}`;
            response = await fetch(url, options);
          } else {
            // Refresh token failed/expired
            window.clearAuthSession();
            window.location.href = '/login';
            return response;
          }
        } catch (err) {
          window.clearAuthSession();
          window.location.href = '/login';
          return response;
        }
      } else {
        // No refresh token available, redirect
        window.clearAuthSession();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return response;
  };

  /**
   * Handle Log Out
   */
  window.handleLogout = async function () {
    try {
      await window.apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      window.clearAuthSession();
      window.location.href = '/login';
    }
  };

  // Password Visibility Toggle
  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      if (isPassword) {
        eyeOpenIcon.classList.add('hidden');
        eyeClosedIcon.classList.remove('hidden');
      } else {
        eyeOpenIcon.classList.remove('hidden');
        eyeClosedIcon.classList.add('hidden');
      }
    });
  }

  // Handle Login Submit
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Hide error
      errorContainer.classList.add('hidden');
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        errorText.textContent = 'Please fill in all fields.';
        errorContainer.classList.remove('hidden');
        return;
      }

      // Show loading
      submitBtn.disabled = true;
      btnText.classList.add('hidden');
      btnLoading.classList.remove('hidden');

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
          window.setAuthSession(data.accessToken, data.refreshToken, data.user);
          // Redirect to dashboard
          window.location.href = '/dashboard';
        } else {
          errorText.textContent = data.error || 'Invalid credentials. Please try again.';
          errorContainer.classList.remove('hidden');
        }
      } catch (err) {
        errorText.textContent = 'A connection error occurred. Please try again later.';
        errorContainer.classList.remove('hidden');
        console.error('Login error:', err);
      } finally {
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
      }
    });
  }

  // Setup Global Logout Button Listeners
  document.addEventListener('DOMContentLoaded', () => {
    // If on /login page, but we already have an active access token, redirect to /dashboard
    if (window.location.pathname === '/login' && window.getAccessToken()) {
      window.location.href = '/dashboard';
    }

    const logoutBtns = document.querySelectorAll('.logout-btn, [id="navLogoutBtn"], [id="sidebarLogoutBtn"]');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.handleLogout();
      });
    });
  });
})();
