-- ============================================================
-- CRM SANTA MARIA MINAS — SCHEMA SUPABASE (PostgreSQL)
-- Execute este script no SQL Editor do seu projeto Supabase
-- ============================================================

-- Extensão para gerar UUIDs
create extension if not exists "uuid-ossp";

-- ── Tabela: unidades ──
create table if not exists unidades (
  id          serial primary key,
  nome        text not null,
  cidade      text not null,
  ativo       boolean default true,
  criado_em   timestamptz default now()
);

-- ── Tabela: perfis (estende auth.users do Supabase Auth) ──
-- O id é o mesmo do auth.users.id (FK 1:1)
create table if not exists perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null,
  email         text not null unique,
  tipo          text not null check (tipo in ('master','auxiliar')) default 'auxiliar',
  unidade_id    integer references unidades(id),
  ativo         boolean default true,
  criado_em     timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- ── Tabela: leads ──
create table if not exists leads (
  id                  uuid primary key default uuid_generate_v4(),
  nome_responsavel    text not null,
  nome_aluno          text not null,
  telefone            text not null,
  email               text,
  unidade_id          integer not null references unidades(id),
  serie_interesse     text not null,
  turno_interesse     text,
  etapa_funil         text not null default 'captacao_lead',
  origem              text not null,
  data_criacao        timestamptz default now(),
  data_atualizacao    timestamptz default now(),
  responsavel_id      uuid references perfis(id),
  valor_mensalidade   numeric(10,2),
  temperatura         text check (temperatura in ('quente','morno','frio')) default 'morno',
  proxima_acao        text,
  data_proxima_acao   timestamptz,
  anotacoes           text,
  tags                text[] default '{}',
  convertido          boolean default false,
  data_matricula      timestamptz,
  motivo_perda        text
);

-- ── Tabela: histórico de atividades do lead ──
create table if not exists lead_historico (
  id           uuid primary key default uuid_generate_v4(),
  lead_id      uuid not null references leads(id) on delete cascade,
  usuario_id   uuid references perfis(id),
  usuario_nome text not null,
  tipo         text not null,
  acao         text not null,
  descricao    text,
  data         timestamptz default now()
);

-- ── Índices para performance ──
create index if not exists idx_leads_unidade        on leads(unidade_id);
create index if not exists idx_leads_etapa          on leads(etapa_funil);
create index if not exists idx_leads_responsavel    on leads(responsavel_id);
create index if not exists idx_leads_atualizacao    on leads(data_atualizacao);
create index if not exists idx_historico_lead       on lead_historico(lead_id);
create index if not exists idx_perfis_unidade       on perfis(unidade_id);

-- ============================================================
-- DADOS INICIAIS — Unidades da Rede
-- ============================================================
insert into unidades (id, nome, cidade) values
  (1, 'Santa Maria — Unidade Centro',    'BH'),
  (2, 'Santa Maria — Unidade Pampulha',  'BH'),
  (3, 'Santa Maria — Unidade Contagem',  'Contagem'),
  (4, 'Santa Maria — Unidade Betim',     'Betim'),
  (5, 'Santa Maria — Unidade Nova Lima', 'Nova Lima')
on conflict (id) do nothing;

-- Reinicia a sequência para não colidir com os IDs fixos acima
select setval('unidades_id_seq', (select max(id) from unidades));

-- ============================================================
-- TRIGGER: cria automaticamente um perfil ao registrar usuário
-- (usado quando o admin cria usuários via Supabase Auth)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfis (id, nome, email, tipo, unidade_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'tipo', 'auxiliar'),
    nullif(new.raw_user_meta_data->>'unidade_id','')::integer
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TRIGGER: atualiza "atualizado_em" em perfis
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_perfis_updated on perfis;
create trigger trg_perfis_updated
  before update on perfis
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table unidades       enable row level security;
alter table perfis         enable row level security;
alter table leads          enable row level security;
alter table lead_historico enable row level security;

-- Função auxiliar: retorna o perfil do usuário autenticado
create or replace function public.meu_perfil()
returns perfis as $$
  select * from perfis where id = auth.uid() limit 1;
$$ language sql stable security definer;

create or replace function public.sou_master()
returns boolean as $$
  select exists(select 1 from perfis where id = auth.uid() and tipo = 'master');
$$ language sql stable security definer;

create or replace function public.minha_unidade()
returns integer as $$
  select unidade_id from perfis where id = auth.uid();
$$ language sql stable security definer;

-- ── Políticas: unidades (todos autenticados podem ler) ──
drop policy if exists "unidades_select" on unidades;
create policy "unidades_select" on unidades for select
  using (auth.role() = 'authenticated');

drop policy if exists "unidades_admin_all" on unidades;
create policy "unidades_admin_all" on unidades for all
  using (sou_master()) with check (sou_master());

-- ── Políticas: perfis ──
-- Todo usuário autenticado pode ver todos os perfis (necessário para listas de responsáveis)
drop policy if exists "perfis_select" on perfis;
create policy "perfis_select" on perfis for select
  using (auth.role() = 'authenticated');

-- Apenas master pode inserir/editar/remover perfis (gestão de usuários)
drop policy if exists "perfis_admin_insert" on perfis;
create policy "perfis_admin_insert" on perfis for insert
  with check (sou_master());

drop policy if exists "perfis_admin_update" on perfis;
create policy "perfis_admin_update" on perfis for update
  using (sou_master() or id = auth.uid())
  with check (sou_master() or id = auth.uid());

drop policy if exists "perfis_admin_delete" on perfis;
create policy "perfis_admin_delete" on perfis for delete
  using (sou_master());

-- ── Políticas: leads ──
-- Master vê tudo; auxiliar vê apenas leads da própria unidade
drop policy if exists "leads_select" on leads;
create policy "leads_select" on leads for select
  using (sou_master() or unidade_id = minha_unidade());

drop policy if exists "leads_insert" on leads;
create policy "leads_insert" on leads for insert
  with check (sou_master() or unidade_id = minha_unidade());

drop policy if exists "leads_update" on leads;
create policy "leads_update" on leads for update
  using (sou_master() or unidade_id = minha_unidade())
  with check (sou_master() or unidade_id = minha_unidade());

drop policy if exists "leads_delete" on leads;
create policy "leads_delete" on leads for delete
  using (sou_master());

-- ── Políticas: histórico de leads ──
drop policy if exists "historico_select" on lead_historico;
create policy "historico_select" on lead_historico for select
  using (
    exists (
      select 1 from leads l
      where l.id = lead_historico.lead_id
        and (sou_master() or l.unidade_id = minha_unidade())
    )
  );

drop policy if exists "historico_insert" on lead_historico;
create policy "historico_insert" on lead_historico for insert
  with check (
    exists (
      select 1 from leads l
      where l.id = lead_historico.lead_id
        and (sou_master() or l.unidade_id = minha_unidade())
    )
  );

-- ============================================================
-- FIM DO SCHEMA
-- Após executar, crie o primeiro usuário master via:
--   Authentication → Users → Add User (no painel do Supabase)
--   Em "User Metadata" (raw_user_meta_data), adicione um JSON:
--   { "nome": "Gerente Comercial", "tipo": "master" }
-- O trigger criará o perfil automaticamente.
-- ============================================================
