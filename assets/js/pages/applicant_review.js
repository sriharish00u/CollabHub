(function () {
  if (!requireAuth()) return;

  var params = new URLSearchParams(window.location.search);
  var actId = params.get('actId');
  if (!actId) { window.location.href = 'feed.html'; return; }

  var listEl = document.getElementById('applicant-list');
  var emptyEl = document.getElementById('empty-state');
  var titleEl = document.getElementById('activity-title');
  var countEl = document.getElementById('applicant-count');
  var searchInput = document.getElementById('search-input');
  var resetBtn = document.getElementById('reset-btn');

  var allApplicants = [];
  var currentFilter = 'all';

  function statusBadge(status) {
    var map = {
      Pending: '<span class="mt-xs px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label text-[10px] w-fit">PENDING</span>',
      Approved: '<span class="mt-xs px-2 py-0.5 rounded bg-primary text-white font-label text-[10px] w-fit">APPROVED</span>',
      Rejected: '<span class="mt-xs px-2 py-0.5 rounded bg-error text-white font-label text-[10px] w-fit">REJECTED</span>',
    };
    return map[status] || map.Pending;
  }

  function actionButtons(jr, status) {
    if (status === 'Approved') {
      return '<button class="w-full py-2.5 border border-outline text-outline rounded-lg font-label text-label cursor-not-allowed" disabled>Already Approved</button>';
    }
    if (status === 'Rejected') {
      return '<button class="w-full py-2.5 border border-outline text-outline rounded-lg font-label text-label cursor-not-allowed" disabled>Rejected</button>';
    }
    return '<button class="approve-btn w-full py-2.5 bg-primary text-white rounded-lg font-label text-label hover:bg-primary-container transition-colors active:scale-95 shadow-sm" data-jrid="' + jr.id + '">Approve</button>' +
      '<button class="reject-btn w-full py-2.5 border border-error text-error rounded-lg font-label text-label hover:bg-error-container transition-colors active:scale-95" data-jrid="' + jr.id + '">Reject</button>';
  }

  function renderCard(jr) {
    var status = jr.status || 'Pending';
    var initials = (jr.user_name || 'U').split(' ').map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();

    return '<article class="bg-white border border-outline-variant rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 group">' +
      '<div class="p-lg flex flex-col lg:flex-row gap-lg">' +
      '<div class="flex items-center gap-lg lg:w-1/3">' +
      '<div class="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-h5 text-h5 flex-shrink-0">' + initials + '</div>' +
      '<div class="flex flex-col">' +
      '<h3 class="font-h5 text-h5 text-on-surface">' + escapeHtml(jr.user_name || 'Unknown') + '</h3>' +
      '<p class="font-body-sm text-on-surface-variant">' + escapeHtml(jr.user_email || '') + '</p>' +
      statusBadge(status) +
      '</div>' +
      '</div>' +
      '<div class="flex-1 flex flex-col justify-center">' +
      '<p class="font-caption text-caption text-on-surface-variant">Applied ' + (jr.created_at ? new Date(jr.created_at).toLocaleDateString() : '') + '</p>' +
      '</div>' +
      '<div class="flex lg:flex-col items-center justify-center gap-sm lg:w-48">' +
      actionButtons(jr, status) +
      '</div>' +
      '</div>' +
      '</article>';
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function render() {
    var search = searchInput.value.toLowerCase();
    var filtered = allApplicants.filter(function (jr) {
      var name = (jr.user_name || '').toLowerCase();
      var email = (jr.user_email || '').toLowerCase();
      if (search && !name.includes(search) && !email.includes(search)) return false;
      if (currentFilter !== 'all' && jr.status !== currentFilter) return false;
      return true;
    });

    listEl.innerHTML = filtered.map(renderCard).join('');

    if (filtered.length === 0) {
      listEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
    } else {
      listEl.classList.remove('hidden');
      emptyEl.classList.add('hidden');
    }

    countEl.textContent = filtered.length + ' Applicant' + (filtered.length !== 1 ? 's' : '');

    bindActions();
  }

  function bindActions() {
    listEl.querySelectorAll('.approve-btn').forEach(function (btn) {
      btn.onclick = async function () {
        var jrId = this.dataset.jrid;
        this.disabled = true;
        this.textContent = 'Approving...';
        try {
          await api.processJoinRequest(actId, jrId, { status: 'Approved' });
          var jr = allApplicants.find(function (j) { return j.id == jrId; });
          if (jr) jr.status = 'Approved';
          render();
        } catch (err) {
          alert(err.detail || 'Failed to approve');
          this.disabled = false;
          this.textContent = 'Approve';
        }
      };
    });

    listEl.querySelectorAll('.reject-btn').forEach(function (btn) {
      btn.onclick = async function () {
        var jrId = this.dataset.jrid;
        this.disabled = true;
        this.textContent = 'Rejecting...';
        try {
          await api.processJoinRequest(actId, jrId, { status: 'Rejected' });
          var jr = allApplicants.find(function (j) { return j.id == jrId; });
          if (jr) jr.status = 'Rejected';
          render();
        } catch (err) {
          alert(err.detail || 'Failed to reject');
          this.disabled = false;
          this.textContent = 'Reject';
        }
      };
    });
  }

  resetBtn.addEventListener('click', function () {
    searchInput.value = '';
    currentFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(function (b) {
      b.classList.remove('bg-primary', 'text-white');
      b.classList.add('bg-surface-container-high', 'text-on-surface-variant');
    });
    var allBtn = document.querySelector('.filter-btn[data-filter="all"]');
    if (allBtn) {
      allBtn.classList.add('bg-primary', 'text-white');
      allBtn.classList.remove('bg-surface-container-high', 'text-on-surface-variant');
    }
    render();
  });

  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentFilter = this.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(function (b) {
        b.classList.remove('bg-primary', 'text-white');
        b.classList.add('bg-surface-container-high', 'text-on-surface-variant');
      });
      this.classList.add('bg-primary', 'text-white');
      this.classList.remove('bg-surface-container-high', 'text-on-surface-variant');
      render();
    });
  });

  searchInput.addEventListener('input', render);

  async function init() {
    try {
      var data = await api.getActivity(actId);
      titleEl.textContent = data.title || '';
      document.title = 'Applicant Review: ' + (data.title || '') + ' | CollabHub';
    } catch (_) {}

    try {
      allApplicants = await api.listApplicants(actId);
      if (!Array.isArray(allApplicants)) allApplicants = [];
    } catch (err) {
      allApplicants = [];
    }
    render();
  }

  init();
})();
