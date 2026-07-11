(function () {
  if (!requireNoAuth()) return;
  var form = document.getElementById('registration-form');
  var errorMsg = document.getElementById('error-msg');
  var registerBtn = document.getElementById('register-btn');

  var securityQuestions = {
    pet: "What is your pet's name?",
    city: "What city were you born in?",
    food: "What is your favorite food?",
    teacher: "What was your favorite teacher's name?",
    book: "What is your favorite book?"
  };

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorMsg.classList.add('hidden');

    var email = document.getElementById('reg-email').value.trim();
    var password = document.getElementById('reg-password').value;
    var confirm = document.getElementById('reg-confirm').value;
    var sq = document.getElementById('reg-security-q').value;
    var sa = document.getElementById('reg-security-a').value.trim();

    if (password !== confirm) {
      errorMsg.textContent = 'Passwords do not match';
      errorMsg.classList.remove('hidden');
      return;
    }
    if (!sq) {
      errorMsg.textContent = 'Please select a security question';
      errorMsg.classList.remove('hidden');
      return;
    }
    if (!sa) {
      errorMsg.textContent = 'Please provide a security answer';
      errorMsg.classList.remove('hidden');
      return;
    }

    registerBtn.disabled = true;
    registerBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Creating account...';
    try {
      var data = await api.register({
        name: email.split('@')[0],
        email: email,
        password: password,
        security_question: securityQuestions[sq] || sq,
        security_answer: sa,
      });
      api.saveSession(data.access_token, data.user);
      window.location.href = 'onboarding.html';
    } catch (err) {
      errorMsg.textContent = err.detail || 'Registration failed';
      errorMsg.classList.remove('hidden');
      registerBtn.disabled = false;
      registerBtn.innerHTML = 'Create Account <span class="material-symbols-outlined">arrow_forward</span>';
    }
  });
})();
