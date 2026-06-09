/* ============================================================
   SUPABASE-CLIENT.JS — Configuração e inicialização do Supabase
   ============================================================
   INSTRUÇÕES:
   1. Crie um projeto em https://supabase.com (gratuito)
   2. Vá em Settings → API e copie:
      - Project URL          → cole em SUPABASE_URL
      - anon / public key    → cole em SUPABASE_ANON_KEY
   3. No SQL Editor, execute o arquivo sql/schema.sql
   4. Crie o primeiro usuário master em Authentication → Users
      com metadata: { "nome": "Gerente Comercial", "tipo": "master" }
   ============================================================ */

const SUPABASE_URL      = 'https://cvddbbbdppphklazuzko.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZGRiYmJkcHBwaGtsYXp1emtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzkyOTAsImV4cCI6MjA5NjUxNTI5MH0.iWNCDv_7e_YRi7vjihQPkRdYtDiP6JUiXviqJRfxf1g';

// Indica se a configuração foi preenchida corretamente
const SUPABASE_CONFIGURADO =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_ANON_KEY.startsWith('eyJ');

// Cliente Supabase (criado apenas se configurado e biblioteca carregada)
let sb = null;
function inicializarClienteSupabase() {
  if (sb) return sb;
  const lib = window.supabase;
  if (SUPABASE_CONFIGURADO && lib && typeof lib.createClient === 'function') {
    sb = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'crm_santamaria_auth'
      }
    });
  }
  return sb;
}
inicializarClienteSupabase();

// ── Aviso de configuração pendente ──
function checarConfigSupabase() {
  if (!SUPABASE_CONFIGURADO) {
    console.warn(
      '%c⚠️ Supabase não configurado',
      'font-weight:bold;color:#C8102E;font-size:13px',
      '\nEdite js/supabase-client.js e preencha SUPABASE_URL e SUPABASE_ANON_KEY com as credenciais do seu projeto.'
    );
    return false;
  }
  if (!window.supabase) {
    console.error('Biblioteca Supabase não carregada. Verifique a conexão com o CDN.');
    return false;
  }
  return true;
}
