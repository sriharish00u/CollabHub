(function () {
  var verifyForm = document.getElementById('verify-form');
  var resetForm = document.getElementById('reset-form');
  var verifyError = document.getElementById('verify-error');
  var resetError = document.getElementById('reset-error');
  var verifyBtn = document.getElementById('verify-btn');
  var resetBtn = document.getElementById('reset-btn');

  var verifiedEmail = '';
  var verifiedAnswer = '';

  function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  verifyForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    verifyError.classList.add('hidden');
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Verifying...';

    var email = document.getElementById('fp-email').value.trim();
    var answer = document.getElementById('fp-answer').value.trim();

    try {
      await api.forgotPasswordVerify({ email: email, security_answer: answer });
      verifiedEmail = email;
      verifiedAnswer = answer;
      document.getElementById('verify-stage').classList.add('hidden');
      document.getElementById('reset-stage').classList.remove('hidden');
    } catch (err) {
      showError(verifyError, err.detail || 'Verification failed');
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = 'Verify <span class="material-symbols-outlined">arrow_forward</span>';
    }
  });

  resetForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    resetError.classList.add('hidden');
    resetBtn.disabled = true;
    resetBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Resetting...';

    var newPass = document.getElementById('fp-new').value;
    var confirmPass = document.getElementById('fp-confirm').value;

    if (newPass !== confirmPass) {
      showError(resetError, 'Passwords do not match');
      resetBtn.disabled = false;
      resetBtn.innerHTML = 'Reset Password <span class="material-symbols-outlined">check</span>';
      return;
    }

    try {
      await api.forgotPasswordReset({
        email: verifiedEmail,
        security_answer: verifiedAnswer,
        new_password: newPass,
      });
      document.getElementById('reset-stage').classList.add('hidden');
      document.getElementById('success-state').classList.remove('hidden');
    } catch (err) {
      showError(resetError, err.detail || 'Reset failed');
    } finally {
      resetBtn.disabled = false;
      resetBtn.innerHTML = 'Reset Password <span class="material-symbols-outlined">check</span>';
    }
  });
})();
