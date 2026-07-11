(function () {
  if (!requireAuth()) return;

  var user = api.getUser();

  function toggleTab(tab) {
    var pill = document.getElementById('tab-pill');
    var activeBtn = document.getElementById('btn-active');
    var pendingBtn = document.getElementById('btn-pending');
    var activeContent = document.getElementById('active-content');
    var pendingContent = document.getElementById('pending-content');

    if (tab === 'active') {
      pill.style.transform = 'translateX(0)';
      activeBtn.classList.add('text-primary');
      activeBtn.classList.remove('text-on-surface-variant');
      pendingBtn.classList.add('text-on-surface-variant');
      pendingBtn.classList.remove('text-primary');
      activeContent.classList.remove('hidden');
      pendingContent.classList.add('hidden');
    } else {
      pill.style.transform = 'translateX(100%)';
      pendingBtn.classList.add('text-primary');
      pendingBtn.classList.remove('text-on-surface-variant');
      activeBtn.classList.add('text-on-surface-variant');
      activeBtn.classList.remove('text-primary');
      activeContent.classList.add('hidden');
      pendingContent.classList.remove('hidden');
    }
  }
  window.toggleTab = toggleTab;

  function timeAgo(dateStr) {
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    return days + 'd ago';
  }

  function teamCard(a) {
    var count = a.members_count || 0;
    var max = a.max_members || 5;
    var status = a.status || 'In Progress';
    var progress = max > 0 ? Math.round((count / max) * 100) : 0;
    var created = a.created_at ? timeAgo(a.created_at) : '';

    return '<div class="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">' +
      '<div class="p-md">' +
      '<div class="flex justify-between items-start mb-sm">' +
      '<div>' +
      '<span class="font-caption text-caption text-primary font-bold tracking-wider uppercase">' + (a.category || 'General') + '</span>' +
      '<h3 class="font-h5 text-h5 mt-1">' + (a.title || 'Untitled') + '</h3>' +
      '</div>' +
      '<span class="bg-primary-container/10 text-primary px-2 py-1 rounded text-label font-label flex items-center gap-1">' +
      '<span class="w-1.5 h-1.5 bg-primary rounded-full"></span>' + status + '</span>' +
      '</div>' +
      '<div class="mt-md">' +
      '<div class="flex justify-between text-caption font-caption mb-1">' +
      '<span class="text-on-surface-variant">' + (a.description || '').substring(0, 80) + '</span>' +
      '<span class="text-primary font-bold">' + progress + '%</span>' +
      '</div>' +
      '<div class="w-full bg-surface-container rounded-full h-1.5">' +
      '<div class="bg-primary h-1.5 rounded-full" style="width: ' + progress + '%"></div>' +
      '</div></div>' +
      '<div class="mt-lg pt-md border-t border-outline-variant flex justify-between items-center">' +
      '<span class="font-label text-label text-on-surface-variant">' + count + '/' + max + ' members</span>' +
      '<button class="bg-primary-container/10 text-primary p-2 rounded-lg hover:bg-primary-container/20 transition-colors" onclick="window.location.href=\'activity_detail.html?id=' + a.id + '\'">' +
      '<span class="material-symbols-outlined">chat</span>' +
      '</button></div></div></div>';
  }

  function applicationCard(a) {
    var count = a.members_count || 0;
    var max = a.max_members || 5;
    var statusIcon = a.status === 'open' ? 'check_circle' : 'hourglass_empty';
    var statusLabel = a.status === 'open' ? 'Active' : a.status || 'In Progress';

    return '<div class="bg-white border border-outline-variant rounded-xl p-md">' +
      '<div class="flex justify-between items-start mb-md">' +
      '<div class="flex-1">' +
      '<span class="bg-secondary-container/10 text-secondary px-2 py-0.5 rounded text-[10px] font-bold uppercase">' + (a.category || 'Activity') + '</span>' +
      '<h3 class="font-h5 text-h5 mt-1">' + (a.title || 'Untitled') + '</h3>' +
      '</div>' +
      '<div class="text-right">' +
      '<div class="text-secondary font-h5 text-h5">' + count + '/' + max + '</div>' +
      '<div class="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter leading-none">Members</div>' +
      '</div></div>' +
      '<div class="flex items-center gap-sm bg-surface-container-low p-sm rounded-lg mb-md">' +
      '<span class="material-symbols-outlined text-secondary text-lg">' + statusIcon + '</span>' +
      '<div>' +
      '<p class="text-label font-label text-on-surface">' + statusLabel + '</p>' +
      '</div></div>' +
      '<div class="flex justify-end gap-sm">' +
      '<button class="px-md py-1.5 text-label font-label bg-primary text-white rounded-lg" onclick="window.location.href=\'activity_detail.html?id=' + a.id + '\'">View Detail</button>' +
      '</div></div>';
  }

  async function loadTeams() {
    var activeEl = document.getElementById('active-content');
    var pendingEl = document.getElementById('pending-content');

    try {
      var myId = user?.id || user?.user_id;

      var [allActivities, memberActivities] = await Promise.all([
        api.listActivities(),
        api.getMemberActivities().catch(function () { return []; }),
      ]);

      var created = allActivities.filter(function (a) { return a.creator_id === myId; });
      var joined = memberActivities.filter(function (a) { return a.creator_id !== myId; });
      var myTeams = created.concat(joined);

      var teamsLoading = document.getElementById('teams-loading');
      if (teamsLoading) teamsLoading.remove();
      var pendingLoading = document.getElementById('pending-loading');
      if (pendingLoading) pendingLoading.remove();

      if (myTeams.length === 0) {
        activeEl.innerHTML = '<div class="bg-surface-container p-xl rounded-xl text-center border border-dashed border-outline">' +
          '<span class="material-symbols-outlined text-outline-variant text-[48px] mb-md">groups</span>' +
          '<p class="font-body-md text-on-surface-variant">You have not joined any teams yet.</p>' +
          '<a href="feed.html" class="mt-md inline-flex items-center gap-1 text-primary font-label text-label hover:underline">Find Teams <span class="material-symbols-outlined text-[16px]">arrow_forward</span></a>' +
          '</div>';
        pendingEl.innerHTML = '<div class="bg-surface-container p-xl rounded-xl text-center border border-dashed border-outline">' +
          '<p class="font-body-md text-on-surface-variant">No pending applications.</p></div>';
      } else {
        activeEl.innerHTML = myTeams.map(teamCard).join('');
        pendingEl.innerHTML = '<div class="bg-surface-container p-xl rounded-xl text-center border border-dashed border-outline">' +
          '<p class="font-body-md text-on-surface-variant">No pending applications.</p></div>';
      }
    } catch (err) {
      console.error(err);
      var teamsLoading = document.getElementById('teams-loading');
      if (teamsLoading) teamsLoading.textContent = 'Could not load teams.';
      var pendingLoading = document.getElementById('pending-loading');
      if (pendingLoading) pendingLoading.textContent = '';
    }
  }

  loadTeams();
})();
