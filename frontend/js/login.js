const params = new URLSearchParams(window.location.search);
const portal = (params.get('portal') || 'student').toLowerCase();
const portalNames = {
  system_admin: 'Account Administrator',
  student: 'Student',
  president: 'Club President',
  faculty_coordinator: 'Faculty Coordinator',
  club_coordinator: 'Club Coordinator',
  venue_admin: 'Venue Administrator',
  director: 'Director',
  faculty_mentor: 'Mentor'
};
const intro = document.getElementById('portalIntro');
const errorEl = document.getElementById('error');
const expectedPortalName = portalNames[portal];

if (!expectedPortalName) {
  errorEl.textContent = 'This portal is not recognized. Return to the portal page and choose your role.';
  document.querySelector('#loginForm button[type="submit"]').disabled = true;
} else if (intro) {
  intro.textContent = `Sign in to the ${expectedPortalName} portal using your existing account.`;
}

document.querySelector('.auth-card h2').textContent = expectedPortalName ? `Welcome, ${expectedPortalName}` : 'Welcome back';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!expectedPortalName) return;
  const btn = e.currentTarget.querySelector('button');
  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: {
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        portal
      }
    });
    const role = String(data.user.role || '').toLowerCase();
    if (role !== portal && !(portal === 'president' && ['student','vice_president'].includes(role) && data.user.portalAccess === true)) {
      const actualPortal = portalNames[role] || 'another role';
      throw new Error(`This account is assigned to ${actualPortal}. Please return to the home page and choose the matching portal.`);
    }
    localStorage.setItem('cms_token', data.token);
    localStorage.setItem('cms_user', JSON.stringify(data.user));
    window.location.href = '/pages/dashboard.html';
  } catch (err) {
    errorEl.textContent = err.message || 'Unable to sign in. Please check your details and try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});

// Keep password entry private by default, with an explicit show/hide control.
const loginPassword = document.getElementById('password');
if (loginPassword && !document.getElementById('toggleLoginPassword')) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'toggleLoginPassword';
  toggle.className = 'secondary';
  toggle.textContent = 'Show password';
  toggle.style.marginTop = '6px';
  toggle.addEventListener('click', () => {
    const visible = loginPassword.type === 'text';
    loginPassword.type = visible ? 'password' : 'text';
    toggle.textContent = visible ? 'Show password' : 'Hide password';
  });
  loginPassword.insertAdjacentElement('afterend', toggle);
}
