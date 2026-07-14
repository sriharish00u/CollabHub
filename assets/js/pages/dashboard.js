(function () {
  requireAuth();

  const user = api.getUser();

  async function loadDashboard() {
    try {
      const [profile, activities, memberActivities] = await Promise.all([
        api.getProfile(),
        api.listActivities(),
        api.getMemberActivities().catch(function () { return []; }),
      ]);

      var name = profile.name || user?.name || 'User';
      document.getElementById('welcome-name').textContent = 'Welcome back, ' + name;

      var avatarEl = document.getElementById('user-avatar');
      if (avatarEl) {
        var img = avatarEl.querySelector('img');
        if (img) img.src = api.avatarFallback(profile.avatar_url);
      }

      var created = activities.filter(function (a) { return a.creator_id === profile.id; });
      var joined = memberActivities.filter(function (a) { return a.creator_id !== profile.id; });

      document.getElementById('dashboard-summary').textContent =
        'You have ' + created.length + ' created activities and ' + joined.length + ' joined.';

      renderCreatedActivities(created);
      renderJoinedActivities(joined);
      renderSkills(profile);

      document.getElementById('discover-text').textContent =
        'Based on your profile, there are activities looking for collaborators like you.';

    } catch (err) {
      document.getElementById('dashboard-summary').textContent = 'Could not load dashboard data.';
      console.error(err);
    }
  }

  function renderCreatedActivities(activities) {
    var container = document.getElementById('created-activities');
    if (!activities || activities.length === 0) {
      container.innerHTML = '<p class="font-body-md text-body-md text-on-surface-variant">You haven\'t created any activities yet. <a href="create_activity.html" class="text-primary font-semibold hover:underline">Start one!</a></p>';
      return;
    }
    var html = '';
    activities.forEach(function (a) {
      var count = a.members_count || 0;
      var max = a.max_members || 5;
      var pct = Math.min(Math.round(count / Math.max(max, 1) * 100), 100);
      html += '<div class="bg-surface border border-outline-variant p-lg rounded-xl flex flex-col gap-md transition-all hover:border-primary" style="box-shadow: 0 4px 12px rgba(67, 56, 202, 0.08);">' +
        '<div class="flex justify-between items-start">' +
        '<span class="bg-primary-fixed text-on-primary-fixed px-sm py-xs rounded text-label font-label">' + (a.category || 'General') + '</span>' +
        '<span class="text-caption font-caption text-on-surface-variant">' + (a.status || 'Open') + '</span>' +
        '</div>' +
        '<h4 class="font-h5 text-h5">' + escapeHtml(a.title || 'Untitled') + '</h4>' +
        '<p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">' + escapeHtml(a.description || '') + '</p>' +
        '<div class="mt-auto pt-md border-t border-outline-variant/30">' +
        '<div class="flex justify-between mb-xs"><span class="text-label font-label">Capacity</span><span class="text-label font-label">' + pct + '%</span></div>' +
        '<div class="w-full bg-surface-container-high h-2 rounded-full overflow-hidden"><div class="bg-primary h-full rounded-full" style="width:' + pct + '%"></div></div>' +
        '</div>' +
        '<div class="flex justify-between items-center pt-xs">' +
        '<span class="font-label text-label text-on-surface-variant">' + count + '/' + max + ' members</span>' +
        '<a href="group_chat.html?activity=' + a.id + '" class="flex items-center gap-xs text-primary font-label text-label hover:bg-primary/5 px-sm py-xs rounded transition-colors"><span class="material-symbols-outlined text-[18px]">forum</span> Chat</a>' +
        '</div></div>';
    });
    container.innerHTML = html;
  }

  function renderJoinedActivities(activities) {
    var container = document.getElementById('joined-activities-list');
    if (!activities || activities.length === 0) {
      container.innerHTML = '<p class="font-body-sm text-body-sm text-on-surface-variant">You haven\'t joined any activities yet.</p>';
      return;
    }
    var html = '';
    activities.forEach(function (a) {
      html += '<div class="flex gap-md items-center p-sm hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer" onclick="window.location.href=\'activity_detail.html?id=' + a.id + '\'">' +
        '<div class="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center"><span class="material-symbols-outlined text-on-primary-container">folder_shared</span></div>' +
        '<div><p class="font-body-sm font-semibold">' + escapeHtml(a.title) + '</p><p class="text-caption text-on-surface-variant">' + (a.status || 'Active') + '</p></div>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  function renderSkills(profile) {
    var pctEl = document.getElementById('skill-percentage');
    var tagsEl = document.getElementById('skill-tags');

    api.listMySkills().then(function (skills) {
      var count = skills.length;
      var pct = count > 0 ? Math.min(count * 20, 100) : 0;
      pctEl.textContent = pct + '%';
      var ring = document.querySelector('.w-24.h-24.rounded-full');
      if (ring) ring.style.setProperty('--percentage', pct);
      if (count === 0) {
        tagsEl.innerHTML = '<a href="settings.html" class="text-primary font-label text-label hover:underline">Add your first skill</a>';
        return;
      }
      var html = '';
      skills.forEach(function (s) {
        html += '<div class="bg-primary-container/10 text-primary-container px-sm py-xs rounded-full text-label font-label flex items-center gap-xs">' +
          '<span class="material-symbols-outlined text-[14px]" style="font-variation-settings: \'FILL\' 1;">verified</span>' + escapeHtml(s.skill_name) +
          '</div>';
      });
      tagsEl.innerHTML = html;
    }).catch(function () {
      pctEl.textContent = '0%';
      tagsEl.innerHTML = '<a href="settings.html" class="text-primary font-label text-label hover:underline">Add your first skill</a>';
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  loadDashboard();
})();
