(function () {
  requireAuth();
  var currentStep = 1;
  var totalSteps = 3;

  var btnContinue = document.getElementById('btn-continue');
  var btnBack = document.getElementById('btn-back');
  var progressBar = document.getElementById('progress-bar');
  var currentStepNum = document.getElementById('current-step-num');

  var inputTitle = document.getElementById('input-title');
  var inputCategory = document.getElementById('input-category');
  var inputMode = document.getElementById('input-mode');
  var inputMembers = document.getElementById('input-members');
  var inputDeadline = document.getElementById('input-deadline');
  var inputDescription = document.getElementById('input-description');

  var previewTitle = document.getElementById('preview-title');
  var previewCategory = document.getElementById('preview-category');
  var previewDesc = document.getElementById('preview-desc');
  var previewMembers = document.getElementById('preview-members');
  var previewDeadline = document.getElementById('preview-deadline');
  var previewSkills = document.getElementById('preview-skills');

  var skills = [];
  var skillInput = document.getElementById('skill-input');
  var skillChips = document.getElementById('skill-chips');

  var updatePreview = function () {
    previewTitle.innerText = inputTitle.value || 'Untitled Project';
    previewCategory.innerText = inputCategory.value.toUpperCase();
    previewDesc.innerText = inputDescription.value || 'Enter a description to see how it looks here.';
    previewMembers.innerText = '0/' + (inputMembers.value || 0) + ' Members';
    previewDeadline.innerText = inputDeadline.value ? 'Deadline: ' + inputDeadline.value : 'No deadline set';
  };

  [inputTitle, inputCategory, inputMembers, inputDeadline, inputDescription].forEach(function (el) {
    el.addEventListener('input', updatePreview);
  });

  function renderSkillChips() {
    skillChips.innerHTML = '';
    skills.forEach(function (s, idx) {
      var chip = document.createElement('div');
      chip.className = 'inline-flex items-center gap-sm px-md py-xs rounded-full border border-outline-variant bg-surface-container-low';
      var dotsHtml = '';
      for (var i = 1; i <= 5; i++) {
        dotsHtml += '<span class="skill-dot cursor-pointer w-2.5 h-2.5 rounded-full transition-colors ' + (i <= s.level ? 'bg-primary' : 'bg-outline-variant') + '" data-skill-idx="' + idx + '" data-level="' + i + '"></span>';
      }
      chip.innerHTML =
        '<span class="font-label text-label text-on-surface">' + s.name + '</span>' +
        '<span class="flex gap-0.5">' + dotsHtml + '</span>' +
        '<button class="skill-remove text-on-surface-variant hover:text-error transition-colors" data-skill-idx="' + idx + '">' +
          '<span class="material-symbols-outlined text-[14px]">close</span>' +
        '</button>';
      skillChips.appendChild(chip);
    });

    skillChips.querySelectorAll('.skill-dot').forEach(function (dot) {
      dot.addEventListener('click', function () {
        var idx = parseInt(this.dataset.skillIdx);
        var level = parseInt(this.dataset.level);
        skills[idx].level = level;
        renderSkillChips();
        renderPreviewSkills();
      });
    });

    skillChips.querySelectorAll('.skill-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.dataset.skillIdx);
        skills.splice(idx, 1);
        renderSkillChips();
        renderPreviewSkills();
      });
    });

    renderPreviewSkills();
  }

  function renderPreviewSkills() {
    previewSkills.innerHTML = '';
    skills.forEach(function (s) {
      var chip = document.createElement('div');
      chip.className = 'flex items-center gap-xs px-sm py-xs rounded-full font-label text-label';
      chip.style.backgroundColor = s.level >= 4 ? 'var(--tw-color-primary)' : 'rgba(42, 20, 180, ' + (s.level * 0.2) + ')';
      chip.style.color = s.level >= 4 ? '#ffffff' : 'var(--tw-color-primary)';
      chip.innerHTML =
        '<span class="material-symbols-outlined text-[12px]" style="font-variation-settings: \'FILL\' 1;">verified</span>' +
        s.name + ' L' + s.level;
      previewSkills.appendChild(chip);
    });
  }

  skillInput.addEventListener('keydown', function (e) {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      var val = skillInput.value.replace(/,/g, '').trim();
      if (val && !skills.some(function (s) { return s.name.toLowerCase() === val.toLowerCase(); })) {
        skills.push({ name: val, level: 3 });
        renderSkillChips();
      }
      skillInput.value = '';
    }
  });

  function navigateToStep(step) {
    for (var i = 1; i <= totalSteps; i++) {
      var el = document.getElementById('step-' + i);
      el.classList.add('hidden', 'opacity-0', 'translate-x-12');
      el.classList.remove('opacity-100', 'translate-x-0');
    }
    var currentEl = document.getElementById('step-' + step);
    currentEl.classList.remove('hidden');
    setTimeout(function () {
      currentEl.classList.remove('opacity-0', 'translate-x-12');
      currentEl.classList.add('opacity-100', 'translate-x-0');
    }, 10);
    currentStep = step;
    currentStepNum.innerText = currentStep;
    progressBar.style.width = (currentStep / totalSteps * 100) + '%';
    btnBack.classList.toggle('opacity-50', currentStep === 1);
    btnBack.classList.toggle('cursor-not-allowed', currentStep === 1);
    btnContinue.innerText = currentStep === totalSteps ? 'Post Activity' : 'Continue';
  }

  btnContinue.addEventListener('click', async function () {
    if (currentStep < totalSteps) {
      navigateToStep(currentStep + 1);
    } else {
      btnContinue.disabled = true;
      btnContinue.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Creating...';

      try {
        var resolvedSkills = [];
        if (skills.length > 0) {
          var catalog = await api.listSkills().catch(function () { return []; });
          for (var i = 0; i < skills.length; i++) {
            var s = skills[i];
            var match = catalog.find(function (c) { return c.skill_name.toLowerCase() === s.name.toLowerCase(); });
            if (!match) {
              var created = await api.createSkill({ skill_name: s.name }).catch(function () { return null; });
              match = created;
            }
            if (match) {
              resolvedSkills.push({ skill_id: match.id || match.skill_id, required_level: s.level });
            }
          }
        }

        await api.createActivity({
          title: inputTitle.value,
          description: inputDescription.value,
          category: inputCategory.value,
          mode: inputMode.value,
          max_members: parseInt(inputMembers.value),
          deadline: inputDeadline.value,
          skills: resolvedSkills,
        });
        window.location.href = 'dashboard.html';
      } catch (err) {
        alert(err.detail || 'Failed to create activity');
        btnContinue.disabled = false;
        btnContinue.innerText = 'Post Activity';
      }
    }
  });

  btnBack.addEventListener('click', function () {
    if (currentStep > 1) navigateToStep(currentStep - 1);
  });
})();
