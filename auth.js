/* ============================================================
   AUTH.JS — Autenticação real via Supabase Auth
   ============================================================ */

let currentUser = null;     // perfil atual { id, nome, email, tipo, unidade_id }
let currentSession = null;  // sessão do Supabase Auth

function getUser() { return currentUser; }
function isMaster() { return !!currentUser && currentUser.tipo === 'master'; }

// ── Login com e-mail/senha via Supabase Auth ──
async function login(email, senha) {
  if (!sb) { toast('Supabase não configurado. Veja js/supabase-client.js', 'error'); return false; }

  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) {
    console.error('Erro de login:', error.message);
    return false;
  }
  currentSession = data.session;
  return await carregarPerfil(data.user.id);
}

// ── Carrega o perfil (tabela "perfis") do usuário autenticado ──
async function carregarPerfil(userId) {
  const { data, error } = await sb
    .from('perfis')
    .select('id, nome, email, tipo, unidade_id, ativo')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('Erro ao carregar perfil:', error?.message);
    await sb.auth.signOut();
    return false;
  }
  if (data.ativo === false) {
    toast('Sua conta está desativada. Contate o administrador.', 'error');
    await sb.auth.signOut();
    return false;
  }
  currentUser = data;
  return true;
}

// ── Logout ──
async function logout() {
  if (sb) await sb.auth.signOut();
  currentUser = null;
  currentSession = null;
}

// ── Restaura sessão existente (ao recarregar a página) ──
async function restoreSession() {
  if (!sb) return false;
  const { data } = await sb.auth.getSession();
  if (data?.session?.user) {
    currentSession = data.session;
    return await carregarPerfil(data.session.user.id);
  }
  return false;
}

// ── Cadastro de novo usuário (usado pelo painel Admin) ──
// Cria o usuário no Auth; o trigger no banco cria o perfil automaticamente.
async function adminCriarUsuario({ nome, email, senha, tipo, unidade_id }) {
  if (!isMaster()) return { error: 'Apenas administradores podem criar usuários.' };

  // Usamos signUp porque a anon key não tem permissão de admin (admin.createUser exige service_role).
  // Isso cria a conta e dispara o trigger handle_new_user() para criar o perfil.
  const { data, error } = await sb.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome, tipo, unidade_id: unidade_id ? String(unidade_id) : '' }
    }
  });

  if (error) return { error: error.message };

  // Atualiza explicitamente o perfil (garante consistência mesmo se o trigger usar defaults)
  if (data?.user?.id) {
    await sb.from('perfis').update({
      nome, tipo, unidade_id: unidade_id || null
    }).eq('id', data.user.id);
  }

  return { data };
}

// ── Atualizar usuário existente (painel Admin) ──
async function adminAtualizarUsuario(id, { nome, tipo, unidade_id, ativo }) {
  if (!isMaster()) return { error: 'Apenas administradores podem editar usuários.' };
  const { error } = await sb
    .from('perfis')
    .update({ nome, tipo, unidade_id: unidade_id || null, ativo })
    .eq('id', id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ── Desativar usuário (soft delete — preserva integridade referencial) ──
async function adminDesativarUsuario(id) {
  if (!isMaster()) return { error: 'Apenas administradores podem remover usuários.' };
  const { error } = await sb.from('perfis').update({ ativo: false }).eq('id', id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ── Listar todos os usuários (cache simples em memória) ──
let usuariosCache = null;
async function listarUsuarios(forcar = false) {
  if (usuariosCache && !forcar) return usuariosCache;
  const { data, error } = await sb
    .from('perfis')
    .select('id, nome, email, tipo, unidade_id, ativo, criado_em')
    .order('nome');
  if (error) { console.error(error.message); return []; }
  usuariosCache = data || [];
  return usuariosCache;
}
function invalidarCacheUsuarios() { usuariosCache = null; }

// ── Listar unidades (cache em memória) ──
let unidadesCache = null;
async function listarUnidades(forcar = false) {
  if (unidadesCache && !forcar) return unidadesCache;
  const { data, error } = await sb
    .from('unidades')
    .select('id, nome, cidade, ativo')
    .order('id');
  if (error) { console.error(error.message); return []; }
  unidadesCache = data || [];
  return unidadesCache;
}
function invalidarCacheUnidades() { unidadesCache = null; }

// ── Helpers síncronos baseados em cache (compatibilidade com código existente) ──
function getUnidade(id) {
  const u = (unidadesCache || []).find(u => u.id === id);
  return u || { nome: 'Unidade #' + id, cidade: '' };
}
function getUsuario(id) {
  const u = (usuariosCache || []).find(u => u.id === id);
  return u || { nome: 'Usuário', email: '' };
}
function getEtapa(id) {
  return ETAPAS_FUNIL.find(e => e.id === id) || { label: id, cor: '#5A6A7A', icone: '•' };
}

// ── Filtra leads visíveis conforme o tipo de usuário (a RLS já filtra no banco,
//    mas mantemos esta função para compatibilidade com chamadas existentes) ──
function leadsVisiveis(leads) {
  if (isMaster()) return leads;
  return leads.filter(l => l.unidade_id === currentUser.unidade_id);
}
