(function () {
  requireAuth();
  let activityId = sessionStorage.getItem('ch_activity_id');
  if (!activityId) {
    const stored = sessionStorage.getItem('ch_pending_activity');
    if (stored) {
      const data = JSON.parse(stored);
      api.createActivity(data).then(res => {
        activityId = res.id || res.activity_id;
        sessionStorage.setItem('ch_activity_id', activityId);
      }).catch(() => {});
    }
  }

  const btnContinue = document.getElementById('btn-continue');
  const btnBack = document.getElementById('btn-back');

  function getSkillsData() {
    const skills = [];
    document.querySelectorAll('#skills-list > div').forEach(row => {
      const skillName = row.querySelector('.skill-select')?.value;
      const level = row.querySelector('.dot-selector')?.getAttribute('data-value');
      if (skillName) skills.push({ name: skillName, level: parseInt(level || '3') });
    });
    return skills;
  }

  if (btnContinue) {
    btnContinue.addEventListener('click', async () => {
      const skills = getSkillsData();
      sessionStorage.setItem('ch_activity_skills', JSON.stringify(skills));

      if (activityId) {
        btnContinue.disabled = true;
        btnContinue.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Saving...';
        try {
          await api.updateActivity(activityId, { skills });
          sessionStorage.removeItem('ch_activity_id');
          sessionStorage.removeItem('ch_activity_skills');
          window.location.href = 'dashboard.html';
        } catch (err) {
          alert(err.detail || 'Failed to update skills');
          btnContinue.disabled = false;
          btnContinue.innerText = 'Continue';
        }
      } else {
        window.location.href = 'dashboard.html';
      }
    });
  }

  if (btnBack) {
    btnBack.addEventListener('click', () => {
      const skills = getSkillsData();
      sessionStorage.setItem('ch_activity_skills', JSON.stringify(skills));
      window.location.href = 'create_activity.html';
    });
  }

  const skillSuggestions = ["React", "Python", "UI Design", "Rust", "Solidity", "Machine Learning", "Figma", "Data Analysis", "Academic Writing"];

  function addSkillRow() {
    const container = document.getElementById('skills-list');
    const rowId = Date.now();
    const div = document.createElement('div');
    div.className = "flex flex-col md:flex-row gap-md p-md bg-white border border-outline-variant rounded-lg items-center animate-in slide-in-from-left duration-200";
    div.id = `skill-row-${rowId}`;
    div.innerHTML = `
      <div class="flex-1 w-full">
        <select class="skill-select w-full px-md py-xs border border-outline-variant rounded-lg outline-none" onchange="updateSkillPreview()">
          <option value="">Select a skill...</option>
          ${skillSuggestions.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div class="flex items-center gap-sm">
        <span class="font-label text-label text-on-surface-variant">Min Level:</span>
        <div class="flex gap-xs dot-selector" data-value="3">
          ${[1, 2, 3, 4, 5].map(i => `
            <div onclick="setDotLevel(this, ${i})" class="skill-dot cursor-pointer transition-all ${i <= 3 ? 'dot-active' : 'dot-inactive'}"></div>
          `).join('')}
        </div>
      </div>
      <button onclick="removeSkillRow(${rowId})" class="text-error hover:bg-error-container p-xs rounded-full transition-colors">
        <span class="material-symbols-outlined text-sm">delete</span>
      </button>
    `;
    container.appendChild(div);
    updateSkillPreview();
  }

  window.setDotLevel = (el, level) => {
    const parent = el.closest('.dot-selector');
    parent.setAttribute('data-value', level);
    const dots = parent.querySelectorAll('.skill-dot');
    dots.forEach((dot, idx) => {
      if (idx < level) {
        dot.classList.add('dot-active');
        dot.classList.remove('dot-inactive');
      } else {
        dot.classList.add('dot-inactive');
        dot.classList.remove('dot-active');
      }
    });
    updateSkillPreview();
  };

  window.removeSkillRow = (id) => {
    document.getElementById(`skill-row-${id}`).remove();
    updateSkillPreview();
  };

  window.updateSkillPreview = () => {
    const previewSkills = document.getElementById('preview-skills');
    if (!previewSkills) return;
    previewSkills.innerHTML = '';
    document.querySelectorAll('#skills-list > div').forEach(row => {
      const skillName = row.querySelector('.skill-select')?.value;
      const level = row.querySelector('.dot-selector')?.getAttribute('data-value');
      if (skillName) {
        const chip = document.createElement('div');
        chip.className = 'flex items-center gap-xs px-sm py-xs rounded-full font-label text-label';
        chip.style.backgroundColor = level >= 4 ? 'var(--tw-color-primary)' : `rgba(42, 20, 180, 0.${level * 2})`;
        chip.style.color = level >= 4 ? '#ffffff' : 'var(--tw-color-primary)';
        chip.innerHTML = `
          <span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1;">verified</span>
          ${skillName} L${level}
        `;
        previewSkills.appendChild(chip);
      }
    });
  };

  addSkillRow();
})();
