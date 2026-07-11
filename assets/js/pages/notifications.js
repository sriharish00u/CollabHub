(function () {
  if (!requireAuth()) return;

  const panel = document.getElementById('notifications-panel');
  const activityList = document.getElementById('activity-notifications');
  const systemList = document.getElementById('system-notifications');
  const unreadCount = document.getElementById('unread-count');
  const markAllBtn = document.getElementById('mark-all-read');

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' mins ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' hours ago';
    const days = Math.floor(hrs / 24);
    return days + ' day' + (days > 1 ? 's' : '') + ' ago';
  }

  function renderActivityItem(activity) {
    return '<div class="px-lg py-md flex gap-md hover:bg-primary/5 cursor-pointer group relative">' +
      '<div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary rounded-r-full"></div>' +
      '<div class="relative">' +
        '<div class="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-primary">science</span>' +
        '</div>' +
      '</div>' +
      '<div class="flex-1">' +
        '<p class="font-body-sm text-body-sm text-on-surface leading-snug">' +
          '<span class="font-bold">' + (activity.title || 'Activity') + '</span> — ' +
          '<span class="text-primary font-medium">' + (activity.category || 'General') + '</span>' +
        '</p>' +
        '<p class="font-caption text-caption text-on-surface-variant mt-1 flex items-center gap-xs">' +
          '<span class="material-symbols-outlined text-[12px]">schedule</span> ' +
          (activity.created_at ? timeAgo(activity.created_at) : '') +
        '</p>' +
      '</div>' +
      '<div class="w-2 h-2 rounded-full bg-secondary self-center"></div>' +
    '</div>';
  }

  function renderJoinRequestItem(activity, status) {
    var statusLabel = status === 'approved' ? 'Accepted' : status === 'rejected' ? 'Rejected' : 'Pending';
    var statusColor = status === 'approved' ? 'text-primary' : status === 'rejected' ? 'text-error' : 'text-secondary';
    return '<div class="px-lg py-md flex gap-md hover:bg-primary/5 cursor-pointer group relative">' +
      '<div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary rounded-r-full"></div>' +
      '<div class="relative">' +
        '<div class="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-primary">person_add</span>' +
        '</div>' +
      '</div>' +
      '<div class="flex-1">' +
        '<p class="font-body-sm text-body-sm text-on-surface leading-snug">' +
          'Your application for <span class="font-bold">' + (activity.title || 'Activity') + '</span> is ' +
          '<span class="' + statusColor + ' font-medium">' + statusLabel + '</span>' +
        '</p>' +
        '<p class="font-caption text-caption text-on-surface-variant mt-1 flex items-center gap-xs">' +
          '<span class="material-symbols-outlined text-[12px]">schedule</span> ' +
          (activity.created_at ? timeAgo(activity.created_at) : '') +
        '</p>' +
      '</div>' +
    '</div>';
  }

  async function loadNotifications() {
    try {
      var activities = await api.listActivities();
      var items = activities.items || activities || [];

      if (items.length === 0) {
        activityList.innerHTML = '<p class="px-lg py-md font-body-sm text-body-sm text-on-surface-variant">No new notifications.</p>';
        unreadCount.textContent = '0 unread updates';
        return;
      }

      var html = '';
      var count = 0;
      items.slice(0, 5).forEach(function (a) {
        html += renderActivityItem(a);
        count++;
      });
      activityList.innerHTML = html;
      unreadCount.textContent = count + ' unread update' + (count !== 1 ? 's' : '') + ' today';

      // System section: show a sample security alert
      systemList.innerHTML =
        '<div class="px-lg py-md flex gap-md hover:bg-surface-container-high cursor-pointer opacity-70">' +
          '<div class="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline-variant">' +
            '<span class="material-symbols-outlined text-on-surface-variant">security</span>' +
          '</div>' +
          '<div class="flex-1">' +
            '<p class="font-body-sm text-body-sm text-on-surface leading-snug">' +
              'Security alert: A new login was detected from <span class="font-bold">your device</span>' +
            '</p>' +
            '<p class="font-caption text-caption text-on-surface-variant mt-1 flex items-center gap-xs">' +
              '<span class="material-symbols-outlined text-[12px]">schedule</span> Just now' +
            '</p>' +
          '</div>' +
        '</div>';

    } catch (err) {
      activityList.innerHTML = '<p class="px-lg py-md font-body-sm text-body-sm text-on-surface-variant">Failed to load notifications.</p>';
      unreadCount.textContent = '';
    }
  }

  // Close on Esc
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel) panel.style.display = 'none';
  });

  // Mark all as read
  if (markAllBtn) {
    markAllBtn.addEventListener('click', function () {
      var dots = activityList.querySelectorAll('.bg-secondary');
      dots.forEach(function (d) { d.style.display = 'none'; });
      var bars = activityList.querySelectorAll('.bg-primary.rounded-r-full');
      bars.forEach(function (b) { b.style.display = 'none'; });
      unreadCount.textContent = '0 unread updates';
    });
  }

  // Click individual items to mark read
  document.querySelectorAll('.divide-y > div').forEach(function (item) {
    item.addEventListener('click', function () {
      var dot = this.querySelector('.bg-secondary');
      var bar = this.querySelector('.bg-primary');
      if (dot) dot.style.display = 'none';
      if (bar) bar.style.display = 'none';
      this.classList.add('opacity-70');
    });
  });

  loadNotifications();
})();
