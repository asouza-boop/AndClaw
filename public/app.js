const DEFAULT_API_BASE = window.ANDCLAW_API_BASE_URL || "";
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const banner = document.getElementById('banner');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const target = item.dataset.view;
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${target}`).classList.add('active');
  });
});

const modal = document.getElementById('modal');
const modalInput = document.getElementById('modal-input');
const loginModal = document.getElementById('login-modal');
const loginApiBase = document.getElementById('login-api-base');
const loginPassword = document.getElementById('login-password');
const loginTokenSecret = document.getElementById('login-token-secret');
const bootstrapHint = document.getElementById('bootstrap-hint');

function showBanner(text) {
  banner.textContent = text;
  banner.classList.remove('hidden');
}

function hideBanner() {
  banner.classList.add('hidden');
  banner.textContent = '';
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
    throw new Error('API base not configured');
  }

  const res = await fetch(`${apiBase}${path}`, { ...options, headers });
  if (res.status === 401) {
    showLogin();
    throw new Error('Unauthorized');
  }
  if (res.status === 503) {
    showLogin();
    throw new Error('Bootstrap required');
  }
  return res;
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
    await initApp();
  } else {
    const data = await res.json().catch(() => ({}));
    if (data.error === 'auth not configured') {
      bootstrapHint.textContent = 'Configure senha e clique em Inicializar.';
    } else {
      showBanner('Falha no login. Verifique a senha e a URL do backend.');
    }
  }
});

document.getElementById('login-bootstrap').addEventListener('click', async () => {
  const apiBase = loginApiBase.value.trim();
  const password = loginPassword.value.trim();
  const tokenSecret = loginTokenSecret.value.trim();
  if (!apiBase || !password) return;
  setApiBase(apiBase);
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
  } else {
    const data = await res.json().catch(() => ({}));
    if (data.error === 'already_configured') {
      showBanner('Ja configurado. Use Entrar.');
    } else {
      showBanner('Falha na inicializacao. Verifique a URL do backend.');
    }
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
    await apiFetch('/api/captures', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
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
    const res = await apiFetch('/api/captures');
    const data = await res.json();
    (data.items || []).slice(0, 50).forEach(item => {
      const div = document.createElement('div');
      div.textContent = item.content;
      list.appendChild(div);
    });
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
  const res = await apiFetch('/api/messages/by-conversation/pwa-user?limit=200');
  const data = await res.json();
  const items = data.items || [];
  const html = items.map(msg => `<div>${msg.role === 'assistant' ? 'Agente' : 'Você'}: ${msg.content}</div>`).join('');
  chatWindow.innerHTML = html;
  chatWindowFull.innerHTML = html;
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
    const res = await apiFetch('/api/agent', {
      method: 'POST',
      body: JSON.stringify({ input: content })
    });
    const data = await res.json();
    if (data.reply) {
      windowEl.innerHTML += `<div>Agente: ${data.reply}</div>`;
    }
    await loadChatHistory();
  } else {
    enqueueLocal('messages', payload);
  }

  inputEl.value = '';
}

chatSend.addEventListener('click', () => sendChatMessage(chatInput, chatWindow));
chatSendFull.addEventListener('click', () => sendChatMessage(chatInputFull, chatWindowFull));

async function loadDashboard() {
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
}

async function loadAgenda() {
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
}

async function loadAdmin() {
  const res = await apiFetch('/api/status');
  const data = await res.json();

  document.getElementById('status-db').innerHTML = data.db?.ok ? 'OK' : 'Falha';
  document.getElementById('status-google').innerHTML = (data.google?.connectedAccounts || []).length
    ? `Conectado (${data.google.connectedAccounts.length})`
    : 'Nao conectado';
  document.getElementById('status-gitvault').innerHTML = data.gitvault ? 'OK' : 'Nao configurado';
  document.getElementById('status-push').innerHTML = data.push ? 'OK' : 'Nao configurado';
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
  const res = await apiFetch('/api/google/auth/url');
  const { url } = await res.json();
  if (url) window.location.href = url;
}

document.getElementById('google-connect-btn').addEventListener('click', connectGoogle);

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
      showBanner('Configure a URL do backend para continuar.');
      showLogin();
      return;
    }
    const health = await fetch(`${apiBase}/api/health`).then(r => r.ok);
    if (!health) {
      showBanner('Backend indisponivel ou URL incorreta.');
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
  await subscribePush();
  await flushQueue();
  await refreshCaptures();
  await loadDashboard();
  await loadAgenda();
  await loadChatHistory();
  await loadAdmin();
}

initApp();
