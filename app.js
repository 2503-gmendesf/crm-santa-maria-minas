/* ============================================================
   APP.JS — Inicialização, router e utilitários globais
   ============================================================ */

// ── Toast ──
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <span class="toast__icon">${icons[type]||'ℹ️'}</span>
    <span class="toast__message">${message}</span>
    <span class="toast__close" onclick="this.parentElement.remove()">✕</span>`;
  container.appendChild(t);
  setTimeout(() => { t.classList.add('hiding'); setTimeout(() => t.remove(), 300); }, 3500);
}

// ── Router ──
let paginaAtual = null;

function navegar(pagina) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));

  const el = document.getElementById(`page-${pagina}`);
  if (el) el.classList.add('active');

  const nav = document.querySelector(`[data-page="${pagina}"]`);
  if (nav) nav.classList.add('active');

  paginaAtual = pagina;

  // Renderizar a página correspondente
  switch (pagina) {
    case 'dashboard':   renderDashboard(); break;
    case 'kanban':      renderKanban();    break;
    case 'leads':       renderLeads();     break;
    case 'relatorios':  if (isMaster()) renderRelatorios(); break;
    case 'configuracoes': if (isMaster()) renderConfiguracoes(); break;
  }
}

// ── Sidebar ──
function initSidebar() {
  const user = getUser();
  const unidade = user.unidade_id ? getUnidade(user.unidade_id) : null;

  document.getElementById('sidebar-user-nome').textContent  = user.nome;
  document.getElementById('sidebar-user-cargo').textContent = unidade ? unidade.nome.split('—')[1]?.trim() || '' : 'Gerente Master';

  const avatar = document.getElementById('sidebar-user-avatar');
  avatar.textContent = initials(user.nome);
  avatar.style.background = avatarColor(user.nome);

  // Ocultar itens restritos
  if (!isMaster()) {
    document.querySelectorAll('[data-master-only]').forEach(el => el.style.display = 'none');
  }

  atualizarBadges();
}

function atualizarBadges() {
  const leads = leadsVisiveis(DB.leads);

  // Badge: leads sem contato há +5 dias
  const semContato = leads.filter(l => {
    if (['matricula','perdido'].includes(l.etapa_funil)) return false;
    return diasDesde(l.data_atualizacao) >= 5;
  }).length;

  // Badge: ações vencidas
  const acVencidas = leads.filter(l => l.data_proxima_acao && new Date(l.data_proxima_acao) < new Date() && !['matricula','perdido'].includes(l.etapa_funil)).length;

  const badgeLeads  = document.getElementById('badge-leads');
  const badgeKanban = document.getElementById('badge-kanban');

  if (badgeLeads)  { badgeLeads.textContent  = semContato; badgeLeads.style.display  = semContato  > 0 ? 'inline' : 'none'; }
  if (badgeKanban) { badgeKanban.textContent = acVencidas;  badgeKanban.style.display = acVencidas > 0 ? 'inline' : 'none'; }
}

// ── Toggle sidebar ──
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ── Login ──
document.getElementById('form-login').addEventListener('submit', async function(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const senha = document.getElementById('login-senha').value;
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;
  const ok = await login(email, senha);
  if (btn) btn.disabled = false;
  if (ok) {
    await iniciarApp();
  } else {
    toast('E-mail ou senha incorretos', 'error');
    document.getElementById('login-senha').value = '';
  }
});

async function iniciarApp() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app').style.display = 'flex';
  await carregarDadosIniciais();
  initSidebar();
  navegar('dashboard');
}

async function fazerLogout() {
  await logout();
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('login-email').value = '';
  document.getElementById('login-senha').value = '';
  paginaAtual = null;
}

// ── Atalhos de teclado ──
document.addEventListener('keydown', function(e) {
  // N = Novo lead (exceto em inputs)
  if (e.key === 'n' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) && getUser()) {
    abrirFormLead();
  }
  // ESC = Fechar modais/drawers
  if (e.key === 'Escape') {
    document.querySelector('.modal-backdrop')?.remove();
    fecharDrawer();
  }
});

// ── Inicialização ──
document.addEventListener('DOMContentLoaded', async function() {
  checarConfigSupabase();

  if (await restoreSession()) {
    await iniciarApp();
  } else {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app').style.display = 'none';
  }
});
