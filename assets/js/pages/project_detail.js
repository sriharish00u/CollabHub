(function () {
  if (!requireAuth()) return;

  var activityId = new URLSearchParams(window.location.search).get('id');
  if (!activityId) {
    window.location.href = 'feed.html';
    return;
  }

  /* ── Elements ──────────────────────────────────────────────────────────── */
  var $title        = document.getElementById('activity-title');
  var $category     = document.getElementById('activity-category');
  var $description  = document.getElementById('activity-description');
  var $matchScore   = document.getElementById('match-score');
  var $membersAvatars = document.getElementById('members-avatars');
  var $membersLocation = document.getElementById('members-location');
  var $skillsList   = document.getElementById('skills-list');
  var $teamList     = document.getElementById('team-list');
  var $applyBtn     = document.getElementById('apply-btn');
  var $toast        = document.getElementById('toast');

  /* ── Toast helper ──────────────────────────────────────────────────────── */
  function showToast(msg, ok) {
    $toast.textContent = msg;
    $toast.className = ok
      ? 'fixed top-20 left-1/2 -translate-x-1/2 z-50 px-lg py-md rounded-lg shadow-lg font-label text-label text-on-primary bg-green-600'
      : 'fixed top-20 left-1/2 -translate-x-1/2 z-50 px-lg py-md rounded-lg shadow-lg font-label text-label text-on-primary bg-error';
    setTimeout(function () {
      $toast.className = 'hidden fixed top-20 left-1/2 -translate-x-1/2 z-50 px-lg py-md rounded-lg shadow-lg font-label text-label text-on-primary transition-all duration-300';
    }, 4000);
  }

  /* ── Apply handler ─────────────────────────────────────────────────────── */
  var applying = false;
  async function handleApply() {
    if (applying) return;
    applying = true;
    $applyBtn.disabled = true;
    $applyBtn.textContent = 'Applying…';
    try {
      await api.applyToActivity(activityId);
      showToast('Application sent!', true);
      $applyBtn.textContent = 'Applied';
      $applyBtn.classList.remove('bg-primary');
      $applyBtn.classList.add('bg-secondary');
    } catch (err) {
      showToast(err.detail || 'Failed to apply', false);
      $applyBtn.disabled = false;
      $applyBtn.textContent = 'Apply Now';
    } finally {
      applying = false;
    }
  }
  $applyBtn.addEventListener('click', handleApply);

  /* ── Load data ─────────────────────────────────────────────────────────── */
  async function load() {
    try {
      var activity = await api.getActivity(activityId);
      var members = await api.listMembers(activityId).catch(function () { return []; });
      var eligibility = await api.getEligibility(activityId).catch(function () { return null; });

      /* Title / meta */
      $title.textContent = activity.title || '';
      document.title = 'Project Details - ' + (activity.title || '');
      $category.textContent = activity.category || '';
      $description.textContent = activity.description || '';

      /* Match score */
      if (eligibility && eligibility.match_score != null) {
        $matchScore.textContent = Math.round(eligibility.match_score * 100) + '%';
      }

      /* Members avatars */
      $membersAvatars.innerHTML = '';
      var shown = members.slice(0, 3);
      shown.forEach(function (m) {
        var img = document.createElement('img');
        img.className = 'w-10 h-10 rounded-full border-2 border-surface shadow-sm';
        img.src = api.avatarFallback(m.avatar_url);
        img.onerror = function() { this.onerror = null; this.src = '/assets/img/default-avatar.svg'; };
        img.alt = m.full_name || '';
        $membersAvatars.appendChild(img);
      });
      if (members.length > 3) {
        var badge = document.createElement('div');
        badge.className = 'w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-label border-2 border-surface shadow-sm';
        badge.textContent = '+' + (members.length - 3);
        $membersAvatars.appendChild(badge);
      }

      /* Location */
      if (activity.location) {
        $membersLocation.textContent = activity.location;
      } else if (members.length > 0 && members[0].location) {
        $membersLocation.textContent = members[0].location;
      } else {
        $membersLocation.textContent = members.length + ' team members';
      }

      /* Skills */
      $skillsList.innerHTML = '';
      var skillNames = activity.required_skills || [];
      skillNames.forEach(function (s) {
        var name = typeof s === 'string' ? s : (s.name || s.skill_name || '');
        if (name) {
          $skillsList.innerHTML +=
            '<span class="skill-pill flex items-center px-4 py-2 bg-primary/10 text-primary-container rounded-full font-body-sm font-semibold border border-primary/20">' +
              '<span class="material-symbols-outlined text-[16px] mr-1" style="font-variation-settings: \'FILL\' 1;">check_circle</span>' +
              name +
            '</span>';
        }
      });

      /* Team list */
      $teamList.innerHTML = '';
      members.forEach(function (m) {
        $teamList.innerHTML +=
          '<div class="flex items-center gap-md bg-surface border border-outline-variant rounded-lg p-md">' +
            '<div class="w-10 h-10 rounded-full overflow-hidden bg-surface-container flex-shrink-0">' +
              '<img class="w-full h-full object-cover" src="' + api.avatarFallback(m.avatar_url) + '" alt="' + (m.full_name || '') + '" onerror="this.onerror=null;this.src=\'/assets/img/default-avatar.svg\'"/>' +
            '</div>' +
            '<div>' +
              '<p class="font-body-sm font-semibold text-on-surface">' + (m.full_name || 'Member') + '</p>' +
              '<p class="font-caption text-caption text-outline">' + (m.role || '') + '</p>' +
            '</div>' +
          '</div>';
      });
    } catch (err) {
      showToast(err.detail || 'Failed to load project', false);
    }
  }

  load();
})();
