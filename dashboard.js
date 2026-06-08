/* ============================================================
   DASHBOARD.JS — Dashboard auxiliar e master
   ============================================================ */

let dashCharts = {};

function renderDashboard() {
  const leads = leadsVisiveis(DB.leads);
  if (isMaster()) renderDashboardMaster(leads);
  else            renderDashboardAuxiliar(leads);
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  DASHBOARD AUXILIAR                                      ║
   ╚══════════════════════════════════════════════════════════╝ */
function renderDashboardAuxiliar(leads) {
  const unidade   = getUnidade(currentUser.unidade_id);
  const ativos    = leads.filter(l => l.etapa_funil !== 'perdido');
  const quentes   = ativos.filter(l => l.temperatura === 'quente');
  const visitas   = leads.filter(l => l.etapa_funil === 'agendamento_visita');
  const mesAtual  = new Date();
  const matriculas = leads.filter(l => {
    if (!l.data_matricula) return false;
    const d = new Date(l.data_matricula);
    return d.getMonth() === mesAtual.getMonth() && d.getFullYear() === mesAtual.getFullYear();
  });

  document.getElementById('page-dashboard').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">${unidade.nome}</p>
      </div>
      <span style="font-size:13px;color:var(--neutral-mid)">
        ${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
      </span>
    </div>
    <div class="page-body" style="display:flex;flex-direction:column;gap:20px">

      <!-- KPIs -->
      <div class="kpi-grid">
        ${kpiCard('📣','Leads Ativos',   ativos.length,    'Excluindo perdidos',          'background:var(--primary-pale)','color:var(--primary)')}
        ${kpiCard('🔥','Leads Quentes', quentes.length,   'Alta probabilidade',           'background:var(--accent-light)','color:var(--accent)')}
        ${kpiCard('📅','Visitas Agend.',  visitas.length,   'Aguardando realização',       'background:#e0f2fe','color:#0369a1')}
        ${kpiCard('✅','Matrículas/Mês', matriculas.length,'Mês atual',                   'background:var(--success-light)','color:var(--success)')}
      </div>

      <!-- Funil de conversão — destaque principal -->
      <div class="chart-card" style="border:2px solid var(--primary-pale)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h3 style="font-size:17px">📉 Funil de Conversão por Etapa</h3>
          <span style="font-size:12px;color:var(--neutral-mid)">% de avanço entre etapas consecutivas</span>
        </div>
        <div id="funnel-conv-aux"></div>
        <canvas id="chart-conv-line-aux" style="margin-top:20px;max-height:200px"></canvas>
      </div>

      <!-- Gráficos secundários -->
      <div class="charts-grid">
        <div class="chart-card">
          <h3>Leads por Origem <span style="font-size:11px;color:var(--neutral-mid);font-weight:400">(últimos 30 dias)</span></h3>
          <canvas id="chart-origens"></canvas>
        </div>
        <div class="chart-card">
          <h3>Volume de Leads por Semana</h3>
          <canvas id="chart-semanas"></canvas>
        </div>
      </div>

      <!-- Listas de ação -->
      <div class="dashboard-lists">
        <div class="list-card">
          <div class="list-card-header">
            <h3>📋 Ações de Hoje</h3>
            <span class="badge badge-primary">${leadsAcoesHoje(leads).length}</span>
          </div>
          <div class="list-card-body" id="lista-acoes-hoje"></div>
        </div>
        <div class="list-card">
          <div class="list-card-header" style="background:#fff5f6;border-bottom:1px solid var(--accent-light)">
            <h3 style="color:var(--accent)">⚠️ Sem Contato há +5 dias</h3>
            <span class="badge badge-danger">${leadsSemContato(leads).length}</span>
          </div>
          <div class="list-card-body" id="lista-sem-contato"></div>
        </div>
      </div>
    </div>`;

  renderFunnelConversao('funnel-conv-aux', 'chart-conv-line-aux', leads);
  renderListaAcoesHoje(leads);
  renderListaSemContato(leads);
  renderChartOrigens(leads);
  renderChartSemanas(leads);
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  DASHBOARD MASTER                                        ║
   ╚══════════════════════════════════════════════════════════╝ */
function renderDashboardMaster(leads) {
  const ativos = leads.filter(l => l.etapa_funil !== 'perdido');
  const mesAtual = new Date();
  const matriculasDoMes = leads.filter(l => {
    if (!l.data_matricula) return false;
    const d = new Date(l.data_matricula);
    return d.getMonth() === mesAtual.getMonth() && d.getFullYear() === mesAtual.getFullYear();
  });
  const totalMatric  = leads.filter(l => l.etapa_funil === 'matricula').length;
  const taxaGlobal   = leads.length > 0 ? (totalMatric / leads.length * 100).toFixed(1) : 0;
  const ticketMedio  = matriculasDoMes.length > 0
    ? (matriculasDoMes.reduce((s,l) => s + (l.valor_mensalidade||0), 0) / matriculasDoMes.length).toFixed(0)
    : 0;
  const quentes = leads.filter(l => l.temperatura === 'quente' && l.etapa_funil !== 'perdido');

  // Melhor unidade por taxa de conversão
  let melhorUnidade = '—'; let melhorTaxa = -1;
  UNIDADES.forEach(u => {
    const ul = leads.filter(l => l.unidade_id === u.id);
    if (!ul.length) return;
    const taxa = ul.filter(l => l.etapa_funil === 'matricula').length / ul.length * 100;
    if (taxa > melhorTaxa) { melhorTaxa = taxa; melhorUnidade = u.nome.split('—')[1]?.trim()||u.nome; }
  });

  document.getElementById('page-dashboard').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard — Visão da Rede</h1>
        <p class="page-subtitle">Gerenciamento consolidado de todas as unidades</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="filter-unidade-master" class="form-control" style="width:auto"
          onchange="recarregarDashMaster()">
          <option value="">Todas as Unidades</option>
          ${UNIDADES.map(u=>`<option value="${u.id}">${u.nome.split('—')[1]?.trim()||u.nome}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="page-body" style="display:flex;flex-direction:column;gap:20px">

      <!-- KPIs -->
      <div class="kpi-grid" style="grid-template-columns:repeat(auto-fill,minmax(168px,1fr))">
        ${kpiCard('📣','Leads na Rede',     ativos.length,         'Ativos', 'background:var(--primary-pale)','color:var(--primary)')}
        ${kpiCard('✅','Matrículas/Mês',    matriculasDoMes.length,'Mês atual', 'background:var(--success-light)','color:var(--success)')}
        ${kpiCard('📈','Tx. Conversão',     taxaGlobal+'%',        'Lead → Matrícula', 'background:#e0f2fe','color:#0369a1')}
        ${kpiCard('💰','Ticket Médio',      'R$ '+Number(ticketMedio).toLocaleString('pt-BR'),'Mensalidade', 'background:var(--gold-light)','color:#a06b00')}
        ${kpiCard('🔥','Leads Quentes',     quentes.length,        'Alta probabilidade', 'background:var(--accent-light)','color:var(--accent)')}
        ${kpiCard('🏆','Melhor Unidade',    melhorUnidade,         `Taxa: ${melhorTaxa.toFixed(1)}%`, 'background:#f0fdf4','color:var(--success)')}
      </div>

      <!-- FUNIL DE CONVERSÃO (destaque absoluto) -->
      <div class="chart-card" style="border:2px solid var(--primary-pale)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
          <h3 style="font-size:17px">📉 Funil de Conversão por Etapa</h3>
          <span style="font-size:12px;color:var(--neutral-mid)">Volume e % de avanço entre etapas consecutivas</span>
        </div>
        <div id="funnel-conv-master"></div>
        <canvas id="chart-conv-line-master" style="margin-top:20px;max-height:200px"></canvas>
      </div>

      <!-- Comparativo de Unidades + Origens -->
      <div class="charts-grid">
        <div class="chart-card">
          <h3>Performance por Unidade</h3>
          <canvas id="chart-unidades-dash" style="max-height:240px"></canvas>
        </div>
        <div class="chart-card">
          <h3>Leads por Origem</h3>
          <canvas id="chart-origens-master"></canvas>
        </div>
      </div>

      <!-- Tabela comparativa -->
      <div class="chart-card">
        <h3 style="margin-bottom:14px">Comparativo por Unidade</h3>
        <div class="table-wrapper">
          <table class="data-table units-table" id="table-unidades">
            <thead><tr>
              <th>Unidade</th>
              <th>Leads Ativos</th>
              <th>Visitas</th>
              <th>Inscrições</th>
              <th>Provas</th>
              <th>Matrículas</th>
              <th>Tx. Conv. %</th>
              <th>Leads Quentes</th>
            </tr></thead>
            <tbody id="tbody-unidades"></tbody>
          </table>
        </div>
      </div>

    </div>`;

  const leadsVis = leads;
  renderFunnelConversao('funnel-conv-master', 'chart-conv-line-master', leadsVis);
  renderTabelaUnidades(leadsVis);
  renderChartUnidadesDash(leadsVis);
  renderChartOrigensMaster(leadsVis);
}

/* ── Filtro unidade no master ── */
function recarregarDashMaster() {
  const uid = parseInt(document.getElementById('filter-unidade-master')?.value);
  const todos = DB.leads;
  const leads = uid ? todos.filter(l => l.unidade_id === uid) : todos;
  renderFunnelConversao('funnel-conv-master', 'chart-conv-line-master', leads);
  renderTabelaUnidades(leads);
  renderChartUnidadesDash(leads);
  renderChartOrigensMaster(leads);
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  FUNIL DE CONVERSÃO COM LINHA DE TAXA                    ║
   ╚══════════════════════════════════════════════════════════╝ */
function renderFunnelConversao(barContainerId, lineChartId, leads) {
  const etapasPrincipais = ETAPAS_FUNIL.filter(e => e.id !== 'perdido');
  const total = leads.length || 1;

  // Volume por etapa
  const volumes = etapasPrincipais.map(e => leads.filter(l => l.etapa_funil === e.id).length);

  // Taxa de conversão etapa → etapa (n_proximo / n_atual * 100)
  const taxas = etapasPrincipais.map((e, i) => {
    const atual   = volumes[i];
    const proximo = i < volumes.length - 1 ? volumes[i + 1] : null;
    if (proximo === null || atual === 0) return null;
    return ((proximo / atual) * 100).toFixed(1);
  });

  // Taxa acumulada (em relação ao total de leads = captacao_lead + todo o resto)
  const totalLeads = volumes[0] || total;
  const taxasAcumuladas = volumes.map(v => totalLeads > 0 ? (v / totalLeads * 100).toFixed(1) : 0);

  /* ── Barras do funil ── */
  const barContainer = document.getElementById(barContainerId);
  if (barContainer) {
    const maxVol = Math.max(...volumes, 1);
    barContainer.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px">
        ${etapasPrincipais.map((e, i) => {
          const v    = volumes[i];
          const pct  = Math.round(v / maxVol * 100);
          const taxa = taxas[i];
          const acum = taxasAcumuladas[i];
          return `
            <div style="display:flex;align-items:center;gap:10px">
              <!-- Label -->
              <div style="width:160px;text-align:right;font-size:12px;font-weight:600;color:var(--neutral-dark);flex-shrink:0">
                ${e.icone} ${e.label}
              </div>
              <!-- Barra -->
              <div style="flex:1;background:var(--neutral-light);border-radius:6px;height:30px;overflow:hidden;position:relative">
                <div style="width:${Math.max(pct,2)}%;height:100%;background:${e.cor};border-radius:6px;
                     display:flex;align-items:center;padding-left:10px;transition:width 0.6s ease">
                  ${v > 0 ? `<span style="color:white;font-size:12px;font-weight:700">${v}</span>` : ''}
                </div>
              </div>
              <!-- Volume e acumulado -->
              <div style="width:90px;text-align:right;flex-shrink:0">
                <span style="font-size:13px;font-weight:700;color:var(--neutral-dark)">${v}</span>
                <span style="font-size:11px;color:var(--neutral-mid);margin-left:4px">(${acum}%)</span>
              </div>
              <!-- Taxa de conversão para próxima etapa -->
              <div style="width:88px;flex-shrink:0">
                ${taxa !== null
                  ? `<span class="badge" style="font-size:11px;
                       background:${parseFloat(taxa)>=50?'var(--success-light)':parseFloat(taxa)>=25?'var(--gold-light)':'var(--accent-light)'};
                       color:${parseFloat(taxa)>=50?'var(--success)':parseFloat(taxa)>=25?'#a06b00':'var(--accent)'}">
                       → ${taxa}%
                     </span>`
                  : '<span style="font-size:11px;color:var(--neutral-mid)">—</span>'
                }
              </div>
            </div>`;
        }).join('')}
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
          <span style="font-size:11px;color:var(--neutral-mid)">Volume · (% do total)</span>
          <span style="font-size:11px;color:var(--neutral-mid);width:88px">→ conv. p/ próxima</span>
        </div>
      </div>`;
  }

  /* ── Linha de taxa acumulada ── */
  destroyChart(lineChartId);
  const ctx = document.getElementById(lineChartId)?.getContext('2d');
  if (!ctx) return;

  dashCharts[lineChartId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: etapasPrincipais.map(e => e.label),
      datasets: [
        {
          label: 'Volume de leads',
          data: volumes,
          borderColor: '#1A4DB5',
          backgroundColor: 'rgba(26,77,181,0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#1A4DB5',
          pointRadius: 5,
          yAxisID: 'yVol'
        },
        {
          label: 'Taxa acumulada (%)',
          data: taxasAcumuladas.map(Number),
          borderColor: '#1A7F4B',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 3],
          fill: false,
          tension: 0.35,
          pointBackgroundColor: '#1A7F4B',
          pointRadius: 4,
          yAxisID: 'yPct'
        }
      ]
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'DM Sans', size: 12 }, padding: 16 }
        },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              if (ctx.datasetIndex === 0) {
                const i = ctx.dataIndex;
                if (taxas[i] !== null) return `  → Conversão p/ próxima: ${taxas[i]}%`;
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { font: { family: 'DM Sans', size: 11 }, maxRotation: 30 }
        },
        yVol: {
          type: 'linear', position: 'left', beginAtZero: true,
          title: { display: true, text: 'Leads', font: { size: 11 } },
          ticks: { stepSize: 1 }
        },
        yPct: {
          type: 'linear', position: 'right', beginAtZero: true, max: 105,
          title: { display: true, text: '%', font: { size: 11 } },
          grid: { drawOnChartArea: false },
          ticks: { callback: v => v + '%' }
        }
      }
    }
  });
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  GRÁFICOS AUXILIARES                                     ║
   ╚══════════════════════════════════════════════════════════╝ */
function renderChartOrigens(leads) {
  const trinta = new Date(); trinta.setDate(trinta.getDate() - 30);
  const recentes = leads.filter(l => new Date(l.data_criacao) >= trinta);
  const contagem = {};
  recentes.forEach(l => { contagem[l.origem] = (contagem[l.origem]||0) + 1; });
  const labels = Object.keys(contagem);
  const values = Object.values(contagem);
  destroyChart('chart-origens');
  const ctx = document.getElementById('chart-origens')?.getContext('2d');
  if (!ctx) return;
  dashCharts['chart-origens'] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: PALETTE_COLORS }] },
    options: { plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 }, padding: 10 } } }, cutout: '58%' }
  });
}

function renderChartSemanas(leads) {
  const semanas = []; const labels = [];
  for (let i = 5; i >= 0; i--) {
    const ini = new Date(); ini.setDate(ini.getDate() - (i+1)*7);
    const fim = new Date(); fim.setDate(fim.getDate() - i*7);
    semanas.push(leads.filter(l => { const d = new Date(l.data_criacao); return d>=ini && d<fim; }).length);
    labels.push(i === 0 ? 'Esta sem.' : `Sem -${i}`);
  }
  destroyChart('chart-semanas');
  const ctx = document.getElementById('chart-semanas')?.getContext('2d');
  if (!ctx) return;
  dashCharts['chart-semanas'] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Leads criados', data: semanas, backgroundColor: '#1A4DB5', borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}

function renderChartOrigensMaster(leads) {
  const contagem = {};
  leads.forEach(l => { contagem[l.origem] = (contagem[l.origem]||0) + 1; });
  destroyChart('chart-origens-master');
  const ctx = document.getElementById('chart-origens-master')?.getContext('2d');
  if (!ctx) return;
  dashCharts['chart-origens-master'] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: Object.keys(contagem), datasets: [{ data: Object.values(contagem), backgroundColor: PALETTE_COLORS }] },
    options: { plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 }, padding: 10 } } }, cutout: '58%' }
  });
}

function renderChartUnidadesDash(leads) {
  destroyChart('chart-unidades-dash');
  const ctx = document.getElementById('chart-unidades-dash')?.getContext('2d');
  if (!ctx) return;
  const labels    = UNIDADES.map(u => u.nome.split('—')[1]?.trim()||u.nome);
  const leadsN    = UNIDADES.map(u => leads.filter(l=>l.unidade_id===u.id&&l.etapa_funil!=='perdido').length);
  const matricN   = UNIDADES.map(u => leads.filter(l=>l.unidade_id===u.id&&l.etapa_funil==='matricula').length);
  dashCharts['chart-unidades-dash'] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Leads Ativos', data: leadsN, backgroundColor: '#1A4DB5', borderRadius: 5 },
      { label: 'Matrículas',   data: matricN, backgroundColor: '#1A7F4B', borderRadius: 5 }
    ]},
    options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}

const PALETTE_COLORS = ['#003087','#1A4DB5','#0891B2','#8B5CF6','#EC4899','#F97316','#F5A623','#1A7F4B','#C8102E','#64748B','#D0D8E4'];

function destroyChart(id) {
  if (dashCharts[id]) { dashCharts[id].destroy(); delete dashCharts[id]; }
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  TABELA COMPARATIVA DE UNIDADES (master)                 ║
   ╚══════════════════════════════════════════════════════════╝ */
function renderTabelaUnidades(leads) {
  const tbody = document.getElementById('tbody-unidades');
  if (!tbody) return;
  tbody.innerHTML = UNIDADES.map(u => {
    const ul      = leads.filter(l => l.unidade_id === u.id);
    const ativos  = ul.filter(l => l.etapa_funil !== 'perdido').length;
    const visitas = ul.filter(l => l.etapa_funil === 'agendamento_visita').length;
    const inscritos = ul.filter(l => l.etapa_funil === 'inscricao').length;
    const provas  = ul.filter(l => l.etapa_funil === 'prova_nivelamento').length;
    const matric  = ul.filter(l => l.etapa_funil === 'matricula').length;
    const conv    = ul.length ? (matric/ul.length*100).toFixed(1) : '0.0';
    const quentes = ul.filter(l => l.temperatura === 'quente').length;
    const convNum = parseFloat(conv);
    const convCls = convNum >= 20 ? 'badge-success' : convNum >= 10 ? 'badge-gold' : 'badge-neutral';
    return `<tr>
      <td><span class="unit-name">${u.nome.split('—')[1]?.trim()||u.nome}</span></td>
      <td><strong>${ativos}</strong></td>
      <td>${visitas}</td>
      <td>${inscritos}</td>
      <td>${provas}</td>
      <td><span class="badge badge-success">${matric}</span></td>
      <td><span class="badge ${convCls}">${conv}%</span></td>
      <td>${quentes > 0 ? `<span class="badge badge-quente">${quentes}</span>` : '—'}</td>
    </tr>`;
  }).join('');
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  LISTAS DE AÇÃO                                          ║
   ╚══════════════════════════════════════════════════════════╝ */
function leadsAcoesHoje(leads) {
  const hoje = new Date().toDateString();
  return leads
    .filter(l => l.data_proxima_acao && new Date(l.data_proxima_acao).toDateString() === hoje)
    .sort((a,b) => { const o={quente:0,morno:1,frio:2}; return o[a.temperatura]-o[b.temperatura]; });
}

function leadsSemContato(leads) {
  return leads.filter(l => {
    if (['matricula','perdido'].includes(l.etapa_funil)) return false;
    return diasDesde(l.data_atualizacao) >= 5;
  });
}

function renderListaAcoesHoje(leads) {
  const lista = leadsAcoesHoje(leads);
  const el = document.getElementById('lista-acoes-hoje');
  if (!lista.length) { el.innerHTML = emptyState('📋','Nenhuma ação para hoje','Tudo em dia!'); return; }
  el.innerHTML = lista.map(l => `
    <div class="action-item" onclick="abrirDetalhe('${l.id}')">
      <div class="avatar avatar-sm" style="background:${avatarColor(l.nome_responsavel)}">${initials(l.nome_responsavel)}</div>
      <div class="action-item__info">
        <div class="action-item__name">${l.nome_responsavel}</div>
        <div class="action-item__meta">${l.nome_aluno} · ${l.proxima_acao||''}</div>
      </div>
      <span class="badge badge-${l.temperatura}">${tempIcon(l.temperatura)}</span>
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();abrirDetalhe('${l.id}')">Ver</button>
    </div>`).join('');
}

function renderListaSemContato(leads) {
  const lista = leadsSemContato(leads);
  const el = document.getElementById('lista-sem-contato');
  if (!lista.length) { el.innerHTML = emptyState('✅','Todos os leads atualizados','Bom trabalho!'); return; }
  el.innerHTML = lista.map(l => `
    <div class="action-item overdue-alert" onclick="abrirDetalhe('${l.id}')">
      <div class="avatar avatar-sm" style="background:${avatarColor(l.nome_responsavel)}">${initials(l.nome_responsavel)}</div>
      <div class="action-item__info">
        <div class="action-item__name">${l.nome_responsavel}</div>
        <div class="action-item__meta">${diasDesde(l.data_atualizacao)}d sem contato · ${getEtapa(l.etapa_funil).label}</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();abrirDetalhe('${l.id}')">Contatar</button>
    </div>`).join('');
}

/* ── Utilitários ── */
function kpiCard(icone, label, valor, sub, iconBg, iconColor) {
  return `<div class="kpi-card">
    <div class="kpi-card__icon" style="${iconBg};${iconColor}">${icone}</div>
    <div class="kpi-card__value">${valor}</div>
    <div class="kpi-card__label">${label}</div>
    <div class="kpi-card__sub">${sub}</div>
  </div>`;
}

function tempIcon(temp) {
  return temp === 'quente' ? '🔴 Quente' : temp === 'morno' ? '🟡 Morno' : '🔵 Frio';
}

function emptyState(icon, title, desc) {
  return `<div class="empty-state" style="padding:32px">
    <div class="empty-state__icon">${icon}</div>
    <div class="empty-state__title">${title}</div>
    <div class="empty-state__desc">${desc}</div>
  </div>`;
}
