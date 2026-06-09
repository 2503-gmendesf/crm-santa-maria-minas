/* ============================================================
   ADMIN.JS — Painel de Configurações (gerenciamento de usuários)
   Acesso exclusivo do Gerente Master
   ============================================================ */

async function renderConfiguracoes() {
  const el = document.getElementById('page-configuracoes');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">⚙️ Configurações</h1>
        <p class="page-subtitle">Gerencie usuários, unidades e dados do sistema</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="gerarDemoClick(this)">🌱 Gerar dados demo</button>
        <button class="btn btn-primary btn-sm" onclick="abrirFormUsuario()">+ Novo Usuário</button>
      </div>
    </div>
    <div style="padding:16px 24px;flex:1;overflow:auto">
      <div id="admin-usuarios-list">Carregando usuários...</div>
    </div>
  `;
  await renderListaUsuarios();
}

async function renderListaUsuarios() {
  const cont = document.getElementById('admin-usuarios-list');
  if (!cont) return;
  const usuarios = await listarUsuarios(true);
  const unidades = await listarUnidades();

  cont.innerHTML = `
    <table class="table">
      <thead>
        <tr><th>Nome</th><th>E-mail</th><th>Tipo</th><th>Unidade</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${usuarios.map(u => {
          const unidade = u.unidade_id ? (unidades.find(x => x.id === u.unidade_id)?.nome || '—') : '—';
          return `
          <tr>
            <td>${u.nome}</td>
            <td>${u.email}</td>
            <td>${u.tipo === 'master' ? '👑 Gerente Master' : '🧑‍💼 Auxiliar Comercial'}</td>
            <td>${unidade}</td>
            <td>${u.ativo === false ? '<span class="badge badge-frio">Inativo</span>' : '<span class="badge badge-quente">Ativo</span>'}</td>
            <td style="text-align:right;white-space:nowrap">
              <button class="btn btn-ghost btn-sm" onclick="abrirFormUsuario('${u.id}')">✏️ Editar</button>
              <button class="btn btn-ghost btn-sm" onclick="toggleAtivoUsuario('${u.id}', ${u.ativo === false})">${u.ativo === false ? '✅ Reativar' : '🚫 Desativar'}</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function abrirFormUsuario(id) {
  const editando = !!id;
  let usuario = null;
  if (editando) {
    const usuarios = await listarUsuarios();
    usuario = usuarios.find(u => u.id === id);
    if (!usuario) return;
  }
  const unidades = await listarUnidades();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${editando ? '✏️ Editar Usuário' : '➕ Novo Usuário'}</h2>
        <button class="btn btn-ghost btn-icon" onclick="this.closest('.modal-backdrop').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nome <span class="required">*</span></label>
          <input class="form-control" id="fu-nome" value="${usuario?.nome || ''}">
        </div>
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">E-mail <span class="required">*</span></label>
          <input class="form-control" id="fu-email" type="email" value="${usuario?.email || ''}" ${editando ? 'disabled' : ''}>
        </div>
        ${!editando ? `
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Senha provisória <span class="required">*</span></label>
          <input class="form-control" id="fu-senha" type="password" placeholder="Mínimo 6 caracteres">
        </div>` : ''}
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Tipo de Acesso <span class="required">*</span></label>
          <select class="form-control" id="fu-tipo" onchange="document.getElementById('fu-unidade-wrap').style.display = this.value==='master' ? 'none' : 'block'">
            <option value="auxiliar" ${usuario?.tipo === 'auxiliar' ? 'selected' : ''}>Auxiliar Comercial (acesso à unidade)</option>
            <option value="master" ${usuario?.tipo === 'master' ? 'selected' : ''}>Gerente Master (acesso à rede inteira)</option>
          </select>
        </div>
        <div class="form-group" id="fu-unidade-wrap" style="margin-top:12px;${usuario?.tipo === 'master' ? 'display:none' : ''}">
          <label class="form-label">Unidade</label>
          <select class="form-control" id="fu-unidade">
            <option value="">Selecione...</option>
            ${unidades.map(u => `<option value="${u.id}" ${usuario?.unidade_id === u.id ? 'selected' : ''}>${u.nome}</option>`).join('')}
          </select>
        </div>
        ${editando ? `
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Status</label>
          <select class="form-control" id="fu-ativo">
            <option value="true" ${usuario?.ativo !== false ? 'selected' : ''}>Ativo</option>
            <option value="false" ${usuario?.ativo === false ? 'selected' : ''}>Inativo</option>
          </select>
        </div>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
        <button class="btn btn-primary" onclick="salvarUsuario('${editando ? id : ''}', this)">${editando ? 'Salvar Alterações' : 'Criar Usuário'}</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
}

async function salvarUsuario(id, btn) {
  const nome  = document.getElementById('fu-nome')?.value?.trim();
  const tipo  = document.getElementById('fu-tipo')?.value;
  const unidadeVal = document.getElementById('fu-unidade')?.value;
  const unidade_id = unidadeVal ? parseInt(unidadeVal) : null;

  if (!nome || !tipo) { toast('Preencha todos os campos obrigatórios', 'error'); return; }
  if (tipo === 'auxiliar' && !unidade_id) { toast('Selecione a unidade do auxiliar', 'error'); return; }

  btn.disabled = true;

  if (id) {
    const ativoVal = document.getElementById('fu-ativo')?.value;
    const { error } = await adminAtualizarUsuario(id, { nome, tipo, unidade_id, ativo: ativoVal !== 'false' });
    if (error) { toast('Erro: ' + error, 'error'); btn.disabled = false; return; }
    toast('Usuário atualizado com sucesso', 'success');
  } else {
    const email = document.getElementById('fu-email')?.value?.trim();
    const senha = document.getElementById('fu-senha')?.value;
    if (!email || !senha || senha.length < 6) { toast('Informe e-mail e senha (mín. 6 caracteres)', 'error'); btn.disabled = false; return; }
    const { error } = await adminCriarUsuario({ nome, email, senha, tipo, unidade_id });
    if (error) { toast('Erro: ' + error, 'error'); btn.disabled = false; return; }
    toast('Usuário criado com sucesso', 'success');
  }

  invalidarCacheUsuarios();
  btn.closest('.modal-backdrop').remove();
  await renderListaUsuarios();
}

async function toggleAtivoUsuario(id, reativar) {
  const { error } = reativar
    ? await adminAtualizarUsuario(id, { ativo: true })
    : await adminDesativarUsuario(id);
  if (error) { toast('Erro: ' + error, 'error'); return; }
  invalidarCacheUsuarios();
  toast(reativar ? 'Usuário reativado' : 'Usuário desativado', 'success');
  await renderListaUsuarios();
}

async function gerarDemoClick(btn) {
  if (!confirm('Isso irá gerar 30 leads de demonstração no banco de dados. Continuar?')) return;
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = '⏳ Gerando...';
  try {
    await gerarESalvarLeadsDemo((feito, total) => { btn.textContent = `⏳ Gerando ${feito}/${total}...`; });
    toast('Dados demo gerados com sucesso!', 'success');
    const pagAtiva = document.querySelector('.page.active')?.id;
    if (pagAtiva === 'page-dashboard') renderDashboard();
    else if (pagAtiva === 'page-kanban') renderKanban();
    else if (pagAtiva === 'page-leads') atualizarTabelaLeads?.();
    atualizarBadges();
  } catch (e) {
    toast('Erro ao gerar dados demo: ' + (e?.message || e), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}
