// HUDDLE SWAP MAIN FRONTEND APPLICATION

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? (window.location.port === '8000' ? '/api' : 'http://localhost:8000/api')
  : 'https://collabhub-83cu.onrender.com/api';

// APP STATE
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user')) || null,
  currentView: 'dashboard',
  currentFilter: 'all',
  searchQuery: '',
  theme: localStorage.getItem('theme') || 'light',
  items: [],
  teams: [],
  mySwaps: [],
  myItems: [],
  myTeams: [],
  activeSwapId: null,
  activeSwapTimer: null,
  activeTeamId: null,
  activeTeamTimer: null,
  pendingSwapTargetItem: null
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initLucideIcons();
  bindEvents();
  
  if (state.token) {
    await fetchProfile();
  }
  
  updateAuthUI();
  switchView(state.user ? 'dashboard' : 'landing');
});

function initLucideIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// THEME HANDLING
function initTheme() {
  const html = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const label = document.getElementById('theme-label');
  
  html.setAttribute('data-theme', state.theme);
  toggle.checked = (state.theme === 'dark');
  label.textContent = state.theme === 'dark' ? 'Dark Green Mode' : 'Light Blue Mode';
  
  toggle.addEventListener('change', (e) => {
    state.theme = e.target.checked ? 'dark' : 'light';
    localStorage.setItem('theme', state.theme);
    html.setAttribute('data-theme', state.theme);
    label.textContent = state.theme === 'dark' ? 'Dark Green Mode' : 'Light Blue Mode';
  });
}

// API REQUEST WRAPPER
async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  
  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    let res = await fetch(`${API_BASE}${endpoint}`, options);
    
    // Fallback: If hosted backend returns 404 with /api, try endpoint without /api prefix
    if (res.status === 404 && API_BASE.includes('onrender.com/api')) {
      const altBase = API_BASE.replace('/api', '');
      const altRes = await fetch(`${altBase}${endpoint}`, options);
      if (altRes.status !== 404) {
        res = altRes;
      }
    }

    const contentType = res.headers.get('content-type') || '';
    
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      throw new Error(`Backend server not reached (Status ${res.status}). Please check backend API server.`);
    }

    if (!res.ok) {
      throw new Error(data.detail || 'API Request Failed');
    }
    return data;
  } catch (err) {
    console.error(`API Error (${endpoint}):`, err);
    throw err;
  }
}

// AUTH FUNCTIONS
async function fetchProfile() {
  try {
    const user = await apiRequest('/auth/me');
    state.user = user;
    localStorage.setItem('user', JSON.stringify(user));
  } catch (err) {
    logout();
  }
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateAuthUI();
  switchView('landing');
}

function updateAuthUI() {
  const authElements = document.querySelectorAll('.auth-only');
  const userBadge = document.getElementById('user-badge');
  const authHeaderBtns = document.getElementById('auth-header-btns');
  const userNameDisplay = document.getElementById('user-display-name');
  const avatarInitials = document.getElementById('avatar-initials');
  
  if (state.user) {
    authElements.forEach(el => el.style.display = '');
    userBadge.style.display = 'flex';
    authHeaderBtns.style.display = 'none';
    userNameDisplay.textContent = state.user.name;
    avatarInitials.textContent = state.user.name ? state.user.name.charAt(0).toUpperCase() : 'U';
  } else {
    authElements.forEach(el => el.style.display = 'none');
    userBadge.style.display = 'none';
    authHeaderBtns.style.display = 'flex';
  }
}

// VIEW ROUTING & NAVIGATION
function switchView(viewName) {
  state.currentView = viewName;
  
  // Stop chat polling timer if changing view away from manage
  if (viewName !== 'manage' && state.activeSwapTimer) {
    clearInterval(state.activeSwapTimer);
    state.activeSwapTimer = null;
  }

  // Update nav buttons
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(btn => {
    if (btn.dataset.view === viewName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update view sections
  document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
  const targetSec = document.getElementById(`${viewName}-view`);
  if (targetSec) {
    targetSec.style.display = 'block';
  }

  // Update Page Title
  const titles = {
    dashboard: 'Dashboard',
    manage: 'Manage Swaps & Teams',
    settings: 'Profile & Settings',
    landing: 'Welcome to Huddle Swap',
    auth: 'Account Login / Register'
  };
  document.getElementById('page-title').textContent = titles[viewName] || 'Huddle Swap';

  // Load view data
  if (viewName === 'dashboard') {
    loadDashboardData();
  } else if (viewName === 'manage') {
    if (!state.user) return switchView('auth');
    loadManageData();
  } else if (viewName === 'settings') {
    if (!state.user) return switchView('auth');
    populateSettingsForm();
  }
  
  initLucideIcons();
}

// EVENT BINDINGS
function bindEvents() {
  // Navigation clicks
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Auth Header & Hero Buttons
  document.getElementById('btn-header-login')?.addEventListener('click', () => {
    switchView('auth');
    showAuthTab('login');
  });
  document.getElementById('btn-header-register')?.addEventListener('click', () => {
    switchView('auth');
    showAuthTab('register');
  });
  document.getElementById('btn-hero-start')?.addEventListener('click', () => {
    if (state.user) switchView('dashboard');
    else { switchView('auth'); showAuthTab('register'); }
  });
  document.getElementById('btn-hero-explore')?.addEventListener('click', () => {
    switchView('dashboard');
  });
  document.getElementById('btn-logout')?.addEventListener('click', logout);

  // Auth Tabs (Login / Register)
  document.getElementById('tab-login')?.addEventListener('click', () => showAuthTab('login'));
  document.getElementById('tab-register')?.addEventListener('click', () => showAuthTab('register'));

  // Auth Forms Submission
  document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = await apiRequest('/auth/login', 'POST', {
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
      });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      updateAuthUI();
      switchView('dashboard');
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const skillsArr = document.getElementById('reg-skills').value
        .split(',').map(s => s.trim()).filter(Boolean);
      
      const data = await apiRequest('/auth/register', 'POST', {
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        bio: document.getElementById('reg-bio').value,
        skills: skillsArr
      });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      updateAuthUI();
      switchView('dashboard');
    } catch (err) {
      alert(err.message);
    }
  });

  // Search & Filter Pills
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderListings();
  });

  document.querySelectorAll('.filter-pills .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.currentFilter = pill.dataset.filter;
      renderListings();
    });
  });

  // Modal Triggers
  document.getElementById('btn-open-add-item')?.addEventListener('click', () => openModal('modal-add-item'));
  document.getElementById('btn-open-create-team')?.addEventListener('click', () => openModal('modal-create-team'));
  
  document.querySelectorAll('.modal-close, [data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.close;
      if (modalId) closeModal(modalId);
    });
  });

  // Form Submissions: Add Item
  document.getElementById('form-add-item')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.user) return switchView('auth');
    try {
      const itemType = document.getElementById('item-type').value;
      await apiRequest('/items', 'POST', {
        type: itemType,
        title: document.getElementById('item-title').value,
        category: document.getElementById('item-category').value,
        value_estimate: document.getElementById('item-value').value,
        image_url: document.getElementById('item-image').value,
        description: document.getElementById('item-description').value
      });
      closeModal('modal-add-item');
      document.getElementById('form-add-item').reset();

      // Reset search & filter so the new item is guaranteed visible
      state.searchQuery = '';
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = '';
      state.currentFilter = 'all';
      document.querySelectorAll('.filter-pills .pill').forEach(p => {
        p.classList.toggle('active', p.dataset.filter === 'all');
      });

      // Reload both Dashboard and Manage datasets
      await loadDashboardData();
      await loadManageData();

      alert(`Success! Your ${itemType} has been listed.`);
      switchView('dashboard');
    } catch (err) {
      alert(err.message);
    }
  });

  // Form Submissions: Create Team
  document.getElementById('form-create-team')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.user) return switchView('auth');
    try {
      const skillsArr = document.getElementById('team-skills').value
        .split(',').map(s => s.trim()).filter(Boolean);
        
      await apiRequest('/teams', 'POST', {
        title: document.getElementById('team-title').value,
        required_skills: skillsArr,
        description: document.getElementById('team-description').value
      });
      closeModal('modal-create-team');
      document.getElementById('form-create-team').reset();

      // Reset search & filter
      state.searchQuery = '';
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = '';
      state.currentFilter = 'all';
      document.querySelectorAll('.filter-pills .pill').forEach(p => {
        p.classList.toggle('active', p.dataset.filter === 'all');
      });

      await loadDashboardData();
      await loadManageData();

      alert("Success! Your team has been created.");
      switchView('dashboard');
    } catch (err) {
      alert(err.message);
    }
  });

  // Form Submissions: Request Swap
  document.getElementById('form-request-swap')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.user || !state.pendingSwapTargetItem) return;
    const offeredItemId = document.getElementById('offer-item-select').value;
    if (!offeredItemId) return alert("Please select one of your items to offer.");
    
    try {
      await apiRequest('/swaps', 'POST', {
        requested_item_id: state.pendingSwapTargetItem.id,
        offered_item_id: offeredItemId
      });
      closeModal('modal-request-swap');
      switchView('manage');
    } catch (err) {
      alert(err.message);
    }
  });

  // Manage Subtabs
  document.querySelectorAll('.sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.querySelectorAll('.subtab-content').forEach(c => c.style.display = 'none');
      document.getElementById(`subtab-${tabName}`).style.display = 'block';
    });
  });

  // Profile Settings Form
  document.getElementById('form-settings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const skillsArr = document.getElementById('setting-skills').value
        .split(',').map(s => s.trim()).filter(Boolean);
        
      const updated = await apiRequest('/auth/me', 'PUT', {
        name: document.getElementById('setting-name').value,
        bio: document.getElementById('setting-bio').value,
        skills: skillsArr
      });
      state.user = updated;
      localStorage.setItem('user', JSON.stringify(updated));
      updateAuthUI();
      alert("Profile updated successfully!");
    } catch (err) {
      alert(err.message);
    }
  });
}

function showAuthTab(tab) {
  const loginTab = document.getElementById('tab-login');
  const regTab = document.getElementById('tab-register');
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');

  if (tab === 'login') {
    loginTab.classList.add('active');
    regTab.classList.remove('active');
    loginForm.style.display = 'block';
    regForm.style.display = 'none';
  } else {
    regTab.classList.add('active');
    loginTab.classList.remove('active');
    regForm.style.display = 'block';
    loginForm.style.display = 'none';
  }
}

function openModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
  if (modalId === 'modal-swap-detail' && state.activeSwapTimer) {
    clearInterval(state.activeSwapTimer);
    state.activeSwapTimer = null;
    state.activeSwapId = null;
  }
  if (modalId === 'modal-team-workspace' && state.activeTeamTimer) {
    clearInterval(state.activeTeamTimer);
    state.activeTeamTimer = null;
    state.activeTeamId = null;
  }
  document.getElementById(modalId).style.display = 'none';
}

// LOAD DASHBOARD DATA
async function loadDashboardData() {
  try {
    const [itemsData, teamsData] = await Promise.all([
      apiRequest('/items'),
      apiRequest('/teams')
    ]);
    state.items = Array.isArray(itemsData) ? itemsData : [];
    state.teams = Array.isArray(teamsData) ? teamsData : [];
    renderListings();
  } catch (err) {
    console.error(err);
  }
}

function renderListings() {
  const container = document.getElementById('listings-container');
  container.innerHTML = '';
  
  const q = state.searchQuery.toLowerCase();
  
  // Build mixed list based on filter
  let cardsHTML = '';
  
  if (state.currentFilter === 'all' || state.currentFilter === 'product' || state.currentFilter === 'skill') {
    (state.items || []).forEach(item => {
      if (state.currentFilter !== 'all' && item.type !== state.currentFilter) return;
      if (q && !item.title.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) return;
      
      const isOwner = state.user && item.user_id === state.user.id;
      
      cardsHTML += `
        <div class="card">
          <div class="card-img-placeholder">
            ${item.image_url ? `<img src="${item.image_url}" alt="${item.title}">` : `<i data-lucide="${item.type === 'product' ? 'package' : 'zap'}" style="width:48px;height:48px;"></i>`}
          </div>
          <div class="card-body">
            <span class="card-badge ${item.type}">${item.type}</span>
            <h4 class="card-title">${escapeHTML(item.title)}</h4>
            <p class="card-desc">${escapeHTML(item.description)}</p>
            <div class="card-meta">
              <span><strong>Value:</strong> ${escapeHTML(item.value_estimate)}</span>
              <span>By ${escapeHTML(item.user_name)}</span>
            </div>
            <div class="card-actions">
              ${isOwner ? 
                `<button class="btn btn-outline btn-block" disabled>Your Listing</button>` : 
                `<button class="btn btn-primary btn-block" onclick="openSwapRequestModal('${item.id}')"><i data-lucide="arrow-left-right"></i> Request Swap</button>`
              }
            </div>
          </div>
        </div>
      `;
    });
  }

  if (state.currentFilter === 'all' || state.currentFilter === 'team') {
    (state.teams || []).forEach(team => {
      if (q && !team.title.toLowerCase().includes(q) && !team.description.toLowerCase().includes(q)) return;
      
      const isMember = state.user && team.members.some(m => m.user_id === state.user.id);
      const skillsList = team.required_skills ? team.required_skills.join(', ') : 'None specified';

      cardsHTML += `
        <div class="card">
          <div class="card-img-placeholder" style="background-color: var(--bg-hover);">
            <i data-lucide="users" style="width:48px;height:48px;color:var(--primary);"></i>
          </div>
          <div class="card-body">
            <span class="card-badge team">Team Build</span>
            <h4 class="card-title">${escapeHTML(team.title)}</h4>
            <p class="card-desc">${escapeHTML(team.description)}</p>
            <div class="card-meta">
              <span><strong>Needs:</strong> ${escapeHTML(skillsList)}</span>
              <span>${team.members.length} members</span>
            </div>
            <div class="card-actions" style="display:flex; gap:0.5rem;">
              ${!isMember ? 
                `<button class="btn btn-outline btn-sm" onclick="handleJoinTeam('${team.id}')"><i data-lucide="user-plus"></i> Join</button>` : 
                `<button class="btn btn-outline btn-sm" disabled>Member</button>`
              }
              <button class="btn btn-primary btn-sm" style="flex:1;" onclick="openTeamWorkspace('${team.id}')"><i data-lucide="message-square"></i> Open Chat</button>
            </div>
          </div>
        </div>
      `;
    });
  }

  if (!cardsHTML) {
    cardsHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">No products, skills, or teams found matching your search.</div>`;
  }
  
  container.innerHTML = cardsHTML;
  initLucideIcons();
}

// OPEN SWAP REQUEST MODAL
async function openSwapRequestModal(targetItemId) {
  if (!state.user) return switchView('auth');
  
  const targetItem = state.items.find(i => i.id === targetItemId);
  if (!targetItem) return;
  
  state.pendingSwapTargetItem = targetItem;

  // Fetch current user's listed items to offer in swap
  try {
    const userItems = await apiRequest(`/items?user_id=${state.user.id}`);
    state.myItems = userItems;
    
    if (userItems.length === 0) {
      alert("You need to list at least one Product or Skill before requesting a swap!");
      openModal('modal-add-item');
      return;
    }
    
    // Populate preview
    const preview = document.getElementById('swap-target-preview');
    preview.innerHTML = `
      <div style="background-color: var(--bg-main); padding: 1rem; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 1rem;">
        <span class="card-badge ${targetItem.type}">${targetItem.type}</span>
        <h4>${escapeHTML(targetItem.title)}</h4>
        <p style="font-size:0.85rem; color:var(--text-muted);">${escapeHTML(targetItem.description)}</p>
        <div style="font-size:0.85rem; margin-top:0.5rem;"><strong>Value:</strong> ${escapeHTML(targetItem.value_estimate)} | <strong>Owner:</strong> ${escapeHTML(targetItem.user_name)}</div>
      </div>
    `;
    
    // Populate select
    const select = document.getElementById('offer-item-select');
    select.innerHTML = userItems.map(item => `
      <option value="${item.id}">[${item.type.toUpperCase()}] ${escapeHTML(item.title)} (Est: ${escapeHTML(item.value_estimate)})</option>
    `).join('');
    
    openModal('modal-request-swap');
  } catch (err) {
    alert(err.message);
  }
}

// JOIN TEAM HANDLER
async function handleJoinTeam(teamId) {
  if (!state.user) return switchView('auth');
  try {
    await apiRequest(`/teams/${teamId}/join`, 'POST');
    alert("Joined team successfully!");
    loadDashboardData();
  } catch (err) {
    alert(err.message);
  }
}

// LOAD MANAGE DATA (SWAPS, MY LISTINGS, MY TEAMS)
async function loadManageData() {
  try {
    const [swapsData, myItemsData, myTeamsData] = await Promise.all([
      apiRequest('/swaps'),
      apiRequest(`/items?user_id=${state.user.id}`),
      apiRequest('/teams')
    ]);
    
    state.mySwaps = Array.isArray(swapsData) ? swapsData : [];
    state.myItems = Array.isArray(myItemsData) ? myItemsData : [];
    const validTeams = Array.isArray(myTeamsData) ? myTeamsData : [];
    state.myTeams = validTeams.filter(t => t.members && t.members.some(m => m.user_id === state.user.id));
    
    // Update badge
    const badge = document.getElementById('swap-badge');
    const activeCount = state.mySwaps.filter(s => s.status === 'pending' || s.status === 'active').length;
    if (activeCount > 0) {
      badge.textContent = activeCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
    
    renderSwapsList();
    renderMyListings();
    renderMyTeams();
  } catch (err) {
    console.error(err);
  }
}

function renderSwapsList() {
  const container = document.getElementById('swaps-container');
  if (!state.mySwaps || state.mySwaps.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 3rem;">You have no active or completed swap requests.</div>`;
    return;
  }

  const userId = state.user ? state.user.id : '';

  container.innerHTML = state.mySwaps.map(swap => {
    const isOwner = swap.owner_id === userId;
    const partnerName = isOwner ? swap.requester_name : swap.owner_name;
    const myItem = isOwner ? swap.requested_item : swap.offered_item;
    const partnerItem = isOwner ? swap.offered_item : swap.requested_item;

    const myTitle = (myItem && myItem.title) ? myItem.title : 'Item';
    const partnerTitle = (partnerItem && partnerItem.title) ? partnerItem.title : 'Item';

    return `
      <div class="swap-card">
        <div class="swap-info">
          <div class="swap-item-box">
            <span class="label">Partner</span>
            <span class="val">${escapeHTML(partnerName)}</span>
          </div>
          <div class="swap-item-box">
            <span class="label">Your Item/Skill</span>
            <span class="val">${escapeHTML(myTitle)}</span>
          </div>
          <i data-lucide="arrow-left-right" style="color:var(--primary);"></i>
          <div class="swap-item-box">
            <span class="label">Partner's Item/Skill</span>
            <span class="val">${escapeHTML(partnerTitle)}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:1rem;">
          <span class="swap-status-badge status-${swap.status}">${swap.status}</span>
          <button class="btn btn-primary btn-sm" onclick="openSwapWorkspace('${swap.id}')">
            <i data-lucide="message-square"></i> Open Chat & Confirm
          </button>
        </div>
      </div>
    `;
  }).join('');

  initLucideIcons();
}

function renderMyListings() {
  const container = document.getElementById('my-listings-container');
  if (state.myItems.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">You haven't listed any products or skills yet.</div>`;
    return;
  }

  container.innerHTML = state.myItems.map(item => `
    <div class="card">
      <div class="card-body">
        <span class="card-badge ${item.type}">${item.type}</span>
        <h4 class="card-title">${escapeHTML(item.title)}</h4>
        <p class="card-desc">${escapeHTML(item.description)}</p>
        <div class="card-meta">
          <span>Est: ${escapeHTML(item.value_estimate)}</span>
          <span>Cat: ${escapeHTML(item.category)}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-outline btn-block" onclick="handleDeleteItem('${item.id}')"><i data-lucide="trash-2"></i> Delete</button>
        </div>
      </div>
    </div>
  `).join('');
  initLucideIcons();
}

async function handleDeleteItem(itemId) {
  if (!confirm("Are you sure you want to delete this listing?")) return;
  try {
    await apiRequest(`/items/${itemId}`, 'DELETE');
    loadManageData();
  } catch (err) {
    alert(err.message);
  }
}

function renderMyTeams() {
  const container = document.getElementById('my-teams-container');
  if (state.myTeams.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">You are not part of any team yet.</div>`;
    return;
  }

  container.innerHTML = state.myTeams.map(team => `
    <div class="card">
      <div class="card-body">
        <span class="card-badge team">Team</span>
        <h4 class="card-title">${escapeHTML(team.title)}</h4>
        <p class="card-desc">${escapeHTML(team.description)}</p>
        <div class="card-meta">
          <span>Members: ${team.members.map(m => m.user_name).join(', ')}</span>
        </div>
        <div class="card-actions" style="margin-top:0.75rem;">
          <button class="btn btn-primary btn-block" onclick="openTeamWorkspace('${team.id}')"><i data-lucide="message-square"></i> Open Workspace & Chat</button>
        </div>
      </div>
    </div>
  `).join('');
  initLucideIcons();
}

// SWAP WORKSPACE (CHAT, MUTUAL CONFIRMATION, FULFILLMENT & PIN VERIFICATION)
async function openSwapWorkspace(swapId) {
  state.activeSwapId = swapId;
  
  // Clear modal container so layout builds fresh for this swap
  const container = document.getElementById('swap-workspace-content');
  if (container) {
    container.innerHTML = '<div style="grid-column:1/-1; padding:3rem; text-align:center; color:var(--text-muted);">Loading chat workspace...</div>';
  }
  
  openModal('modal-swap-detail');
  
  try {
    await renderSwapWorkspace();

    // Start polling every 3 seconds for real-time chat updates
    if (state.activeSwapTimer) clearInterval(state.activeSwapTimer);
    state.activeSwapTimer = setInterval(renderSwapWorkspace, 3000);
  } catch (err) {
    console.error("Error opening swap workspace:", err);
    if (container) {
      container.innerHTML = `<div style="grid-column:1/-1; padding:3rem; text-align:center; color:red;">Failed to open chat: ${escapeHTML(err.message)}</div>`;
    }
  }
}

async function renderSwapWorkspace() {
  if (!state.activeSwapId || !state.user) return;
  
  try {
    const swap = await apiRequest(`/swaps/${state.activeSwapId}`);
    const isOwner = swap.owner_id === state.user.id;
    const partnerName = isOwner ? swap.requester_name : swap.owner_name;

    const conf = swap.confirmations || {};
    const myConfirmed = isOwner ? conf.owner_confirmed : conf.requester_confirmed;
    const partnerConfirmed = isOwner ? conf.requester_confirmed : conf.owner_confirmed;

    const fulfillment = swap.fulfillment || {};
    const myFulfillment = isOwner ? fulfillment.owner_fulfillment : fulfillment.requester_fulfillment;
    const partnerFulfillment = isOwner ? fulfillment.requester_fulfillment : fulfillment.owner_fulfillment;

    const pins = swap.pins || {};
    const verifications = swap.verifications || {};

    const reqTitle = (swap.requested_item && swap.requested_item.title) ? swap.requested_item.title : 'Item';
    const offTitle = (swap.offered_item && swap.offered_item.title) ? swap.offered_item.title : 'Item';

    const myOutboundItemTitle = isOwner ? reqTitle : offTitle;
    const myInboundItemTitle = isOwner ? offTitle : reqTitle;
    const myPinForPartner = isOwner ? pins.pin_a_to_b : pins.pin_b_to_a;
    const iHaveVerified = isOwner ? verifications.owner_verified : verifications.requester_verified;
    const partnerHasVerified = isOwner ? verifications.requester_verified : verifications.owner_verified;

    const container = document.getElementById('swap-workspace-content');

    // Build static shell on initial render so input box is NEVER destroyed during polling
    if (!document.getElementById('chat-messages-container')) {
      container.innerHTML = `
        <!-- LEFT PANE: LIVE CHAT -->
        <div class="chat-box">
          <div class="chat-messages" id="chat-messages-container"></div>
          <div class="chat-input-bar">
            <input type="text" id="chat-input-text" placeholder="Type a message to ${escapeHTML(partnerName)}..." onkeypress="handleChatKeyPress(event)">
            <button class="btn btn-primary btn-sm" onclick="handleSendChatMessage()"><i data-lucide="send"></i></button>
          </div>
        </div>

        <!-- RIGHT PANE: SWAP ACTIONS & STATUS -->
        <div id="swap-actions-pane" style="display:flex; flex-direction:column; gap:1.25rem;"></div>
      `;
    }

    // 1. Update Messages list (preserve input box!)
    const messagesContainer = document.getElementById('chat-messages-container');
    const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 50;

    messagesContainer.innerHTML = swap.messages.map(m => {
      let cls = 'recv';
      if (m.sender_id === 'system') cls = 'system';
      else if (m.sender_id === state.user.id) cls = 'sent';
      
      return `
        <div class="msg-bubble ${cls}">
          ${m.sender_id !== 'system' ? `<div class="msg-meta">${escapeHTML(m.sender_name)}</div>` : ''}
          <div>${escapeHTML(m.text)}</div>
        </div>
      `;
    }).join('');

    if (isAtBottom) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 2. Update Right Pane Status & Controls (only if user is not actively typing in it)
    const actionsPane = document.getElementById('swap-actions-pane');
    const isUserInteracting = actionsPane && actionsPane.contains(document.activeElement);

    if (!isUserInteracting) {
      actionsPane.innerHTML = `
        <!-- Status Header -->
        <div style="background-color:var(--bg-main); padding:1rem; border-radius:12px; border:1px solid var(--border-color);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <strong>Swap Status:</strong>
            <span class="swap-status-badge status-${swap.status}">${swap.status.toUpperCase()}</span>
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted);">
            <div><strong>You offer:</strong> ${escapeHTML(isOwner ? swap.requested_item.title : swap.offered_item.title)}</div>
            <div><strong>${escapeHTML(partnerName)} offers:</strong> ${escapeHTML(isOwner ? swap.offered_item.title : swap.requested_item.title)}</div>
          </div>
        </div>

        <!-- STEP 1: MUTUAL CONFIRMATION -->
        <div style="background-color:var(--bg-main); padding:1rem; border-radius:12px; border:1px solid var(--border-color);">
          <h4 style="font-size:0.95rem; margin-bottom:0.5rem;">Step 1: Mutual Confirmation</h4>
          <div style="font-size:0.85rem; margin-bottom:0.75rem;">
            <div>Your confirmation: ${myConfirmed ? '✅ Confirmed' : '⏳ Pending'}</div>
            <div>Partner's confirmation: ${partnerConfirmed ? '✅ Confirmed' : '⏳ Pending'}</div>
          </div>
          ${!myConfirmed && swap.status === 'pending' ? 
            `<button class="btn btn-primary btn-block" onclick="handleConfirmSwap(this)"><i data-lucide="check-circle"></i> Confirm Swap Agreement</button>` : 
            (swap.status === 'pending' ? `<button class="btn btn-outline btn-block" disabled>Waiting for partner to confirm...</button>` : ``)
          }
        </div>

        <!-- STEP 2: FULFILLMENT (TRACKING OR LINK DROPDOWN) -->
        ${swap.status === 'active' || swap.status === 'completed' ? `
          <div style="background-color:var(--bg-main); padding:1rem; border-radius:12px; border:1px solid var(--border-color);">
            <h4 style="font-size:0.95rem; margin-bottom:0.5rem;">Step 2: Tracking / Resource Link</h4>
            
            <div style="font-size:0.85rem; margin-bottom:0.75rem;">
              <strong>Partner's Fulfillment Info:</strong>
              ${partnerFulfillment ? 
                `<div style="margin-top:4px; padding:6px 10px; background:var(--bg-card); border-radius:6px; border:1px solid var(--border-color); word-break:break-all;">
                  <strong>[${escapeHTML((partnerFulfillment.type || 'Fulfillment').toUpperCase())}]:</strong> ${escapeHTML(partnerFulfillment.value || partnerFulfillment.tracking_number || partnerFulfillment.url_link || '')}
                 </div>` : 
                `<div style="color:var(--text-muted); font-style:italic;">Partner has not submitted details yet.</div>`
              }
            </div>

            <form id="form-fulfillment" onsubmit="handleFulfillmentSubmit(event)" style="margin-top:0.75rem;">
              <div style="font-size:0.85rem; font-weight:600; margin-bottom:4px;">Submit Your Fulfillment:</div>
              <div style="display:flex; gap:0.5rem; margin-bottom:0.5rem;">
                <select id="fulfillment-type" style="padding:0.4rem; font-size:0.85rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-main);">
                  <option value="tracking" ${myFulfillment && myFulfillment.type === 'tracking' ? 'selected' : ''}>Tracking Number (Product)</option>
                  <option value="link" ${myFulfillment && myFulfillment.type === 'link' ? 'selected' : ''}>Meeting / Access Link (Skill)</option>
                </select>
              </div>
              <div style="display:flex; gap:0.5rem;">
                <input type="text" id="fulfillment-value" value="${myFulfillment ? escapeHTML(myFulfillment.value || myFulfillment.tracking_number || myFulfillment.url_link || '') : ''}" placeholder="e.g. TRK123456789 or https://meet.google.com/..." required style="flex:1; padding:0.4rem; font-size:0.85rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-main);">
                <button type="submit" class="btn btn-primary btn-sm">Submit</button>
              </div>
            </form>
          </div>

          <!-- STEP 3: SEPARATE 2-WAY PIN VERIFICATION -->
          <div style="background-color:var(--bg-main); padding:1rem; border-radius:12px; border:1px solid var(--border-color);">
            <h4 style="font-size:0.95rem; margin-bottom:0.5rem;">Step 3: Two-Way Confirmation PINs</h4>
            
            <!-- Outbound Box: You sending item to Partner -->
            <div style="background-color:var(--primary-light); color:var(--primary); padding:0.75rem; border-radius:8px; margin-bottom:0.75rem;">
              <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase;">Outbound PIN (${escapeHTML(myOutboundItemTitle)}):</div>
              <div style="font-size:1.4rem; font-weight:800; letter-spacing:2px; margin:2px 0;">${myPinForPartner || '••••••'}</div>
              <div style="font-size:0.72rem; opacity:0.9;">Give this PIN to ${escapeHTML(partnerName)} after ${escapeHTML(partnerName)} receives your item. Partner receipt: ${partnerHasVerified ? '✅ Confirmed' : '⏳ Pending'}</div>
            </div>

            <!-- Inbound Box: Partner sending item to You -->
            <div style="margin-top:0.75rem;">
              <div style="font-size:0.85rem; font-weight:600; margin-bottom:4px;">Inbound Confirmation (${escapeHTML(myInboundItemTitle)}):</div>
              ${!iHaveVerified ? `
                <form onsubmit="handleVerifyPinSubmit(event)" style="display:flex; flex-direction:column; gap:0.4rem;">
                  <label style="font-size:0.78rem; color:var(--text-muted);">After receiving ${escapeHTML(partnerName)}'s item/service, ask for their PIN and enter it below:</label>
                  <div style="display:flex; gap:0.5rem;">
                    <input type="text" id="input-verify-pin" placeholder="Enter 6-digit PIN" required style="flex:1; padding:0.5rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-main); font-weight:700; letter-spacing:1px;">
                    <button type="submit" class="btn btn-primary btn-sm">Confirm Receipt</button>
                  </div>
                </form>
              ` : `
                <div style="background:#dcfce7; color:#15803d; padding:0.6rem; border-radius:8px; font-weight:700; font-size:0.85rem; text-align:center;">
                  ✅ You confirmed receipt of ${escapeHTML(partnerName)}'s item!
                </div>
              `}
            </div>
          </div>
        ` : ''}

        ${swap.status === 'completed' ? `
          <div style="background-color:#dcfce7; color:#15803d; padding:1rem; border-radius:12px; text-align:center; font-weight:700;">
            🎉 Swap Successfully Completed!
          </div>
        ` : ''}
      `;
    }
    
    initLucideIcons();
  } catch (err) {
    console.error(err);
  }
}

async function handleSendChatMessage() {
  const input = document.getElementById('chat-input-text');
  if (!input || !input.value.trim() || !state.activeSwapId) return;
  
  const text = input.value.trim();
  input.value = '';
  
  try {
    await apiRequest(`/swaps/${state.activeSwapId}/chat`, 'POST', { text });
    await renderSwapWorkspace();
  } catch (err) {
    alert(err.message);
  }
}

function handleChatKeyPress(e) {
  if (e.key === 'Enter') handleSendChatMessage();
}

async function handleConfirmSwap(btnEl) {
  if (!state.activeSwapId) return;
  const targetBtn = (btnEl && btnEl.innerText) ? btnEl : (window.event ? window.event.target : null);
  const originalText = targetBtn ? targetBtn.innerText : 'Confirm Swap Agreement';
  
  if (targetBtn && targetBtn.innerText) {
    targetBtn.disabled = true;
    targetBtn.innerText = 'Confirming...';
  }
  
  try {
    await apiRequest(`/swaps/${state.activeSwapId}/confirm`, 'POST');
    alert("✅ Agreement confirmed successfully!");
    await renderSwapWorkspace();
    loadManageData();
  } catch (err) {
    alert(err.message);
  } finally {
    if (targetBtn && targetBtn.innerText) {
      targetBtn.disabled = false;
      targetBtn.innerText = originalText;
    }
  }
}

async function handleFulfillmentSubmit(e) {
  e.preventDefault();
  if (!state.activeSwapId) return;
  const type = document.getElementById('fulfillment-type')?.value || 'tracking';
  const valueInput = document.getElementById('fulfillment-value');
  const value = valueInput ? valueInput.value.trim() : '';
  
  if (!value) return alert("Please enter your tracking number or link.");
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.innerText : 'Submit';
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Submitting...';
  }
  
  try {
    await apiRequest(`/swaps/${state.activeSwapId}/fulfillment`, 'POST', { type, value });
    alert("📦 Delivery / Resource details submitted successfully!");
    await renderSwapWorkspace();
  } catch (err) {
    alert(err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = originalText;
    }
  }
}

async function handleVerifyPinSubmit(e) {
  e.preventDefault();
  if (!state.activeSwapId) return;
  const pinInput = document.getElementById('input-verify-pin');
  const pin = pinInput ? pinInput.value.trim() : '';
  if (!pin) return;
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.innerText : 'Verify PIN';
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Verifying...';
  }
  
  try {
    await apiRequest(`/swaps/${state.activeSwapId}/verify_pin`, 'POST', { pin });
    alert("🎉 2-Way PIN verified successfully! Receipt confirmed.");
    await renderSwapWorkspace();
    loadManageData();
  } catch (err) {
    alert(err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = originalText;
    }
  }
}

// TEAM WORKSPACE (CHAT & MEMBERS)
async function openTeamWorkspace(teamId) {
  state.activeTeamId = teamId;
  const container = document.getElementById('team-workspace-content');
  if (container) {
    container.innerHTML = '<div style="grid-column:1/-1; padding:3rem; text-align:center; color:var(--text-muted);">Loading team workspace...</div>';
  }
  
  openModal('modal-team-workspace');
  
  try {
    await renderTeamWorkspace();
    if (state.activeTeamTimer) clearInterval(state.activeTeamTimer);
    state.activeTeamTimer = setInterval(renderTeamWorkspace, 3000);
  } catch (err) {
    console.error("Error opening team workspace:", err);
    if (container) {
      container.innerHTML = `<div style="grid-column:1/-1; padding:3rem; text-align:center; color:red;">Failed to open team workspace: ${escapeHTML(err.message)}</div>`;
    }
  }
}

async function renderTeamWorkspace() {
  if (!state.activeTeamId) return;
  
  try {
    const team = await apiRequest(`/teams/${state.activeTeamId}`);
    const userId = state.user ? state.user.id : '';
    const isMember = team.members && team.members.some(m => m.user_id === userId);
    
    const titleEl = document.getElementById('team-modal-title');
    if (titleEl) titleEl.textContent = `Team: ${team.title}`;

    const container = document.getElementById('team-workspace-content');

    // Build static shell on initial render
    if (!document.getElementById('team-chat-messages-container')) {
      container.innerHTML = `
        <!-- LEFT PANE: LIVE TEAM CHAT -->
        <div class="chat-box">
          <div class="chat-messages" id="team-chat-messages-container"></div>
          <div class="chat-input-bar">
            ${isMember ? `
              <input type="text" id="team-chat-input-text" placeholder="Type a message to team members..." onkeypress="handleTeamChatKeyPress(event)">
              <button class="btn btn-primary btn-sm" onclick="handleSendTeamChatMessage()"><i data-lucide="send"></i></button>
            ` : `
              <div style="font-size:0.85rem; color:var(--text-muted); text-align:center; width:100%;">Join this team to participate in the chat.</div>
            `}
          </div>
        </div>

        <!-- RIGHT PANE: TEAM INFO & MEMBERS -->
        <div id="team-info-pane" style="display:flex; flex-direction:column; gap:1.25rem;"></div>
      `;
    }

    // 1. Update Messages list
    const messagesContainer = document.getElementById('team-chat-messages-container');
    if (messagesContainer) {
      const messages = team.messages || [];
      const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 50;

      messagesContainer.innerHTML = messages.map(m => {
        let cls = 'recv';
        if (m.sender_id === 'system') cls = 'system';
        else if (state.user && m.sender_id === state.user.id) cls = 'sent';
        
        return `
          <div class="msg-bubble ${cls}">
            ${m.sender_id !== 'system' ? `<div class="msg-meta">${escapeHTML(m.sender_name)}</div>` : ''}
            <div>${escapeHTML(m.text)}</div>
          </div>
        `;
      }).join('');

      if (isAtBottom) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }

    // 2. Update Right Pane Team Info (if user is not actively interacting in it)
    const infoPane = document.getElementById('team-info-pane');
    const isUserInteracting = infoPane && infoPane.contains(document.activeElement);

    if (infoPane && !isUserInteracting) {
      const skillsList = team.required_skills ? team.required_skills.map(s => `<span class="card-badge skill" style="font-size:0.75rem; margin-right:4px;">${escapeHTML(s)}</span>`).join('') : 'None';
      
      infoPane.innerHTML = `
        <div style="background-color:var(--bg-main); padding:1rem; border-radius:12px; border:1px solid var(--border-color);">
          <h4 style="font-size:1.1rem; font-weight:700; margin-bottom:0.4rem;">${escapeHTML(team.title)}</h4>
          <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:0.75rem;">${escapeHTML(team.description)}</p>
          <div style="font-size:0.85rem; margin-bottom:0.5rem;">
            <strong>Required Skills:</strong><br>
            <div style="margin-top:4px;">${skillsList}</div>
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted); border-top:1px solid var(--border-color); padding-top:0.5rem; margin-top:0.5rem;">
            <span>Leader: <strong>${escapeHTML(team.owner_name)}</strong></span>
          </div>
        </div>

        <div style="background-color:var(--bg-main); padding:1rem; border-radius:12px; border:1px solid var(--border-color);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <h4 style="font-size:0.95rem; font-weight:700;">Team Members (${team.members.length})</h4>
            ${!isMember ? `<button class="btn btn-primary btn-sm" onclick="handleJoinTeamFromWorkspace('${team.id}')"><i data-lucide="user-plus"></i> Join Team</button>` : `<span class="swap-status-badge status-completed">Joined</span>`}
          </div>

          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            ${team.members.map(m => `
              <div style="display:flex; align-items:center; justify-content:space-between; padding:0.5rem; background:var(--bg-card); border-radius:8px; border:1px solid var(--border-color);">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <div class="avatar" style="width:28px; height:28px; font-size:0.75rem;">${m.user_name ? m.user_name.charAt(0).toUpperCase() : 'M'}</div>
                  <span style="font-size:0.88rem; font-weight:600;">${escapeHTML(m.user_name)}</span>
                </div>
                <span class="card-badge ${m.role === 'Owner' ? 'product' : 'skill'}" style="font-size:0.7rem; padding:2px 8px;">${escapeHTML(m.role)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    initLucideIcons();
  } catch (err) {
    console.error(err);
  }
}

async function handleSendTeamChatMessage() {
  const input = document.getElementById('team-chat-input-text');
  if (!input || !input.value.trim() || !state.activeTeamId) return;
  
  const text = input.value.trim();
  input.value = '';
  
  try {
    await apiRequest(`/teams/${state.activeTeamId}/chat`, 'POST', { text });
    await renderTeamWorkspace();
  } catch (err) {
    alert(err.message);
  }
}

function handleTeamChatKeyPress(e) {
  if (e.key === 'Enter') handleSendTeamChatMessage();
}

async function handleJoinTeamFromWorkspace(teamId) {
  if (!state.user) return switchView('auth');
  try {
    await apiRequest(`/teams/${teamId}/join`, 'POST');
    alert("🎉 Joined team successfully!");
    await renderTeamWorkspace();
    loadDashboardData();
    loadManageData();
  } catch (err) {
    alert(err.message);
  }
}

// PROFILE SETTINGS POPULATION
function populateSettingsForm() {
  if (!state.user) return;
  document.getElementById('setting-name').value = state.user.name || '';
  document.getElementById('setting-email').value = state.user.email || '';
  document.getElementById('setting-bio').value = state.user.bio || '';
  document.getElementById('setting-skills').value = state.user.skills ? state.user.skills.join(', ') : '';
}

// UTILS
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
