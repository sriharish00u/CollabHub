(function () {
  var page = window.location.pathname.split('/').pop() || 'dashboard.html';
  var user = null;
  try { user = JSON.parse(localStorage.getItem('ch_user')); } catch (_) {}

  var name = (user && user.name) || 'User';
  var email = (user && user.email) || '';
  var avatarUrl = (user && user.avatar_url) || 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="none" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="#c7c4d7"/><circle cx="40" cy="30" r="12" fill="#777586"/><path d="M62 58c0-12.15-9.85-22-22-22s-22 9.85-22 22" fill="#777586"/></svg>');

  var navItems = [
    { icon: 'dashboard', label: 'Dashboard', href: 'dashboard.html', id: 'dashboard' },
    { icon: 'folder_shared', label: 'Projects', href: 'feed.html', id: 'feed' },
    { icon: 'assignment_ind', label: 'Applications', href: 'applicant_review.html', id: 'applicant_review' },
    { icon: 'groups', label: 'Community', href: 'group_chat.html', id: 'group_chat' },
  ];

  var bottomItems = [
    { icon: 'settings', label: 'Settings', href: 'settings.html', id: 'settings' },
  ];

  function isActive(item) {
    return page === item.href || page === item.id + '.html';
  }

  function navLink(item) {
    var active = isActive(item);
    var cls = active
      ? 'flex items-center gap-md p-md bg-primary-container text-on-primary-container font-semibold rounded-xl transition-transform scale-95 active:scale-90'
      : 'flex items-center gap-md p-md text-on-surface-variant hover:bg-surface-variant/50 transition-transform scale-95 active:scale-90';
    return '<a class="' + cls + '" href="' + item.href + '">' +
      '<span class="material-symbols-outlined">' + item.icon + '</span>' +
      '<span class="font-body-md text-body-md">' + item.label + '</span>' +
    '</a>';
  }

  var html =
    '<aside class="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container border-r border-outline-variant p-md gap-sm z-50">' +
      '<div class="flex items-center gap-sm mb-lg">' +
        '<div class="w-10 h-10 bg-primary-container rounded-xl flex items-center justify-center">' +
          '<span class="material-symbols-outlined text-on-primary-container" style="font-variation-settings: \'FILL\' 1;">hub</span>' +
        '</div>' +
        '<div>' +
          '<h1 class="font-h5 text-h5 font-bold text-primary">CollabHub</h1>' +
          '<p class="font-label text-label text-on-surface-variant">Collaboration Network</p>' +
        '</div>' +
      '</div>' +
      '<nav class="flex flex-col gap-xs flex-grow">' +
        navItems.map(navLink).join('') +
      '</nav>' +
      '<div class="mt-auto flex flex-col gap-xs">' +
        '<a href="create_activity.html" class="bg-primary text-on-primary font-label text-label py-md px-lg rounded-xl mb-md transition-transform scale-95 active:scale-90 flex items-center justify-center">' +
          'Start Project' +
        '</a>' +
        bottomItems.map(navLink).join('') +
        '<div class="flex items-center gap-md p-md mt-xs">' +
          '<img class="w-10 h-10 rounded-full object-cover border border-outline-variant" src="' + avatarUrl + '" alt="" onerror="this.onerror=null;this.src=\'/assets/img/default-avatar.svg\'"/>' +
          '<div class="min-w-0">' +
            '<p class="font-label text-label text-on-surface truncate">' + name + '</p>' +
            '<p class="font-caption text-caption text-on-surface-variant truncate">' + email + '</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</aside>';

  document.body.insertAdjacentHTML('afterbegin', html);
  document.body.classList.add('md:ml-64');
})();
