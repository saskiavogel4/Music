/* =========================================================
   Riff — email + password accounts via Supabase Auth.
   Shows the login screen until there is a session, then hands
   the signed-in user to the studio (window.Riff.start).
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const screen = $('#auth');
  const cfg = window.RIFF_CONFIG || {};
  const redirectTo = location.origin + location.pathname;

  const COPY = {
    signin: { title: 'Welcome back.', lead: 'Log in to your studio.', submit: 'Log in', pass: 'Password', ac: 'current-password' },
    signup: { title: 'Make your first hit.', lead: 'Create a free Riff account with your email.', submit: 'Create account', pass: 'Choose a password', ac: 'new-password' },
    forgot: { title: 'Forgot your password?', lead: 'Enter your email and we’ll send you a link to set a new one.', submit: 'Send reset link' },
    reset: { title: 'Choose a new password.', lead: 'Almost there. Pick a new password for your account.', submit: 'Save password', pass: 'New password', ac: 'new-password' },
    sent: { title: 'Check your inbox.', lead: '' },
  };

  const ERRORS = {
    invalid_credentials: 'That email and password don’t match. Try again or reset your password.',
    user_already_exists: 'You already have an account with this email. Log in instead.',
    email_exists: 'You already have an account with this email. Log in instead.',
    weak_password: 'Please choose a stronger password (at least 8 characters, mixing letters and numbers).',
    same_password: 'Your new password must be different from the old one.',
    over_email_send_rate_limit: 'Too many emails were sent recently. Please wait a few minutes and try again.',
    over_request_rate_limit: 'Too many attempts. Please wait a minute and try again.',
    email_address_invalid: 'That email address doesn’t look right.',
    signup_disabled: 'New sign-ups are currently turned off.',
    otp_expired: 'That link has expired. Request a new one below.',
  };

  let view = 'signin';
  let lastEmail = '';
  let lastSent = null; // 'signup' | 'recovery'
  let recovering = /(^|[#&?])type=recovery/.test(location.hash + location.search);

  // ---------- view helpers ----------
  function setView(v, keepMessages = false) {
    view = v;
    screen.dataset.view = v;
    const c = COPY[v];
    $$('[data-show]', screen).forEach((el) => { el.hidden = !el.dataset.show.split(' ').includes(v); });
    $('#auth-title').textContent = c.title;
    $('#auth-lead').textContent = c.lead;
    $('#auth-lead').hidden = !c.lead;
    if (c.submit) $('#auth-submit .btn-label').textContent = c.submit;
    if (c.pass) {
      $('#auth-pass-label').textContent = c.pass;
      $('#auth-pass').autocomplete = c.ac;
    }
    $$('.auth-tabs button', screen).forEach((b) => {
      const on = b.dataset.go === v;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
    });
    if (!keepMessages) { message('error', ''); message('ok', ''); }
    const first = $$('input', screen).find((i) => !i.closest('[hidden]') && !i.value);
    (first || $('#auth-submit')).focus?.();
  }

  function message(kind, text) {
    const el = $(kind === 'error' ? '#auth-error' : '#auth-ok');
    el.textContent = text;
    el.hidden = !text;
  }

  function showScreen(v = 'signin') {
    screen.hidden = false;
    setView(v);
  }

  function busy(btn, on) {
    btn.disabled = on;
    btn.classList.toggle('loading', on);
  }

  function friendly(error) {
    if (!error) return '';
    if (error.code && ERRORS[error.code]) return ERRORS[error.code];
    if (/fetch|network/i.test(error.message || '')) return 'Couldn’t reach the sign-in service. Check your connection.';
    return error.message || 'Something went wrong. Please try again.';
  }

  function showSent(kind, email) {
    lastSent = kind;
    lastEmail = email;
    setView('sent');
    $('#auth-sent-text').innerHTML = '';
    const b = document.createElement('b');
    b.textContent = email;
    const parts = kind === 'recovery'
      ? ['If there’s an account for ', b, ', a password reset link is on its way. Open it on this device to choose a new password.']
      : ['We sent a confirmation link to ', b, '. Click it to activate your account. It brings you straight back here.'];
    parts.forEach((p) => $('#auth-sent-text').append(p));
  }

  // ---------- bail out gracefully if Supabase failed to load ----------
  if (!window.supabase?.createClient || !cfg.supabaseUrl || !cfg.supabaseKey) {
    showScreen('signin');
    message('error', 'Sign-in couldn’t load. Check your connection and refresh the page.');
    $('#auth-submit').disabled = true;
    return;
  }

  // Errors Supabase passes back on the redirect (e.g. an expired email link).
  const urlParams = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
  const urlError = urlParams.get('error_code') ? (ERRORS[urlParams.get('error_code')] || urlParams.get('error_description')) : '';

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
  });

  function cleanUrl() {
    if (location.href.includes('#') || location.search) history.replaceState(null, '', location.pathname);
  }

  function onAuth(event, session) {
    if (event === 'PASSWORD_RECOVERY') recovering = true;
    if (recovering && session) {
      window.Riff.stop();
      cleanUrl();
      showScreen('reset');
      return;
    }
    if (session?.user) {
      screen.hidden = true;
      cleanUrl();
      window.Riff.start(session.user);
      return;
    }
    // Signed out (or no session yet).
    window.Riff.stop();
    if (screen.hidden || view === 'reset') showScreen('signin');
    if (urlError && event === 'INITIAL_SESSION') {
      message('error', urlError);
      cleanUrl();
    }
  }

  // Run handlers outside the auth callback; calling Supabase inside it can deadlock.
  sb.auth.onAuthStateChange((event, session) => setTimeout(() => onAuth(event, session), 0));

  // ---------- form ----------
  $$('[data-go]', screen).forEach((b) => b.addEventListener('click', () => setView(b.dataset.go)));

  $('#auth-toggle').addEventListener('click', () => {
    const i = $('#auth-pass');
    i.type = i.type === 'password' ? 'text' : 'password';
  });

  $('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#auth-submit');
    const email = $('#auth-email').value.trim();
    const password = $('#auth-pass').value;
    message('error', ''); message('ok', '');

    if (view !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { message('error', 'Enter a valid email address.'); $('#auth-email').focus(); return; }
    if ((view === 'signup' || view === 'reset') && password.length < 8) { message('error', 'Use at least 8 characters for your password.'); $('#auth-pass').focus(); return; }
    if (view === 'signin' && !password) { message('error', 'Enter your password.'); $('#auth-pass').focus(); return; }

    busy(btn, true);
    try {
      if (view === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error?.code === 'email_not_confirmed') {
          showSent('signup', email);
          message('error', 'Please confirm your email first. Check your inbox, or resend the link.');
        } else if (error) message('error', friendly(error));
      } else if (view === 'signup') {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
        if (error) message('error', friendly(error));
        else if (data.session) { /* email confirmation is off: onAuthStateChange signs them in */ }
        else if (data.user && data.user.identities?.length === 0) message('error', ERRORS.user_already_exists);
        else showSent('signup', email);
      } else if (view === 'forgot') {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) message('error', friendly(error));
        else showSent('recovery', email);
      } else if (view === 'reset') {
        const { data, error } = await sb.auth.updateUser({ password });
        if (error) message('error', friendly(error));
        else {
          recovering = false;
          $('#auth-pass').value = '';
          screen.hidden = true;
          window.Riff.start(data.user);
        }
      }
    } catch (err) {
      message('error', friendly(err));
    } finally {
      busy(btn, false);
    }
  });

  let resendTimer;
  $('#auth-resend').addEventListener('click', async () => {
    const btn = $('#auth-resend');
    busy(btn, true);
    const { error } = lastSent === 'recovery'
      ? await sb.auth.resetPasswordForEmail(lastEmail, { redirectTo })
      : await sb.auth.resend({ type: 'signup', email: lastEmail, options: { emailRedirectTo: redirectTo } });
    busy(btn, false);
    if (error) { message('error', friendly(error)); return; }
    message('error', '');
    message('ok', 'Sent again. It can take a minute to arrive, so check your spam folder too.');
    // Small cooldown so people don't burn through the email rate limit.
    btn.disabled = true;
    let left = 60;
    clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      left -= 1;
      btn.textContent = left > 0 ? `Resend email (${left}s)` : 'Resend email';
      if (left <= 0) { clearInterval(resendTimer); btn.disabled = false; }
    }, 1000);
  });

  // ---------- log out ----------
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-logout]')) return;
    const { error } = await sb.auth.signOut();
    if (error) await sb.auth.signOut({ scope: 'local' });
  });
})();
