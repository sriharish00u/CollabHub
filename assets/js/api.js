/**
 * CollabHub API Client
 * Wraps every backend endpoint with JWT handling and auth guards.
 */
(function () {
  const BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL);

  const DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="none" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fd761a"/><stop offset="100%" stop-color="#c445e0"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#g)"/><circle cx="40" cy="30" r="12" fill="#fff" opacity="0.9"/><path d="M62 58c0-12.15-9.85-22-22-22s-22 9.85-22 22" fill="#fff" opacity="0.9"/></svg>');
  function avatarFallback(url) { return url || DEFAULT_AVATAR; }

  function getToken() { return localStorage.getItem('ch_token'); }
  function setToken(t) { localStorage.setItem('ch_token', t); }
  function clearToken() { localStorage.removeItem('ch_token'); }
  function getUser() { try { return JSON.parse(localStorage.getItem('ch_user')); } catch { return null; } }
  function setUser(u) { localStorage.setItem('ch_user', JSON.stringify(u)); }
  function clearUser() { localStorage.removeItem('ch_user'); }

  async function request(method, path, body, auth) {
    const url = BASE + path;
    const headers = { 'Content-Type': 'application/json' };
    if (auth !== false && getToken()) headers['Authorization'] = 'Bearer ' + getToken();
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      var msg;
      if (typeof data.detail === 'string') msg = data.detail;
      else if (Array.isArray(data.detail)) msg = data.detail.map(function (d) { return d.msg || JSON.stringify(d); }).join(', ');
      else msg = 'Request failed';
      throw { status: res.status, detail: msg };
    }
    return data;
  }

  const api = {
    // Auth
    register: (d) => request('POST', '/auth/register', d, false),
    login: (d) => request('POST', '/auth/login', d, false),
    forgotPasswordVerify: (d) => request('POST', '/auth/forgot-password/verify', d, false),
    forgotPasswordReset: (d) => request('POST', '/auth/forgot-password/reset', d, false),

    // Users
    getProfile: () => request('GET', '/users/me'),
    updateProfile: (d) => request('PUT', '/users/me', d),
    getMemberActivities: () => request('GET', '/users/me/member-activities'),

    // User Skills
    listMySkills: () => request('GET', '/users/me/skills'),
    addSkill: (d) => request('POST', '/users/me/skills', d),
    removeSkill: (skillId) => request('DELETE', '/users/me/skills/' + skillId),

    // Skills Catalog
    listSkills: () => request('GET', '/skills'),
    createSkill: (d) => request('POST', '/skills', d),

    // Activities
    listActivities: (params) => {
      const q = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
      const qs = q.toString();
      return request('GET', '/activities' + (qs ? '?' + qs : ''));
    },
    createActivity: (d) => request('POST', '/activities', d),
    getActivity: (id) => request('GET', '/activities/' + id),
    updateActivity: (id, d) => request('PUT', '/activities/' + id, d),

    // Join Requests
    applyToActivity: (id) => request('POST', '/activities/' + id + '/apply'),
    listApplicants: (id) => request('GET', '/activities/' + id + '/applicants'),
    processJoinRequest: (actId, jrId, d) => request('PUT', '/activities/' + actId + '/applicants/' + jrId, d),

    // Members & Eligibility
    listMembers: (id) => request('GET', '/activities/' + id + '/members'),
    getEligibility: (id) => request('GET', '/activities/' + id + '/eligibility'),

    // Chat
    getMessages: (actId, params) => {
      const q = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) q.set(k, v); });
      const qs = q.toString();
      return request('GET', '/chat/' + actId + '/messages' + (qs ? '?' + qs : ''));
    },
    sendMessage: (actId, d) => request('POST', '/chat/' + actId + '/messages', d),

    // Session helpers
    saveSession: (token, user) => { setToken(token); setUser(user); },
    logout: () => { clearToken(); clearUser(); window.location.href = '/pages/login.html'; },
    isLoggedIn: () => !!getToken(),
    getUser: getUser,

    // Avatar helpers
    DEFAULT_AVATAR: DEFAULT_AVATAR,
    avatarFallback: avatarFallback,
  };

  window.api = api;

  // Auth guard
  window.requireAuth = function () {
    if (!api.isLoggedIn()) {
      window.location.href = '/pages/login.html';
      return false;
    }
    var u = api.getUser();
    if (u && u.onboarding_complete === false && !window.location.pathname.includes('onboarding.html')) {
      window.location.href = '/pages/onboarding.html';
      return false;
    }
    return true;
  };

  window.requireNoAuth = function () {
    if (api.isLoggedIn()) {
      window.location.href = '/pages/dashboard.html';
      return false;
    }
    return true;
  };
})();
