/* ============================================================
   KANBAN.JS — Funil de vendas com drag & drop
   ============================================================ */

let kanbanFiltros = { temperatura: '', serie: '', origem: '', responsavel: '' };
let mostrarPerdidos = false;
let draggedCard = null;

function renderKanban() {
  const leads = leadsVisiveis(DB.leads);
  const el = document.getElementById('page-kanban');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📋 Funil de Vendas</h1>
        <p class="page-subtitle">Arraste os cards para mover leads entre etapas</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="togglePerdidos()">${mostrarPerdidos ? 'Ocultar Perdidos' : 'Exibir Perdidos'}</button>
        <button class="btn btn-primary btn-sm" onclick="abrirFormLead()">+ Novo Lead</button>
      </div>
    </div>
    <div style="padding:12px 24px 8px;background:var(--white);border-bottom:1px solid var(--border)">
      <div class="toolbar" style="margin:0">
        <select class="form-control" style="width:auto" onchange="setKanbanFiltro('temperatura',this.value)">
          <option value="">Todas temperaturas</option>
          <option value="quente">🔴 Quente</option>
          <option value="morno">🟡 Morno</option>
          <option value="frio">🔵 Frio</option>
        </select>
        <select class="form-control" style="width:auto" onchange="setKanbanFiltro('serie',this.value)">
          <option value="">Todas as séries</option>
          ${SERIES.map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
        <select class="form-control" style="width:auto" onchange="setKanbanFiltro('origem',this.value)">
          <option value="">Todas as origens</option>
          ${ORIGENS.map(o=>`<option value="${o}">${o}</option>`).join('')}
        </select>
        ${isMaster() ? `<select class="form-control" style="width:auto" onchange="setKanbanFiltro('responsavel',this.value)">
          <option value="">Todos os responsáveis</option>
          ${USUARIOS.filter(u=>u.tipo==='auxiliar').map(u=>`<option value="${u.id}">${u.nome}</option>`).join('')}
        </select>` : ''}
      </div>
    </div>
    <div style="flex:1;overflow:hidden;display:flex;flex-direction:column">
      <div id="kanban-view" style="padding:16px 24px 24px"></div>
    </div>
  `;
  renderColunas(leads);
}

function togglePerdidos() {
  mostrarPerdidos = !mostrarPerdidos;
  renderKanban();
}

function setKanbanFiltro(key, val) {
  kanbanFiltros[key] = val;
  const leads = leadsVisiveis(DB.leads);
  renderColunas(leads);
}

function filtrarLeadsKanban(leads) {
  return leads.filter(l => {
    if (kanbanFiltros.temperatura && l.temperatura !== kanbanFiltros.temperatura) return false;
    if (kanbanFiltros.serie && l.serie_interesse !== kanbanFiltros.serie) return false;
    if (kanbanFiltros.origem && l.origem !== kanbanFiltros.origem) return false;
    if (kanbanFiltros.responsavel && String(l.responsavel_id) !== kanbanFiltros.responsavel) return false;
    return true;
  });
}

function renderColunas(allLeads) {
  const filtered = filtrarLeadsKanban(allLeads);
  const view = document.getElementById('kanban-view');
  if (!view) return;

  const etapas = mostrarPerdidos ? ETAPAS_FUNIL : ETAPAS_FUNIL.filter(e => e.id !== 'perdido');

  view.innerHTML = etapas.map(etapa => {
    const cards = filtered.filter(l => l.etapa_funil === etapa.id);
    const colColor = etapa.cor;
    return `
      <div class="kanban-column" id="col-${etapa.id}">
        <div class="kanban-col-header" style="background:${colColor}">
          <span class="kanban-col-title" style="color:white">${etapa.icone} ${etapa.label}</span>
          <span class="kanban-col-count">${cards.length}</span>
        </div>
        <div class="kanban-col-body" id="body-${etapa.id}"
          ondragover="event.preventDefault();event.currentTarget.classList.add('drag-over')"
          ondragleave="event.currentTarget.classList.remove('drag-over')"
          ondrop="onDrop(event,'${etapa.id}')">
          ${cards.length === 0
            ? `<div style="text-align:center;padding:20px 8px;color:var(--neutral-mid);font-size:12px">Nenhum lead</div>`
            : cards.map(l => renderLeadCard(l)).join('')
          }
        </div>
        ${etapa.id !== 'perdido' ? `
        <div class="kanban-col-add">
          <button onclick="abrirFormLead('${etapa.id}')">+ Adicionar lead</button>
        </div>` : ''}
      </div>`;
  }).join('');
}

function renderLeadCard(l) {
  const etapa = getEtapa(l.etapa_funil);
  const vencida = l.data_proxima_acao && new Date(l.data_proxima_acao) < new Date() && !['matricula','perdido'].includes(l.etapa_funil);
  const semContato = diasDesde(l.data_atualizacao) >= 5 && !['matricula','perdido'].includes(l.etapa_funil);
  const borderColor = l.temperatura === 'quente' ? 'var(--temp-quente)' : l.temperatura === 'morno' ? 'var(--temp-morno)' : 'var(--temp-frio)';
  const urgente = vencida || semContato;

  const waMensagem = encodeURIComponent(`Olá ${l.nome_responsavel}! Sou ${currentUser.nome} da Rede de Colégios Santa Maria. Gostaria de conversar sobre a matrícula de ${l.nome_aluno} para ${l.serie_interesse}.`);
  const telLimpo = l.telefone.replace(/\D/g,'');

  return `
    <div class="lead-card${urgente ? ' urgente' : ''}" style="border-left-color:${borderColor}"
      draggable="true" id="card-${l.id}"
      ondragstart="onDragStart(event,'${l.id}')"
      ondragend="event.currentTarget.classList.remove('dragging')"
      onclick="abrirDetalhe('${l.id}')">
      <div class="lead-card__header">
        <div style="display:flex;gap:8px;align-items:flex-start;flex:1;min-width:0">
          <div class="avatar avatar-sm" style="background:${avatarColor(l.nome_responsavel)}">${initials(l.nome_responsavel)}</div>
          <div class="lead-card__names">
            <div class="lead-card__responsavel">${l.nome_responsavel}</div>
            <div class="lead-card__aluno">${l.nome_aluno}</div>
          </div>
        </div>
      </div>
      <div class="lead-card__badges">
        <span class="badge badge-${l.temperatura}" title="Temperatura: ${l.temperatura}">${tempIcon(l.temperatura)}</span>
        <span class="badge badge-neutral" style="font-size:10px">${l.serie_interesse}</span>
      </div>
      ${l.proxima_acao ? `
        <div class="lead-card__next-action${vencida ? ' vencida' : ''}">
          ${vencida ? '⚠️' : '📅'} ${l.proxima_acao}
          ${l.data_proxima_acao ? `<span style="margin-left:auto">${formatDate(l.data_proxima_acao)}</span>` : ''}
        </div>` : ''}
      <div class="lead-card__footer" style="margin-top:8px">
        <span class="lead-card__days">${diasDesde(l.data_criacao)}d atrás</span>
        <div class="lead-card__actions" onclick="event.stopPropagation()">
          <button class="lead-card__action-btn whatsapp" title="WhatsApp"
            onclick="window.open('https://wa.me/55${telLimpo}?text=${waMensagem}','_blank')">💬</button>
          <button class="lead-card__action-btn" title="Ver detalhes"
            onclick="abrirDetalhe('${l.id}')">👁️</button>
        </div>
      </div>
    </div>`;
}

// ── Drag & Drop ──
function onDragStart(event, leadId) {
  draggedCard = leadId;
  event.currentTarget.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
}

async function onDrop(event, novaEtapa) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  if (!draggedCard) return;

  const leads = DB.leads;
  const lead = leads.find(l => l.id === draggedCard);
  if (!lead || lead.etapa_funil === novaEtapa) { draggedCard = null; return; }

  // Pedir motivo se for "perdido"
  if (novaEtapa === 'perdido') {
    abrirModalPerdido(lead, () => { draggedCard = null; renderKanban(); });
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
  if (error) { toast('Erro ao salvar: ' + error, 'error'); draggedCard = null; return; }
  toast(`Lead movido para "${etapaNova}"`, 'success');
  draggedCard = null;
  renderKanban();
  atualizarBadges();
}

function abrirModalPerdido(lead, callback) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-header">
        <h2 class="modal-title">❌ Marcar como Perdido</h2>
        <button class="btn btn-ghost btn-icon" onclick="this.closest('.modal-backdrop').remove()">✕</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:16px;color:var(--neutral-mid)">Informe o motivo pelo qual o lead <strong>${lead.nome_responsavel}</strong> foi perdido:</p>
        <div class="form-group">
          <label class="form-label">Motivo da Perda <span class="required">*</span></label>
          <select class="form-control" id="motivo-perda-select">
            <option value="">Selecione...</option>
            <option>Optou por concorrente</option>
            <option>Preço acima do orçamento</option>
            <option>Mudança de planos da família</option>
            <option>Sem resposta após múltiplos contatos</option>
            <option>Mudou de cidade</option>
            <option>Outros</option>
          </select>
        </div>
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Observação</label>
          <textarea class="form-control" id="motivo-perda-obs" placeholder="Detalhes adicionais..." rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
        <button class="btn btn-danger" onclick="confirmarPerdido('${lead.id}',this)">Confirmar Perda</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
}

async function confirmarPerdido(leadId, btn) {
  const motivo = document.getElementById('motivo-perda-select').value;
  if (!motivo) { toast('Informe o motivo da perda', 'error'); return; }
  const obs    = document.getElementById('motivo-perda-obs').value;

  const leads = DB.leads;
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return;

  lead.etapa_funil = 'perdido';
  lead.motivo_perda = motivo + (obs ? ` — ${obs}` : '');
  lead.data_atualizacao = new Date().toISOString();
  const historicoItem = {
    id: uuid(), data: new Date().toISOString(),
    usuario_id: currentUser.id, usuario: currentUser.nome,
    tipo: 'etapa', acao: 'Lead perdido',
    descricao: `Motivo: ${motivo}${obs ? ` — ${obs}` : ''}`
  };

  btn.disabled = true;
  const { error } = await DB.saveLead(lead, historicoItem);
  if (error) { toast('Erro ao salvar: ' + error, 'error'); btn.disabled = false; return; }
  btn.closest('.modal-backdrop').remove();
  toast('Lead marcado como perdido', 'warning');
  renderKanban();
  atualizarBadges();
}
