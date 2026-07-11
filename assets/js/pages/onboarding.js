(function () {
  if (!requireAuth()) return;

  var currentStep = 1;
  var selectedSkills = [];

  function showStep(step) {
    document.getElementById('step-1').classList.toggle('hidden', step !== 1);
    document.getElementById('step-2').classList.toggle('hidden', step !== 2);
    document.getElementById('step-3').classList.toggle('hidden', step !== 3);
    document.getElementById('step-num').textContent = step;
    document.getElementById('progress-bar').style.width = (step * 33) + '%';
    var labels = { 1: 'Basic Info', 2: 'Organization', 3: 'Skills' };
    document.getElementById('step-label').textContent = labels[step] || '';
    currentStep = step;
  }

  function showError(msg) {
    var el = document.getElementById('error-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideError() {
    document.getElementById('error-msg').classList.add('hidden');
  }

  // Step 1 -> 2
  document.getElementById('next-1').addEventListener('click', function () {
    hideError();
    showStep(2);
  });

  // Step 2 -> 3
  document.getElementById('next-2').addEventListener('click', function () {
    hideError();
    showStep(3);
  });

  // Back buttons
  document.getElementById('back-2').addEventListener('click', function () { showStep(1); });
  document.getElementById('back-3').addEventListener('click', function () { showStep(2); });

  // Skip or Finish
  document.getElementById('skip-3').addEventListener('click', function () { finish(); });
  document.getElementById('finish-3').addEventListener('click', function () { finish(); });

  async function finish() {
    hideError();
    try {
      var payload = {};

      var name = document.getElementById('ob-name').value.trim();
      var bio = document.getElementById('ob-bio').value.trim();
      var college = document.getElementById('ob-college').value.trim();
      var dept = document.getElementById('ob-dept').value.trim();
      var year = document.getElementById('ob-year').value;

      if (name) payload.name = name;
      if (bio) payload.bio = bio;
      if (college) payload.college = college;
      if (dept) payload.department = dept;
      if (year) payload.year = parseInt(year);

      payload.onboarding_complete = true;

      await api.updateProfile(payload);
      var user = api.getUser();
      if (user) {
        Object.assign(user, payload);
        localStorage.setItem('ch_user', JSON.stringify(user));
      }

      document.getElementById('step-3').classList.add('hidden');
      document.getElementById('success-state').classList.remove('hidden');
      document.querySelector('.mb-xl').classList.add('hidden');
    } catch (err) {
      showError(err.detail || 'Failed to save profile');
    }
  }

  // Skill search (simplified)
  var searchInput = document.getElementById('ob-skill-search');
  var suggestionsEl = document.getElementById('skill-suggestions');
  var selectedEl = document.getElementById('selected-skills');

  async function loadSkills() {
    try {
      var skills = await api.listSkills();
      window._allSkills = skills;
    } catch (_) {
      window._allSkills = [];
    }
  }

  searchInput.addEventListener('input', function () {
    var q = this.value.toLowerCase().trim();
    if (!q || q.length < 2) {
      suggestionsEl.innerHTML = '';
      return;
    }
    var matches = (window._allSkills || []).filter(function (s) {
      return s.skill_name.toLowerCase().includes(q) && selectedSkills.indexOf(s.id) === -1;
    }).slice(0, 8);

    suggestionsEl.innerHTML = matches.map(function (s) {
      return '<button class="skill-add-btn w-full text-left p-md bg-surface-container-low border border-outline-variant rounded-lg font-body-sm text-body-sm hover:bg-surface-container transition-colors" data-id="' + s.id + '" data-name="' + s.skill_name + '">' +
        s.skill_name +
        '<span class="material-symbols-outlined text-[16px] float-right">add</span>' +
      '</button>';
    }).join('');

    suggestionsEl.querySelectorAll('.skill-add-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(this.dataset.id);
        var name = this.dataset.name;
        if (selectedSkills.indexOf(id) === -1) {
          selectedSkills.push(id);
          renderSelected();
        }
        searchInput.value = '';
        suggestionsEl.innerHTML = '';
      });
    });
  });

  function renderSelected() {
    selectedEl.innerHTML = selectedSkills.map(function (id) {
      var skill = (window._allSkills || []).find(function (s) { return s.id === id; });
      var name = skill ? skill.skill_name : 'Skill';
      return '<span class="inline-flex items-center gap-xs px-md py-xs bg-primary/10 text-primary rounded-full font-body-sm text-[12px] border border-primary/20">' +
        name +
        '<button class="skill-remove material-symbols-outlined text-[14px] cursor-pointer" data-id="' + id + '">close</button>' +
      '</span>';
    }).join('');

    selectedEl.querySelectorAll('.skill-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(this.dataset.id);
        selectedSkills = selectedSkills.filter(function (s) { return s !== id; });
        renderSelected();
      });
    });
  }

  loadSkills();
})();
