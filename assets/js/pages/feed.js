(function () {
  if (!requireAuth()) return;

  const grid = document.getElementById('activity-grid');
  const categorySelect = document.getElementById('filter-category');
  const skillInput = document.getElementById('filter-skill');
  const applyBtn = document.getElementById('apply-filters-btn');
  const sortSelect = document.getElementById('sort-select');
  const paginationEl = document.getElementById('pagination');

  const SKILL_CHIP_CLASSES = [
    'skill-chip-1', 'skill-chip-2', 'skill-chip-3', 'skill-chip-4', 'skill-chip-5'
  ];

  let currentPage = 1;

  function skillChipClass(level) {
    const idx = Math.min(Math.max(level || 1, 1), 5) - 1;
    return SKILL_CHIP_CLASSES[idx];
  }

  function daysLeft(deadline) {
    if (!deadline) return null;
    const diff = new Date(deadline) - new Date();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
  }

  function renderCard(act) {
    const filled = act.members_count || 0;
    const total = act.max_members || 0;
    const dl = daysLeft(act.deadline);
    const deadlineText = dl === null ? 'Ongoing' : (dl === 0 ? 'Ended' : dl + ' days left');
    const deadlineUrgent = dl !== null && dl <= 3;
    const skills = act.required_skills || [];
    const applyCount = act.applications_count || 0;

    return `
      <article class="card-elevation rounded-xl overflow-hidden flex flex-col h-full relative group cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all" data-id="${act.id}">
        <div class="p-lg flex flex-col flex-grow">
          <div class="flex justify-between items-start mb-sm">
            <span class="font-label text-label px-sm py-xs bg-surface-container rounded uppercase tracking-wider text-on-secondary-container">${act.category || 'Project'}</span>
            <span class="font-caption text-caption text-on-surface-variant">${timeAgo(act.created_at)}</span>
          </div>
          <h3 class="font-h5 text-h5 mb-xs">${act.title || 'Untitled'}</h3>
          <p class="text-body-sm text-on-surface-variant line-clamp-2 mb-md">${act.description || ''}</p>
          <div class="flex items-center gap-md mb-md">
            <div class="flex items-center gap-xs">
              <span class="material-symbols-outlined text-primary text-[18px]">group</span>
              <span class="text-body-sm font-semibold">${filled}/${total} slots</span>
            </div>
            <div class="flex items-center gap-xs">
              <span class="material-symbols-outlined ${deadlineUrgent ? 'text-error' : 'text-on-surface-variant'} text-[18px]">schedule</span>
              <span class="text-body-sm font-semibold">${deadlineText}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-xs mb-lg">
            ${skills.map((s, i) => {
              const lvl = s.level || 1;
              const chipCls = skillChipClass(lvl);
              const hasCheck = lvl >= 3;
              return `<span class="${chipCls} font-label text-[10px] px-sm py-1 rounded-full flex items-center gap-1">
                ${hasCheck ? `<span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' 1;">check</span>` : ''}
                ${s.name || s.skill_name || 'Skill'}${lvl ? ' Lvl ' + lvl : ''}
              </span>`;
            }).join('')}
          </div>
          <div class="mt-auto flex items-center justify-between border-t border-outline-variant pt-md">
            <button class="apply-btn bg-primary text-white px-lg py-sm rounded font-label text-label hover:bg-primary-container transition-colors">Apply Now</button>
          </div>
        </div>
      </article>`;
  }

  function renderPagination(total, perPage) {
    const pages = Math.ceil(total / perPage);
    if (pages <= 1) { paginationEl.classList.add('hidden'); return; }
    paginationEl.classList.remove('hidden');
    let html = `
      <button class="prev-page p-sm rounded-lg border border-outline-variant hover:bg-surface-container transition-colors flex disabled:opacity-50" ${currentPage <= 1 ? 'disabled' : ''}>
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
      <div class="flex gap-xs">`;
    for (let i = 1; i <= Math.min(pages, 5); i++) {
      html += `<button class="page-btn w-10 h-10 rounded-lg ${i === currentPage ? 'bg-primary text-white font-bold' : 'border border-outline-variant hover:bg-surface-container font-medium'}">${i}</button>`;
    }
    if (pages > 5) {
      html += `<span class="flex items-center px-sm">...</span><button class="page-btn w-10 h-10 rounded-lg border border-outline-variant hover:bg-surface-container font-medium">${pages}</button>`;
    }
    html += `</div>
      <button class="next-page p-sm rounded-lg border border-outline-variant hover:bg-surface-container transition-colors flex disabled:opacity-50" ${currentPage >= pages ? 'disabled' : ''}>
        <span class="material-symbols-outlined">chevron_right</span>
      </button>`;
    paginationEl.innerHTML = html;

    paginationEl.querySelector('.prev-page').addEventListener('click', () => { if (currentPage > 1) { currentPage--; fetchActivities(); }});
    paginationEl.querySelector('.next-page').addEventListener('click', () => { if (currentPage < pages) { currentPage++; fetchActivities(); }});
    paginationEl.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => { currentPage = parseInt(btn.textContent); fetchActivities(); });
    });
  }

  async function fetchActivities() {
    const params = {};
    const cat = categorySelect.value;
    const skill = skillInput.value.trim();
    const sort = sortSelect.value;
    if (cat) params.category = cat;
    if (skill) params.skill = skill;
    if (sort) params.sort = sort;
    params.page = currentPage;

    try {
      const data = await api.listActivities(params);
      const activities = data.activities || data.items || data || [];
      const total = data.total || activities.length;
      const perPage = data.per_page || 12;

      if (activities.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-xxl text-on-surface-variant font-body-md">No activities found matching your filters.</div>`;
      } else {
        grid.innerHTML = activities.map(renderCard).join('');
      }
      renderPagination(total, perPage);
      wireInteractions();
    } catch (err) {
      grid.innerHTML = `<div class="col-span-full text-center py-xxl text-on-surface-variant font-body-md">Failed to load activities. ${err.detail || 'Please try again.'}</div>`;
    }
  }

  function wireInteractions() {
    document.querySelectorAll('.bookmark-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const icon = btn.querySelector('.material-symbols-outlined');
        const isFilled = icon.style.fontVariationSettings.includes("'FILL' 1");
        icon.style.fontVariationSettings = isFilled ? "'FILL' 0" : "'FILL' 1";
        if (!isFilled) {
          icon.classList.add('text-primary');
          icon.classList.remove('text-on-surface-variant');
        } else {
          icon.classList.remove('text-primary');
          icon.classList.add('text-on-surface-variant');
        }
      });
    });

    document.querySelectorAll('.apply-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('article');
        const actId = card.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Applying...';
        try {
          await api.applyToActivity(actId);
          btn.textContent = 'Applied';
          btn.classList.remove('bg-primary');
          btn.classList.add('bg-on-surface-variant');
        } catch (err) {
          btn.textContent = err.detail || 'Apply Failed';
          setTimeout(() => { btn.textContent = 'Apply Now'; btn.disabled = false; }, 2000);
        }
      });
    });

    document.querySelectorAll('article[data-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.apply-btn') || e.target.closest('.bookmark-btn')) return;
        window.location.href = 'activity_detail.html?id=' + card.dataset.id;
      });
    });
  }

  applyBtn.addEventListener('click', () => { currentPage = 1; fetchActivities(); });
  sortSelect.addEventListener('change', () => { currentPage = 1; fetchActivities(); });
  categorySelect.addEventListener('change', () => { currentPage = 1; fetchActivities(); });

  let skillDebounce;
  skillInput.addEventListener('input', () => {
    clearTimeout(skillDebounce);
    skillDebounce = setTimeout(() => { currentPage = 1; fetchActivities(); }, 400);
  });

  fetchActivities();
})();
