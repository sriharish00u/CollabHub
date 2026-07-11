(function () {
  if (!requireAuth()) return;

  var user = api.getUser();

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ── Profile ─────────────────────────────────────────────────────────── */
  async function loadProfile() {
    try {
      var profile = await api.getProfile();
      document.getElementById('settings-name').textContent = profile.name || 'User';
      document.getElementById('settings-email').textContent = profile.email || '';
      document.getElementById('settings-college').textContent = profile.college || '—';
      document.getElementById('settings-department').textContent = profile.department || '—';
      document.getElementById('settings-year').textContent = profile.year || '—';

      var avatarEl = document.getElementById('profile-avatar-settings');
      if (avatarEl) avatarEl.src = api.avatarFallback(profile.avatar_url);
    } catch (_) {
      document.getElementById('settings-name').textContent = user?.name || 'User';
      document.getElementById('settings-email').textContent = user?.email || '';
      var avatarEl = document.getElementById('profile-avatar-settings');
      if (avatarEl) avatarEl.src = api.DEFAULT_AVATAR;
    }
  }

  /* ── Skills ──────────────────────────────────────────────────────────── */
  var allCatalogSkills = [];
  var selectedSkillId = null;

  function renderSkills(skills) {
    var listEl = document.getElementById('skills-list');
    if (!skills || skills.length === 0) {
      listEl.innerHTML = '<p class="font-body-sm text-on-surface-variant">No skills added yet. Use the search below to add your first skill.</p>';
      return;
    }
    var html = '';
    skills.forEach(function (s) {
      var stars = '';
      for (var i = 1; i <= 5; i++) {
        stars += '<span class="material-symbols-outlined text-[14px] ' + (i <= s.level ? 'text-primary' : 'text-outline') + '" style="font-variation-settings: ' + (i <= s.level ? "'FILL' 1" : "'FILL' 0") + ';">star</span>';
      }
      html += '<div class="flex items-center justify-between p-sm bg-surface-container rounded-lg">' +
        '<div class="flex items-center gap-sm">' +
        '<span class="material-symbols-outlined text-[16px] text-primary" style="font-variation-settings: \'FILL\' 1;">verified</span>' +
        '<span class="font-label text-label">' + escapeHtml(s.skill_name) + '</span>' +
        '<div class="flex items-center">' + stars + '</div>' +
        '</div>' +
        '<button class="p-1 text-on-surface-variant hover:text-error transition-colors rounded" data-skill-id="' + s.skill_id + '" title="Remove skill">' +
        '<span class="material-symbols-outlined text-[18px]">close</span>' +
        '</button>' +
        '</div>';
    });
    listEl.innerHTML = html;

    listEl.querySelectorAll('button[data-skill-id]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var skillId = parseInt(this.dataset.skillId);
        this.disabled = true;
        try {
          await api.removeSkill(skillId);
          await loadSkills();
        } catch (err) {
          alert(err.detail || 'Failed to remove skill');
          this.disabled = false;
        }
      });
    });
  }

  async function loadSkills() {
    try {
      var skills = await api.listMySkills();
      renderSkills(skills);
    } catch (_) {
      document.getElementById('skills-list').innerHTML = '<p class="font-body-sm text-on-surface-variant">Failed to load skills.</p>';
    }
  }

  async function loadSkillCatalog() {
    try {
      allCatalogSkills = await api.listSkills();
    } catch (_) {
      allCatalogSkills = [];
    }
  }

  function showDropdown(matches) {
    var dropdown = document.getElementById('skill-dropdown');
    if (matches.length === 0) {
      dropdown.classList.add('hidden');
      return;
    }
    dropdown.innerHTML = matches.map(function (s) {
      return '<div class="px-md py-sm hover:bg-surface-container-low cursor-pointer text-body-sm font-label" data-id="' + s.id + '" data-name="' + escapeHtml(s.skill_name) + '">' + escapeHtml(s.skill_name) + '</div>';
    }).join('');
    dropdown.classList.remove('hidden');

    dropdown.querySelectorAll('div[data-id]').forEach(function (item) {
      item.addEventListener('click', function () {
        document.getElementById('skill-name-input').value = this.dataset.name;
        selectedSkillId = parseInt(this.dataset.id);
        dropdown.classList.add('hidden');
      });
    });
  }

  var skillInput = document.getElementById('skill-name-input');
  var skillDropdown = document.getElementById('skill-dropdown');
  var addBtn = document.getElementById('add-skill-btn');
  var levelInput = document.getElementById('skill-level-input');

  if (skillInput) {
    skillInput.addEventListener('input', function () {
      var val = this.value.trim().toLowerCase();
      selectedSkillId = null;
      if (val.length < 1) {
        skillDropdown.classList.add('hidden');
        return;
      }
      var matches = allCatalogSkills.filter(function (s) {
        return s.skill_name.toLowerCase().includes(val);
      }).slice(0, 8);
      showDropdown(matches);
    });

    skillInput.addEventListener('blur', function () {
      setTimeout(function () { skillDropdown.classList.add('hidden'); }, 200);
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', async function () {
      var skillId = selectedSkillId;
      var level = parseInt(levelInput.value) || 3;

      if (!skillId) {
        var val = skillInput.value.trim().toLowerCase();
        var match = allCatalogSkills.find(function (s) { return s.skill_name.toLowerCase() === val; });
        if (match) {
          skillId = match.id;
        } else {
          try {
            var newSkill = await api.createSkill({ skill_name: skillInput.value.trim() });
            skillId = newSkill.id;
            allCatalogSkills.push(newSkill);
          } catch (err) {
            alert(err.detail || 'Failed to create skill');
            return;
          }
        }
      }

      this.disabled = true;
      try {
        await api.addSkill({ skill_id: skillId, level: level });
        skillInput.value = '';
        selectedSkillId = null;
        levelInput.value = '5';
        await loadSkills();
      } catch (err) {
        alert(err.detail || 'Failed to add skill');
      } finally {
        this.disabled = false;
      }
    });
  }

  /* ── Logout ──────────────────────────────────────────────────────────── */
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      api.logout();
    });
  }

  /* ── Init ────────────────────────────────────────────────────────────── */
  loadProfile();
  loadSkills();
  loadSkillCatalog();
})();
