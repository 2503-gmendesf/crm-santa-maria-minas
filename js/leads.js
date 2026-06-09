/* ============================================================
   LEADS.JS — Lista de leads, detalhe e formulários
   ============================================================ */

let leadsFiltros = {
  busca: '', unidade: '', etapa: '', temperatura: '', origem: '',
  serie: '', responsavel: '', periodo: '', com_acao: ''
};
let leadsOrdem  = { col: 'data_criacao', dir: 'desc' };
let leadsPagina = 1;
const LEADS_POR_PAGINA = 25;
let leadsSelecionados = new Set();
let filtroAberto = false;

// ── Página de Lista de Leads ──
function renderLeads() {
  const el = document.getElementById('page-leads');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">👥 Lista de Leads</h1>
        <p class="page-subtitle" id="leads-count-label"></p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" id="btn-acoes-lote" style="display:none" onclick="abrirAcoesLote()">
          Ações em Lote (<span id="lote-count">0</span>)
        </button>
        <button class="btn btn-primary" onclick="abrirFormLead()">+ Novo Lead</button>
      </div>
    </div>
    <div class="page-body" style="display:flex;flex-direction:column;gap:16px">
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="leads-search" placeholder="Buscar por nome, telefone ou e-mail..." oninput="debounceSearch(this.value)">
        </div>
        <button class="btn btn-secondary btn-sm" onclick="toggleFiltros()">
          🔧 Filtros ${filtroAberto ? '▲' : '▼'}
        </button>
        <button class="btn btn-ghost btn-sm" onclick="limparFiltros()" title="Limpar filtros">✕ Limpar</button>
      </div>

      <div id="filtros-panel" style="display:${filtroAberto?'block':'none'}">
        <div class="filter-panel">
          ${isMaster() ? `<div class="form-group">
            <label class="form-label">Unidade</label>
            <select class="form-control" onchange="setFiltro('unidade',this.value)">
              <option value="">Todas</option>
              ${UNIDADES.map(u=>`<option value="${u.id}">${u.nome.split('—')[1]?.trim()||u.nome}</option>`).join('')}
            </select>
          </div>` : ''}
          <div class="form-group">
            <label class="form-label">Etapa do Funil</label>
            <select class="form-control" onchange="setFiltro('etapa',this.value)">
              <option value="">Todas</option>
              ${ETAPAS_FUNIL.map(e=>`<option value="${e.id}">${e.icone} ${e.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Temperatura</label>
            <select class="form-control" onchange="setFiltro('temperatura',this.value)">
              <option value="">Todas</option>
              <option value="quente">🔴 Quente</option>
              <option value="morno">🟡 Morno</option>
              <option value="frio">🔵 Frio</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Origem</label>
            <select class="form-control" onchange="setFiltro('origem',this.value)">
              <option value="">Todas</option>
              ${ORIGENS.map(o=>`<option value="${o}">${o}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Série</label>
            <select class="form-control" onchange="setFiltro('serie',this.value)">
              <option value="">Todas</option>
              ${SERIES.map(s=>`<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          ${isMaster() ? `<div class="form-group">
            <label class="form-label">Responsável</label>
            <select class="form-control" onchange="setFiltro('responsavel',this.value)">
              <option value="">Todos</option>
              ${USUARIOS.filter(u=>u.tipo==='auxiliar').map(u=>`<option value="${u.id}">${u.nome}</option>`).join('')}
            </select>
          </div>` : ''}
          <div class="form-group">
            <label class="form-label">Próxima Ação</label>
            <select class="form-control" onchange="setFiltro('com_acao',this.value)">
              <option value="">Todos</option>
              <option value="sim">Com próxima ação</option>
              <option value="nao">Sem próxima ação</option>
              <option value="vencida">Ação vencida</option>
            </select>
          </div>
        </div>
      </div>

      <div class="table-wrapper" id="leads-table-wrapper"></div>
      <div style="display:flex;align-items:center;justify-content:space-between" id="leads-pagination-wrapper">
        <span id="leads-pag-info" style="font-size:13px;color:var(--neutral-mid)"></span>
        <div class="pagination" id="leads-pagination"></div>
      </div>
    </div>
  `;
  atualizarTabelaLeads();
}

function getLeadsFiltrados() {
  let leads = leadsVisiveis(DB.leads);

  if (leadsFiltros.busca) {
    const b = leadsFiltros.busca.toLowerCase();
    leads = leads.filter(l =>
      l.nome_responsavel.toLowerCase().includes(b) ||
      l.nome_aluno.toLowerCase().includes(b) ||
      l.telefone.includes(b) ||
      (l.email||'').toLowerCase().includes(b)
    );
  }
  if (leadsFiltros.unidade)     leads = leads.filter(l => String(l.unidade_id) === leadsFiltros.unidade);
  if (leadsFiltros.etapa)       leads = leads.filter(l => l.etapa_funil === leadsFiltros.etapa);
  if (leadsFiltros.temperatura) leads = leads.filter(l => l.temperatura === leadsFiltros.temperatura);
  if (leadsFiltros.origem)      leads = leads.filter(l => l.origem === leadsFiltros.origem);
  if (leadsFiltros.serie)       leads = leads.filter(l => l.serie_interesse === leadsFiltros.serie);
  if (leadsFiltros.responsavel) leads = leads.filter(l => String(l.responsavel_id) === leadsFiltros.responsavel);
  if (leadsFiltros.com_acao === 'sim')    leads = leads.filter(l => l.proxima_acao);
  if (leadsFiltros.com_acao === 'nao')    leads = leads.filter(l => !l.proxima_acao);
  if (leadsFiltros.com_acao === 'vencida') leads = leads.filter(l => l.data_proxima_acao && new Date(l.data_proxima_acao) < new Date());

  // Ordenação
  leads.sort((a, b) => {
    let va = a[leadsOrdem.col] || '';
    let vb = b[leadsOrdem.col] || '';
    if (typeof va === 'number') return leadsOrdem.dir === 'asc' ? va - vb : vb - va;
    return leadsOrdem.dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  return leads;
}

function atualizarTabelaLeads() {
  const todos = getLeadsFiltrados();
  const total = todos.length;
  const inicio = (leadsPagina - 1) * LEADS_POR_PAGINA;
  const leads  = todos.slice(inicio, inicio + LEADS_POR_PAGINA);

  const wrapper = document.getElementById('leads-table-wrapper');
  const countLabel = document.getElementById('leads-count-label');
  if (countLabel) countLabel.textContent = `${total} lead${total!==1?'s':''} encontrado${total!==1?'s':''}`;

  if (!wrapper) return;

  if (!leads.length) {
    wrapper.innerHTML = `<div class="empty-state" style="padding:60px">
      <div class="empty-state__icon">🔍</div>
      <div class="empty-state__title">Nenhum lead encontrado</div>
      <div class="empty-state__desc">Ajuste os filtros ou <button class="btn btn-primary btn-sm" onclick="abrirFormLead()">adicione um novo lead</button></div>
    </div>`;
    renderPaginacao(total);
    return;
  }

  const header = `
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:32px"><input type="checkbox" id="select-all" onchange="toggleSelectAll(this.checked)" style="accent-color:var(--primary)"></th>
          ${col('nome_responsavel','Responsável')}
          ${col('nome_aluno','Aluno')}
          ${isMaster() ? col('unidade_id','Unidade') : ''}
          ${col('serie_interesse','Série')}
          ${col('etapa_funil','Etapa')}
          ${col('temperatura','Temp.')}
          ${col('origem','Origem')}
          ${col('responsavel_id','Responsável')}
          ${col('data_atualizacao','Atualização')}
          ${col('data_proxima_acao','Próx. Ação')}
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${leads.map(l => renderLeadRow(l)).join('')}
      </tbody>
    </table>`;
  wrapper.innerHTML = header;
  renderPaginacao(total);

  // Re-marcar selecionados
  leads.forEach(l => {
    const cb = document.getElementById(`cb-${l.id}`);
    if (cb && leadsSelecionados.has(l.id)) cb.checked = true;
  });
}

function col(key, label) {
  const cls = leadsOrdem.col === key ? `sort-${leadsOrdem.dir}` : '';
  return `<th class="${cls}" onclick="sortLeads('${key}')">${label}</th>`;
}

function renderLeadRow(l) {
  const etapa = getEtapa(l.etapa_funil);
  const vencida = l.data_proxima_acao && new Date(l.data_proxima_acao) < new Date();
  const telLimpo = l.telefone.replace(/\D/g,'');
  const waMensagem = encodeURIComponent(`Olá ${l.nome_responsavel}! Sou ${currentUser.nome} da Rede de Colégios Santa Maria. Gostaria de conversar sobre a matrícula de ${l.nome_aluno} para ${l.serie_interesse}.`);

  return `<tr onclick="abrirDetalhe('${l.id}')" style="${vencida?'background:#fff9f9':''}">
    <td onclick="event.stopPropagation()">
      <input type="checkbox" id="cb-${l.id}" style="accent-color:var(--primary)"
        onchange="toggleSelect('${l.id}',this.checked)">
    </td>
    <td>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="avatar avatar-sm" style="background:${avatarColor(l.nome_responsavel)}">${initials(l.nome_responsavel)}</div>
        <span style="font-weight:600">${l.nome_responsavel}</span>
      </div>
    </td>
    <td>${l.nome_aluno}</td>
    ${isMaster() ? `<td style="font-size:12px;color:var(--neutral-mid)">${getUnidade(l.unidade_id).nome.split('—')[1]?.trim()||''}</td>` : ''}
    <td><span class="badge badge-neutral" style="font-size:11px">${l.serie_interesse}</span></td>
    <td><span class="badge" style="background:${etapa.cor}22;color:${etapa.cor};font-size:11px">${etapa.icone} ${etapa.label}</span></td>
    <td><span class="badge badge-${l.temperatura}" style="font-size:11px">${tempIcon(l.temperatura)}</span></td>
    <td style="font-size:12px;color:var(--neutral-mid)">${l.origem}</td>
    <td style="font-size:12px">${getUsuario(l.responsavel_id).nome.split(' ')[0]}</td>
    <td style="font-size:12px;color:var(--neutral-mid)">${formatDate(l.data_atualizacao)}</td>
    <td style="font-size:12px;color:${vencida?'var(--accent)':'var(--neutral-mid)'}">
      ${l.data_proxima_acao ? `${vencida?'⚠️ ':''}`+formatDate(l.data_proxima_acao) : '—'}
    </td>
    <td onclick="event.stopPropagation()">
      <div style="display:flex;gap:4px">
        <button class="btn btn-ghost btn-sm btn-icon" title="WhatsApp"
          onclick="window.open('https://wa.me/55${telLimpo}?text=${waMensagem}','_blank')" style="color:#25D366">💬</button>
        <button class="btn btn-ghost btn-sm btn-icon" title="Editar"
          onclick="abrirFormLead(null,'${l.id}')">✏️</button>
      </div>
    </td>
  </tr>`;
}

function renderPaginacao(total) {
  const totalPag = Math.ceil(total / LEADS_POR_PAGINA);
  const info = document.getElementById('leads-pag-info');
  const pag  = document.getElementById('leads-pagination');
  if (!info || !pag) return;
  const inicio = Math.min((leadsPagina-1)*LEADS_POR_PAGINA + 1, total);
  const fim    = Math.min(leadsPagina * LEADS_POR_PAGINA, total);
  info.textContent = total > 0 ? `Exibindo ${inicio}–${fim} de ${total}` : '';
  if (totalPag <= 1) { pag.innerHTML = ''; return; }

  let html = `<button class="pagination-btn" ${leadsPagina===1?'disabled':''} onclick="irPagina(${leadsPagina-1})">‹</button>`;
  for (let i = 1; i <= totalPag; i++) {
    if (totalPag <= 7 || Math.abs(i - leadsPagina) < 3 || i === 1 || i === totalPag) {
      html += `<button class="pagination-btn${i===leadsPagina?' active':''}" onclick="irPagina(${i})">${i}</button>`;
    } else if (Math.abs(i - leadsPagina) === 3) {
      html += `<span style="padding:0 4px;color:var(--neutral-mid)">…</span>`;
    }
  }
  html += `<button class="pagination-btn" ${leadsPagina===totalPag?'disabled':''} onclick="irPagina(${leadsPagina+1})">›</button>`;
  pag.innerHTML = html;
}

function sortLeads(col) {
  if (leadsOrdem.col === col) leadsOrdem.dir = leadsOrdem.dir === 'asc' ? 'desc' : 'asc';
  else { leadsOrdem.col = col; leadsOrdem.dir = 'asc'; }
  leadsPagina = 1;
  atualizarTabelaLeads();
}
function irPagina(n) { leadsPagina = n; atualizarTabelaLeads(); }
function setFiltro(key, val) { leadsFiltros[key] = val; leadsPagina = 1; atualizarTabelaLeads(); }
function toggleFiltros() { filtroAberto = !filtroAberto; renderLeads(); }
function limparFiltros() {
  leadsFiltros = { busca:'',unidade:'',etapa:'',temperatura:'',origem:'',serie:'',responsavel:'',periodo:'',com_acao:'' };
  leadsPagina = 1;
  renderLeads();
}

let searchTimeout;
function debounceSearch(val) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { setFiltro('busca', val); }, 300);
}

function toggleSelect(id, checked) {
  if (checked) leadsSelecionados.add(id); else leadsSelecionados.delete(id);
  const btn = document.getElementById('btn-acoes-lote');
  const cnt = document.getElementById('lote-count');
  if (btn) btn.style.display = leadsSelecionados.size > 0 ? 'inline-flex' : 'none';
  if (cnt) cnt.textContent = leadsSelecionados.size;
}

function toggleSelectAll(checked) {
  const todos = getLeadsFiltrados().slice((leadsPagina-1)*LEADS_POR_PAGINA, leadsPagina*LEADS_POR_PAGINA);
  todos.forEach(l => {
    const cb = document.getElementById(`cb-${l.id}`);
    if (cb) cb.checked = checked;
    if (checked) leadsSelecionados.add(l.id); else leadsSelecionados.delete(l.id);
  });
  toggleSelect('__dummy__', false);
  atualizarTabelaLeads();
}

function abrirAcoesLote() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-header">
        <h2 class="modal-title">Ações em Lote (${leadsSelecionados.size} leads)</h2>
        <button class="btn btn-ghost btn-icon" onclick="this.closest('.modal-backdrop').remove()">✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:12px">
        <div class="form-group">
          <label class="form-label">Alterar Etapa para</label>
          <select class="form-control" id="lote-etapa">
            <option value="">Não alterar</option>
            ${ETAPAS_FUNIL.map(e=>`<option value="${e.id}">${e.icone} ${e.label}</option>`).join('')}
          </select>
        </div>
        ${isMaster() ? `<div class="form-group">
          <label class="form-label">Alterar Responsável para</label>
          <select class="form-control" id="lote-resp">
            <option value="">Não alterar</option>
            ${USUARIOS.filter(u=>u.tipo==='auxiliar').map(u=>`<option value="${u.id}">${u.nome}</option>`).join('')}
          </select>
        </div>` : ''}
        <button class="btn btn-secondary" onclick="exportarCSV()">📥 Exportar selecionados como CSV</button>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
        <button class="btn btn-primary" onclick="aplicarLote(this)">Aplicar</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
}

async function aplicarLote(btn) {
  const etapa = document.getElementById('lote-etapa')?.value;
  const resp  = document.getElementById('lote-resp')?.value;
  if (!etapa && !resp) { toast('Selecione ao menos uma ação', 'warning'); return; }

  btn.disabled = true;
  let alterados = 0;
  for (const id of leadsSelecionados) {
    const lead = DB.leads.find(l => l.id === id);
    if (!lead) continue;
    let historicoItem = null;
    if (etapa) {
      lead.etapa_funil = etapa;
      historicoItem = { id: uuid(), data: new Date().toISOString(), usuario_id: currentUser.id, usuario: currentUser.nome, tipo: 'etapa', acao: 'Etapa atualizada (lote)', descricao: `Etapa alterada para "${getEtapa(etapa).label}"` };
    }
    if (resp) lead.responsavel_id = resp;
    lead.data_atualizacao = new Date().toISOString();
    const { error } = await DB.saveLead(lead, historicoItem);
    if (!error) alterados++;
  }

  btn.closest('.modal-backdrop').remove();
  leadsSelecionados.clear();
  toast(`${alterados} lead(s) atualizados`, 'success');
  atualizarBadges();
  atualizarTabelaLeads();
}

function exportarCSV() {
  const ids = leadsSelecionados.size > 0 ? leadsSelecionados : new Set(getLeadsFiltrados().map(l=>l.id));
  const leads = DB.leads.filter(l => ids.has(l.id));
  const cols = ['nome_responsavel','nome_aluno','telefone','email','unidade_id','serie_interesse','turno_interesse','etapa_funil','temperatura','origem','data_criacao','valor_mensalidade'];
  const header = ['Responsável','Aluno','Telefone','E-mail','Unidade','Série','Turno','Etapa','Temperatura','Origem','Criação','Mensalidade'];
  const rows = leads.map(l => cols.map(c => {
    if (c === 'unidade_id') return getUnidade(l[c]).nome;
    if (c === 'data_criacao') return formatDate(l[c]);
    return (l[c]||'');
  }));
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'leads_santamaria.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportado com sucesso', 'success');
}

// ── Detalhe do Lead (Drawer) ──
function abrirDetalhe(id) {
  const lead = DB.leads.find(l => l.id === id);
  if (!lead) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';
  backdrop.onclick = (e) => { if (e.target === backdrop) fecharDrawer(); };
  document.body.appendChild(backdrop);

  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.id = 'lead-drawer';
  drawer.innerHTML = buildDrawerContent(lead);
  document.body.appendChild(drawer);
}

function fecharDrawer() {
  document.querySelector('.drawer-backdrop')?.remove();
  document.getElementById('lead-drawer')?.remove();
}

function buildDrawerContent(lead) {
  const etapa   = getEtapa(lead.etapa_funil);
  const unidade = getUnidade(lead.unidade_id);
  const resp    = getUsuario(lead.responsavel_id);
  const telLimpo = lead.telefone.replace(/\D/g,'');
  const waMensagem = encodeURIComponent(`Olá ${lead.nome_responsavel}! Sou ${currentUser.nome} da Rede de Colégios Santa Maria. Gostaria de conversar sobre a matrícula de ${lead.nome_aluno} para ${lead.serie_interesse}.`);
  const vencida = lead.data_proxima_acao && new Date(lead.data_proxima_acao) < new Date();

  return `
    <div class="drawer-header">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div class="avatar avatar-lg" style="background:${avatarColor(lead.nome_responsavel)}">${initials(lead.nome_responsavel)}</div>
        <div style="flex:1">
          <h2 style="font-family:var(--font-heading);font-size:18px;font-weight:700">${lead.nome_responsavel}</h2>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
            <span class="badge" style="background:${etapa.cor}22;color:${etapa.cor}">${etapa.icone} ${etapa.label}</span>
            <span class="badge badge-${lead.temperatura}">${tempIcon(lead.temperatura)}</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-icon" onclick="fecharDrawer()">✕</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="abrirFormLead(null,'${lead.id}')">✏️ Editar</button>
        <button class="btn btn-secondary btn-sm" onclick="abrirFormAtividade('${lead.id}')">📝 Registrar</button>
        <a href="https://wa.me/55${telLimpo}?text=${waMensagem}" target="_blank" class="btn btn-sm" style="background:#25D366;color:white">💬 WhatsApp</a>
      </div>
    </div>

    <div class="drawer-body">
      <!-- Informações -->
      <div class="detail-section">
        <div class="detail-section__title">👤 Informações do Lead</div>
        <div class="detail-row"><span class="detail-row__label">Aluno</span><span class="detail-row__value">${lead.nome_aluno}</span></div>
        <div class="detail-row"><span class="detail-row__label">Série / Turno</span><span class="detail-row__value">${lead.serie_interesse} · ${lead.turno_interesse}</span></div>
        <div class="detail-row"><span class="detail-row__label">Telefone</span><span class="detail-row__value"><a href="tel:${lead.telefone}" style="color:var(--primary)">${lead.telefone}</a></span></div>
        <div class="detail-row"><span class="detail-row__label">E-mail</span><span class="detail-row__value">${lead.email||'—'}</span></div>
        <div class="detail-row"><span class="detail-row__label">Unidade</span><span class="detail-row__value">${unidade.nome}</span></div>
        <div class="detail-row"><span class="detail-row__label">Origem</span><span class="detail-row__value">${lead.origem}</span></div>
        <div class="detail-row"><span class="detail-row__label">Responsável</span><span class="detail-row__value">${resp.nome}</span></div>
        <div class="detail-row"><span class="detail-row__label">Mensalidade</span><span class="detail-row__value">${lead.valor_mensalidade ? 'R$ '+Number(lead.valor_mensalidade).toLocaleString('pt-BR') : '—'}</span></div>
        <div class="detail-row"><span class="detail-row__label">Criado em</span><span class="detail-row__value">${formatDate(lead.data_criacao)}</span></div>
        <div class="detail-row"><span class="detail-row__label">Atualizado em</span><span class="detail-row__value">${formatDate(lead.data_atualizacao)}</span></div>
      </div>

      <!-- Próxima ação -->
      ${lead.proxima_acao ? `
      <div class="detail-section">
        <div class="detail-section__title">📅 Próxima Ação</div>
        <div style="background:${vencida?'#fff5f6':'var(--primary-pale)'};border-radius:var(--radius-md);padding:12px;border-left:4px solid ${vencida?'var(--accent)':'var(--primary)'}">
          <div style="font-weight:600;color:${vencida?'var(--accent)':'var(--primary)'}">${vencida?'⚠️ Vencida — ':''}${lead.proxima_acao}</div>
          <div style="font-size:12px;color:var(--neutral-mid);margin-top:4px">Prevista para: ${formatDate(lead.data_proxima_acao)}</div>
          <button class="btn btn-sm btn-secondary" style="margin-top:8px" onclick="marcarAcaoRealizada('${lead.id}')">✓ Marcar como Realizada</button>
        </div>
      </div>` : ''}

      <!-- Mover no funil -->
      <div class="detail-section">
        <div class="detail-section__title">🔀 Mover no Funil</div>
        <div class="funnel-stages">
          ${ETAPAS_FUNIL.map(e => `
            <button class="funnel-stage-btn${lead.etapa_funil===e.id?' active':''}"
              style="border-color:${e.cor};color:${lead.etapa_funil===e.id?'white':e.cor};background:${lead.etapa_funil===e.id?e.cor:'transparent'}"
              onclick="moverLeadDrawer('${lead.id}','${e.id}')">
              ${e.icone} ${e.label}
            </button>`).join('')}
        </div>
      </div>

      <!-- Anotações -->
      ${lead.anotacoes ? `
      <div class="detail-section">
        <div class="detail-section__title">📝 Anotações</div>
        <p style="font-size:14px;color:var(--neutral-mid);white-space:pre-wrap">${lead.anotacoes}</p>
      </div>` : ''}

      <!-- Histórico -->
      <div class="detail-section">
        <div class="detail-section__title">🕐 Histórico de Atividades</div>
        <div class="timeline">
          ${(lead.historico||[]).map(h => renderTimelineItem(h)).join('')}
        </div>
      </div>

      <!-- Formulário rápido de atividade -->
      <div class="detail-section">
        <div class="detail-section__title">➕ Registrar Atividade</div>
        <div id="form-atividade-inline-${lead.id}">
          ${formAtividadeInline(lead.id)}
        </div>
      </div>
    </div>`;
}

function renderTimelineItem(h) {
  const tipos = { ligacao:'📞',whatsapp:'💬',email:'📧',visita:'🏫',anotacao:'📝',reuniao:'🤝',etapa:'🔀',criacao:'✨' };
  const cores = { ligacao:'#1A4DB5',whatsapp:'#25D366',email:'#EC4899',visita:'#8B5CF6',anotacao:'#F97316',reuniao:'#0891B2',etapa:'#F5A623',criacao:'#1A7F4B' };
  const icone = tipos[h.tipo] || '•';
  const cor   = cores[h.tipo] || 'var(--neutral-mid)';
  return `
    <div class="timeline-item">
      <div class="timeline-dot" style="background:${cor}22">${icone}</div>
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="timeline-action">${h.acao}</span>
          <span class="timeline-meta">por ${h.usuario} · ${formatDateTime(h.data)}</span>
        </div>
        ${h.descricao ? `<div class="timeline-desc">${h.descricao}</div>` : ''}
      </div>
    </div>`;
}

function formAtividadeInline(leadId) {
  return `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select class="form-control" id="atv-tipo-${leadId}">
            ${TIPOS_ATIVIDADE.map(t=>`<option value="${t.id}">${t.icone} ${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Data</label>
          <input type="datetime-local" class="form-control" id="atv-data-${leadId}" value="${new Date().toISOString().slice(0,16)}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descrição</label>
        <textarea class="form-control" id="atv-desc-${leadId}" rows="2" placeholder="Descreva o contato realizado..."></textarea>
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="atv-prox-${leadId}" onchange="toggleProxAcao('${leadId}',this.checked)">
        <label for="atv-prox-${leadId}">Definir próxima ação</label>
      </div>
      <div id="prox-acao-fields-${leadId}" style="display:none;padding:12px;background:var(--primary-pale);border-radius:var(--radius-md)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">Próxima Ação</label>
            <input type="text" class="form-control" id="prox-desc-${leadId}" placeholder="Ex: Ligar amanhã">
          </div>
          <div class="form-group">
            <label class="form-label">Data</label>
            <input type="date" class="form-control" id="prox-data-${leadId}">
          </div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="salvarAtividade('${leadId}')">Registrar Atividade</button>
    </div>`;
}

function toggleProxAcao(leadId, show) {
  const el = document.getElementById(`prox-acao-fields-${leadId}`);
  if (el) el.style.display = show ? 'block' : 'none';
}

async function salvarAtividade(leadId) {
  const tipo  = document.getElementById(`atv-tipo-${leadId}`)?.value;
  const data  = document.getElementById(`atv-data-${leadId}`)?.value;
  const desc  = document.getElementById(`atv-desc-${leadId}`)?.value;
  const proxCb = document.getElementById(`atv-prox-${leadId}`)?.checked;
  const proxDesc = document.getElementById(`prox-desc-${leadId}`)?.value;
  const proxData = document.getElementById(`prox-data-${leadId}`)?.value;

  if (!desc) { toast('Informe uma descrição', 'warning'); return; }

  const lead = DB.leads.find(l => l.id === leadId);
  if (!lead) return;

  const tipoObj = TIPOS_ATIVIDADE.find(t => t.id === tipo);
  const historicoItem = {
    id: uuid(),
    data: data ? new Date(data).toISOString() : new Date().toISOString(),
    usuario_id: currentUser.id,
    usuario: currentUser.nome,
    tipo,
    acao: tipoObj?.label || tipo,
    descricao: desc
  };

  if (proxCb && proxDesc) {
    lead.proxima_acao = proxDesc;
    lead.data_proxima_acao = proxData ? new Date(proxData).toISOString() : null;
  }

  lead.data_atualizacao = new Date().toISOString();
  const { error } = await DB.saveLead(lead, historicoItem);
  if (error) { toast('Erro ao salvar: ' + error, 'error'); return; }
  toast('Atividade registrada', 'success');

  // Re-renderiza drawer
  fecharDrawer();
  abrirDetalhe(leadId);
  atualizarBadges();
}

async function marcarAcaoRealizada(leadId) {
  const lead = DB.leads.find(l => l.id === leadId);
  if (!lead) return;
  const historicoItem = {
    id: uuid(), data: new Date().toISOString(),
    usuario_id: currentUser.id, usuario: currentUser.nome,
    tipo: 'anotacao', acao: 'Ação concluída',
    descricao: `"${lead.proxima_acao}" marcada como realizada`
  };
  lead.proxima_acao = null;
  lead.data_proxima_acao = null;
  lead.data_atualizacao = new Date().toISOString();
  const { error } = await DB.saveLead(lead, historicoItem);
  if (error) { toast('Erro ao salvar: ' + error, 'error'); return; }
  toast('Ação marcada como realizada', 'success');
  fecharDrawer();
  abrirDetalhe(leadId);
  atualizarBadges();
}

async function moverLeadDrawer(leadId, novaEtapa) {
  const lead = DB.leads.find(l => l.id === leadId);
  if (!lead || lead.etapa_funil === novaEtapa) return;

  if (novaEtapa === 'perdido') {
    abrirModalPerdido(lead, () => { fecharDrawer(); abrirDetalhe(leadId); atualizarBadges(); });
    return;
  }

  const etapaAnterior = getEtapa(lead.etapa_funil).label;
  const etapaNova     = getEtapa(novaEtapa).label;
  lead.etapa_funil = novaEtapa;
  lead.data_atualizacao = new Date().toISOString();
  if (novaEtapa === 'matricula') { lead.convertido = true; lead.data_matricula = new Date().toISOString(); }
  const historicoItem = {
    id: uuid(), data: new Date().toISOString(),
    usuario_id: currentUser.id, usuario: currentUser.nome,
    tipo: 'etapa', acao: 'Etapa atualizada',
    descricao: `Movido de "${etapaAnterior}" para "${etapaNova}"`
  };
  const { error } = await DB.saveLead(lead, historicoItem);
  if (error) { toast('Erro ao salvar: ' + error, 'error'); return; }
  toast(`Lead movido para "${etapaNova}"`, 'success');
  fecharDrawer();
  abrirDetalhe(leadId);
  atualizarBadges();
}

// ── Formulário de Lead ──
function abrirFormLead(etapaInicial, editId) {
  const editando = !!editId;
  const lead = editando ? DB.leads.find(l => l.id === editId) : null;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-header">
        <h2 class="modal-title">${editando ? '✏️ Editar Lead' : '➕ Novo Lead'}</h2>
        <button class="btn btn-ghost btn-icon" onclick="this.closest('.modal-backdrop').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" id="form-lead-grid">
          <div class="form-group">
            <label class="form-label">Nome do Responsável <span class="required">*</span></label>
            <input type="text" class="form-control" id="fl-responsavel" value="${lead?.nome_responsavel||''}" placeholder="Nome completo do pai/mãe">
          </div>
          <div class="form-group">
            <label class="form-label">Nome do Aluno <span class="required">*</span></label>
            <input type="text" class="form-control" id="fl-aluno" value="${lead?.nome_aluno||''}" placeholder="Nome do aluno">
          </div>
          <div class="form-group">
            <label class="form-label">Telefone <span class="required">*</span></label>
            <input type="tel" class="form-control" id="fl-telefone" value="${lead?.telefone||''}" placeholder="(31) 99999-9999" oninput="mascaraTelefone(this)">
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input type="email" class="form-control" id="fl-email" value="${lead?.email||''}" placeholder="email@exemplo.com">
          </div>
          <div class="form-group">
            <label class="form-label">Série de Interesse <span class="required">*</span></label>
            <select class="form-control" id="fl-serie">
              ${SERIES.map(s=>`<option value="${s}" ${lead?.serie_interesse===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Turno</label>
            <select class="form-control" id="fl-turno">
              ${TURNOS.map(t=>`<option value="${t}" ${lead?.turno_interesse===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Unidade de Interesse <span class="required">*</span></label>
            <select class="form-control" id="fl-unidade">
              ${UNIDADES.map(u=>`<option value="${u.id}" ${(lead?.unidade_id||currentUser.unidade_id||1)===u.id?'selected':''}>${u.nome}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Origem <span class="required">*</span></label>
            <select class="form-control" id="fl-origem">
              ${ORIGENS.map(o=>`<option value="${o}" ${lead?.origem===o?'selected':''}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Temperatura</label>
            <div class="radio-pills">
              ${['quente','morno','frio'].map(t=>`
                <div class="radio-pill ${t}">
                  <input type="radio" name="fl-temp" id="fl-temp-${t}" value="${t}" ${(lead?.temperatura||'morno')===t?'checked':''}>
                  <label for="fl-temp-${t}">${tempIcon(t)}</label>
                </div>`).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Mensalidade Estimada (R$)</label>
            <input type="number" class="form-control" id="fl-mensalidade" value="${lead?.valor_mensalidade||''}" placeholder="1500">
          </div>
          <div class="form-group">
            <label class="form-label">Etapa Inicial</label>
            <select class="form-control" id="fl-etapa">
              ${ETAPAS_FUNIL.filter(e=>e.id!=='perdido').map(e=>`<option value="${e.id}" ${(lead?.etapa_funil||etapaInicial||'captacao_lead')===e.id?'selected':''}>${e.icone} ${e.label}</option>`).join('')}
            </select>
          </div>
          ${isMaster() ? `<div class="form-group">
            <label class="form-label">Responsável</label>
            <select class="form-control" id="fl-resp-id">
              <option value="${currentUser.id}" ${(!lead?.responsavel_id||lead?.responsavel_id===currentUser.id)?'selected':''}>${currentUser.nome} (você)</option>
              ${USUARIOS.filter(u=>u.id!==currentUser.id).map(u=>`<option value="${u.id}" ${lead?.responsavel_id===u.id?'selected':''}>${u.nome}</option>`).join('')}
            </select>
          </div>` : ''}
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Anotação</label>
            <textarea class="form-control" id="fl-anotacao" rows="2" placeholder="Observações iniciais sobre o lead...">${lead?.anotacoes||''}</textarea>
          </div>
        </div>
        <div style="margin-top:16px;padding:12px;background:var(--primary-pale);border-radius:var(--radius-md)">
          <div style="font-weight:600;font-size:13px;margin-bottom:10px">📅 Próxima Ação</div>
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px">
            <div class="form-group">
              <label class="form-label">Ação</label>
              <input type="text" class="form-control" id="fl-prox-acao" value="${lead?.proxima_acao||''}" placeholder="Ex: Ligar para confirmar visita">
            </div>
            <div class="form-group">
              <label class="form-label">Data</label>
              <input type="date" class="form-control" id="fl-prox-data" value="${lead?.data_proxima_acao ? lead.data_proxima_acao.slice(0,10) : ''}">
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
        <button class="btn btn-primary" onclick="salvarLead(${editando?`'${lead.id}'`:null},this)">
          ${editando ? '💾 Salvar Alterações' : '✅ Criar Lead'}
        </button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
}

async function salvarLead(editId, btn) {
  const responsavel = document.getElementById('fl-responsavel')?.value?.trim();
  const aluno       = document.getElementById('fl-aluno')?.value?.trim();
  const telefone    = document.getElementById('fl-telefone')?.value?.trim();
  const serie       = document.getElementById('fl-serie')?.value;
  const unidade     = parseInt(document.getElementById('fl-unidade')?.value);
  const origem      = document.getElementById('fl-origem')?.value;

  if (!responsavel || !aluno || !telefone || !serie || !unidade || !origem) {
    toast('Preencha todos os campos obrigatórios', 'error'); return;
  }

  const temperatura  = document.querySelector('input[name="fl-temp"]:checked')?.value || 'morno';
  const etapa        = document.getElementById('fl-etapa')?.value || 'captacao_lead';
  // responsavel_id agora é um UUID (referência à tabela perfis)
  const respId       = (isMaster() ? document.getElementById('fl-resp-id')?.value : null) || currentUser.id;
  const proxAcao     = document.getElementById('fl-prox-acao')?.value?.trim() || null;
  const proxData     = document.getElementById('fl-prox-data')?.value;

  const agora = new Date().toISOString();
  btn.disabled = true;

  if (editId) {
    const lead = DB.leads.find(l => l.id === editId);
    if (!lead) { btn.disabled = false; return; }
    lead.nome_responsavel = responsavel;
    lead.nome_aluno       = aluno;
    lead.telefone         = telefone;
    lead.email            = document.getElementById('fl-email')?.value?.trim() || '';
    lead.serie_interesse  = serie;
    lead.turno_interesse  = document.getElementById('fl-turno')?.value;
    lead.unidade_id       = unidade;
    lead.origem           = origem;
    lead.temperatura      = temperatura;
    lead.etapa_funil      = etapa;
    lead.responsavel_id   = respId;
    lead.valor_mensalidade = parseFloat(document.getElementById('fl-mensalidade')?.value) || null;
    lead.anotacoes        = document.getElementById('fl-anotacao')?.value?.trim() || '';
    lead.proxima_acao     = proxAcao;
    lead.data_proxima_acao = proxData ? new Date(proxData).toISOString() : null;
    lead.data_atualizacao = agora;
    const historicoItem = { id: uuid(), data: agora, usuario_id: currentUser.id, usuario: currentUser.nome, tipo: 'anotacao', acao: 'Lead editado', descricao: 'Informações do lead atualizadas' };
    const { error } = await DB.saveLead(lead, historicoItem);
    if (error) { toast('Erro ao salvar: ' + error, 'error'); btn.disabled = false; return; }
    toast('Lead atualizado com sucesso', 'success');
  } else {
    const novoLead = {
      id: uuid(),
      nome_responsavel: responsavel,
      nome_aluno: aluno,
      telefone,
      email: document.getElementById('fl-email')?.value?.trim() || '',
      unidade_id: unidade,
      serie_interesse: serie,
      turno_interesse: document.getElementById('fl-turno')?.value,
      etapa_funil: etapa,
      origem,
      data_criacao: agora,
      data_atualizacao: agora,
      responsavel_id: respId,
      valor_mensalidade: parseFloat(document.getElementById('fl-mensalidade')?.value) || null,
      temperatura,
      proxima_acao: proxAcao,
      data_proxima_acao: proxData ? new Date(proxData).toISOString() : null,
      anotacoes: document.getElementById('fl-anotacao')?.value?.trim() || '',
      tags: [],
      convertido: etapa === 'matricula',
      data_matricula: etapa === 'matricula' ? agora : null
    };
    const historicoItem = { id: uuid(), data: agora, usuario_id: currentUser.id, usuario: currentUser.nome, tipo: 'criacao', acao: 'Lead criado', descricao: `Lead captado via ${origem}` };
    const { error } = await DB.saveLead(novoLead, historicoItem);
    if (error) { toast('Erro ao salvar: ' + error, 'error'); btn.disabled = false; return; }
    toast('Lead criado com sucesso!', 'success');
  }

  btn.closest('.modal-backdrop').remove();
  const pagAtiva = document.querySelector('.page.active')?.id;
  if (pagAtiva === 'page-kanban') renderKanban();
  else if (pagAtiva === 'page-leads') atualizarTabelaLeads();
  atualizarBadges();
}

function mascaraTelefone(input) {
  let v = input.value.replace(/\D/g,'').slice(0,11);
  if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
  else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
  else if (v.length) v = `(${v}`;
  input.value = v;
}
