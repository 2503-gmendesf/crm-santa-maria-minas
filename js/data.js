/* ============================================================
   DATA.JS — Schema, constantes e camada de dados (Supabase)
   ============================================================
   A UI do sistema foi originalmente escrita para ler dados de
   forma síncrona (DB.leads). Para manter essa compatibilidade
   sem reescrever toda a interface, mantemos um CACHE local em
   memória que é sincronizado com o Supabase:
     - LeadsStore.refresh()   → busca tudo do Supabase (async)
     - LeadsStore.leads       → array em cache (síncrono, para a UI)
     - LeadsStore.saveLead()  → grava no Supabase E atualiza cache
     - LeadsStore.deleteLead()→ remove no Supabase E do cache
   ============================================================ */

const UNIDADES_FALLBACK = [
  { id: 1, nome: "Santa Maria — Unidade Centro",    cidade: "BH" },
  { id: 2, nome: "Santa Maria — Unidade Pampulha",  cidade: "BH" },
  { id: 3, nome: "Santa Maria — Unidade Contagem",  cidade: "Contagem" },
  { id: 4, nome: "Santa Maria — Unidade Betim",     cidade: "Betim" },
  { id: 5, nome: "Santa Maria — Unidade Nova Lima", cidade: "Nova Lima" }
];

// UNIDADES é preenchido dinamicamente a partir do Supabase (ver carregarDadosIniciais)
let UNIDADES = [...UNIDADES_FALLBACK];
// USUARIOS é preenchido a partir da tabela "perfis"
let USUARIOS = [];

const ETAPAS_FUNIL = [
  { id: "captacao_lead",      label: "Captação Lead",       cor: "#5A6A7A", icone: "📣" },
  { id: "qualificacao",       label: "Qualificação",        cor: "#1A4DB5", icone: "🔍" },
  { id: "agendamento_visita", label: "Agendamento Visita",  cor: "#0891B2", icone: "📅" },
  { id: "visita_realizada",   label: "Visita Realizada",    cor: "#8B5CF6", icone: "🏫" },
  { id: "inscricao",          label: "Inscrição",           cor: "#EC4899", icone: "📝" },
  { id: "prova_nivelamento",  label: "Prova/Nivelamento",   cor: "#F97316", icone: "📋" },
  { id: "resultado",          label: "Resultado",           cor: "#F5A623", icone: "🎯" },
  { id: "matricula",          label: "Matrícula",           cor: "#1A7F4B", icone: "✅" },
  { id: "perdido",            label: "Perdido",             cor: "#C8102E", icone: "❌" }
];

const ORIGENS = [
  "Instagram", "Facebook", "Google Ads", "Site Institucional",
  "Indicação de Aluno", "Indicação de Ex-Aluno", "Evento / Feira",
  "Outdoor / Mídia OOH", "WhatsApp", "Ligação Receptiva", "Outros"
];

const SERIES = [
  "Maternal", "Pré-Escola", "1º Ano EF", "2º Ano EF", "3º Ano EF",
  "4º Ano EF", "5º Ano EF", "6º Ano EF", "7º Ano EF", "8º Ano EF",
  "9º Ano EF", "1º Ano EM", "2º Ano EM", "3º Ano EM"
];

const TURNOS = ["Manhã", "Tarde", "Integral"];

const TIPOS_ATIVIDADE = [
  { id: "ligacao",   label: "Ligação",          icone: "📞" },
  { id: "whatsapp",  label: "WhatsApp",         icone: "💬" },
  { id: "email",     label: "E-mail",           icone: "📧" },
  { id: "visita",    label: "Visita",           icone: "🏫" },
  { id: "anotacao",  label: "Anotação",         icone: "📝" },
  { id: "reuniao",   label: "Reunião",          icone: "🤝" }
];

const CORES_AVATAR = [
  "#003087","#1A4DB5","#1A7F4B","#8B5CF6",
  "#EC4899","#F97316","#C8102E","#0891B2"
];

// ── Gera UUID ──
function uuid() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function avatarColor(nome) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return CORES_AVATAR[Math.abs(hash) % CORES_AVATAR.length];
}
function initials(nome) {
  return nome.split(' ').filter(p => p).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}
function diasAtras(n)   { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }
function diasFuturos(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); }
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function diasDesde(iso) {
  if (!iso) return 999;
  return Math.floor((new Date() - new Date(iso)) / 86400000);
}

/* ============================================================
   LEADS STORE — camada de sincronização com Supabase
   ============================================================ */
const LeadsStore = {
  _leads: [],
  get leads() { return this._leads; },

  // Busca leads + histórico do Supabase e popula o cache
  async refresh() {
    if (!sb) return [];
    const { data: leadsData, error: errLeads } = await sb
      .from('leads')
      .select('*')
      .order('data_criacao', { ascending: false });

    if (errLeads) { console.error('Erro ao buscar leads:', errLeads.message); return []; }

    const ids = (leadsData || []).map(l => l.id);
    let historicoData = [];
    if (ids.length) {
      const { data: hist, error: errHist } = await sb
        .from('lead_historico')
        .select('*')
        .in('lead_id', ids)
        .order('data', { ascending: false });
      if (errHist) console.error('Erro ao buscar histórico:', errHist.message);
      historicoData = hist || [];
    }

    this._leads = (leadsData || []).map(l => ({
      ...mapLeadFromDB(l),
      historico: historicoData
        .filter(h => h.lead_id === l.id)
        .map(h => ({ id: h.id, data: h.data, usuario_id: h.usuario_id, usuario: h.usuario_nome, tipo: h.tipo, acao: h.acao, descricao: h.descricao }))
    }));

    return this._leads;
  },

  // Cria ou atualiza um lead (grava no Supabase e atualiza o cache local)
  async saveLead(lead, novoHistoricoItem) {
    if (!sb) return { error: 'Supabase não configurado' };

    const payload = mapLeadToDB(lead);
    const existente = this._leads.find(l => l.id === lead.id);

    let resultado;
    if (existente) {
      resultado = await sb.from('leads').update(payload).eq('id', lead.id).select().single();
    } else {
      payload.id = lead.id || uuid();
      resultado = await sb.from('leads').insert(payload).select().single();
    }

    if (resultado.error) {
      console.error('Erro ao salvar lead:', resultado.error.message);
      return { error: resultado.error.message };
    }

    // Grava o item de histórico mais recente (se informado)
    if (novoHistoricoItem) {
      const { error: errHist } = await sb.from('lead_historico').insert({
        id: novoHistoricoItem.id || uuid(),
        lead_id: resultado.data.id,
        usuario_id: novoHistoricoItem.usuario_id,
        usuario_nome: novoHistoricoItem.usuario,
        tipo: novoHistoricoItem.tipo,
        acao: novoHistoricoItem.acao,
        descricao: novoHistoricoItem.descricao,
        data: novoHistoricoItem.data || new Date().toISOString()
      });
      if (errHist) console.error('Erro ao gravar histórico:', errHist.message);
    }

    // Atualiza cache local
    const leadAtualizado = { ...mapLeadFromDB(resultado.data) };
    const idx = this._leads.findIndex(l => l.id === leadAtualizado.id);
    if (idx >= 0) {
      leadAtualizado.historico = novoHistoricoItem
        ? [novoHistoricoItem, ...this._leads[idx].historico]
        : this._leads[idx].historico;
      this._leads[idx] = leadAtualizado;
    } else {
      leadAtualizado.historico = novoHistoricoItem ? [novoHistoricoItem] : [];
      this._leads.unshift(leadAtualizado);
    }

    return { data: leadAtualizado };
  },

  async deleteLead(id) {
    if (!sb) return { error: 'Supabase não configurado' };
    const { error } = await sb.from('leads').delete().eq('id', id);
    if (error) return { error: error.message };
    this._leads = this._leads.filter(l => l.id !== id);
    return { ok: true };
  }
};

// Compatibilidade: várias partes do código antigo chamam DB.leads / DB.saveLead
const DB = {
  get leads() { return LeadsStore.leads; },
  saveLead(lead, historicoItem) { return LeadsStore.saveLead(lead, historicoItem); },
  deleteLead(id) { return LeadsStore.deleteLead(id); }
};

// ── Mapeia lead do formato do banco → formato usado pela UI ──
function mapLeadFromDB(row) {
  return {
    id: row.id,
    nome_responsavel: row.nome_responsavel,
    nome_aluno: row.nome_aluno,
    telefone: row.telefone,
    email: row.email,
    unidade_id: row.unidade_id,
    serie_interesse: Array.isArray(row.serie_interesse) ? row.serie_interesse : (row.serie_interesse ? [row.serie_interesse] : []),
    turno_interesse: row.turno_interesse,
    etapa_funil: row.etapa_funil,
    origem: row.origem,
    data_criacao: row.data_criacao,
    data_atualizacao: row.data_atualizacao,
    responsavel_id: row.responsavel_id,
    valor_mensalidade: row.valor_mensalidade,
    temperatura: row.temperatura,
    proxima_acao: row.proxima_acao,
    data_proxima_acao: row.data_proxima_acao,
    anotacoes: row.anotacoes,
    tags: row.tags || [],
    convertido: row.convertido,
    data_matricula: row.data_matricula,
    motivo_perda: row.motivo_perda,
    historico: row.historico || []
  };
}

// ── Mapeia lead do formato da UI → formato do banco (remove campos calculados) ──
function mapLeadToDB(lead) {
  return {
    nome_responsavel: lead.nome_responsavel,
    nome_aluno: lead.nome_aluno,
    telefone: lead.telefone,
    email: lead.email || null,
    unidade_id: lead.unidade_id,
    serie_interesse: lead.serie_interesse,
    turno_interesse: lead.turno_interesse,
    etapa_funil: lead.etapa_funil,
    origem: lead.origem,
    data_criacao: lead.data_criacao,
    data_atualizacao: lead.data_atualizacao,
    responsavel_id: lead.responsavel_id,
    valor_mensalidade: lead.valor_mensalidade || null,
    temperatura: lead.temperatura,
    proxima_acao: lead.proxima_acao || null,
    data_proxima_acao: lead.data_proxima_acao || null,
    anotacoes: lead.anotacoes || null,
    tags: lead.tags || [],
    convertido: !!lead.convertido,
    data_matricula: lead.data_matricula || null,
    motivo_perda: lead.motivo_perda || null
  };
}

/* ============================================================
   CARREGAMENTO INICIAL — unidades, usuários e leads
   ============================================================ */
async function carregarDadosIniciais() {
  const [unidades, usuarios] = await Promise.all([
    listarUnidades(true),
    listarUsuarios(true)
  ]);
  if (unidades?.length) UNIDADES = unidades;
  if (usuarios)         USUARIOS = usuarios;

  await LeadsStore.refresh();
}

/* ============================================================
   SEED — popula o banco com dados de demonstração (opcional)
   Chamado manualmente pelo painel Admin quando o banco está vazio
   ============================================================ */
const NOMES_RESPONSAVEIS = [
  "Marcos Oliveira","Ana Cristina Ferreira","José Roberto Santos","Patrícia Alves Costa",
  "Ricardo Nunes","Simone Meirelles","Eduardo Teixeira","Luciana Barbosa","Fernando Pires",
  "Cláudia Rocha","Alexandre Lima","Débora Martins","Roberto Carvalho","Tatiana Freitas",
  "Paulo Henrique Souza","Mariana Andrade","Sérgio Nascimento","Juliana Cunha",
  "Thiago Mendonça","Cristiane Vieira","Leandro Assis","Renata Borges","Diego Lopes",
  "Vanessa Cardoso","Márcio Silveira","Adriana Macedo","Fabrício Moura","Cíntia Araújo",
  "Gilson Figueiredo","Bruna Rezende"
];
const NOMES_ALUNOS = [
  "Gabriel Oliveira","Sophia Ferreira","Matheus Santos","Isabela Costa","Pedro Nunes",
  "Beatriz Meirelles","Lucas Teixeira","Larissa Barbosa","Enzo Pires","Valentina Rocha",
  "Arthur Lima","Laura Martins","Caio Carvalho","Clara Freitas","Bernardo Souza",
  "Alice Andrade","Rafael Nascimento","Lívia Cunha","Felipe Mendonça","Manuela Vieira",
  "Vinícius Assis","Helena Borges","Davi Lopes","Ana Luíza Cardoso","Samuel Silveira",
  "Carolina Macedo","Henrique Moura","Camila Araújo","Leonardo Figueiredo","Júlia Rezende"
];

async function gerarESalvarLeadsDemo(progressoCb) {
  if (!isMaster()) { toast('Apenas o administrador pode gerar dados de demonstração', 'error'); return; }
  if (!USUARIOS.length || !UNIDADES.length) await carregarDadosIniciais();

  const auxiliares = USUARIOS.filter(u => u.tipo === 'auxiliar' && u.unidade_id);
  if (!auxiliares.length) {
    toast('Crie ao menos um usuário auxiliar (com unidade) antes de gerar leads demo', 'warning');
    return;
  }

  const etapas = [
    "captacao_lead","captacao_lead","captacao_lead","captacao_lead",
    "qualificacao","qualificacao","qualificacao",
    "agendamento_visita","agendamento_visita","agendamento_visita",
    "visita_realizada","visita_realizada","visita_realizada",
    "inscricao","inscricao","inscricao",
    "prova_nivelamento","prova_nivelamento",
    "resultado","resultado",
    "matricula","matricula","matricula",
    "perdido","perdido","perdido",
    "captacao_lead","qualificacao","agendamento_visita","visita_realizada"
  ];
  const temps = ['quente','quente','morno','morno','frio'];

  let criados = 0;
  for (let i = 0; i < 30; i++) {
    const unidade = UNIDADES[i % UNIDADES.length];
    const responsavel = auxiliares.find(u => u.unidade_id === unidade.id) || auxiliares[i % auxiliares.length];
    const etapa = etapas[i % etapas.length];
    const temp  = temps[i % temps.length];
    const criado = diasAtras(Math.floor(Math.random() * 60) + 1);
    const serie  = SERIES[Math.floor(Math.random() * SERIES.length)];
    const origem = ORIGENS[Math.floor(Math.random() * ORIGENS.length)];
    const mensalidade = [1200,1400,1600,1800,2000,2200][Math.floor(Math.random()*6)];

    let proxima_acao = null, data_proxima_acao = null;
    if (!['matricula','perdido'].includes(etapa)) {
      const vencida = Math.random() > 0.5;
      data_proxima_acao = vencida ? diasAtras(Math.floor(Math.random()*3)+1) : diasFuturos(Math.floor(Math.random()*7)+1);
      proxima_acao = ['Ligar para confirmar visita','Enviar proposta atualizada','Agendar nova visita','Fazer follow-up por WhatsApp','Enviar material informativo'][Math.floor(Math.random()*5)];
    }

    const novoLead = {
      id: uuid(),
      nome_responsavel: NOMES_RESPONSAVEIS[i],
      nome_aluno: NOMES_ALUNOS[i],
      telefone: `(31) 9${String(Math.floor(Math.random()*90000000+10000000))}`,
      email: NOMES_RESPONSAVEIS[i].split(' ')[0].toLowerCase() + `${i}@email.com`,
      unidade_id: unidade.id,
      serie_interesse: serie,
      turno_interesse: TURNOS[Math.floor(Math.random()*3)],
      etapa_funil: etapa,
      origem,
      data_criacao: criado,
      data_atualizacao: diasAtras(Math.floor(Math.random()*10)),
      responsavel_id: responsavel.id,
      valor_mensalidade: mensalidade,
      temperatura: temp,
      proxima_acao,
      data_proxima_acao,
      anotacoes: '',
      tags: [],
      convertido: etapa === 'matricula',
      data_matricula: etapa === 'matricula' ? diasAtras(Math.floor(Math.random()*30)) : null,
      motivo_perda: etapa === 'perdido' ? 'Optou por concorrente' : null
    };

    const { data, error } = await LeadsStore.saveLead(novoLead, {
      id: uuid(), data: criado, usuario_id: responsavel.id, usuario: responsavel.nome,
      tipo: 'criacao', acao: 'Lead criado', descricao: `Lead captado via ${origem}`
    });

    if (!error) criados++;
    if (progressoCb) progressoCb(i + 1, 30);
  }

  await LeadsStore.refresh();
  return criados;
}
