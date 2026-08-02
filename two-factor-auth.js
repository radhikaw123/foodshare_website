document.addEventListener('DOMContentLoaded', () => {
  const setupWizard = document.getElementById('setup-wizard');
  const enabledView = document.getElementById('enabled-view');
  const steps = document.querySelectorAll('.step');
  const panels = document.querySelectorAll('.step-panel');

  let currentStep = 1;
  let setupComplete = false;

  function getAuthHeaders() {
    const sessionToken = localStorage.getItem('session_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken || ''}`
    };
  }

  function goToStep(step) {
    currentStep = step;
    panels.forEach(panel => panel.classList.remove('active'));
    document.getElementById(`step-${step}`)?.classList.add('active');

    steps.forEach(s => {
      const num = parseInt(s.dataset.step, 10);
      s.classList.remove('active', 'completed');
      if (num < step) s.classList.add('completed');
      if (num === step) s.classList.add('active');
    });
  }

  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  }

  function hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = 'none';
  }

  async function checkStatus() {
    try {
      const res = await fetch('/api/2fa/status', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      const data = await res.json();

      if (data.success && data.enabled) {
        setupWizard.style.display = 'none';
        enabledView.style.display = 'block';
      }
    } catch (err) {
      console.error('Failed to check 2FA status:', err);
    }
  }

  async function startSetup() {
    hideError('setup-error');
    document.getElementById('qr-loading').style.display = 'block';
    document.getElementById('qr-content').style.display = 'none';

    goToStep(2);

    try {
      const res = await fetch('/api/2fa/setup', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      const data = await res.json();

      if (!data.success) {
        showError('setup-error', data.message || 'Failed to generate QR code');
        goToStep(1);
        return;
      }

      document.getElementById('qr-image').src = data.qrCode;
      document.getElementById('secret-key').textContent = data.secret;
      document.getElementById('qr-loading').style.display = 'none';
      document.getElementById('qr-content').style.display = 'block';
      setupComplete = true;
    } catch (err) {
      showError('setup-error', 'Network error. Please try again.');
      goToStep(1);
    }
  }

  async function verifyCode() {
    hideError('verify-error');
    const code = document.getElementById('verify-code').value.trim();

    if (!/^\d{6}$/.test(code)) {
      showError('verify-error', 'Please enter a valid 6-digit code');
      return;
    }

    const btn = document.getElementById('verify-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
      const res = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ code })
      });
      const data = await res.json();

      if (!data.success) {
        showError('verify-error', data.message || 'Verification failed');
        btn.disabled = false;
        btn.textContent = 'Verify & Enable';
        return;
      }

      goToStep(4);
    } catch (err) {
      showError('verify-error', 'Network error. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Verify & Enable';
    }
  }

  async function disable2FA() {
    hideError('disable-error');
    const code = document.getElementById('disable-code').value.trim();

    if (!/^\d{6}$/.test(code)) {
      showError('disable-error', 'Please enter a valid 6-digit code');
      return;
    }

    const btn = document.getElementById('disable-btn');
    btn.disabled = true;
    btn.textContent = 'Disabling...';

    try {
      const res = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ code })
      });
      const data = await res.json();

      if (!data.success) {
        showError('disable-error', data.message || 'Failed to disable 2FA');
        btn.disabled = false;
        btn.textContent = 'Disable 2FA';
        return;
      }

      enabledView.style.display = 'none';
      setupWizard.style.display = 'block';
      goToStep(1);
      setupComplete = false;
    } catch (err) {
      showError('disable-error', 'Network error. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Disable 2FA';
    }
  }

  document.getElementById('start-setup-btn')?.addEventListener('click', startSetup);

  document.querySelectorAll('[data-go-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.dataset.goStep, 10);
      if (step === 3 && !setupComplete) {
        showError('setup-error', 'Please wait for the QR code to load');
        return;
      }
      hideError('setup-error');
      hideError('verify-error');
      goToStep(step);
    });
  });

  document.getElementById('verify-btn')?.addEventListener('click', verifyCode);

  document.getElementById('verify-code')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyCode();
  });

  document.getElementById('disable-btn')?.addEventListener('click', disable2FA);

  document.getElementById('disable-code')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') disable2FA();
  });

  document.getElementById('copy-secret-btn')?.addEventListener('click', () => {
    const secret = document.getElementById('secret-key').textContent;
    navigator.clipboard.writeText(secret).then(() => {
      const btn = document.getElementById('copy-secret-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });

  document.querySelectorAll('.code-input-group input').forEach(input => {
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
  });

  checkStatus();
});
