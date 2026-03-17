const DEFAULT_API_BASE = window.ANDCLAW_API_BASE_URL || "";
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const banner = document.getElementById('banner');
const pageTitleEl = document.getElementById('page-title-el');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const target = item.dataset.view;
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${target}`).classList.add('active');
    const titles = {
      dashboard: 'Dashboard',
      inbox: 'Inbox',
      chat: 'Chat',
      agenda: 'Agenda',
      projects: 'Projetos',
      agents: 'Agentes',
      skills: 'Skills',
      meetings: 'Reuniões',
      favorites: 'Favoritos',
      knowledge: 'Conhecimento',
      archive: 'Arquivo',
      admin: 'Configurações',
    };
    if (pageTitleEl && titles[target]) pageTitleEl.textContent = titles[target];
  });
});

const modal = document.getElementById('modal');
const modalInput = document.getElementById('modal-input');
const loginModal = document.getElementById('login-modal');
const loginApiBase = document.getElementById('login-api-base');
const loginPassword = document.getElementById('login-password');
const loginTokenSecret = document.getElementById('login-token-secret');
const bootstrapHint = document.getElementById('bootstrap-hint');
const adminFeedback = document.getElementById('admin-feedback');

function showBanner(text) {
  banner.textContent = text;
  banner.classList.remove('hidden');
}

function hideBanner() {
  banner.classList.add('hidden');
  banner.textContent = '';
}

function showError(err) {
  const msg = typeof err === 'string' ? err : (err && err.message) ? err.message : 'Erro inesperado';
  showBanner(msg);
}

function showInline(text) {
  if (!adminFeedback) return;
  adminFeedback.textContent = text;
  adminFeedback.classList.remove('hidden');
}

function hideInline() {
  if (!adminFeedback) return;
  adminFeedback.textContent = '';
  adminFeedback.classList.add('hidden');
}
function getApiBase() {
  return localStorage.getItem('andclaw_api_base') || DEFAULT_API_BASE;
}

function setApiBase(value) {
  if (value) localStorage.setItem('andclaw_api_base', value);
}

function openModal() {
  modal.classList.remove('hidden');
  modalInput.focus();
}

function closeModal() {
  modal.classList.add('hidden');
  modalInput.value = '';
}

function showLogin() {
  loginModal.classList.remove('hidden');
  loginApiBase.value = getApiBase();
  loginPassword.focus();
}

function hideLogin() {
  loginModal.classList.add('hidden');
  loginPassword.value = '';
  loginTokenSecret.value = '';
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const apiBase = getApiBase();
  if (!apiBase) {
    showLogin();
    throw new Error('API base nao configurada');
  }

  const res = await fetch(`${apiBase}${path}`, { ...options, headers });
  if (res.status === 401) {
    showLogin();
    throw new Error('Nao autorizado. Faça login novamente.');
  }
  if (res.status === 503) {
    showLogin();
    throw new Error('Inicializacao necessaria. Use o botao Inicializar.');
  }
  if (res.ok) {
    const ct = res.headers.get('content-type') || '';
    if (ct && !ct.includes('application/json')) {
      throw new Error('Resposta invalida do backend.');
    }
  }
  return res;
}

function statusBadge(text, state) {
  return `<span class=\"status-badge ${state}\">${text}</span>`;
}

function applyTheme(theme) {
  const root = document.body;
  if (theme === 'auto') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = prefersDark ? 'dark' : 'light';
  } else {
    root.dataset.theme = theme;
  }
  localStorage.setItem('andclaw_theme', theme);
}

async function ensureAuth() {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    showLogin();
    return false;
  }
  try {
    await apiFetch('/api/auth/me');
    return true;
  } catch {
    showLogin();
    return false;
  }
}

document.getElementById('login-submit').addEventListener('click', async () => {
  const apiBase = loginApiBase.value.trim();
  const password = loginPassword.value.trim();
  if (!apiBase || !password) return;
  setApiBase(apiBase);
  try {
    const res = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      hideLogin();
      hideBanner();
      hideInline();
      await initApp();
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.error === 'auth not configured') {
      bootstrapHint.textContent = 'Configure senha e clique em Inicializar.';
      showBanner('Auth nao configurado no backend.');
    } else {
      showBanner('Falha no login. Verifique a senha e a URL do backend.');
    }
  } catch (err) {
    showError(err);
  }
});

document.getElementById('login-bootstrap').addEventListener('click', async () => {
  const apiBase = loginApiBase.value.trim();
  const password = loginPassword.value.trim();
  const tokenSecret = loginTokenSecret.value.trim();
  if (!apiBase || !password) return;
  setApiBase(apiBase);
  try {
    const res = await fetch(`${apiBase}/api/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, tokenSecret: tokenSecret || undefined })
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('auth_token', data.token);
      hideLogin();
      hideBanner();
      await initApp();
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.error === 'already_configured') {
      showBanner('Ja configurado. Use Entrar.');
    } else {
      showBanner('Falha na inicializacao. Verifique a URL do backend.');
    }
  } catch (err) {
    showError(err);
  }
});

document.getElementById('login-generate').addEventListener('click', () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  loginTokenSecret.value = secret;
});

document.getElementById('quick-capture-btn').addEventListener('click', openModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);

document.getElementById('modal-save').addEventListener('click', async () => {
  const text = modalInput.value.trim();
  if (!text) return;
  await queueCapture(text);
  closeModal();
  await refreshCaptures();
});

const captureInput = document.getElementById('capture-input');
const captureSend = document.getElementById('capture-send');

captureSend.addEventListener('click', async () => {
  const text = captureInput.value.trim();
  if (!text) return;
  await queueCapture(text);
  captureInput.value = '';
  await refreshCaptures();
});

async function queueCapture(content) {
  if (navigator.onLine) {
    try {
      await apiFetch('/api/captures', {
        method: 'POST',
        body: JSON.stringify({ content })
      });
    } catch (err) {
      showError(err);
    }
  } else {
    enqueueLocal('captures', { content, createdAt: new Date().toISOString() });
  }
}

function enqueueLocal(key, item) {
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.push(item);
  localStorage.setItem(key, JSON.stringify(list));
}

async function flushQueue() {
  if (!navigator.onLine) return;

  const captures = JSON.parse(localStorage.getItem('captures') || '[]');
  if (captures.length) {
    for (const cap of captures) {
      await apiFetch('/api/captures', {
        method: 'POST',
        body: JSON.stringify({ content: cap.content })
      });
    }
    localStorage.removeItem('captures');
  }

  const messages = JSON.parse(localStorage.getItem('messages') || '[]');
  if (messages.length) {
    for (const msg of messages) {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify(msg)
      });
    }
    localStorage.removeItem('messages');
  }
}

async function refreshCaptures() {
  const list = document.getElementById('captures-list');
  list.innerHTML = '';
  const localCaptures = JSON.parse(localStorage.getItem('captures') || '[]');
  localCaptures.forEach(item => {
    const div = document.createElement('div');
    div.textContent = `[offline] ${item.content}`;
    list.appendChild(div);
  });

  if (navigator.onLine) {
    try {
      const res = await apiFetch('/api/captures');
      const data = await res.json();
      (data.items || []).slice(0, 50).forEach(item => {
        const div = document.createElement('div');
        div.textContent = item.content;
        list.appendChild(div);
      });
    } catch (err) {
      showError(err);
    }
  }
}

const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const chatWindow = document.getElementById('chat-window');

const chatInputFull = document.getElementById('chat-input-full');
const chatSendFull = document.getElementById('chat-send-full');
const chatWindowFull = document.getElementById('chat-window-full');

async function loadChatHistory() {
  if (!navigator.onLine) return;
  try {
    const res = await apiFetch('/api/messages/by-conversation/pwa-user?limit=200');
    const data = await res.json();
    const items = data.items || [];
    const html = items.map(msg => `<div>${msg.role === 'assistant' ? 'Agente' : 'Você'}: ${msg.content}</div>`).join('');
    chatWindow.innerHTML = html;
    chatWindowFull.innerHTML = html;
  } catch (err) {
    showError(err);
  }
}

async function sendChatMessage(inputEl, windowEl) {
  const content = inputEl.value.trim();
  if (!content) return;
  const payload = {
    content,
    client_message_id: crypto.randomUUID(),
    role: 'user',
    conversationId: 'pwa-user'
  };

  windowEl.innerHTML += `<div>Você: ${content}</div>`;

  if (navigator.onLine) {
    try {
      const res = await apiFetch('/api/agent', {
        method: 'POST',
        body: JSON.stringify({ input: content })
      });
      const data = await res.json();
      if (data.reply) {
        windowEl.innerHTML += `<div>Agente: ${data.reply}</div>`;
      }
      await loadChatHistory();
    } catch (err) {
      showError(err);
    }
  } else {
    enqueueLocal('messages', payload);
  }

  inputEl.value = '';
}

chatSend.addEventListener('click', () => sendChatMessage(chatInput, chatWindow));
chatSendFull.addEventListener('click', () => sendChatMessage(chatInputFull, chatWindowFull));

async function loadDashboard() {
  try {
    const tasksRes = await apiFetch('/api/tasks');
    const tasks = (await tasksRes.json()).items || [];
    const todayList = document.getElementById('today-list');
    todayList.innerHTML = tasks.slice(0, 5).map(t => `<div>${t.title}</div>`).join('');

    const priorityList = document.getElementById('priority-list');
    priorityList.innerHTML = tasks.slice(0, 3).map(t => `<div>${t.title}</div>`).join('');

    const meetingsRes = await apiFetch('/api/meetings');
    const meetings = (await meetingsRes.json()).items || [];
    const meetingsList = document.getElementById('meetings-list');
    meetingsList.innerHTML = meetings.slice(0, 3).map(m => `<div>${m.title}</div>`).join('');
  } catch (err) {
    showError(err);
  }
}

async function loadAgenda() {
  try {
    const res = await apiFetch('/api/calendar/combined');
    const data = await res.json();
    const list = document.getElementById('agenda-grid');
    list.innerHTML = (data.items || [])
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, 12)
      .map(item => {
        const label = item.type === 'task' ? 'Tarefa' : 'Evento';
        const date = item.start ? new Date(item.start).toLocaleString() : '';
        return `<div class="card"><strong>${label}</strong><div>${item.title || ''}</div><div>${date}</div></div>`;
      })
      .join('');
  } catch (err) {
    showError(err);
  }
}

async function loadAdmin() {
  try {
    const res = await apiFetch('/api/status');
    const data = await res.json();

    document.getElementById('status-db').innerHTML = data.db?.ok
      ? statusBadge('OK', 'ok')
      : statusBadge('Falha', 'bad');
    const connected = (data.google?.connectedAccounts || []).length;
    document.getElementById('status-google').innerHTML = data.google?.configured
      ? statusBadge(`Conectado (${connected})`, connected ? 'ok' : 'warn')
      : statusBadge('Nao configurado', 'bad');
    document.getElementById('status-gitvault').innerHTML = data.gitvault
      ? statusBadge('Configurado', 'ok')
      : statusBadge('Nao configurado', 'bad');
    document.getElementById('status-push').innerHTML = data.push
      ? statusBadge(`Subs: ${data.pushSubscriptions || 0}`, (data.pushSubscriptions || 0) > 0 ? 'ok' : 'warn')
      : statusBadge('Nao configurado', 'bad');
    document.getElementById('status-raindrop').innerHTML = data.raindrop
      ? statusBadge('Configurado', 'ok')
      : statusBadge('Nao configurado', 'bad');
    document.getElementById('status-deploy').innerHTML = data.deploy?.last
      ? new Date(data.deploy.last).toLocaleString()
      : 'Nenhum';

    const llm = data.llm || {};
    const llmLines = [];
    llmLines.push(`Gemini: ${llm.gemini ? 'OK' : 'OFF'}`);
    llmLines.push(`OpenRouter: ${llm.openrouter ? 'OK' : 'OFF'}`);
    llmLines.push(`DeepSeek: ${llm.deepseek ? 'OK' : 'OFF'}`);
    document.getElementById('status-llm').innerHTML = llmLines.join(' | ');

    if (!llm.gemini && !llm.openrouter && !llm.deepseek) {
      showBanner('Modo offline: nenhuma LLM configurada. Configure na seção Configurações.');
    }
  } catch (err) {
    showError(err);
  }
}

async function loadSettingsStatus() {
  try {
    const res = await apiFetch('/api/settings');
    const data = await res.json();
    const s = data.settings || {};

    const setBadge = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      const ok = value && value !== '';
      el.textContent = ok ? 'configurado' : 'pendente';
      el.classList.toggle('ok', ok);
      el.classList.toggle('bad', !ok);
    };

    setBadge('cfg-status-gemini', s.GEMINI_API_KEY);
    setBadge('cfg-status-openrouter', s.OPENROUTER_API_KEY);
    setBadge('cfg-status-deepseek', s.DEEPSEEK_API_KEY);
    setBadge('cfg-status-default-provider', s.DEFAULT_LLM_PROVIDER);
    setBadge('cfg-status-github-token', s.GITHUB_TOKEN);
    setBadge('cfg-status-gitvault-repo', s.GITVAULT_REPO);
    setBadge('cfg-status-gitvault-base', s.GITVAULT_BASE_PATH);
    setBadge('cfg-status-google-client-id', s.GOOGLE_OAUTH_CLIENT_ID);
    setBadge('cfg-status-google-client-secret', s.GOOGLE_OAUTH_CLIENT_SECRET);
    setBadge('cfg-status-google-redirect', s.GOOGLE_OAUTH_REDIRECT_URI);
    setBadge('cfg-status-google-calendar', s.GOOGLE_EXPORT_CALENDAR_ID);
    setBadge('cfg-status-vapid-public', s.VAPID_PUBLIC_KEY);
    setBadge('cfg-status-vapid-private', s.VAPID_PRIVATE_KEY);
    setBadge('cfg-status-vapid-email', s.VAPID_CONTACT_EMAIL);
    setBadge('cfg-status-render-hook', s.RENDER_DEPLOY_HOOK_URL);
    setBadge('cfg-status-raindrop-token', s.RAINDROP_TOKEN);
    setBadge('cfg-status-raindrop-collection', s.RAINDROP_COLLECTION_ID);
  } catch {
    // ignore
  }
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('/sw.js');
  }
}

async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const reg = await navigator.serviceWorker.ready;
  const res = await apiFetch('/api/push/vapid');
  const { publicKey } = await res.json();
  if (!publicKey) return;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  await apiFetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription: sub })
  });
}

async function connectGoogle() {
  try {
    const res = await apiFetch('/api/google/auth/url');
    const { url } = await res.json();
    if (url) window.location.href = url;
  } catch (err) {
    showError(err);
  }
}

document.getElementById('google-connect-btn').addEventListener('click', connectGoogle);

const meetingTitle = document.getElementById('meeting-title');
const meetingTranscript = document.getElementById('meeting-transcript');
const meetingSave = document.getElementById('meeting-save');
const meetingAnalyze = document.getElementById('meeting-analyze');

meetingSave.addEventListener('click', async () => {
  const title = meetingTitle.value.trim();
  const transcript = meetingTranscript.value.trim();
  if (!title) return showBanner('Informe o titulo da reuniao.');
  try {
    await apiFetch('/api/meetings', {
      method: 'POST',
      body: JSON.stringify({ title, transcript_text: transcript || null })
    });
    meetingTitle.value = '';
    meetingTranscript.value = '';
    await loadMeetings();
  } catch (err) {
    showError(err);
  }
});

meetingAnalyze.addEventListener('click', async () => {
  const title = meetingTitle.value.trim();
  const transcript = meetingTranscript.value.trim();
  if (!title || !transcript) return showBanner('Informe titulo e transcricao.');
  try {
    const created = await apiFetch('/api/meetings', {
      method: 'POST',
      body: JSON.stringify({ title, transcript_text: transcript })
    }).then(r => r.json());

    await apiFetch('/api/meetings/analyze', {
      method: 'POST',
      body: JSON.stringify({ meetingId: created.item.id })
    });

    meetingTitle.value = '';
    meetingTranscript.value = '';
    await loadMeetings();
  } catch (err) {
    showError(err);
  }
});

async function loadMeetings() {
  try {
    const res = await apiFetch('/api/meetings');
    const data = await res.json();
    const list = document.getElementById('meetings-full-list');
    list.innerHTML = (data.items || []).slice(0, 50).map(m => `<div>${m.title}</div>`).join('');
  } catch (err) {
    showError(err);
  }
}

const cfgSave = document.getElementById('cfg-save');
const cfgDeploy = document.getElementById('cfg-deploy');
const dbCheck = document.getElementById('db-check');
const googleConnectAdmin = document.getElementById('google-connect-admin');
const googleRefresh = document.getElementById('google-refresh');
const gitvaultExport = document.getElementById('gitvault-export');
const raindropSync = document.getElementById('raindrop-sync');
const pushTest = document.getElementById('push-test');
const onboardSave = document.getElementById('onboard-save');
const onboardGoogle = document.getElementById('onboard-google');
const onboardRaindrop = document.getElementById('onboard-raindrop');
const onboardPush = document.getElementById('onboard-push');
const onboardDeploy = document.getElementById('onboard-deploy');

const settingsItems = document.querySelectorAll('.settings-item');
const settingsViews = document.querySelectorAll('.settings-view');
const profileSave = document.getElementById('profile-save');
const notificationsSave = document.getElementById('notifications-save');
const appearanceSave = document.getElementById('appearance-save');
const profileAvatar = document.getElementById('profile-avatar');

cfgSave.addEventListener('click', async () => {
  const payload = {
    GEMINI_API_KEY: document.getElementById('cfg-gemini').value.trim(),
    OPENROUTER_API_KEY: document.getElementById('cfg-openrouter').value.trim(),
    DEEPSEEK_API_KEY: document.getElementById('cfg-deepseek').value.trim(),
    DEFAULT_LLM_PROVIDER: document.getElementById('cfg-default-provider').value.trim(),
    GITHUB_TOKEN: document.getElementById('cfg-github-token').value.trim(),
    GITVAULT_REPO: document.getElementById('cfg-gitvault-repo').value.trim(),
    GITVAULT_BASE_PATH: document.getElementById('cfg-gitvault-base').value.trim(),
    GOOGLE_OAUTH_CLIENT_ID: document.getElementById('cfg-google-client-id').value.trim(),
    GOOGLE_OAUTH_CLIENT_SECRET: document.getElementById('cfg-google-client-secret').value.trim(),
    GOOGLE_OAUTH_REDIRECT_URI: document.getElementById('cfg-google-redirect').value.trim(),
    GOOGLE_EXPORT_CALENDAR_ID: document.getElementById('cfg-google-calendar').value.trim(),
    VAPID_PUBLIC_KEY: document.getElementById('cfg-vapid-public').value.trim(),
    VAPID_PRIVATE_KEY: document.getElementById('cfg-vapid-private').value.trim(),
    VAPID_CONTACT_EMAIL: document.getElementById('cfg-vapid-email').value.trim(),
    RENDER_DEPLOY_HOOK_URL: document.getElementById('cfg-render-hook').value.trim(),
    RAINDROP_TOKEN: document.getElementById('cfg-raindrop-token').value.trim(),
    RAINDROP_COLLECTION_ID: document.getElementById('cfg-raindrop-collection').value.trim(),
  };

  try {
    await apiFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showInline('Configuracoes salvas.');
    await loadAdmin();
    await loadSettingsStatus();
  } catch (err) {
    showInline('Falha ao salvar configuracoes.');
  }
});

cfgDeploy && cfgDeploy.addEventListener('click', async () => {
  try {
    await apiFetch('/api/deploy', { method: 'POST' });
    showInline('Deploy disparado.');
  } catch (err) {
    showInline('Falha ao disparar deploy.');
  }
});

dbCheck && dbCheck.addEventListener('click', async () => {
  try {
    const res = await apiFetch('/api/health/db');
    if (res.ok) showInline('DB OK');
  } catch (err) {
    showInline('Falha ao checar DB.');
  }
});

googleConnectAdmin && googleConnectAdmin.addEventListener('click', connectGoogle);

googleRefresh && googleRefresh.addEventListener('click', async () => {
  await loadAdmin();
  showInline('Status atualizado.');
});

gitvaultExport && gitvaultExport.addEventListener('click', async () => {
  try {
    await apiFetch('/api/gitvault/export', { method: 'POST' });
    showInline('GitVault exportado.');
  } catch (err) {
    showInline('Falha ao exportar GitVault.');
  }
});

raindropSync && raindropSync.addEventListener('click', async () => {
  try {
    await apiFetch('/api/raindrop/sync', { method: 'POST', body: JSON.stringify({}) });
    showInline('Raindrop sincronizado.');
    await loadFavorites();
  } catch (err) {
    showInline('Falha ao sincronizar Raindrop.');
  }
});

pushTest && pushTest.addEventListener('click', async () => {
  try {
    await apiFetch('/api/push/test', { method: 'POST' });
    showInline('Push enviado.');
  } catch (err) {
    showInline('Falha ao enviar push.');
  }
});

onboardSave && onboardSave.addEventListener('click', () => cfgSave.click());
onboardGoogle && onboardGoogle.addEventListener('click', () => googleConnectAdmin.click());
onboardRaindrop && onboardRaindrop.addEventListener('click', () => raindropSync.click());
onboardPush && onboardPush.addEventListener('click', () => pushTest.click());
onboardDeploy && onboardDeploy.addEventListener('click', () => cfgDeploy.click());

settingsItems.forEach(item => {
  item.addEventListener('click', () => {
    settingsItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const target = item.dataset.settings;
    settingsViews.forEach(v => v.classList.remove('active'));
    document.querySelector(`[data-settings-view=\"${target}\"]`)?.classList.add('active');
  });
});

async function loadProfile() {
  try {
    const res = await apiFetch('/api/profile');
    const data = await res.json();
    const profile = data.profile || {};
    document.getElementById('profile-name').value = profile.fullName || '';
    document.getElementById('profile-email').value = profile.email || '';
    document.getElementById('profile-company').value = profile.company || '';
    document.getElementById('profile-role').value = profile.role || '';
    document.getElementById('profile-photo').value = profile.photoUrl || '';
    if (profileAvatar) {
      if (profile.photoUrl) {
        profileAvatar.style.backgroundImage = `url(${profile.photoUrl})`;
        profileAvatar.style.backgroundSize = 'cover';
        profileAvatar.style.backgroundPosition = 'center';
        profileAvatar.textContent = '';
      } else {
        const initial = (profile.fullName || 'A').trim()[0] || 'A';
        profileAvatar.style.backgroundImage = '';
        profileAvatar.textContent = initial.toUpperCase();
      }
    }
  } catch {}
}

async function loadPreferences() {
  try {
    const res = await apiFetch('/api/preferences');
    const data = await res.json();
    const prefs = data.preferences || {};
    const theme = prefs.theme || localStorage.getItem('andclaw_theme') || 'auto';
    applyTheme(theme);
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.toggle('active', card.dataset.theme === theme);
    });
    document.getElementById('pref-language').value = prefs.language || 'pt-BR';
    document.getElementById('pref-date-format').value = prefs.dateFormat || 'DD/MM/YYYY';
    document.getElementById('notify-email').checked = prefs.notifyEmail === 'true';
    document.getElementById('notify-push').checked = prefs.notifyPush === 'true';
    document.getElementById('notify-weekly').checked = prefs.notifyWeekly === 'true';
    document.getElementById('notify-analysis').checked = prefs.notifyAnalysis === 'true';
  } catch {}
}

profileSave && profileSave.addEventListener('click', async () => {
  const payload = {
    fullName: document.getElementById('profile-name').value.trim(),
    email: document.getElementById('profile-email').value.trim(),
    company: document.getElementById('profile-company').value.trim(),
    role: document.getElementById('profile-role').value.trim(),
    photoUrl: document.getElementById('profile-photo').value.trim(),
  };
  try {
    await apiFetch('/api/profile', { method: 'POST', body: JSON.stringify(payload) });
    showInline('Perfil atualizado.');
    await loadProfile();
  } catch {
    showInline('Falha ao salvar perfil.');
  }
});

notificationsSave && notificationsSave.addEventListener('click', async () => {
  const payload = {
    notifyEmail: String(document.getElementById('notify-email').checked),
    notifyPush: String(document.getElementById('notify-push').checked),
    notifyWeekly: String(document.getElementById('notify-weekly').checked),
    notifyAnalysis: String(document.getElementById('notify-analysis').checked),
  };
  try {
    if (payload.notifyPush === 'true') {
      await subscribePush();
    }
    await apiFetch('/api/preferences', { method: 'POST', body: JSON.stringify(payload) });
    showInline('Preferências salvas.');
  } catch {
    showInline('Falha ao salvar preferências.');
  }
});

appearanceSave && appearanceSave.addEventListener('click', async () => {
  const selected = document.querySelector('.theme-card.active')?.dataset.theme || 'auto';
  const payload = {
    theme: selected,
    language: document.getElementById('pref-language').value.trim(),
    dateFormat: document.getElementById('pref-date-format').value.trim(),
  };
  try {
    applyTheme(selected);
    await apiFetch('/api/preferences', { method: 'POST', body: JSON.stringify(payload) });
    showInline('Aparência salva.');
  } catch {
    showInline('Falha ao salvar aparência.');
  }
});

document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
  });
});

function parseList(value) {
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

async function loadSkills() {
  try {
    const res = await apiFetch('/api/skills');
    const data = await res.json();
    const list = document.getElementById('skills-list');
    list.innerHTML = (data.items || []).map(item => `
      <div class="card">
        <strong>${item.title}</strong>
        <div>${item.slug}</div>
        <div>${item.description || ''}</div>
      </div>
    `).join('');
  } catch (err) {
    showError(err);
  }
}

async function loadAgents() {
  try {
    const res = await apiFetch('/api/agents');
    const data = await res.json();
    const items = data.items || [];
    const groups = {
      estrategico: document.getElementById('agents-estrategico'),
      tatico: document.getElementById('agents-tatico'),
      operacional: document.getElementById('agents-operacional'),
    };
    Object.values(groups).forEach(el => { if (el) el.innerHTML = ''; });

    items.forEach(agent => {
      const level = (agent.level || 'Estrategico').toLowerCase();
      const target = groups[level] || groups.estrategico;
      const tags = (agent.tags || []).map(t => `<span class="tag-pill">${t.name}</span>`).join('');
      const areas = (agent.areas || []).map(a => `<span class="tag-pill">${a}</span>`).join('');
      const skills = (agent.skills || []).map(s => `<span class="tag-pill">${s}</span>`).join('');
      const card = document.createElement('div');
      card.className = 'agent-card';
      card.innerHTML = `
        <strong>${agent.name}</strong>
        <div>${agent.status || ''}</div>
        <div><small>Areas</small></div>
        <div class="tag-row">${areas}</div>
        <div><small>Skills</small></div>
        <div class="tag-row">${skills}</div>
        <div><small>Tags</small></div>
        <div class="tag-row">${tags}</div>
      `;
      target.appendChild(card);
    });
  } catch (err) {
    showError(err);
  }
}

document.getElementById('agent-save').addEventListener('click', async () => {
  const payload = {
    name: document.getElementById('agent-name').value.trim(),
    level: document.getElementById('agent-level').value.trim(),
    status: document.getElementById('agent-status').value.trim(),
    areas: parseList(document.getElementById('agent-areas').value),
    skills: parseList(document.getElementById('agent-skills').value),
    tags: parseList(document.getElementById('agent-tags').value),
    description: document.getElementById('agent-description').value.trim(),
  };
  if (!payload.name) return showBanner('Informe o nome do agente.');
  try {
    await apiFetch('/api/agents', { method: 'POST', body: JSON.stringify(payload) });
    document.getElementById('agent-name').value = '';
    document.getElementById('agent-description').value = '';
    await loadAgents();
  } catch (err) {
    showError(err);
  }
});

async function loadTags() {
  try {
    const res = await apiFetch('/api/tags');
    const data = await res.json();
    const list = document.getElementById('tags-list');
    list.innerHTML = (data.items || []).map(tag => `<div>${tag.name}</div>`).join('');
  } catch (err) {
    showError(err);
  }
}

document.getElementById('tag-save').addEventListener('click', async () => {
  const name = document.getElementById('tag-name').value.trim();
  const color = document.getElementById('tag-color').value.trim();
  if (!name) return;
  try {
    await apiFetch('/api/tags', { method: 'POST', body: JSON.stringify({ name, color }) });
    document.getElementById('tag-name').value = '';
    document.getElementById('tag-color').value = '';
    await loadTags();
  } catch (err) {
    showError(err);
  }
});

async function loadLinks() {
  try {
    const res = await apiFetch('/api/links');
    const data = await res.json();
    const list = document.getElementById('links-list');
    list.innerHTML = (data.items || []).map(link => `
      <div>${link.from_type}#${link.from_id} → ${link.to_type}#${link.to_id} ${link.label ? `(${link.label})` : ''}</div>
    `).join('');
  } catch (err) {
    showError(err);
  }
}

document.getElementById('link-save').addEventListener('click', async () => {
  const payload = {
    from_type: document.getElementById('link-from-type').value.trim(),
    from_id: document.getElementById('link-from-id').value.trim(),
    to_type: document.getElementById('link-to-type').value.trim(),
    to_id: document.getElementById('link-to-id').value.trim(),
    label: document.getElementById('link-label').value.trim(),
  };
  if (!payload.from_type || !payload.from_id || !payload.to_type || !payload.to_id) {
    return showBanner('Preencha todos os campos de link.');
  }
  try {
    await apiFetch('/api/links', { method: 'POST', body: JSON.stringify(payload) });
    document.getElementById('link-from-type').value = '';
    document.getElementById('link-from-id').value = '';
    document.getElementById('link-to-type').value = '';
    document.getElementById('link-to-id').value = '';
    document.getElementById('link-label').value = '';
    await loadLinks();
  } catch (err) {
    showError(err);
  }
});

async function loadFavorites() {
  try {
    const res = await apiFetch('/api/favorites');
    const data = await res.json();
    const list = document.getElementById('favorites-list');
    list.innerHTML = (data.items || []).map(fav => {
      const tags = (fav.tags || []).map(t => `<span class="tag-pill">${t.name}</span>`).join('');
      return `<div class="card">
        <strong>${fav.title}</strong>
        <div><a href="${fav.url}" target="_blank" rel="noreferrer">${fav.url}</a></div>
        <div class="tag-row">${tags}</div>
      </div>`;
    }).join('');
  } catch (err) {
    showError(err);
  }
}

document.getElementById('favorite-save').addEventListener('click', async () => {
  const title = document.getElementById('favorite-title').value.trim();
  const url = document.getElementById('favorite-url').value.trim();
  const tags = parseList(document.getElementById('favorite-tags').value);
  if (!title || !url) return showBanner('Informe titulo e URL.');
  try {
    await apiFetch('/api/favorites', { method: 'POST', body: JSON.stringify({ title, url, tags }) });
    document.getElementById('favorite-title').value = '';
    document.getElementById('favorite-url').value = '';
    document.getElementById('favorite-tags').value = '';
    await loadFavorites();
  } catch (err) {
    showError(err);
  }
});

document.getElementById('favorite-sync').addEventListener('click', async () => {
  try {
    await apiFetch('/api/raindrop/sync', { method: 'POST', body: JSON.stringify({}) });
    showInline('Raindrop sincronizado.');
    await loadFavorites();
  } catch (err) {
    showError(err);
  }
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

window.addEventListener('online', flushQueue);

async function initApp() {
  try {
    const apiBase = getApiBase();
    if (!apiBase) {
      showBanner('Configure o backend para continuar.');
      showLogin();
      return;
    }
    const health = await fetch(`${apiBase}/api/health`).then(r => r.ok);
    if (!health) {
      showBanner('Backend indisponivel.');
      showLogin();
      return;
    }
  } catch {
    showBanner('Falha ao conectar no backend.');
    showLogin();
    return;
  }

  const authed = await ensureAuth();
  if (!authed) return;
  hideBanner();
  await registerServiceWorker();
  await flushQueue();
  await refreshCaptures();
  await loadDashboard();
  await loadAgenda();
  await loadChatHistory();
  await loadMeetings();
  await loadAdmin();
  await loadSettingsStatus();
  await loadProfile();
  await loadPreferences();
  await loadSkills();
  await loadAgents();
  await loadFavorites();
  await loadTags();
  await loadLinks();
}

initApp();
