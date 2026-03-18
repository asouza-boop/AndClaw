const DEFAULT_API_BASE = window.ANDCLAW_API_BASE_URL || "https://andclaw.onrender.com";
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const banner = document.getElementById('banner');
const pageTitleEl = document.getElementById('page-title-el');

const VIEW_TITLES = {
  dashboard: 'Dashboard', inbox: 'Inbox', chat: 'Chat', agenda: 'Agenda',
  projects: 'Projetos', agents: 'Agentes', skills: 'Skills', meetings: 'Reuniões',
  favorites: 'Favoritos', knowledge: 'Conhecimento', archive: 'Arquivo', admin: 'Configurações',
};

function navigateTo(target) {
  if (!target) return;
  // Atualizar nav items
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.view === target);
  });
  // Trocar views
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
  });
  const targetView = document.getElementById('view-' + target);
  if (targetView) {
    targetView.classList.add('active');
  } else {
    console.warn('[nav] view não encontrada: view-' + target);
  }
  // Atualizar título
  if (pageTitleEl && VIEW_TITLES[target]) {
    pageTitleEl.textContent = VIEW_TITLES[target];
  }
}

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    const target = item.dataset.view || e.currentTarget?.dataset?.view;
    navigateTo(target);
  });
});

const modal = document.getElementById('modal');
const modalInput = document.getElementById('modal-input');
const loginModal = document.getElementById('login-modal');
const loginPassword = document.getElementById('login-password');
const adminFeedback = document.getElementById('admin-feedback');
const togglePassword = document.getElementById('toggle-password');

// ── Sistema de notificações ──────────────────────────────
const appLogs = [];
let logErrorCount = 0;

function toast(msg, type = 'info', title = null, duration = 5000) {
  const container = document.getElementById('toast-container');
  if (!container) { console.log(`[${type}] ${msg}`); return; }

  // Registrar no log
  logPush(msg, type, title);

  const icons = { success: '✓', error: '✕', info: 'i', warn: '!' };
  const titles = { success: 'Sucesso', error: 'Erro', info: 'Info', warn: 'Aviso' };

  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `
    <div class="toast-icon">${icons[type] || 'i'}</div>
    <div class="toast-body">
      <div class="toast-title">${title || titles[type] || type}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" onclick="dismissToast(this.parentElement)">✕</button>
    <div class="toast-progress" style="animation-duration:${duration}ms;"></div>
  `;

  t.addEventListener('click', (e) => {
    if (e.target.classList.contains('toast-close')) return;
    // Clique expande para ver msg completa se truncada
    const msgEl = t.querySelector('.toast-msg');
    msgEl.style.whiteSpace = msgEl.style.whiteSpace === 'nowrap' ? 'pre-wrap' : 'nowrap';
  });

  container.appendChild(t);

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => dismissToast(t), duration);
  }

  // Máximo 5 toasts visíveis
  const toasts = container.querySelectorAll('.toast:not(.removing)');
  if (toasts.length > 5) dismissToast(toasts[0]);
}

function dismissToast(el) {
  if (!el || el.classList.contains('removing')) return;
  el.classList.add('removing');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 300);
}

function logPush(msg, type = 'info', title = null) {
  const entry = {
    id: Date.now(),
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    msg: String(msg),
    type,
    title,
  };
  appLogs.unshift(entry);
  if (appLogs.length > 200) appLogs.pop();

  if (type === 'error' || type === 'warn') {
    logErrorCount++;
    const badge = document.getElementById('log-badge');
    if (badge) {
      badge.textContent = logErrorCount > 99 ? '99+' : String(logErrorCount);
      badge.classList.remove('hidden');
    }
  }

  renderLogList();
}

function renderLogList() {
  const list = document.getElementById('log-list');
  if (!list) return;
  if (appLogs.length === 0) {
    list.innerHTML = '<div class="log-empty">Nenhuma atividade registrada.</div>';
    return;
  }
  list.innerHTML = appLogs.map(e => {
    const short = e.msg.length > 120 ? e.msg.slice(0, 120) + '…' : e.msg;
    const hasFull = e.msg.length > 120;
    return `<div class="log-entry" onclick="this.classList.toggle('expanded')">
      <span class="log-entry-dot log-dot-${e.type}"></span>
      <div class="log-entry-body">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
          ${e.title ? `<span style="font-weight:500;color:var(--text);font-size:12px;">${e.title}</span>` : ''}
          <span class="log-entry-time">${e.time}</span>
          ${hasFull ? '<span style="font-size:10px;color:var(--muted);font-family:var(--font-mono);">clique p/ expandir</span>' : ''}
        </div>
        <div class="log-entry-msg">${short}</div>
        ${hasFull ? `<div class="log-entry-full">${e.msg}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// Compatibilidade com código existente — redirecionar para toast
function showBanner(text) {
  toast(text, 'info', null, 6000);
}
function hideBanner() { /* toasts auto-dismiss */ }
function showError(err) {
  const msg = typeof err === 'string' ? err : (err?.message) || 'Erro inesperado';
  toast(msg, 'error', 'Erro', 0); // 0 = não fecha automático em erros
}
function showInline(text) {
  // Detectar se é sucesso ou erro pela mensagem
  const isError = /falha|erro|fail|error/i.test(text);
  toast(text, isError ? 'error' : 'success', null, 4000);
}
function hideInline() { /* toasts auto-dismiss */ }

// Controles do log modal
document.getElementById('open-log-btn')?.addEventListener('click', () => {
  const modal = document.getElementById('log-modal');
  if (modal) {
    modal.classList.remove('hidden');
    // Zerar badge ao abrir
    logErrorCount = 0;
    const badge = document.getElementById('log-badge');
    if (badge) badge.classList.add('hidden');
    renderLogList();
  }
});

document.getElementById('log-close-btn')?.addEventListener('click', () => {
  document.getElementById('log-modal')?.classList.add('hidden');
});

document.getElementById('log-clear-btn')?.addEventListener('click', () => {
  appLogs.length = 0;
  logErrorCount = 0;
  const badge = document.getElementById('log-badge');
  if (badge) badge.classList.add('hidden');
  renderLogList();
  toast('Log limpo.', 'info', null, 2000);
});

// Fechar log clicando fora
document.getElementById('log-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'log-modal') {
    document.getElementById('log-modal').classList.add('hidden');
  }
});
function getApiBase() {
  const stored = localStorage.getItem('andclaw_api_base');
  // Se o frontend está rodando no mesmo servidor do backend (onrender, oracle, etc.)
  // usar a própria origin como base — sem precisar de configuração manual
  const origin = window.location.origin;
  const isVercelOnly = origin.includes('vercel.app');
  if (!isVercelOnly) {
    // Estamos no backend diretamente — usar origin
    setApiBase(origin);
    return origin;
  }
  return stored || DEFAULT_API_BASE;
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
  loginPassword.focus();
}

function hideLogin() {
  loginModal.classList.add('hidden');
  loginPassword.value = '';
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let apiBase = getApiBase();
  if (!apiBase) {
    showLogin();
    throw new Error('API base nao configurada');
  }

  const res = await fetch(`${apiBase}${path}`, { ...options, headers });
  if (res.status === 401) {
    showLogin();
    throw new Error('Não autorizado. Faça login novamente.');
  }
  if (res.status === 503) {
    showLogin();
    throw new Error('Inicialização necessária. Use o botão Inicializar.');
  }
  if (!res.ok && res.status >= 400) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errData = await res.clone().json();
      errMsg = errData.error || errData.message || errMsg;
    } catch {}
    logPush(`${errMsg} — ${res.url || path}`, 'error', `Erro ${res.status}`);
  }
  if (res.ok) {
    const ct = res.headers.get('content-type') || '';
    if (ct && !ct.includes('application/json')) {
      const fallback = DEFAULT_API_BASE;
      if (fallback && apiBase !== fallback) {
        setApiBase(fallback);
        apiBase = fallback;
        const retry = await fetch(`${apiBase}${path}`, { ...options, headers });
        return retry;
      }
      throw new Error('Backend indisponível ou inicializando. Aguarde alguns segundos e tente novamente.');
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

let loginAttempts = 0;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 60 * 1000;
let loginLockedUntil = 0;

function isLoginLocked() {
  return Date.now() < loginLockedUntil;
}

document.getElementById('login-submit').addEventListener('click', async () => {
  if (isLoginLocked()) {
    showBanner('Muitas tentativas. Aguarde 1 minuto.');
    return;
  }
  const password = loginPassword.value.trim();
  const apiBase = getApiBase();
  if (!password) return;
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
      loginAttempts = 0;
      await initApp();
      return;
    }
    await res.json().catch(() => ({}));
    loginAttempts += 1;
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      loginLockedUntil = Date.now() + LOGIN_LOCK_MS;
      showBanner('Muitas tentativas. Aguarde 1 minuto.');
    } else {
      showBanner('Falha no login. Verifique a senha.');
    }
  } catch (err) {
    showError(err);
  }
});

togglePassword && togglePassword.addEventListener('click', () => {
  const isHidden = loginPassword.type === 'password';
  loginPassword.type = isHidden ? 'text' : 'password';
  togglePassword.textContent = isHidden ? 'Ocultar' : 'Mostrar';
});

// bootstrap flow removed from UI

document.getElementById('quick-capture-btn').addEventListener('click', openModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);

document.getElementById('new-task-btn')?.addEventListener('click', () => {
  document.navigateTo('meetings');
  setTimeout(() => document.getElementById('meeting-title')?.focus(), 100);
});

document.getElementById('new-meeting-btn')?.addEventListener('click', () => {
  document.navigateTo('meetings');
  setTimeout(() => document.getElementById('meeting-title')?.focus(), 100);
});

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
  await queueCapture(text, inboxCurrentType);
  captureInput.value = '';
  await refreshCaptures();
});

captureInput?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = captureInput.value.trim();
    if (!text) return;
    await queueCapture(text, inboxCurrentType);
    captureInput.value = '';
    await refreshCaptures();
  }
});

async function queueCapture(content, type = 'note') {
  if (navigator.onLine) {
    try {
      await apiFetch('/api/captures', {
        method: 'POST',
        body: JSON.stringify({ content, type })
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

let inboxFilter = 'all';
let inboxSort = 'recent';
let inboxSelected = new Set();
let inboxCurrentType = 'note';
let inboxAllItems = [];

const typeMap = { note: 'Nota', task: 'Tarefa', idea: 'Ideia', link: 'Link' };
const tagClass = { note: 'inbox-tag-note', task: 'inbox-tag-task', idea: 'inbox-tag-idea', link: 'inbox-tag-link' };

function inboxTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function inboxRender(items) {
  inboxAllItems = items;
  const badge = document.getElementById('inbox-total-badge');
  const list = document.getElementById('captures-list');
  const doneList = document.getElementById('captures-done-list');
  const doneSection = document.getElementById('inbox-label-done');
  const progressFill = document.getElementById('inbox-progress-fill');
  const progressCount = document.getElementById('inbox-progress-count');

  let filtered = items.filter(i =>
    inboxFilter === 'all' || i.type === inboxFilter
  );

  if (badge) badge.textContent = `${filtered.length} ${filtered.length === 1 ? 'item' : 'itens'}`;

  const pending = filtered.filter(i => i.status !== 'processed' && i.status !== 'archived');
  const done = filtered.filter(i => i.status === 'processed');

  const total = items.length;
  const doneCount = items.filter(i => i.status === 'processed').length;
  if (progressFill) progressFill.style.width = total > 0 ? `${Math.round(doneCount / total * 100)}%` : '0%';
  if (progressCount) progressCount.textContent = `${doneCount} / ${total}`;

  const uncategorized = items.filter(i => !i.type || i.type === 'note').length;
  const aiBar = document.getElementById('inbox-ai-bar');
  const aiMsg = document.getElementById('inbox-ai-msg');
  if (aiBar) {
    if (uncategorized > 2) {
      aiBar.style.display = 'flex';
      if (aiMsg) aiMsg.textContent = `${uncategorized} itens sem categoria — o agente pode processar e classificar automaticamente.`;
    } else {
      aiBar.style.display = 'none';
    }
  }

  const bulkBar = document.getElementById('inbox-bulk-bar');
  const selCount = document.getElementById('inbox-selected-count');
  if (bulkBar) bulkBar.style.display = inboxSelected.size > 0 ? 'flex' : 'none';
  if (selCount) selCount.textContent = `${inboxSelected.size} selecionado${inboxSelected.size !== 1 ? 's' : ''}`;

  function renderItem(item) {
    const isSelected = inboxSelected.has(Number(item.id));
    const isDone = item.status === 'processed';
    return `<div class="inbox-item${isSelected ? ' inbox-selected' : ''}" data-id="${item.id}" onclick="inboxToggleSelect(${item.id})">
      <div class="inbox-check${isDone ? ' inbox-done' : ''}" onclick="event.stopPropagation(); inboxToggleDone(${item.id}, '${item.status}')"></div>
      <div class="inbox-item-body">
        <div class="inbox-item-text${isDone ? ' inbox-done-text' : ''}">${item.content}</div>
        <div class="inbox-item-meta">
          <span class="inbox-type-tag ${tagClass[item.type] || 'inbox-tag-note'}">${typeMap[item.type] || 'Nota'}</span>
          <span class="inbox-item-time">${inboxTimeAgo(item.created_at)}</span>
        </div>
      </div>
      <div class="inbox-item-actions" onclick="event.stopPropagation()">
        <button class="inbox-action-btn" title="Converter em tarefa" onclick="inboxConvertTask(${item.id})">✓ Tarefa</button>
        <button class="inbox-action-btn" title="Arquivar" onclick="inboxArchive(${item.id})">Arquivar</button>
        <button class="inbox-action-btn inbox-action-danger" title="Excluir" onclick="inboxDelete(${item.id})">Excluir</button>
      </div>
    </div>`;
  }

  if (list) list.innerHTML = pending.length > 0
    ? pending.map(renderItem).join('')
    : '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px;">Tudo processado por hoje!</div>';

  if (doneSection) doneSection.style.display = done.length > 0 ? 'flex' : 'none';
  if (doneList) doneList.innerHTML = done.map(renderItem).join('');
}

async function inboxToggleDone(id, currentStatus) {
  const numId = Number(id);
  const newStatus = currentStatus === 'processed' ? 'new' : 'processed';
  try {
    await apiFetch(`/api/captures/${numId}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    await refreshCaptures();
  } catch (err) { showError(err); }
}

async function inboxArchive(id) {
  const numId = Number(id);
  try {
    await apiFetch(`/api/captures/${numId}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) });
    showInline('Item arquivado.');
    await refreshCaptures();
  } catch (err) { showError(err); }
}

async function inboxDelete(id) {
  const numId = Number(id);
  try {
    await apiFetch(`/api/captures/${numId}`, { method: 'DELETE' });
    await refreshCaptures();
  } catch (err) { showError(err); }
}

async function inboxConvertTask(id) {
  const numId = Number(id);
  try {
    const res = await apiFetch('/api/captures/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids: [numId], action: 'convert_task' })
    });
    const data = await res.json();
    if (data.ok) showInline('Convertido em tarefa com sucesso.');
    await refreshCaptures();
  } catch (err) { showError(err); }
}

function inboxToggleSelect(id) {
  const numId = Number(id);
  if (inboxSelected.has(numId)) inboxSelected.delete(numId);
  else inboxSelected.add(numId);
  inboxRender(inboxAllItems);
}

async function refreshCaptures() {
  try {
    const res = await apiFetch('/api/captures');
    const data = await res.json();
    inboxRender(data.items || []);
  } catch (err) {
    showError(err);
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
    const res = await apiFetch('/api/messages/by-conversation/pwa-user?limit=50');
    const data = await res.json();
    const items = data.items || [];
    const renderMsgs = (windowEl) => {
      if (!windowEl) return;
      if (items.length === 0) {
        windowEl.innerHTML = '<div class="empty-state" style="padding:20px 0;">Nenhuma mensagem ainda. Diga olá ao agente!</div>';
        return;
      }
      windowEl.innerHTML = items.map(msg => {
        const isUser = msg.role === 'user';
        const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        return `<div class="chat-msg ${isUser ? 'user' : 'agent'}">
          <div class="chat-avatar ${isUser ? 'user-av' : 'agent-av'}">${isUser ? 'U' : 'A'}</div>
          <div>
            <div class="chat-bubble">${msg.content}</div>
            ${time ? `<div class="chat-time">${time}</div>` : ''}
          </div>
        </div>`;
      }).join('');
      windowEl.scrollTop = windowEl.scrollHeight;
    };
    renderMsgs(chatWindow);
    renderMsgs(chatWindowFull);
  } catch (err) {
    showError(err);
  }
}

async function sendChatMessage(inputEl, windowEl) {
  const content = inputEl.value.trim();
  if (!content) return;
  inputEl.value = '';

  const userTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  windowEl.innerHTML += `<div class="chat-msg user">
    <div class="chat-avatar user-av">U</div>
    <div><div class="chat-bubble">${content}</div><div class="chat-time">${userTime}</div></div>
  </div>`;
  windowEl.scrollTop = windowEl.scrollHeight;

  const typingId = 'typing-' + Date.now();
  windowEl.innerHTML += `<div id="${typingId}" class="chat-msg agent">
    <div class="chat-avatar agent-av">A</div>
    <div><div class="chat-bubble" style="padding:10px 16px;">
      <span style="display:flex;gap:5px;align-items:center;">
        <span style="width:6px;height:6px;border-radius:50%;background:var(--muted);animation:typingDot 1.4s ease-in-out infinite;"></span>
        <span style="width:6px;height:6px;border-radius:50%;background:var(--muted);animation:typingDot 1.4s ease-in-out infinite;animation-delay:.2s;"></span>
        <span style="width:6px;height:6px;border-radius:50%;background:var(--muted);animation:typingDot 1.4s ease-in-out infinite;animation-delay:.4s;"></span>
      </span>
    </div></div>
  </div>`;
  windowEl.scrollTop = windowEl.scrollHeight;

  if (navigator.onLine) {
    try {
      const res = await apiFetch('/api/agent', {
        method: 'POST',
        body: JSON.stringify({ input: content })
      });
      const data = await res.json();
      document.getElementById(typingId)?.remove();
      if (data.reply) {
        const agentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        windowEl.innerHTML += `<div class="chat-msg agent">
          <div class="chat-avatar agent-av">A</div>
          <div><div class="chat-bubble">${data.reply}</div><div class="chat-time">${agentTime}</div></div>
        </div>`;
        windowEl.scrollTop = windowEl.scrollHeight;
      }
    } catch (err) {
      document.getElementById(typingId)?.remove();
      showError(err);
    }
  } else {
    document.getElementById(typingId)?.remove();
    enqueueLocal('messages', { content, client_message_id: crypto.randomUUID(), role: 'user', conversationId: 'pwa-user' });
  }
}

chatSend.addEventListener('click', () => sendChatMessage(chatInput, chatWindow));
chatSendFull.addEventListener('click', () => sendChatMessage(chatInputFull, chatWindowFull));

async function loadDashboard() {
  try {
    const [tasksRes, meetingsRes, capturesRes] = await Promise.all([
      apiFetch('/api/tasks'),
      apiFetch('/api/meetings'),
      apiFetch('/api/captures'),
    ]);
    const tasks    = (await tasksRes.json()).items    || [];
    const meetings = (await meetingsRes.json()).items || [];
    const captures = (await capturesRes.json()).items || [];

    const openTasks    = tasks.filter(t => t.status !== 'done');
    const highPriority = tasks.filter(t => t.priority === 'high' || t.priority === 'alta');
    const newCaptures  = captures.filter(c => c.status === 'new');

    const el = id => document.getElementById(id);
    if (el('stat-tasks'))    el('stat-tasks').textContent    = openTasks.length;
    if (el('stat-priority')) el('stat-priority').textContent = highPriority.length;
    if (el('stat-meetings')) el('stat-meetings').textContent = meetings.length;
    if (el('stat-inbox'))    el('stat-inbox').textContent    = newCaptures.length;

    const today = new Date().toDateString();
    const todayTasks = tasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === today);
    if (el('today-list')) {
      el('today-list').innerHTML = todayTasks.length > 0
        ? todayTasks.slice(0, 5).map(t => `<div class="list-item"><div class="list-item-title">${t.title}</div><div class="list-item-sub">${t.priority || 'normal'}</div></div>`).join('')
        : '<div class="empty-state">Sem tarefas para hoje</div>';
    }
    if (el('priority-list')) {
      el('priority-list').innerHTML = openTasks.length > 0
        ? openTasks.slice(0, 3).map(t => `<div class="list-item"><div class="list-item-title">${t.title}</div><div class="list-item-sub">${t.status || 'open'}</div></div>`).join('')
        : '<div class="empty-state">Sem tarefas</div>';
    }
    if (el('meetings-list')) {
      el('meetings-list').innerHTML = meetings.length > 0
        ? meetings.slice(0, 3).map(m => `<div class="list-item"><div class="list-item-title">${m.title}</div><div class="list-item-sub">${m.meeting_date ? new Date(m.meeting_date).toLocaleDateString('pt-BR') : 'Sem data'}</div></div>`).join('')
        : '<div class="empty-state">Sem reuniões</div>';
    }
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

    const setHealth = (id, ok, label) => {
      const el = document.getElementById(id);
      if (!el) return;
      const dot = ok
        ? '<span class="int-dot-green"></span>'
        : '<span class="int-dot-red"></span>';
      el.innerHTML = `${dot} ${label}`;
    };

    setHealth('health-backend', true, 'Online');
    setHealth('health-db', data.db?.ok, data.db?.ok ? 'Conectado' : 'Falha');

    const llm = data.llm || {};
    const activeLlm = llm.gemini ? 'Gemini' : llm.openrouter ? 'OpenRouter' : llm.deepseek ? 'DeepSeek' : 'Nenhum';
    const llmOk = llm.gemini || llm.openrouter || llm.deepseek;
    setHealth('health-llm', llmOk, activeLlm);

    const deployEl = document.getElementById('health-deploy');
    if (deployEl) {
      deployEl.textContent = data.deploy?.last
        ? new Date(data.deploy.last).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
        : 'Nunca';
    }

    const connected = (data.google?.connectedAccounts || []).length;
    setBadgeInt('badge-google', connected > 0, connected > 0 ? `${connected} conta(s)` : 'Não conectado');
    const googleSyncEl = document.getElementById('google-last-sync');
    if (googleSyncEl && connected > 0) googleSyncEl.textContent = 'Última sync há poucos minutos.';

    const googleSyncBtn = document.getElementById('google-sync-now');
    const googleDiscoBtn = document.getElementById('google-disconnect-btn');
    const googleConnBtn = document.getElementById('google-connect-admin');
    if (connected > 0) {
      if (googleSyncBtn) googleSyncBtn.style.display = '';
      if (googleDiscoBtn) googleDiscoBtn.style.display = '';
      if (googleConnBtn) googleConnBtn.style.display = 'none';
    } else {
      if (googleSyncBtn) googleSyncBtn.style.display = 'none';
      if (googleDiscoBtn) googleDiscoBtn.style.display = 'none';
      if (googleConnBtn) googleConnBtn.style.display = '';
    }

    setBadgeInt('badge-gitvault', data.gitvault, data.gitvault ? 'Configurado' : 'Não configurado');
    const repoInfo = document.getElementById('gitvault-repo-info');
    if (repoInfo) repoInfo.textContent = data.gitvault ? 'Backup diário às 02h.' : '';

    setBadgeInt('badge-raindrop', data.raindrop, data.raindrop ? 'Configurado' : 'Não configurado');

    const subs = data.pushSubscriptions || 0;
    setBadgeInt('badge-push', subs > 0, subs > 0 ? `${subs} dispositivo(s)` : '0 subscrições', subs === 0 ? 'warn' : 'ok');
    const pushSubsEl = document.getElementById('push-subs-info');
    if (pushSubsEl) pushSubsEl.textContent = subs > 0 ? `${subs} dispositivo(s) inscrito(s).` : '';

    setBadgeInt('badge-deploy', Boolean(data.deploy?.last), data.deploy?.last ? 'Render' : 'Nunca deployado');
    const deployInfoEl = document.getElementById('deploy-last-info');
    if (deployInfoEl && data.deploy?.last) {
      deployInfoEl.textContent = `Último: ${new Date(data.deploy.last).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    }

    setBadgeInt('badge-db', data.db?.ok, data.db?.ok ? 'Conectado' : 'Falha');

    const chain = document.getElementById('llm-chain-display');
    if (chain) {
      const providers = [
        { name: 'Gemini Flash', active: llm.gemini },
        { name: 'Gemini Lite', active: llm.gemini },
        { name: 'OpenRouter', active: llm.openrouter },
        { name: 'DeepSeek', active: llm.deepseek },
      ];
      chain.innerHTML = providers.map((p, i) => `
        <div class="int-llm-node ${p.active ? 'int-llm-active' : 'int-llm-inactive'}">
          <span class="int-llm-dot"></span>${p.name}
        </div>
        ${i < providers.length - 1 ? '<span class="int-llm-arrow">→</span>' : ''}
      `).join('');
    }

    const tgBadge = document.getElementById('tg-badge');
    if (tgBadge) { tgBadge.textContent = 'Ativo'; tgBadge.className = 'int-badge int-ok'; }
    const tgStatus = document.getElementById('tg-bot-status');
    if (tgStatus) tgStatus.textContent = 'Online · polling ativo';
    const tgUsers = document.getElementById('tg-stat-users');
    if (tgUsers) tgUsers.textContent = '1';
    const tgSkills = document.getElementById('tg-stat-skills');
    if (tgSkills) tgSkills.textContent = '—';

    const statusDb = document.getElementById('status-db');
    if (statusDb) statusDb.innerHTML = data.db?.ok ? '<span class="status-badge ok">OK</span>' : '<span class="status-badge bad">Falha</span>';
    const statusGoogle = document.getElementById('status-google');
    if (statusGoogle) statusGoogle.innerHTML = connected ? `<span class="status-badge ok">Conectado (${connected})</span>` : '<span class="status-badge bad">Não conectado</span>';
    const statusGitvault = document.getElementById('status-gitvault');
    if (statusGitvault) statusGitvault.innerHTML = data.gitvault ? '<span class="status-badge ok">Configurado</span>' : '<span class="status-badge bad">Não configurado</span>';
    const statusPush = document.getElementById('status-push');
    if (statusPush) statusPush.innerHTML = subs > 0 ? `<span class="status-badge ok">Subs: ${subs}</span>` : '<span class="status-badge warn">0 subscrições</span>';
    const statusRaindrop = document.getElementById('status-raindrop');
    if (statusRaindrop) statusRaindrop.innerHTML = data.raindrop ? '<span class="status-badge ok">Configurado</span>' : '<span class="status-badge bad">Não configurado</span>';
    const statusDeploy = document.getElementById('status-deploy');
    if (statusDeploy) statusDeploy.textContent = data.deploy?.last ? new Date(data.deploy.last).toLocaleString() : 'Nenhum';
    const statusLlm = document.getElementById('status-llm');
    if (statusLlm) statusLlm.textContent = `Gemini: ${llm.gemini ? 'OK' : 'OFF'} | OpenRouter: ${llm.openrouter ? 'OK' : 'OFF'} | DeepSeek: ${llm.deepseek ? 'OK' : 'OFF'}`;

    if (!llmOk) {
      toast('Nenhum provider LLM configurado. Acesse Configurações → Integrações → Configurações avançadas para adicionar sua GEMINI_API_KEY.', 'warn', 'LLM offline', 0);
    }

    renderActivityLog(data);
  } catch (err) {
    showError(err);
  }
}

function setBadgeInt(id, ok, label, forceState) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = label;
  const state = forceState || (ok ? 'ok' : 'off');
  el.className = `int-badge int-${state}`;
}

function renderActivityLog(data) {
  const log = document.getElementById('activity-log');
  if (!log) return;
  const entries = [];
  const now = new Date();
  const fmt = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (data.db?.ok) entries.push({ time: fmt(now), tag: 'ok', label: 'DB', msg: 'Banco de dados respondendo normalmente' });
  if (data.deploy?.last) entries.push({ time: fmt(data.deploy.last), tag: 'info', label: 'Deploy', msg: `Último deploy em ${new Date(data.deploy.last).toLocaleDateString('pt-BR')}` });
  if (data.google?.connectedAccounts?.length) entries.push({ time: fmt(now), tag: 'ok', label: 'Google', msg: `${data.google.connectedAccounts.length} conta(s) conectada(s) ao Calendar` });
  if (data.gitvault) entries.push({ time: '02:00', tag: 'ok', label: 'GitVault', msg: 'Backup diário agendado' });
  if (!data.llm?.gemini && !data.llm?.openrouter && !data.llm?.deepseek) {
    entries.push({ time: fmt(now), tag: 'warn', label: 'LLM', msg: 'Nenhum provider LLM configurado — agente offline' });
  }

  if (entries.length === 0) {
    log.innerHTML = '<div class="int-log-empty">Nenhuma atividade registrada.</div>';
    return;
  }

  log.innerHTML = entries.map(e => `
    <div class="int-log-line">
      <span class="int-log-time">${e.time}</span>
      <span class="int-log-tag int-lt-${e.tag}">${e.label}</span>
      <span class="int-log-msg">${e.msg}</span>
    </div>
  `).join('');
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
    showInline('Reunião salva.');
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
    if (!list) return;
    const items = data.items || [];
    list.innerHTML = items.length > 0
      ? items.slice(0, 50).map(m => `
          <div class="list-item" style="gap:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div class="list-item-title">${m.title}</div>
              <span class="inbox-item-time">${m.meeting_date ? new Date(m.meeting_date).toLocaleDateString('pt-BR') : new Date(m.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
            ${m.transcript_text ? `<div class="list-item-sub">${m.transcript_text.substring(0, 80)}...</div>` : '<div class="list-item-sub">Sem transcrição</div>'}
            ${m.transcript_text ? `<div><button class="int-act-btn" onclick="analyzeMeeting(${m.id})">Analisar com IA</button></div>` : ''}
          </div>`).join('')
      : '<div class="empty-state">Nenhuma reunião registrada.</div>';
  } catch (err) {
    showError(err);
  }
}

async function analyzeMeeting(meetingId) {
  try {
    showInline('Analisando transcrição...');
    await apiFetch('/api/meetings/analyze', { method: 'POST', body: JSON.stringify({ meetingId }) });
    showInline('Análise concluída — insight salvo em Conhecimento.');
    await loadMeetings();
  } catch (err) {
    showInline('Falha ao analisar reunião.');
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



document.getElementById('db-check-2')?.addEventListener('click', async () => {
  try {
    const res = await apiFetch('/api/health/db');
    if (res.ok) showInline('Banco de dados OK.');
    else showInline('Falha na conexão com o banco.');
  } catch { showInline('Erro ao verificar banco.'); }
});

document.getElementById('google-sync-now')?.addEventListener('click', async () => {
  try {
    await apiFetch('/api/calendar/sync', { method: 'POST' });
    showInline('Google Calendar sincronizado.');
    await loadAdmin();
  } catch { showInline('Falha ao sincronizar Google Calendar.'); }
});

document.getElementById('google-disconnect-btn')?.addEventListener('click', async () => {
  showInline('Para desconectar, revogue o acesso em myaccount.google.com/permissions');
});

document.getElementById('gitvault-config-btn')?.addEventListener('click', () => {
  const adv = document.getElementById('advanced-content');
  const arrow = document.getElementById('advanced-arrow');
  if (adv) { adv.style.display = 'block'; if (arrow) arrow.textContent = '˅'; }
  document.getElementById('cfg-gitvault-repo')?.focus();
});

document.getElementById('raindrop-config-btn')?.addEventListener('click', () => {
  const adv = document.getElementById('advanced-content');
  const arrow = document.getElementById('advanced-arrow');
  if (adv) { adv.style.display = 'block'; if (arrow) arrow.textContent = '˅'; }
  document.getElementById('cfg-raindrop-token')?.focus();
});

document.getElementById('push-enable-btn')?.addEventListener('click', async () => {
  try {
    await subscribePush();
    showInline('Push ativado neste dispositivo.');
    await loadAdmin();
  } catch { showInline('Falha ao ativar push.'); }
});

document.getElementById('tg-test-btn')?.addEventListener('click', async () => {
  try {
    const res = await apiFetch('/api/health');
    if (res.ok) showInline('Backend respondendo — bot Telegram ativo.');
  } catch { showInline('Falha ao verificar bot.'); }
});

document.getElementById('tg-history-btn')?.addEventListener('click', async () => {
  try {
    const res = await apiFetch('/api/messages?limit=10');
    const data = await res.json();
    const count = (data.items || []).length;
    showInline(`${count} mensagem(ns) recentes no banco.`);
  } catch { showInline('Falha ao buscar histórico.'); }
});

document.getElementById('llm-test-btn')?.addEventListener('click', async () => {
  try {
    const res = await apiFetch('/api/agent', {
      method: 'POST',
      body: JSON.stringify({ input: 'responda apenas: ok' })
    });
    const data = await res.json();
    showInline(data.reply ? `LLM respondeu: "${data.reply}"` : 'LLM não respondeu.');
  } catch { showInline('Falha ao testar LLM.'); }
});

document.getElementById('llm-tokens-btn')?.addEventListener('click', async () => {
  showInline('Monitoramento de tokens por provider ainda não implementado.');
});

document.getElementById('db-backup-btn')?.addEventListener('click', async () => {
  try {
    await apiFetch('/api/gitvault/export', { method: 'POST' });
    showInline('Exportação de dados disparada via GitVault.');
  } catch { showInline('Falha ao exportar dados.'); }
});

document.getElementById('advanced-toggle')?.addEventListener('click', () => {
  const content = document.getElementById('advanced-content');
  const arrow = document.getElementById('advanced-arrow');
  if (!content) return;
  const isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '›' : '˅';
});

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
    applyTheme(card.dataset.theme);
  });
});

// ── Tag autocomplete para campos de texto ──
function initTagAutocomplete(inputId, suggestionsId) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(suggestionsId);
  if (!input || !box) return;

  input.addEventListener('input', () => {
    const val = input.value;
    const lastComma = val.lastIndexOf(',');
    const typing = val.slice(lastComma + 1).trim().toLowerCase();
    if (!typing || cachedTags.length === 0) { box.classList.add('hidden'); return; }

    const matches = cachedTags.filter(t =>
      t.name.toLowerCase().includes(typing) &&
      !val.split(',').map(s => s.trim()).includes(t.name)
    );

    if (matches.length === 0) { box.classList.add('hidden'); return; }

    box.innerHTML = matches.slice(0, 6).map(t => {
      const color = t.color || '#8b5cf6';
      return `<div class="tag-suggestion-item" onclick="selectTagSuggestion('${inputId}', '${suggestionsId}', '${t.name}')">
        <span class="tag-suggestion-dot" style="background:${color};"></span>
        ${t.name}
      </div>`;
    }).join('');
    box.classList.remove('hidden');
  });

  input.addEventListener('blur', () => {
    setTimeout(() => box.classList.add('hidden'), 150);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') box.classList.add('hidden');
  });
}

function selectTagSuggestion(inputId, suggestionsId, tagName) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(suggestionsId);
  if (!input) return;
  const val = input.value;
  const lastComma = val.lastIndexOf(',');
  const prefix = lastComma >= 0 ? val.slice(0, lastComma + 1) + ' ' : '';
  input.value = prefix + tagName + ', ';
  input.focus();
  if (box) box.classList.add('hidden');
}

// Inicializar autocomplete após DOM pronto
document.addEventListener('DOMContentLoaded', () => {
  initTagAutocomplete('agent-tags', 'agent-tags-suggestions');
  initTagAutocomplete('favorite-tags', 'favorite-tags-suggestions');
});


function parseList(value) {
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

let cachedSkills = [];

async function loadSkills() {
  try {
    const [skillsRes, agentsRes] = await Promise.all([
      apiFetch('/api/skills'),
      apiFetch('/api/agents'),
    ]);
    const skillData = await skillsRes.json();
    const agentData = await agentsRes.json();
    cachedSkills = skillData.items || [];
    const agents = agentData.items || [];

    // Map skill→agents
    const skillAgentMap = {};
    agents.forEach(a => {
      (a.skills || []).forEach(s => {
        if (!skillAgentMap[s]) skillAgentMap[s] = [];
        skillAgentMap[s].push(a);
      });
    });

    renderSkillsView(cachedSkills, skillAgentMap);
  } catch (err) { showError(err); }
}

function renderSkillsView(skills, skillAgentMap = {}) {
  const list = document.getElementById('skills-list');
  const statsRow = document.getElementById('skills-stats-row');
  if (!list) return;

  const search = document.getElementById('skills-search')?.value.toLowerCase() || '';
  const filtered = search ? skills.filter(s =>
    (s.title||s.name||'').toLowerCase().includes(search) ||
    (s.slug||'').toLowerCase().includes(search) ||
    (s.description||'').toLowerCase().includes(search)
  ) : skills;

  // Stats
  const totalAgents = Object.values(skillAgentMap).flat().length;
  if (statsRow) statsRow.innerHTML = [
    { label: 'Skills carregadas', val: skills.length, color: 'var(--accent)' },
    { label: 'Com agentes ativos', val: Object.keys(skillAgentMap).length, color: 'var(--accent-3)' },
    { label: 'Associações total', val: totalAgents, color: 'var(--accent-2)' },
    { label: 'Sem agentes', val: skills.filter(s=>!(skillAgentMap[s.slug||s.name]?.length)).length, color: 'var(--muted)' },
  ].map(s => `<div class="stat-card">
    <div class="stat-label">${s.label}</div>
    <div class="stat-value" style="color:${s.color};">${s.val}</div>
  </div>`).join('');

  // Skill icons map
  const icons = { brainstorming:'🧠', 'notion-sync':'📋', 'notion-research':'🔍',
    'canvas-design':'🎨', 'super-agent':'⚡', 'meeting-intelligence':'🎙',
    'skill-creator':'🔧', 'so-expert':'💡', 'user-profiling':'👤' };

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">Nenhuma skill encontrada.</div>';
    return;
  }

  list.innerHTML = filtered.map(skill => {
    const slug = skill.slug || skill.name || '';
    const title = skill.title || skill.name || slug;
    const desc = skill.description || '';
    const linkedAgents = skillAgentMap[slug] || [];
    const icon = icons[slug] || '⚙️';
    return `<div class="skill-card" onclick="openSkillDetail('${slug}')">
      <div class="skill-card-top">
        <div>
          <div class="skill-card-name">${title}</div>
          <div class="skill-card-slug">${slug}</div>
        </div>
        <div class="skill-card-icon">${icon}</div>
      </div>
      <div class="skill-card-desc">${desc.substring(0,120)}${desc.length>120?'…':''}</div>
      <div class="skill-card-footer">
        <span class="skill-agents-count">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0112 0v2"/></svg>
          ${linkedAgents.length} agente${linkedAgents.length!==1?'s':''}
        </span>
        ${linkedAgents.length > 0 ? '<span class="skill-active-badge">Em uso</span>' : ''}
      </div>
    </div>`;
  }).join('');
}

function openSkillDetail(slug) {
  const skill = cachedSkills.find(s => (s.slug||s.name) === slug);
  if (!skill) return;
  const detail = document.getElementById('skill-detail');
  const grid = document.getElementById('skills-list');
  const statsRow = document.getElementById('skills-stats-row');
  if (grid) grid.style.display = 'none';
  if (statsRow) statsRow.style.display = 'none';
  if (detail) {
    detail.style.display = 'block';
    document.getElementById('skill-detail-title').textContent = skill.title || skill.name || slug;
    document.getElementById('skill-detail-meta').innerHTML = `
      <div class="skill-meta-pill">🔧 ${slug}</div>
      ${skill.version ? `<div class="skill-meta-pill">v${skill.version}</div>` : ''}
      ${skill.author ? `<div class="skill-meta-pill">✍ ${skill.author}</div>` : ''}
    `;
    document.getElementById('skill-detail-desc').textContent = skill.description || 'Sem descrição disponível.';
    // Agents usando esta skill
    const agentsUsing = (cachedAgents || []).filter(a => (a.skills||[]).includes(slug));
    const agentsEl = document.getElementById('skill-detail-agents');
    agentsEl.innerHTML = agentsUsing.length > 0
      ? `<div class="agent-detail-section-title" style="margin-bottom:8px;">Agentes usando esta skill</div>` +
        agentsUsing.map(a => `<div class="skill-agent-row" onclick="openAgentDetail(${a.id})">
          <span class="agent-status-pill status-${a.status||'ativo'}">${a.status||'ativo'}</span>
          <span>${a.name}</span>
          <span style="margin-left:auto;font-size:11px;color:var(--muted);">${a.level}</span>
        </div>`).join('')
      : '<div class="empty-state">Nenhum agente usa esta skill ainda.</div>';

    // Assign button
    const assignBtn = document.getElementById('skill-assign-btn');
    if (assignBtn) assignBtn.onclick = () => { openAgentModal(); closeSkillDetail(); };
  }
}

function closeSkillDetail() {
  document.getElementById('skill-detail').style.display = 'none';
  document.getElementById('skills-list').style.display = 'grid';
  const statsRow = document.getElementById('skills-stats-row');
  if (statsRow) statsRow.style.display = 'grid';
}

document.getElementById('skills-search')?.addEventListener('input', () => {
  renderSkillsView(cachedSkills);
});

document.getElementById('skills-reload-btn')?.addEventListener('click', async () => {
  await loadSkills();
  toast('Skills recarregadas.', 'success', null, 2000);
});

let cachedAgents = [];

async function loadAgents() {
  try {
    const res = await apiFetch('/api/agents');
    const data = await res.json();
    cachedAgents = data.items || [];
    renderAgentsView(cachedAgents);
  } catch (err) { showError(err); }
}

function renderAgentsView(agents) {
  const filterLevel  = document.getElementById('agent-filter-level')?.value  || '';
  const filterStatus = document.getElementById('agent-filter-status')?.value || '';
  const filtered = agents.filter(a =>
    (!filterLevel  || a.level  === filterLevel) &&
    (!filterStatus || a.status === filterStatus)
  );

  const groups = { estrategico: [], tatico: [], operacional: [] };
  filtered.forEach(a => {
    const key = (a.level||'Estrategico').toLowerCase();
    (groups[key] || groups.estrategico).push(a);
  });

  ['estrategico','tatico','operacional'].forEach(level => {
    const el = document.getElementById(`agents-${level}`);
    const count = document.getElementById(`count-${level}`);
    if (count) count.textContent = groups[level].length;
    if (!el) return;
    el.innerHTML = groups[level].length > 0
      ? groups[level].map(a => agentCardHTML(a)).join('')
      : '<div class="empty-state" style="padding:20px 0;font-size:13px;">Nenhum agente</div>';
  });

  // Stats row
  const statsEl = document.getElementById('agents-stats');
  if (statsEl) {
    const total   = agents.length;
    const ativos  = agents.filter(a => a.status === 'ativo').length;
    const withSkills = agents.filter(a => (a.skills||[]).length > 0).length;
    const withDoc    = agents.filter(a => a.base_doc).length;
    statsEl.innerHTML = [
      { label: 'Total de agentes', val: total,      color: 'var(--text)' },
      { label: 'Ativos',           val: ativos,     color: 'var(--accent-3)' },
      { label: 'Com skills',       val: withSkills, color: 'var(--accent)' },
      { label: 'Com documento base', val: withDoc,  color: 'var(--accent-2)' },
    ].map(s => `<div class="stat-card">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value" style="color:${s.color};">${s.val}</div>
    </div>`).join('');
  }
}

function agentCardHTML(a) {
  const statusClass = { ativo:'status-ativo', desenvolvimento:'status-desenvolvimento', inativo:'status-inativo' }[a.status] || 'status-ativo';
  const skills = (a.skills||[]).slice(0,4).map(s => `<span class="agent-skill-chip">${s}</span>`).join('');
  const moreSkills = (a.skills||[]).length > 4 ? `<span class="agent-skill-chip">+${(a.skills||[]).length-4}</span>` : '';
  const tags = (a.tags||[]).map(t => {
    const color = t.color||'#8b5cf6';
    const bg = hexToRgba(color, 0.12);
    return `<span class="tag-inline-pill" style="background:${bg};border:1px solid ${hexToRgba(color,0.3)};color:${color};">${t.name}</span>`;
  }).join('');
  const areas = (a.areas||[]).map(ar => `<span class="tag-inline-pill" style="background:var(--surface-3);color:var(--muted);border:1px solid var(--border);">${ar}</span>`).join('');
  return `<div class="agent-card-new" onclick="openAgentDetail(${a.id})">
    <div class="agent-card-top">
      <div class="agent-card-name">${a.name}</div>
      <span class="agent-status-pill ${statusClass}">${a.status||'ativo'}</span>
    </div>
    ${a.description ? `<div class="agent-card-desc">${a.description}</div>` : ''}
    ${(a.skills||[]).length > 0 ? `<div class="agent-card-skills">${skills}${moreSkills}</div>` : ''}
    ${(a.areas||[]).length > 0 || (a.tags||[]).length > 0 ? `<div class="tag-inline-pills">${areas}${tags}</div>` : ''}
    <div class="agent-card-footer">
      <button class="agent-card-footer-btn" onclick="event.stopPropagation();openAgentModal(${a.id})">✎ Editar</button>
      <button class="agent-card-footer-btn" onclick="event.stopPropagation();activateAgentChat(${a.id})" style="color:var(--accent);">💬 Chat</button>
      <button class="agent-card-footer-btn" onclick="event.stopPropagation();deleteAgent(${a.id})" style="color:var(--danger);margin-left:auto;">Excluir</button>
    </div>
  </div>`;
}

function openAgentDetail(id) {
  const agent = cachedAgents.find(a => Number(a.id) === Number(id));
  if (!agent) return;
  const panel = document.getElementById('agent-detail');
  if (!panel) return;
  panel.classList.remove('hidden');
  document.getElementById('agent-detail-name').textContent = agent.name;

  const statusClass = { ativo:'status-ativo', desenvolvimento:'status-desenvolvimento', inativo:'status-inativo' }[agent.status] || 'status-ativo';
  const skills = (agent.skills||[]).map(s => {
    const skill = cachedSkills.find(sk => (sk.slug||sk.name) === s);
    return `<span class="agent-skill-chip" style="cursor:pointer;" onclick="navigateTo('skills');setTimeout(()=>openSkillDetail('${s}'),100)">${skill?.title||s}</span>`;
  }).join('');

  document.getElementById('agent-detail-body').innerHTML = `
    <div class="agent-detail-section">
      <div class="agent-detail-section-title">Status & Nível</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span class="agent-status-pill ${statusClass}">${agent.status||'ativo'}</span>
        <span class="agent-status-pill" style="background:var(--surface-2);color:var(--muted);border:1px solid var(--border);">${agent.level}</span>
        ${(agent.areas||[]).map(ar=>`<span class="skill-meta-pill">${ar}</span>`).join('')}
      </div>
    </div>
    ${agent.description ? `
    <div class="agent-detail-section">
      <div class="agent-detail-section-title">Propósito</div>
      <div class="agent-detail-doc">${agent.description}</div>
    </div>` : ''}
    ${(agent.skills||[]).length > 0 ? `
    <div class="agent-detail-section">
      <div class="agent-detail-section-title">Skills ativas (${(agent.skills||[]).length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${skills}</div>
    </div>` : ''}
    ${agent.base_doc ? `
    <div class="agent-detail-section">
      <div class="agent-detail-section-title">📄 Documento base</div>
      <div class="agent-detail-doc">${agent.base_doc}</div>
    </div>` : '<div class="empty-state">Sem documento base. Edite o agente para adicionar contexto rico.</div>'}
    ${(agent.tags||[]).length > 0 ? `
    <div class="agent-detail-section">
      <div class="agent-detail-section-title">Tags</div>
      <div class="tag-inline-pills">
        ${(agent.tags||[]).map(t=>{const c=t.color||'#8b5cf6';return `<span class="tag-inline-pill" style="background:${hexToRgba(c,0.12)};border:1px solid ${hexToRgba(c,0.3)};color:${c};">${t.name}</span>`;}).join('')}
      </div>
    </div>` : ''}
    <div style="padding-top:8px;border-top:1px solid var(--border);">
      <div class="agent-detail-section-title">Criado em</div>
      <div style="font-size:12px;color:var(--muted);font-family:'Fira Code',monospace;">${new Date(agent.created_at).toLocaleString('pt-BR')}</div>
    </div>
  `;

  document.getElementById('agent-detail-chat-btn').onclick = () => activateAgentChat(id);
  document.getElementById('agent-detail-edit-btn').onclick = () => { closeAgentDetail(); openAgentModal(id); };
}

function closeAgentDetail() {
  document.getElementById('agent-detail')?.classList.add('hidden');
}

function openAgentModal(editId = null) {
  const modal = document.getElementById('agent-modal');
  if (!modal) return;
  const titleEl = document.getElementById('agent-modal-title');
  const saveBtn = document.getElementById('agent-save');
  const editIdEl = document.getElementById('agent-edit-id');

  // Preencher skills picker com skills disponíveis
  const picker = document.getElementById('agent-skills-picker');
  let selectedSkills = new Set();

  if (editId) {
    const agent = cachedAgents.find(a => Number(a.id) === Number(editId));
    if (agent) {
      document.getElementById('agent-name').value = agent.name;
      document.getElementById('agent-level').value = agent.level || 'Estrategico';
      document.getElementById('agent-status').value = agent.status || 'ativo';
      document.getElementById('agent-areas').value = (agent.areas||[]).join(', ');
      document.getElementById('agent-description').value = agent.description || '';
      document.getElementById('agent-base-doc').value = agent.base_doc || '';
      document.getElementById('agent-tags').value = (agent.tags||[]).map(t=>t.name).join(', ');
      selectedSkills = new Set(agent.skills||[]);
      if (titleEl) titleEl.textContent = 'Editar Agente';
      if (saveBtn) saveBtn.textContent = 'Salvar Alterações';
      if (editIdEl) editIdEl.value = String(editId);
    }
  } else {
    document.getElementById('agent-name').value = '';
    document.getElementById('agent-level').value = 'Estrategico';
    document.getElementById('agent-status').value = 'ativo';
    document.getElementById('agent-areas').value = '';
    document.getElementById('agent-description').value = '';
    document.getElementById('agent-base-doc').value = '';
    document.getElementById('agent-tags').value = '';
    if (titleEl) titleEl.textContent = 'Novo Agente';
    if (saveBtn) saveBtn.textContent = 'Criar Agente';
    if (editIdEl) editIdEl.value = '';
  }

  if (picker) {
    picker.innerHTML = cachedSkills.map(s => {
      const slug = s.slug||s.name||'';
      const isSelected = selectedSkills.has(slug);
      return `<span class="skill-toggle-chip ${isSelected?'selected':''}" data-slug="${slug}"
        onclick="toggleSkillChip(this)">${slug}</span>`;
    }).join('') || '<span style="color:var(--muted);font-size:12px;">Nenhuma skill carregada</span>';
  }

  modal.classList.remove('hidden');
  document.getElementById('agent-name').focus();
}

function closeAgentModal() {
  document.getElementById('agent-modal')?.classList.add('hidden');
}

function toggleSkillChip(el) {
  el.classList.toggle('selected');
  const selected = [...document.querySelectorAll('.skill-toggle-chip.selected')].map(e=>e.dataset.slug);
  document.getElementById('agent-skills').value = selected.join(',');
}

function activateAgentChat(id) {
  const agent = cachedAgents.find(a => Number(a.id) === Number(id));
  if (!agent) return;
  navigateTo('chat');
  const input = document.getElementById('chat-input-full');
  if (input) {
    input.placeholder = `Falando com ${agent.name}...`;
    input.dataset.agentId = String(id);
    toast(`Agente ${agent.name} ativado no chat.`, 'success', 'Chat', 3000);
  }
}

async function deleteAgent(id) {
  if (!confirm('Excluir este agente?')) return;
  try {
    await apiFetch(`/api/agents/${id}`, { method: 'DELETE' });
    closeAgentDetail();
    await loadAgents();
    toast('Agente excluído.', 'info', null, 3000);
  } catch (err) { showError(err); }
}

// Filters
document.getElementById('agent-filter-level')?.addEventListener('change', () => renderAgentsView(cachedAgents));
document.getElementById('agent-filter-status')?.addEventListener('change', () => renderAgentsView(cachedAgents));

document.getElementById('agent-save')?.addEventListener('click', async () => {
  const editId = document.getElementById('agent-edit-id')?.value;
  const selectedSkills = [...document.querySelectorAll('.skill-toggle-chip.selected')].map(e=>e.dataset.slug);
  const payload = {
    name: document.getElementById('agent-name').value.trim(),
    level: document.getElementById('agent-level').value,
    status: document.getElementById('agent-status').value,
    areas: parseList(document.getElementById('agent-areas').value),
    skills: selectedSkills,
    tags: parseList(document.getElementById('agent-tags').value),
    description: document.getElementById('agent-description').value.trim(),
    base_doc: document.getElementById('agent-base-doc').value.trim() || null,
  };
  if (!payload.name) { toast('Informe o nome do agente.', 'warn'); return; }
  try {
    if (editId) {
      await apiFetch(`/api/agents/${editId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      await apiFetch(`/api/agents/${editId}/skills`, { method: 'POST', body: JSON.stringify({ skills: selectedSkills }) });
      await apiFetch(`/api/agents/${editId}/tags`, { method: 'POST', body: JSON.stringify({ tags: payload.tags }) });
      toast('Agente atualizado com sucesso.', 'success');
    } else {
      await apiFetch('/api/agents', { method: 'POST', body: JSON.stringify(payload) });
      toast('Agente criado com sucesso!', 'success');
    }
    closeAgentModal();
    await loadAgents();
  } catch (err) { showError(err); }
});

let cachedTags = [];

async function loadTags() {
  try {
    const res = await apiFetch('/api/tags');
    const data = await res.json();
    cachedTags = data.items || [];
    renderTagsList();
  } catch (err) {
    showError(err);
  }
}

function renderTagsList() {
  const list = document.getElementById('tags-list');
  if (!list) return;
  if (cachedTags.length === 0) {
    list.innerHTML = '<div class="empty-state">Nenhuma tag criada ainda.</div>';
    return;
  }
  list.innerHTML = cachedTags.map(tag => {
    const color = tag.color || '#8b5cf6';
    const bg = hexToRgba(color, 0.13);
    const border = hexToRgba(color, 0.35);
    return `<span class="tag-item" style="background:${bg};border:1px solid ${border};color:${color};">
      <span class="tag-item-dot" style="background:${color};"></span>
      ${tag.name}
      <button class="tag-item-del" onclick="deleteTag(${tag.id})" title="Remover">×</button>
    </span>`;
  }).join('');
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  if (isNaN(r)||isNaN(g)||isNaN(b)) return `rgba(139,92,246,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

async function deleteTag(id) {
  try {
    await apiFetch(`/api/tags/${id}`, { method: 'DELETE' });
    await loadTags();
    showInline('Tag removida.');
  } catch (err) { showError(err); }
}

// ── Tag color palette ──
let selectedTagColor = '#8b5cf6';

document.querySelectorAll('.tag-color-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.tag-color-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    selectedTagColor = swatch.dataset.color;
    const colorInput = document.getElementById('tag-color');
    if (colorInput) colorInput.value = selectedTagColor;
    updateTagPreview();
  });
});

document.getElementById('tag-color')?.addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    selectedTagColor = val;
    document.querySelectorAll('.tag-color-swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === val);
    });
    updateTagPreview();
  }
});

document.getElementById('tag-name')?.addEventListener('input', updateTagPreview);

function updateTagPreview() {
  const name = document.getElementById('tag-name')?.value.trim() || 'prévia';
  const color = selectedTagColor || '#8b5cf6';
  const pill = document.getElementById('tag-preview-pill');
  if (!pill) return;
  const bg = hexToRgba(color, 0.14);
  const border = hexToRgba(color, 0.35);
  pill.style.background = bg;
  pill.style.borderColor = border;
  pill.style.color = color;
  pill.textContent = name;
}

document.getElementById('tag-save').addEventListener('click', async () => {
  const nameEl = document.getElementById('tag-name');
  const name = nameEl?.value.trim();
  if (!name) { showInline('Informe o nome da tag.'); return; }
  const color = selectedTagColor || document.getElementById('tag-color')?.value.trim() || '#8b5cf6';
  try {
    await apiFetch('/api/tags', { method: 'POST', body: JSON.stringify({ name, color }) });
    if (nameEl) nameEl.value = '';
    showInline('Tag criada com sucesso.');
    updateTagPreview();
    await loadTags();
  } catch (err) {
    showError(err);
  }
});

// Enter no campo de nome da tag salva
document.getElementById('tag-name')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('tag-save')?.click();
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

async function loadProjects() {
  try {
    const res = await apiFetch('/api/projects');
    const data = await res.json();
    const list = document.getElementById('projects-list');
    if (!list) return;
    const items = data.items || [];
    list.innerHTML = items.length > 0
      ? items.map(p => `<div class="list-item">
          <div class="list-item-title">${p.name}</div>
          <div class="list-item-sub">${p.status || 'ativo'} · ${p.summary || 'Sem descrição'}</div>
        </div>`).join('')
      : '<div class="empty-state">Nenhum projeto criado ainda.</div>';
  } catch (err) { showError(err); }
}

async function loadKnowledge() {
  try {
    const res = await apiFetch('/api/memory');
    const data = await res.json();
    const list = document.getElementById('memory-list');
    if (!list) return;
    const items = data.items || [];
    list.innerHTML = items.length > 0
      ? items.map(m => `<div class="list-item">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span class="inbox-type-tag inbox-tag-idea">${m.type || 'insight'}</span>
            <span class="inbox-item-time">${new Date(m.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
          <div class="list-item-title">${m.content.substring(0, 120)}${m.content.length > 120 ? '...' : ''}</div>
          ${m.source_type ? `<div class="list-item-sub">Fonte: ${m.source_type}</div>` : ''}
        </div>`).join('')
      : '<div class="empty-state">Nenhum insight salvo. Analise uma reunião para gerar conhecimento.</div>';
  } catch (err) { showError(err); }
}

async function loadArchive() {
  try {
    const res = await apiFetch('/api/captures?status=archived');
    const data = await res.json();
    const list = document.getElementById('archive-list');
    if (!list) return;
    const items = data.items || [];
    list.innerHTML = items.length > 0
      ? items.map(c => `<div class="list-item">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span class="inbox-type-tag inbox-tag-${c.type || 'note'}">${c.type || 'nota'}</span>
            <span class="inbox-item-time">${new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
          <div class="list-item-title">${c.content.substring(0, 100)}${c.content.length > 100 ? '...' : ''}</div>
        </div>`).join('')
      : '<div class="empty-state">Arquivo vazio.</div>';
  } catch (err) { showError(err); }
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
    if (!list) return;
    const items = data.items || [];
    list.innerHTML = items.length > 0
      ? items.map(fav => {
          const tags = (fav.tags || []).map(t => {
            const color = t.color || '#8b5cf6';
            const bg = hexToRgba(color, 0.13);
            const border = hexToRgba(color, 0.3);
            return `<span class="tag-inline-pill" style="background:${bg};border:1px solid ${border};color:${color};">${t.name}</span>`;
          }).join('');
          const domain = (() => { try { return new URL(fav.url).hostname; } catch { return fav.url; } })();
          return `<div class="list-item" style="gap:8px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
              <div class="list-item-title">${fav.title}</div>
              <a href="${fav.url}" target="_blank" rel="noreferrer" style="font-size:11px;color:var(--accent-2);white-space:nowrap;">${domain}</a>
            </div>
            ${tags ? `<div class="tag-inline-pills">${tags}</div>` : ''}
          </div>`;
        }).join('')
      : '<div class="empty-state">Nenhum favorito salvo.</div>';
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
    showInline('Favorito salvo.');
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

document.querySelector('.search input')?.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const term = e.target.value.trim();
  if (!term) return;
  e.target.value = '';
  document.navigateTo('chat');
  setTimeout(async () => {
    const input = document.getElementById('chat-input-full');
    if (input) {
      input.value = `Buscar em tudo: "${term}"`;
      await sendChatMessage(input, document.getElementById('chat-window-full'));
    }
  }, 150);
});

window.addEventListener('online', flushQueue);

document.querySelectorAll('.filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    inboxFilter = pill.dataset.filter || 'all';
    inboxRender(inboxAllItems);
  });
});

document.querySelectorAll('.inbox-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.inbox-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    inboxCurrentType = btn.dataset.type || 'note';
  });
});

const inboxSortBtn = document.getElementById('inbox-sort-btn');
const inboxSortLabel = document.getElementById('inbox-sort-label');
inboxSortBtn && inboxSortBtn.addEventListener('click', () => {
  inboxSort = inboxSort === 'recent' ? 'type' : 'recent';
  if (inboxSortLabel) inboxSortLabel.textContent = inboxSort === 'recent' ? 'Mais recente' : 'Por tipo';
  const sorted = [...inboxAllItems];
  if (inboxSort === 'type') sorted.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
  else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  inboxRender(sorted);
});

const inboxSelectAllBtn = document.getElementById('inbox-select-all-btn');
inboxSelectAllBtn && inboxSelectAllBtn.addEventListener('click', () => {
  if (inboxSelected.size === inboxAllItems.length) {
    inboxSelected.clear();
  } else {
    inboxAllItems.forEach(i => inboxSelected.add(i.id));
  }
  inboxRender(inboxAllItems);
});

document.getElementById('bulk-convert-btn')?.addEventListener('click', async () => {
  if (!inboxSelected.size) return;
  try {
    await apiFetch('/api/captures/bulk', { method: 'POST', body: JSON.stringify({ ids: [...inboxSelected], action: 'convert_task' }) });
    showInline('Convertidos em tarefas com sucesso.');
    inboxSelected.clear();
    await refreshCaptures();
  } catch (err) { showError(err); }
});

document.getElementById('bulk-archive-btn')?.addEventListener('click', async () => {
  if (!inboxSelected.size) return;
  try {
    await apiFetch('/api/captures/bulk', { method: 'POST', body: JSON.stringify({ ids: [...inboxSelected], action: 'archive' }) });
    showInline('Itens arquivados.');
    inboxSelected.clear();
    await refreshCaptures();
  } catch (err) { showError(err); }
});

document.getElementById('bulk-delete-btn')?.addEventListener('click', async () => {
  if (!inboxSelected.size) return;
  try {
    await apiFetch('/api/captures/bulk', { method: 'POST', body: JSON.stringify({ ids: [...inboxSelected], action: 'delete' }) });
    inboxSelected.clear();
    await refreshCaptures();
  } catch (err) { showError(err); }
});

document.getElementById('bulk-cancel-btn')?.addEventListener('click', () => {
  inboxSelected.clear();
  inboxRender(inboxAllItems);
});

document.getElementById('inbox-ai-btn')?.addEventListener('click', async () => {
  try {
    const uncategorized = inboxAllItems.filter(i => !i.type || i.type === 'note').map(i => i.content).join('\n');
    const prompt = `Analise estes itens do inbox e sugira onde cada um deve ir (tarefa, projeto, conhecimento ou favoritos):\n${uncategorized}`;
    const res = await apiFetch('/api/agent', { method: 'POST', body: JSON.stringify({ input: prompt }) });
    const data = await res.json();
    if (data.reply) showBanner(data.reply);
  } catch (err) {
    showError(err);
  }
});

async function initApp() {
  const savedTheme = localStorage.getItem('andclaw_theme') || 'auto';
  applyTheme(savedTheme);
  document.querySelectorAll('.theme-card').forEach(c => {
    c.classList.toggle('active', c.dataset.theme === savedTheme);
  });

  // Tratar retorno do OAuth Google
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('google') === 'connected') {
    history.replaceState({}, '', '/'); // limpar query string
    showBanner('Google conectado com sucesso! Sincronizando calendário...');
    setTimeout(() => hideBanner(), 4000);
  }
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
  logPush('App inicializado com sucesso', 'success', 'Sistema');
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
  await loadProjects();
  await loadKnowledge();
  await loadArchive();
}

// ── SISTEMA DE ABAS (Skills e Agents) ────────────────────────

function initSkillTabs() {
  document.querySelectorAll('.sk-tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.sk-tab[data-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('[id^="sktab-"]').forEach(p => p.classList.remove('active'));
      document.getElementById(`sktab-${target}`)?.classList.add('active');
    });
  });
}

function initAgentTabs() {
  document.querySelectorAll('.sk-tab[data-agtab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.agtab;
      document.querySelectorAll('.sk-tab[data-agtab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('[id^="agtab-"]').forEach(p => p.classList.remove('active'));
      document.getElementById(`agtab-${target}`)?.classList.add('active');
    });
  });
}

// ── SKILLS CREATE ────────────────────────────────────────────

const AVAILABLE_TOOLS = ['read_file','write_file','ls','glob','grep','update_user_profile','web_search','run_command','create_file'];

const SKILL_TEMPLATES = {
  analyst: { title:'Analista de Dados', slug:'analista-dados', description:'Analisa dados, gera insights e relatórios estruturados quando solicitado.', tools:['read_file','grep'], content:`## Quando Ativar\n- Pedidos de análise, relatórios, gráficos ou insights de dados\n\n## Protocolo\n1. Identificar fonte de dados\n2. Validar completude\n3. Aplicar análise solicitada\n4. Gerar relatório em markdown com tabelas\n\n## Formato de saída\nSempre inclua: resumo executivo, dados detalhados, recomendações` },
  monitor: { title:'Monitor & Alertas', slug:'monitor-alertas', description:'Monitora métricas, detecta anomalias e aciona alertas de acordo com thresholds.', tools:['read_file','web_search'], content:`## Quando Ativar\n- Verificações de saúde, anomalias, alertas\n\n## Protocolo\n1. Coletar métricas atuais\n2. Comparar com baseline\n3. Calcular desvio padrão\n4. Acionar alerta se threshold > X%` },
  writer: { title:'Redator & Documentador', slug:'redator-docs', description:'Cria e atualiza documentação técnica, resumos e comunicações.', tools:['read_file','write_file'], content:`## Quando Ativar\n- Criação de docs, READMEs, post-mortems, relatórios\n\n## Protocolo\n1. Entender audiência\n2. Estruturar seções\n3. Redigir em linguagem clara\n4. Revisar e formatar` },
  integrator: { title:'Integrador de APIs', slug:'integrador-api', description:'Consome e integra APIs externas, transforma dados e sincroniza sistemas.', tools:['web_search','read_file','write_file'], content:`## Quando Ativar\n- Integrações, sincronizações, chamadas a APIs externas\n\n## Protocolo\n1. Validar endpoint e credenciais\n2. Realizar chamada\n3. Validar resposta (status, schema)\n4. Transformar e entregar dados` },
  researcher: { title:'Pesquisador', slug:'pesquisador', description:'Pesquisa informações, consolida fontes e gera relatórios de inteligência.', tools:['web_search','read_file'], content:`## Quando Ativar\n- Pesquisas, benchmarks, análise de concorrência\n\n## Protocolo\n1. Definir escopo da pesquisa\n2. Buscar em múltiplas fontes\n3. Validar credibilidade\n4. Sintetizar em relatório` },
};

const AGENT_DOC_TEMPLATES = {
  aws: `# AWS Cloud Policies

## Tagging Obrigatório
Todos os recursos AWS devem ter as tags:
- Environment: prod|staging|dev
- Owner: email do responsável
- CostCenter: código do centro de custo
- Project: nome do projeto

## Regiões Aprovadas
- us-east-1 (primária)
- sa-east-1 (Brasil)

## Thresholds de Custo
- Alerta em 80% do budget mensal
- Escalação em 95%`,
  incident: `# Runbook de Resposta a Incidentes

## Severidades
- P1: Sistema crítico fora do ar — resposta em 15min
- P2: Degradação severa — resposta em 1h
- P3: Impacto parcial — resposta em 4h

## Escalação
1. On-call → Slack #incidents
2. +30min sem resolução → Acionar tech lead
3. +1h → Acionar CTO`,
  datadog: `# Datadog Guidelines

## Dashboards padrão
- Infrastructure Overview: monitoramento de hosts
- APM Services: latência e erros por serviço
- Cost Analysis: custo diário por conta AWS

## Alertas configurados
- CPU > 85% por 10min → P2
- Disco > 90% → P1
- Error rate > 5% → P2`,
  org: `# Estrutura da Organização

## Times
- Cloud & Infra: AWS, servidores, redes
- Desenvolvimento: aplicações e integrações
- Suporte: atendimento e incident response

## Hierarquia de decisão
- Configurações de prod: aprovação do tech lead
- Custos acima de R$5k: aprovação do gestor`,
  client: `# Catálogo de Clientes

## MDR Saúde
- Ambiente: AWS us-east-1
- Stack: TOTVS Fluig + RDS PostgreSQL
- SLA: 99.9% disponibilidade

## Configurações por cliente
Manter mapa atualizado com: região, serviços, contatos, budget mensal`,
};

function openSkillCreate() {
  document.querySelectorAll('.sk-tab[data-tab]').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === 'criar');
  });
  document.querySelectorAll('[id^="sktab-"]').forEach(p => p.classList.remove('active'));
  document.getElementById('sktab-criar')?.classList.add('active');
  initSkillToolsPicker();
}

function initSkillToolsPicker() {
  const picker = document.getElementById('sk-tools-picker');
  if (!picker || picker.children.length > 0) return;
  picker.innerHTML = AVAILABLE_TOOLS.map(t =>
    `<span class="sk-tool-chip" data-tool="${t}" onclick="toggleToolChip(this)">${t}</span>`
  ).join('');
}

function toggleToolChip(el) { el.classList.toggle('selected'); }

function applySkillTemplate(key) {
  const t = SKILL_TEMPLATES[key];
  if (!t) return;
  document.getElementById('sk-title').value = t.title;
  document.getElementById('sk-slug').value = t.slug;
  document.getElementById('sk-description').value = t.description;
  document.getElementById('sk-content').value = t.content;
  document.querySelectorAll('.sk-tool-chip').forEach(c => {
    c.classList.toggle('selected', t.tools.includes(c.dataset.tool));
  });
}

// Auto-slug from title
document.getElementById('sk-title')?.addEventListener('input', (e) => {
  const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  document.getElementById('sk-slug').value = slug;
});

document.getElementById('sk-save-btn')?.addEventListener('click', async () => {
  const title = document.getElementById('sk-title')?.value.trim();
  const slug  = document.getElementById('sk-slug')?.value.trim();
  const desc  = document.getElementById('sk-description')?.value.trim();
  const content = document.getElementById('sk-content')?.value.trim();
  const refdoc  = document.getElementById('sk-refdoc')?.value.trim();
  const tools = [...document.querySelectorAll('.sk-tool-chip.selected')].map(c => c.dataset.tool);

  if (!title || !slug) { toast('Preencha nome e slug.', 'warn'); return; }

  const fullContent = refdoc ? `${content}\n\n---\n## 📎 Documento de Referência\n\n${refdoc}` : content;

  try {
    await apiFetch('/api/skills', {
      method: 'POST',
      body: JSON.stringify({ slug, title, description: desc, content: fullContent, allowedTools: tools })
    });
    toast(`Skill "${title}" criada com sucesso!`, 'success');
    // Limpar form
    ['sk-title','sk-slug','sk-description','sk-content','sk-refdoc'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = '';
    });
    document.querySelectorAll('.sk-tool-chip').forEach(c => c.classList.remove('selected'));
    // Voltar para biblioteca e recarregar
    document.querySelectorAll('.sk-tab[data-tab]').forEach(t => t.classList.toggle('active', t.dataset.tab==='biblioteca'));
    document.querySelectorAll('[id^="sktab-"]').forEach(p => p.classList.remove('active'));
    document.getElementById('sktab-biblioteca')?.classList.add('active');
    await loadSkills();
  } catch (err) { showError(err); }
});

document.getElementById('sk-ai-help-btn')?.addEventListener('click', async () => {
  const title = document.getElementById('sk-title')?.value.trim();
  const desc  = document.getElementById('sk-description')?.value.trim();
  if (!title && !desc) { toast('Preencha nome ou descrição primeiro.', 'warn'); return; }
  toast('Gerando sugestões com IA...', 'info', null, 3000);
  try {
    const res = await apiFetch('/api/agent', {
      method: 'POST',
      body: JSON.stringify({ input: `Crie um template de skill para: "${title||desc}". Retorne em markdown com seções: ## Quando Ativar, ## Protocolo (passos numerados), ## Formato de saída. Seja específico e prático.` })
    });
    const data = await res.json();
    if (data.reply) {
      const current = document.getElementById('sk-content')?.value || '';
      if (document.getElementById('sk-content')) {
        document.getElementById('sk-content').value = current ? current + '\n\n' + data.reply : data.reply;
      }
      toast('Sugestão da IA aplicada!', 'success');
    }
  } catch (err) { showError(err); }
});

// openSkillDetail: mudar para aba detalhes
function openSkillDetail(slug) {
  const skill = cachedSkills.find(s => (s.slug||s.name) === slug);
  if (!skill) return;
  const agentsUsing = (cachedAgents||[]).filter(a => (a.skills||[]).includes(slug));
  const icons = { brainstorming:'🧠','notion-sync':'📋','notion-research':'🔍','canvas-design':'🎨','super-agent':'⚡','meeting-intelligence':'🎙','skill-creator':'🔧','so-expert':'💡','user-profiling':'👤' };
  const icon = icons[slug] || '⚙️';
  const tools = (skill.allowedTools||[]).map(t => `<span class="sk-tool-chip selected" style="cursor:default;">${t}</span>`).join('');

  document.getElementById('skill-detail-inner').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border);">
      <div class="skill-card-icon" style="width:48px;height:48px;font-size:24px;">${icon}</div>
      <div>
        <div style="font-size:20px;font-weight:600;color:var(--text);">${skill.title||skill.name}</div>
        <div style="font-size:12px;color:var(--muted);font-family:'Fira Code',monospace;">${slug} · ${skill.sectionCount||0} seções</div>
      </div>
      <button class="btn primary" style="margin-left:auto;" onclick="openAgentWizard()">Atribuir a agente</button>
    </div>
    <div class="agent-detail-section-title">Descrição</div>
    <div class="agent-detail-doc" style="margin-bottom:16px;">${skill.description||'Sem descrição.'}</div>
    ${tools ? `<div class="agent-detail-section-title" style="margin-bottom:8px;">Ferramentas permitidas</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">${tools}</div>` : ''}
    <div class="agent-detail-section-title" style="margin-bottom:8px;">Agentes usando esta skill (${agentsUsing.length})</div>
    ${agentsUsing.length > 0
      ? agentsUsing.map(a => `<div class="skill-agent-row" onclick="openAgentDetailTab(${a.id})">
          <span class="agent-status-pill status-${a.status||'ativo'}">${a.status||'ativo'}</span>
          <span>${a.name}</span>
          <span style="margin-left:auto;font-size:11px;color:var(--muted);">${a.level}</span>
        </div>`).join('')
      : '<div class="empty-state">Nenhum agente usa esta skill. Clique em "Atribuir a agente".</div>'
    }
  `;

  // Ativar aba de detalhes
  const detailTab = document.getElementById('sk-tab-detalhes');
  if (detailTab) detailTab.style.display = '';
  document.querySelectorAll('.sk-tab[data-tab]').forEach(t => t.classList.toggle('active', t.dataset.tab==='detalhes'));
  document.querySelectorAll('[id^="sktab-"]').forEach(p => p.classList.remove('active'));
  document.getElementById('sktab-detalhes')?.classList.add('active');
}

// ── AGENT WIZARD ──────────────────────────────────────────────

let wizardCurrentStep = 1;

function openAgentWizard(editId = null) {
  wizardCurrentStep = 1;
  document.querySelectorAll('.sk-tab[data-agtab]').forEach(t => t.classList.toggle('active', t.dataset.agtab==='wizard'));
  document.querySelectorAll('[id^="agtab-"]').forEach(p => p.classList.remove('active'));
  document.getElementById('agtab-wizard')?.classList.add('active');
  wizardNext(1);
  initSkillsPicker();
  if (editId) fillWizardForEdit(editId);
}

// Compatibilidade com código antigo
function openAgentModal(editId = null) { openAgentWizard(editId); }
function closeAgentModal() { }

function fillWizardForEdit(id) {
  const agent = cachedAgents.find(a => Number(a.id) === Number(id));
  if (!agent) return;
  document.getElementById('agent-edit-id').value = String(id);
  document.getElementById('agent-name').value = agent.name;
  document.getElementById('agent-level').value = agent.level||'Estrategico';
  document.getElementById('agent-status').value = agent.status||'ativo';
  document.getElementById('agent-areas').value = (agent.areas||[]).join(', ');
  document.getElementById('agent-description').value = agent.description||'';
  document.getElementById('agent-tags').value = (agent.tags||[]).map(t=>t.name).join(', ');
  document.getElementById('agent-base-doc').value = agent.base_doc||'';
  const selectedSkills = new Set(agent.skills||[]);
  document.querySelectorAll('.skill-toggle-chip').forEach(c => {
    c.classList.toggle('selected', selectedSkills.has(c.dataset.slug));
  });
  const saveBtn = document.getElementById('agent-save');
  if (saveBtn) saveBtn.textContent = '💾 Salvar Alterações';
}

function wizardNext(step) {
  document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`wstep-${step}`)?.classList.add('active');
  document.querySelectorAll('.wizard-step').forEach((s, i) => {
    s.classList.remove('active','done');
    if (i+1 < step) s.classList.add('done');
    if (i+1 === step) s.classList.add('active');
  });
  wizardCurrentStep = step;
  if (step === 4) buildWizardReview();
}

function buildWizardReview() {
  const name  = document.getElementById('agent-name')?.value||'—';
  const level = document.getElementById('agent-level')?.value||'—';
  const status= document.getElementById('agent-status')?.value||'—';
  const areas = document.getElementById('agent-areas')?.value||'—';
  const desc  = document.getElementById('agent-description')?.value||'—';
  const skills= [...document.querySelectorAll('.skill-toggle-chip.selected')].map(c=>c.dataset.slug);
  const tags  = document.getElementById('agent-tags')?.value||'—';
  const hasDoc= (document.getElementById('agent-base-doc')?.value||'').length > 10;

  document.getElementById('wizard-review').innerHTML = `
<strong>Nome:</strong> ${name}
<strong>Nível:</strong> ${level} | <strong>Status:</strong> ${status}
<strong>Áreas:</strong> ${areas}
<strong>Propósito:</strong> ${desc.substring(0,200)}${desc.length>200?'…':''}
<strong>Skills (${skills.length}):</strong> ${skills.join(', ')||'nenhuma'}
<strong>Tags:</strong> ${tags}
<strong>Documento base:</strong> ${hasDoc ? '✅ Configurado' : '⚠️ Não configurado (recomendado)'}
  `.trim();
}

function initSkillsPicker() {
  const picker = document.getElementById('agent-skills-picker');
  if (!picker) return;
  picker.innerHTML = cachedSkills.map(s => {
    const slug = s.slug||s.name||'';
    return `<span class="skill-toggle-chip" data-slug="${slug}" onclick="toggleSkillChip(this)" title="${s.description||''}">${slug}</span>`;
  }).join('') || '<span style="color:var(--muted);font-size:12px;">Nenhuma skill carregada</span>';
}

function applyAgentDocTemplate(key) {
  const doc = AGENT_DOC_TEMPLATES[key];
  if (!doc) return;
  const el = document.getElementById('agent-base-doc');
  if (el) el.value = (el.value ? el.value + '\n\n---\n\n' : '') + doc;
}

// Upload de arquivo de referência
document.getElementById('agent-doc-upload')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const el = document.getElementById('agent-base-doc');
    if (el) el.value = (el.value ? el.value + '\n\n---\n\n' : '') + ev.target.result;
    toast(`Arquivo "${file.name}" carregado no documento base.`, 'success');
  };
  reader.readAsText(file);
});

function openAgentDetailTab(id) {
  const agent = cachedAgents.find(a => Number(a.id) === Number(id));
  if (!agent) return;
  const statusClass = {ativo:'status-ativo',desenvolvimento:'status-desenvolvimento',inativo:'status-inativo'}[agent.status]||'status-ativo';
  const skills = (agent.skills||[]).map(s => {
    const sk = cachedSkills.find(x=>(x.slug||x.name)===s);
    return `<span class="agent-skill-chip" style="cursor:pointer;" onclick="openSkillDetail('${s}')" title="Ver skill">${sk?.title||s}</span>`;
  }).join('');

  document.getElementById('agent-detail-inner').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-size:20px;font-weight:600;color:var(--text);">${agent.name}</div>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <span class="agent-status-pill ${statusClass}">${agent.status||'ativo'}</span>
          <span class="agent-status-pill" style="background:var(--surface-2);color:var(--muted);border:1px solid var(--border);">${agent.level}</span>
        </div>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;">
        <button class="btn ghost" onclick="activateAgentChat(${agent.id})">💬 Chat</button>
        <button class="btn ghost" onclick="openAgentWizard(${agent.id})">✎ Editar</button>
        <button class="btn ghost" style="color:var(--danger);" onclick="deleteAgent(${agent.id})">Excluir</button>
      </div>
    </div>
    ${agent.description?`<div class="agent-detail-section-title">Propósito</div><div class="agent-detail-doc" style="margin-bottom:16px;">${agent.description}</div>`:''}
    ${(agent.skills||[]).length>0?`<div class="agent-detail-section-title" style="margin-bottom:8px;">Skills ativas (${(agent.skills||[]).length})</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">${skills}</div>`:''}
    ${agent.base_doc?`<div class="agent-detail-section-title" style="margin-bottom:8px;">📄 Documento Base</div><div class="agent-detail-doc">${agent.base_doc.substring(0,800)}${agent.base_doc.length>800?'…':''}</div>`:'<div class="empty-state">Sem documento base.</div>'}
    ${(agent.areas||[]).length>0?`<div class="agent-detail-section-title" style="margin:14px 0 8px;">Áreas</div><div style="display:flex;flex-wrap:wrap;gap:5px;">${(agent.areas||[]).map(ar=>`<span class="tag-inline-pill" style="background:var(--surface-3);color:var(--muted);border:1px solid var(--border);">${ar}</span>`).join('')}</div>`:''}
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);font-size:11px;color:var(--muted);font-family:'Fira Code',monospace;">Criado em ${new Date(agent.created_at).toLocaleString('pt-BR')}</div>
  `;

  const detailTab = document.getElementById('agtab-detail');
  if (detailTab) detailTab.style.display = '';
  document.querySelectorAll('.sk-tab[data-agtab]').forEach(t => t.classList.toggle('active', t.dataset.agtab==='detail'));
  document.querySelectorAll('[id^="agtab-"]').forEach(p => p.classList.remove('active'));
  document.getElementById('agtab-detail')?.classList.add('active');
}

// Sobrescrever openAgentDetail para usar a aba
function openAgentDetail(id) { openAgentDetailTab(id); }

document.getElementById('sk-ai-help-btn-agent')?.addEventListener('click', async () => {
  buildWizardReview();
  const name = document.getElementById('agent-name')?.value||'';
  const desc = document.getElementById('agent-description')?.value||'';
  if (!name) { toast('Preencha o nome do agente primeiro.', 'warn'); return; }
  toast('Gerando melhorias com IA...', 'info', null, 3000);
  try {
    const res = await apiFetch('/api/agent', {
      method: 'POST',
      body: JSON.stringify({ input: `Analise este agente e sugira melhorias para torná-lo mais eficaz:\nNome: ${name}\nPropósito: ${desc}\n\nSugira: 1) Refinamentos no propósito, 2) Skills recomendadas, 3) Seções para o documento base, 4) Pontos de atenção. Seja específico e prático.` })
    });
    const data = await res.json();
    if (data.reply) {
      const recEl = document.getElementById('wizard-review');
      if (recEl) recEl.innerHTML += '\n\n' + data.reply.replace(/\n/g,'\n');
      toast('Análise da IA concluída!', 'success');
    }
  } catch (err) { showError(err); }
});

initSkillTabs();
initAgentTabs();
initSkillToolsPicker();

initApp();
