(function () {
  if (!requireAuth()) return;

  const activityId = new URLSearchParams(window.location.search).get('id');
  if (!activityId) {
    window.location.href = 'feed.html';
    return;
  }

  /* ── Elements ──────────────────────────────────────────────────────────── */
  const $title        = document.getElementById('activity-title');
  const $category     = document.getElementById('activity-category');
  const $description  = document.getElementById('activity-description');
  const $fullDesc     = document.getElementById('activity-full-description');
  const $deadlineLabel = document.getElementById('activity-deadline-label');
  const $countdown    = document.getElementById('countdown');
  const $creatorName  = document.getElementById('creator-name');
  const $creatorRole  = document.getElementById('creator-role');
  const $creatorAvatar = document.getElementById('creator-avatar-container');
  const $teamCount    = document.getElementById('team-count');
  const $teamBar      = document.getElementById('team-progress-bar');
  const $teamGrid     = document.getElementById('team-members-grid');
  const $techStack    = document.getElementById('tech-stack');
  const $skillsComp   = document.getElementById('skills-comparison');
  const $matchScore   = document.getElementById('match-score');
  const $matchRing    = document.getElementById('match-ring');
  const $eligBanner   = document.getElementById('eligibility-banner');
  const $eligMsg      = document.getElementById('eligibility-msg');
  const $applyBtnHero = document.getElementById('apply-btn-hero');
  const $reviewBtnHero = document.getElementById('review-btn-hero');
  const $chatBtnHero = document.getElementById('chat-btn-hero');
  const $applyBtnCta  = document.getElementById('apply-btn-cta');
  const $applyDeadline = document.getElementById('apply-deadline-text');
  const $toast        = document.getElementById('toast');
  const $userAvatar   = document.getElementById('user-avatar');

  /* ── Nav user avatar ───────────────────────────────────────────────────── */
  const user = api.getUser();

  /* ── Toast helper ──────────────────────────────────────────────────────── */
  function showToast(msg, ok) {
    $toast.textContent = msg;
    $toast.className = ok
      ? 'fixed top-20 left-1/2 -translate-x-1/2 z-50 px-lg py-md rounded-lg shadow-lg font-label text-label text-on-primary bg-green-600'
      : 'fixed top-20 left-1/2 -translate-x-1/2 z-50 px-lg py-md rounded-lg shadow-lg font-label text-label text-on-primary bg-error';
    setTimeout(() => { $toast.className = 'hidden fixed top-20 left-1/2 -translate-x-1/2 z-50 px-lg py-md rounded-lg shadow-lg font-label text-label text-on-primary transition-all duration-300'; }, 4000);
  }

  /* ── Countdown ─────────────────────────────────────────────────────────── */
  let deadlineDate = null;
  function tickCountdown() {
    if (!deadlineDate) return;
    const diff = deadlineDate - Date.now();
    if (diff <= 0) { $countdown.textContent = 'Expired'; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    $countdown.textContent = d + 'd ' + h + 'h ' + m + 'm';
  }

  /* ── Render helpers ────────────────────────────────────────────────────── */
  function renderTeamSpot(member, idx, total) {
    const col = document.createElement('div');
    col.className = 'flex flex-col items-center gap-xs';
    if (member) {
      col.innerHTML =
        '<div class="w-12 h-12 rounded-full border-2 border-primary overflow-hidden bg-surface-container">' +
          '<img class="w-full h-full object-cover" src="' + api.avatarFallback(member.avatar_url) + '" alt="' + (member.full_name || '') + '" onerror="this.onerror=null;this.src=\'/assets/img/default-avatar.svg\'"/>' +
        '</div>' +
        '<span class="font-caption text-caption text-on-surface-variant">' + (member.role || 'Member') + '</span>';
    } else {
      col.innerHTML =
        '<div class="w-12 h-12 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center bg-surface-container">' +
          '<span class="material-symbols-outlined text-outline">add</span>' +
        '</div>' +
        '<span class="font-caption text-caption text-outline">Open</span>';
    }
    return col;
  }

  function renderSkillComparison(skill) {
    const userLevel = skill.user_level || 0;
    const reqLevel  = skill.required_level || 1;
    const pct       = Math.min(100, Math.round((userLevel / reqLevel) * 100));
    const markerPct = Math.min(100, Math.round((reqLevel / 5) * 100));
    const ok        = userLevel >= reqLevel;
    const colorClass = ok ? 'bg-primary' : 'bg-amber-500';
    const textColor  = ok ? 'text-primary' : 'text-amber-600';
    const icon       = ok ? 'check_circle' : 'info';

    return '<div>' +
      '<div class="flex justify-between items-center mb-xs">' +
        '<span class="font-label text-label">' + skill.name + '</span>' +
        '<span class="font-caption text-caption text-outline">Lvl ' + reqLevel + ' Required</span>' +
      '</div>' +
      '<div class="skill-bar-bg relative">' +
        '<div class="absolute top-0 bottom-0 w-0.5 bg-outline-variant z-10" style="left:' + markerPct + '%"></div>' +
        '<div class="skill-bar-fill ' + colorClass + '" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<p class="mt-xs font-caption text-caption ' + textColor + ' flex items-center gap-xs">' +
        '<span class="material-symbols-outlined text-[14px]">' + icon + '</span>' +
        'Your Level: ' + userLevel.toFixed(1) +
      '</p>' +
    '</div>';
  }

  /* ── Apply handler ─────────────────────────────────────────────────────── */
  let applying = false;
  async function handleApply() {
    if (applying) return;
    applying = true;
    $applyBtnHero.disabled = true;
    $applyBtnCta.disabled = true;
    $applyBtnHero.textContent = 'Applying…';
    try {
      await api.applyToActivity(activityId);
      showToast('Application sent successfully!', true);
      $applyBtnHero.textContent = 'Applied';
      $applyBtnHero.classList.remove('bg-primary', 'text-on-primary');
      $applyBtnHero.classList.add('bg-secondary', 'text-on-secondary');
      $applyBtnCta.textContent = 'Applied';
      $applyBtnCta.classList.remove('bg-surface', 'text-primary');
      $applyBtnCta.classList.add('bg-secondary-container', 'text-on-secondary');
    } catch (err) {
      showToast(err.detail || 'Failed to apply', false);
      $applyBtnHero.disabled = false;
      $applyBtnHero.textContent = 'Apply Now';
      $applyBtnCta.disabled = false;
      $applyBtnCta.textContent = 'Send Application';
    } finally {
      applying = false;
    }
  }
  $applyBtnHero.addEventListener('click', handleApply);
  $applyBtnCta.addEventListener('click', handleApply);

  /* ── Load data ─────────────────────────────────────────────────────────── */
  async function load() {
    try {
      const [activity, eligibility, members] = await Promise.all([
        api.getActivity(activityId),
        api.getEligibility(activityId).catch(() => null),
        api.listMembers(activityId).catch(() => [])
      ]);

      /* Title / meta */
      $title.textContent = activity.title || '';
      document.title = 'CollabHub | ' + (activity.title || 'Activity');
      $category.textContent = activity.category || '';
      $description.textContent = activity.description || '';
      $fullDesc.textContent = activity.description || '';

      /* Creator */
      if (activity.creator) {
        $creatorName.textContent = activity.creator.full_name || '';
        $creatorRole.textContent = activity.creator.role || '';
        $creatorAvatar.innerHTML = '<img class="w-full h-full object-cover" src="' + api.avatarFallback(activity.creator.avatar_url) + '" alt="" onerror="this.onerror=null;this.src=\'/assets/img/default-avatar.svg\'"/>';
      }

      /* Role-based UI */
      var myId = user ? (user.id || user.user_id) : null;
      var isCreator = myId && activity.creator_id === myId;
      var isMember = members.some(function (m) { return m.user_id === myId; });

      if (isCreator) {
        $applyBtnHero.classList.add('hidden');
        $applyBtnCta.classList.add('hidden');
        $reviewBtnHero.classList.remove('hidden');
        $reviewBtnHero.addEventListener('click', function () {
          window.location.href = 'applicant_review.html?actId=' + activityId;
        });
      } else if (isMember) {
        $applyBtnHero.classList.add('hidden');
        $applyBtnCta.classList.add('hidden');
        $chatBtnHero.classList.remove('hidden');
        $chatBtnHero.addEventListener('click', function () {
          window.location.href = 'group_chat.html?activity=' + activityId;
        });
      }

      /* Deadline / countdown */
      if (activity.deadline) {
        deadlineDate = new Date(activity.deadline);
        $deadlineLabel.textContent = 'Ends ' + deadlineDate.toLocaleDateString();
        $applyDeadline.textContent = 'Applications close ' + deadlineDate.toLocaleDateString();
        tickCountdown();
        setInterval(tickCountdown, 60000);
      } else {
        $deadlineLabel.textContent = '';
        $countdown.textContent = '';
      }

      /* Tech stack tags */
      $techStack.innerHTML = '';
      (activity.required_skills || []).forEach(function (s) {
        var name = typeof s === 'string' ? s : (s.name || s.skill_name || '');
        if (name) {
          $techStack.innerHTML += '<span class="bg-surface-container-high border border-outline-variant px-md py-xs rounded-full font-label text-label text-primary">' + name + '</span>';
        }
      });

      /* Team members */
      var capacity = activity.capacity || 5;
      var filled = members.length;
      $teamCount.textContent = filled + ' of ' + capacity + ' spots filled';
      var pct = capacity > 0 ? Math.round((filled / capacity) * 100) : 0;
      $teamBar.style.width = pct + '%';

      $teamGrid.innerHTML = '';
      for (var i = 0; i < capacity; i++) {
        $teamGrid.appendChild(renderTeamSpot(members[i] || null, i, capacity));
      }

      /* Skills comparison & eligibility */
      if (eligibility) {
        var score = eligibility.match_score != null ? Math.round(eligibility.match_score * 100) : 0;
        $matchScore.textContent = score + '%';
        var circumference = 2 * Math.PI * 40;
        $matchRing.setAttribute('stroke-dasharray', circumference.toFixed(1));
        $matchRing.setAttribute('stroke-dashoffset', (circumference * (1 - score / 100)).toFixed(1));

        $skillsComp.innerHTML = '';
        (eligibility.skills || []).forEach(function (sk) {
          $skillsComp.innerHTML += renderSkillComparison(sk);
        });

        if (!eligibility.eligible && eligibility.gap_summary) {
          $eligBanner.classList.remove('hidden');
          $eligBanner.classList.add('flex');
          $eligMsg.textContent = eligibility.gap_summary;
        }

        /* Animate skill bars */
        setTimeout(function () {
          document.querySelectorAll('.skill-bar-fill').forEach(function (bar) {
            var w = bar.style.width;
            bar.style.width = '0%';
            setTimeout(function () { bar.style.width = w; }, 50);
          });
        }, 200);
      }
    } catch (err) {
      showToast(err.detail || 'Failed to load activity', false);
    }
  }

  load();
})();
