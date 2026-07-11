(function () {
  requireNoAuth();
  const form = document.getElementById('login-form');
  const errorMsg = document.getElementById('error-msg');
  const loginBtn = document.getElementById('login-btn');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorMsg.classList.add('hidden');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    try {
      const data = await api.login({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
      });
      api.saveSession(data.access_token, data.user);
      window.location.href = 'dashboard.html';
    } catch (err) {
      errorMsg.textContent = err.detail || 'Login failed';
      errorMsg.classList.remove('hidden');
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Log In <span class="material-symbols-outlined text-[18px]">arrow_forward</span>';
    }
  });
})();
