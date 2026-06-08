/* ============================================================
   REPORTS.JS — Relatórios (apenas Gerente Master)
   ============================================================ */

let reportCharts = {};

function renderRelatorios() {
  if (!isMaster()) return;
  const leads = DB.leads;

  document.getElementById('page-relatorios').innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📊 Relatórios</h1>
        <p class="page-subtitle">Visão analítica da Rede de Colégios Santa Maria</p>
      </div>
      <div style="display:flex;gap:8px">
        <select class="form-control" id="report-unidade" style="width:auto" onchange="recarregarRelatorios()">
          <option value="">Todas as Unidades</option>
          ${UNIDADES.map(u=>`<option value="${u.id}">${u.nome.split('—')[1]?.trim()||u.nome}</option>`).join('')}
        </select>
        <select class="form-control" id="report-periodo" style="width:auto" onchange="recarregarRelatorios()">
          <option value="30">Últimos 30 dias</option>
          <option value="7">Últimos 7 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="365">Este ano</option>
          <option value="0">Todos</option>
        </select>
      </div>
    </div>
    <div class="page-body">

      <!-- Funil Consolidado -->
      <div class="report-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h2>📉 Funil Consolidado</h2>
          <button class="btn btn-secondary btn-sm" onclick="exportarRelatorio('funil')">📥 Exportar CSV</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div class="chart-card">
            <h3>Distribuição por Etapa</h3>
            <canvas id="chart-funil-pizza"></canvas>
          </div>
          <div class="chart-card">
            <h3>Volume por Etapa</h3>
            <div id="report-funil-bars"></div>
          </div>
        </div>
        <div class="chart-card" style="margin-top:16px">
          <h3>Tabela do Funil</h3>
          <div class="table-wrapper" id="table-funil-wrapper"></div>
        </div>
      </div>

      <!-- Performance por Origem -->
      <div class="report-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h2>📡 Performance por Origem</h2>
          <button class="btn btn-secondary btn-sm" onclick="exportarRelatorio('origem')">📥 Exportar CSV</button>
        </div>
        <div class="chart-card">
          <div class="table-wrapper" id="table-origem-wrapper"></div>
        </div>
      </div>

      <!-- Performance por Unidade -->
      <div class="report-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h2>🏫 Performance por Unidade</h2>
          <button class="btn btn-secondary btn-sm" onclick="exportarRelatorio('unidade')">📥 Exportar CSV</button>
        </div>
        <div class="chart-card">
          <canvas id="chart-unidades-bar" style="max-height:300px"></canvas>
        </div>
      </div>

      <!-- Ranking de Responsáveis -->
      <div class="report-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h2>🏆 Performance por Responsável</h2>
          <button class="btn btn-secondary btn-sm" onclick="exportarRelatorio('responsavel')">📥 Exportar CSV</button>
        </div>
        <div class="chart-card">
          <div class="table-wrapper" id="table-resp-wrapper"></div>
        </div>
      </div>

    </div>`;

  renderRelatorioFunil(leads);
  renderRelatorioOrigem(leads);
  renderRelatorioUnidades(leads);
  renderRelatorioResponsaveis(leads);
}

function getLeadsFiltradosReport() {
  let leads = DB.leads;
  const unidadeId = parseInt(document.getElementById('report-unidade')?.value);
  const dias      = parseInt(document.getElementById('report-periodo')?.value);

  if (unidadeId) leads = leads.filter(l => l.unidade_id === unidadeId);
  if (dias > 0) {
    const limite = new Date();
    limite.setDate(limite.getDate() - dias);
    leads = leads.filter(l => new Date(l.data_criacao) >= limite);
  }
  return leads;
}

function recarregarRelatorios() {
  const leads = getLeadsFiltradosReport();
  renderRelatorioFunil(leads);
  renderRelatorioOrigem(leads);
  renderRelatorioUnidades(leads);
  renderRelatorioResponsaveis(leads);
}

// ── Funil ──
function renderRelatorioFunil(leads) {
  const total = leads.length || 1;

  // Pizza
  destroyReportChart('chart-funil-pizza');
  const ctx = document.getElementById('chart-funil-pizza')?.getContext('2d');
  if (ctx) {
    reportCharts['chart-funil-pizza'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ETAPAS_FUNIL.map(e => e.label),
        datasets: [{
          data: ETAPAS_FUNIL.map(e => leads.filter(l=>l.etapa_funil===e.id).length),
          backgroundColor: ETAPAS_FUNIL.map(e => e.cor)
        }]
      },
      options: { plugins: { legend: { position: 'right', labels: { font: { family: 'DM Sans', size: 11 }, padding: 8 } } }, cutout: '55%' }
    });
  }

  // Barras horizontais
  const barsEl = document.getElementById('report-funil-bars');
  if (barsEl) {
    barsEl.innerHTML = '<div class="funnel-chart">' + ETAPAS_FUNIL.map(e => {
      const count = leads.filter(l=>l.etapa_funil===e.id).length;
      const pct   = Math.round(count/total*100);
      return `<div class="funnel-bar-row">
        <div class="funnel-bar-label" style="font-size:12px">${e.icone} ${e.label}</div>
        <div class="funnel-bar-track">
          <div class="funnel-bar-fill" style="width:${Math.max(pct,2)}%;background:${e.cor}">${count||''}</div>
        </div>
        <div class="funnel-bar-count">${pct}%</div>
      </div>`;
    }).join('') + '</div>';
  }

  // Tabela
  const tw = document.getElementById('table-funil-wrapper');
  if (tw) {
    const rows = ETAPAS_FUNIL.map((e, i) => {
      const count = leads.filter(l=>l.etapa_funil===e.id).length;
      const pct   = (count/total*100).toFixed(1);
      const proxEtapa = ETAPAS_FUNIL[i+1];
      const convProx  = proxEtapa ? ((leads.filter(l=>l.etapa_funil===proxEtapa.id).length/Math.max(count,1))*100).toFixed(1) : '—';
      return `<tr>
        <td><span class="badge" style="background:${e.cor}22;color:${e.cor}">${e.icone} ${e.label}</span></td>
        <td><strong>${count}</strong></td>
        <td>${pct}%</td>
        <td>${convProx !== '—' ? convProx+'%' : '—'}</td>
      </tr>`;
    });
    tw.innerHTML = `<table class="data-table">
      <thead><tr><th>Etapa</th><th>Volume</th><th>% do Total</th><th>Conv. p/ Próx.</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;
  }
}

// ── Origem ──
function renderRelatorioOrigem(leads) {
  const tw = document.getElementById('table-origem-wrapper');
  if (!tw) return;
  const rows = ORIGENS.map(o => {
    const ol  = leads.filter(l => l.origem === o);
    const neg = ol.filter(l => l.etapa_funil === 'prova_nivelamento').length;
    const mat = ol.filter(l => l.etapa_funil === 'matricula').length;
    const conv = ol.length ? (mat/ol.length*100).toFixed(1) : '0.0';
    if (!ol.length) return '';
    return `<tr>
      <td><strong>${o}</strong></td>
      <td>${ol.length}</td>
      <td>${neg}</td>
      <td><span class="badge badge-success">${mat}</span></td>
      <td><span class="badge ${parseFloat(conv)>=20?'badge-success':parseFloat(conv)>=10?'badge-gold':'badge-neutral'}">${conv}%</span></td>
    </tr>`;
  }).filter(Boolean);
  tw.innerHTML = `<table class="data-table">
    <thead><tr><th>Origem</th><th>Total Leads</th><th>Em Negociação</th><th>Matriculados</th><th>Conversão %</th></tr></thead>
    <tbody>${rows.join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--neutral-mid)">Nenhum dado</td></tr>'}</tbody>
  </table>`;
}

// ── Unidades ──
function renderRelatorioUnidades(leads) {
  destroyReportChart('chart-unidades-bar');
  const ctx = document.getElementById('chart-unidades-bar')?.getContext('2d');
  if (!ctx) return;
  const labels = UNIDADES.map(u => u.nome.split('—')[1]?.trim()||u.nome);
  const leadsCount = UNIDADES.map(u => leads.filter(l=>l.unidade_id===u.id).length);
  const matriculas  = UNIDADES.map(u => leads.filter(l=>l.unidade_id===u.id&&l.etapa_funil==='matricula').length);
  reportCharts['chart-unidades-bar'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Total de Leads', data: leadsCount, backgroundColor: '#1A4DB5', borderRadius: 6 },
        { label: 'Matrículas',     data: matriculas,  backgroundColor: '#1A7F4B', borderRadius: 6 }
      ]
    },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
  });
}

// ── Responsáveis ──
function renderRelatorioResponsaveis(leads) {
  const tw = document.getElementById('table-resp-wrapper');
  if (!tw) return;
  const rows = USUARIOS.filter(u => u.tipo === 'auxiliar').map((u, i) => {
    const ul  = leads.filter(l => l.responsavel_id === u.id);
    const mat = ul.filter(l => l.etapa_funil === 'matricula').length;
    const conv = ul.length ? (mat/ul.length*100).toFixed(1) : '0.0';
    const unidade = getUnidade(u.unidade_id);
    const rank = i + 1;
    return { rank, nome: u.nome, unidade: unidade.nome.split('—')[1]?.trim()||'', total: ul.length, matriculas: mat, conv: parseFloat(conv), row: `<tr>
      <td><span class="badge ${rank===1?'badge-gold':rank<=3?'badge-primary':'badge-neutral'}">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}</span></td>
      <td><strong>${u.nome}</strong></td>
      <td style="font-size:12px;color:var(--neutral-mid)">${unidade.nome.split('—')[1]?.trim()||''}</td>
      <td>${ul.length}</td>
      <td><span class="badge badge-success">${mat}</span></td>
      <td><span class="badge ${parseFloat(conv)>=20?'badge-success':parseFloat(conv)>=10?'badge-gold':'badge-neutral'}">${conv}%</span></td>
    </tr>` };
  }).sort((a,b) => b.conv - a.conv);

  rows.forEach((r,i) => r.rank = i+1);
  tw.innerHTML = `<table class="data-table">
    <thead><tr><th>#</th><th>Responsável</th><th>Unidade</th><th>Total Leads</th><th>Matrículas</th><th>Conversão %</th></tr></thead>
    <tbody>${rows.map(r=>r.row).join('')}</tbody>
  </table>`;
}

function destroyReportChart(id) {
  if (reportCharts[id]) { reportCharts[id].destroy(); delete reportCharts[id]; }
}

// ── Exportar CSV do relatório ──
function exportarRelatorio(tipo) {
  const leads = getLeadsFiltradosReport();
  let rows = [], header = [];

  if (tipo === 'funil') {
    header = ['Etapa','Volume','% do Total'];
    const total = leads.length || 1;
    rows = ETAPAS_FUNIL.map(e => {
      const count = leads.filter(l=>l.etapa_funil===e.id).length;
      return [e.label, count, (count/total*100).toFixed(1)+'%'];
    });
  } else if (tipo === 'origem') {
    header = ['Origem','Total Leads','Em Negociação','Matriculados','Conversão %'];
    rows = ORIGENS.map(o => {
      const ol = leads.filter(l=>l.origem===o);
      if (!ol.length) return null;
      return [o, ol.length, ol.filter(l=>l.etapa_funil==='prova_nivelamento').length, ol.filter(l=>l.etapa_funil==='matricula').length, (ol.filter(l=>l.etapa_funil==='matricula').length/ol.length*100).toFixed(1)+'%'];
    }).filter(Boolean);
  } else if (tipo === 'unidade') {
    header = ['Unidade','Total Leads','Matrículas','Conversão %'];
    rows = UNIDADES.map(u => {
      const ul = leads.filter(l=>l.unidade_id===u.id);
      const mat = ul.filter(l=>l.etapa_funil==='matricula').length;
      return [u.nome, ul.length, mat, ul.length ? (mat/ul.length*100).toFixed(1)+'%' : '0%'];
    });
  } else if (tipo === 'responsavel') {
    header = ['Responsável','Unidade','Total Leads','Matrículas','Conversão %'];
    rows = USUARIOS.filter(u=>u.tipo==='auxiliar').map(u => {
      const ul = leads.filter(l=>l.responsavel_id===u.id);
      const mat = ul.filter(l=>l.etapa_funil==='matricula').length;
      return [u.nome, getUnidade(u.unidade_id).nome, ul.length, mat, ul.length?(mat/ul.length*100).toFixed(1)+'%':'0%'];
    });
  }

  const csv = [header, ...rows].map(r => r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`relatorio_${tipo}_santamaria.csv`; a.click();
  URL.revokeObjectURL(url);
  toast('Relatório exportado com sucesso', 'success');
}
