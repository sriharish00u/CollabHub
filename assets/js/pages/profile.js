(function () {
  if (!requireAuth()) return;

  const user = api.getUser();

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    const months = Math.floor(days / 30);
    return months + 'mo ago';
  }

  function renderSkillLevel(level) {
    let dots = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= level) {
        dots += '<div class="w-2 h-2 rounded-full bg-primary"></div>';
      } else {
        dots += '<div class="w-2 h-2 rounded-full bg-outline-variant"></div>';
      }
    }
    return dots;
  }

  function skillChipClass(level) {
    if (level >= 5) return 'bg-primary-container text-on-primary rounded-lg border border-primary-container';
    if (level >= 4) return 'bg-primary-fixed text-on-primary-fixed rounded-lg border border-primary-container/20';
    return 'bg-surface-container text-on-surface-variant rounded-lg border border-outline-variant';
  }

  async function loadProfile() {
    try {
      const profile = await api.getProfile();
      const name = profile.name || 'User';
      document.getElementById('profile-name').textContent = name;
      document.title = name + ' | CollabHub';

      const dept = profile.department || '';
      const college = profile.college || '';
      const parts = [dept, college].filter(Boolean);
      document.getElementById('profile-dept-college').textContent = parts.length ? parts.join(', ') : 'No info';

      document.getElementById('profile-bio').textContent = profile.bio || '';

      const avatarSrc = api.avatarFallback(profile.avatar_url);
      document.getElementById('profile-avatar').src = avatarSrc;
      document.getElementById('nav-avatar').src = avatarSrc;

      document.getElementById('stat-email').textContent = profile.email || '';
      document.getElementById('stat-year').textContent = profile.year || '—';

      document.getElementById('skill-pct').textContent = '';
      document.getElementById('stat-skills').textContent = '…';
    } catch (err) {
      document.getElementById('profile-name').textContent = user?.name || 'User';
      document.getElementById('profile-dept-college').textContent = '—';
      document.getElementById('profile-bio').textContent = '';
      document.getElementById('nav-avatar').src = api.DEFAULT_AVATAR;
      document.getElementById('profile-avatar').src = api.DEFAULT_AVATAR;
    }
  }

  async function loadSkills() {
    const grid = document.getElementById('skills-grid');
    try {
      const skills = await api.listMySkills();
      document.getElementById('stat-skills').textContent = skills.length;
      document.getElementById('skill-pct').textContent = skills.length + ' skills';

      if (skills.length === 0) {
        grid.innerHTML = '<p class="font-body-sm text-on-surface-variant col-span-full">No skills added yet.</p>';
        return;
      }

      grid.innerHTML = skills.map(s => {
        const level = s.proficiency || s.level || 3;
        const name = s.name || s.skill_name || 'Skill';
        return '<div class="flex items-center justify-between p-md ' + skillChipClass(level) + '">' +
          '<div class="flex items-center gap-sm">' +
          '<span class="material-symbols-outlined text-[16px]">verified</span>' +
          '<span class="font-label text-label">' + name + '</span>' +
          '</div>' +
          '<div class="flex gap-1">' + renderSkillLevel(level) + '</div>' +
          '</div>';
      }).join('');
    } catch {
      grid.innerHTML = '<p class="font-body-sm text-on-surface-variant col-span-full">Could not load skills.</p>';
    }
  }

  async function loadActivities() {
    const createdEl = document.getElementById('content-created');
    const joinedEl = document.getElementById('content-joined');
    try {
      const [activities, memberActivities] = await Promise.all([
        api.listActivities(),
        api.getMemberActivities().catch(() => []),
      ]);
      const myId = user?.id || user?.user_id;

      const created = activities.filter(a => a.creator_id === myId);
      const joined = memberActivities.filter(a => a.creator_id !== myId);

      document.getElementById('created-loading')?.remove();
      document.getElementById('joined-loading')?.remove();

      if (created.length === 0) {
        createdEl.innerHTML = '<p class="font-body-sm text-on-surface-variant col-span-full">No activities created yet.</p>';
      } else {
        createdEl.innerHTML = created.map(a => activityCard(a)).join('');
      }

      if (joined.length === 0) {
        joinedEl.innerHTML = '<div class="bg-surface-container p-xl rounded-xl text-center border border-dashed border-outline">' +
          '<span class="material-symbols-outlined text-outline-variant text-[48px] mb-md">folder_shared</span>' +
          '<p class="font-body-md text-on-surface-variant">You have not joined any teams yet.</p></div>';
      } else {
        joinedEl.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-md">' + joined.map(a => activityCard(a)).join('') + '</div>';
      }
    } catch {
      var cl = document.getElementById('created-loading');
      if (cl) cl.textContent = 'Could not load activities.';
      var jl = document.getElementById('joined-loading');
      if (jl) jl.textContent = '';
    }
  }

  function activityCard(a) {
    const memberCount = a.members_count || 0;
    const created = a.created_at ? timeAgo(a.created_at) : '';
    return '<div class="bg-surface border border-outline-variant rounded-xl overflow-hidden hover:border-primary transition-all flex flex-col group">' +
      '<div class="h-32 bg-primary-fixed relative overflow-hidden">' +
      '<div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent"></div>' +
      '<div class="absolute top-sm right-sm px-sm py-xs bg-white/90 rounded font-caption text-caption">' + created + '</div>' +
      '</div>' +
      '<div class="p-lg">' +
      '<h4 class="font-h5 text-h5 mb-xs group-hover:text-primary transition-colors">' + (a.title || 'Untitled') + '</h4>' +
      '<p class="font-body-sm text-body-sm text-on-surface-variant mb-md line-clamp-2">' + (a.description || '') + '</p>' +
      '<div class="flex items-center justify-between">' +
      '<div class="flex -space-x-2">' +
      '<div class="w-8 h-8 rounded-full border-2 border-white bg-primary-fixed flex items-center justify-center text-[10px] font-bold">' + memberCount + '</div>' +
      '</div>' +
      '<button class="text-primary font-label text-label flex items-center gap-xs" onclick="window.location.href=\'activity_detail.html?id=' + a.id + '\'">' +
      'View Details <span class="material-symbols-outlined text-[16px]">arrow_forward</span>' +
      '</button>' +
      '</div></div></div>';
  }

  loadProfile();
  loadSkills();
  loadActivities();
})();
