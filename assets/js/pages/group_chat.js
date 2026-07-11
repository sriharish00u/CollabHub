(function () {
  requireAuth();

  const params = new URLSearchParams(window.location.search);
  const actId = params.get('id');
  if (!actId) {
    document.getElementById('message-thread').innerHTML =
      '<p class="text-on-surface-variant text-body-md p-lg">No activity selected. Go to your dashboard to open a chat.</p>';
    return;
  }

  const currentUser = api.getUser();
  const thread = document.getElementById('message-thread');
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const membersList = document.getElementById('members-list');
  const chatTitle = document.getElementById('chat-title');
  const chatSubtitle = document.getElementById('chat-subtitle');

  let lastMessageId = null;
  let pollTimer = null;

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function isSelf(msg) {
    if (currentUser && msg.user_id === currentUser.id) return true;
    if (currentUser && msg.sender === currentUser.username) return true;
    return false;
  }

  function renderMessage(msg) {
    const self = isSelf(msg);
    const name = msg.user_name || msg.username || msg.sender || 'Unknown';
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const time = msg.created_at ? formatTime(msg.created_at) : '';

    if (self) {
      return '<div class="flex flex-row-reverse gap-md">' +
        '<div class="w-10 h-10 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-on-primary font-bold">' + initials + '</div>' +
        '<div class="max-w-[70%] text-right">' +
          '<div class="flex items-center flex-row-reverse gap-sm mb-xs">' +
            '<span class="font-label text-label text-primary">You</span>' +
            '<span class="font-caption text-caption text-on-surface-variant">' + time + '</span>' +
          '</div>' +
          '<div class="bg-primary text-on-primary p-md rounded-xl message-bubble-self shadow-lg">' +
            '<p class="font-body-md text-body-md">' + escapeHtml(msg.message || msg.content || '') + '</p>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    return '<div class="flex gap-md">' +
      '<div class="w-10 h-10 rounded-full bg-surface-variant flex-shrink-0 flex items-center justify-center text-on-surface-variant font-bold">' + initials + '</div>' +
      '<div class="max-w-[70%]">' +
        '<div class="flex items-center gap-sm mb-xs">' +
          '<span class="font-label text-label text-primary">' + escapeHtml(name) + '</span>' +
          '<span class="font-caption text-caption text-on-surface-variant">' + time + '</span>' +
        '</div>' +
        '<div class="bg-surface-container p-md rounded-xl message-bubble-other border border-outline-variant">' +
          '<p class="font-body-md text-body-md">' + escapeHtml(msg.message || msg.content || '') + '</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function loadMessages() {
    try {
      const data = await api.getMessages(actId);
      const messages = data.messages || data || [];
      if (messages.length === 0) {
        thread.innerHTML = '<p class="text-on-surface-variant text-body-sm text-center p-xl">No messages yet. Start the conversation!</p>';
        return;
      }
      const html = messages.map(renderMessage).join('');
      thread.innerHTML = html;
      const newLast = messages[messages.length - 1];
      if (newLast && newLast.id) lastMessageId = newLast.id;
      thread.scrollTop = thread.scrollHeight;
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  async function pollMessages() {
    try {
      const params = {};
      if (lastMessageId) params.after = lastMessageId;
      const data = await api.getMessages(actId, lastMessageId ? { after: lastMessageId } : undefined);
      const messages = data.messages || data || [];
      if (messages.length > 0) {
        const html = messages.map(renderMessage).join('');
        thread.insertAdjacentHTML('beforeend', html);
        const newLast = messages[messages.length - 1];
        if (newLast && newLast.id) lastMessageId = newLast.id;
        thread.scrollTop = thread.scrollHeight;
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }

  async function loadMembers() {
    try {
      const data = await api.listMembers(actId);
      const members = data.members || data || [];
      membersList.innerHTML = members.map(function (m) {
        const name = m.user_name || m.username || m.name || 'Unknown';
        const role = m.role || 'Member';
        const avatarUrl = api.avatarFallback(m.avatar_url);
        return '<div class="flex items-center gap-md">' +
          '<img class="w-10 h-10 rounded-full flex-shrink-0 object-cover" src="' + avatarUrl + '" alt="" onerror="this.onerror=null;this.src=\'/assets/img/default-avatar.svg\'"/>' +
          '<div>' +
            '<h4 class="font-body-md text-body-md font-medium">' + escapeHtml(name) + '</h4>' +
            '<p class="font-caption text-caption text-on-surface-variant">' + escapeHtml(role) + '</p>' +
          '</div>' +
        '</div>';
      }).join('');
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  }

  async function loadActivityInfo() {
    try {
      const act = await api.getActivity(actId);
      chatTitle.innerHTML = escapeHtml(act.title || act.name || 'Activity') +
        ' <span class="inline-block w-2 h-2 bg-green-500 rounded-full"></span>';
      var memberCount = act.members_count || '?';
      chatSubtitle.textContent = memberCount + ' members \u2022 Active Collaboration';
    } catch (err) {
      console.error('Failed to load activity info:', err);
    }
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    try {
      await api.sendMessage(actId, { message: text });
      input.value = '';
      input.style.height = 'auto';
      await pollMessages();
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      sendBtn.disabled = false;
    }
  }

  input.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  loadActivityInfo();
  loadMessages();
  loadMembers();
  pollTimer = setInterval(pollMessages, 5000);
})();
