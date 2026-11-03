-- ARQUIVO GERADO: rode inteiro no SQL Editor do Supabase (uma vez só)

-- >>> migrations/0001_schema.sql
-- =====================================================================
-- Barbearia Jean Rodrigues — schema principal
-- Valores em dinheiro: inteiros em centavos.
-- Fuso de referência: America/Sao_Paulo
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type papel_usuario     as enum ('dono', 'barbeiro');
create type tipo_produto      as enum ('venda', 'insumo', 'bar');
create type tipo_movimentacao as enum ('entrada', 'saida_venda', 'saida_insumo', 'ajuste');
create type status_fila       as enum ('aguardando', 'em_atendimento', 'finalizado', 'desistiu');
create type tipo_item         as enum ('servico', 'produto');
create type forma_pagamento   as enum ('pix', 'dinheiro', 'debito', 'credito', 'outro');
create type origem_cliente    as enum ('totem', 'qr', 'balcao');

-- ---------- Utilidades ----------
create or replace function public.hoje_sp() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- Mantém só dígitos e remove o DDI 55 quando vier junto
create or replace function public.normalizar_telefone(p text) returns text
language sql immutable as $$
  select case
    when length(d) >= 12 and left(d, 2) = '55' then substr(d, 3)
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Configurações (uma linha só) ----------
create table public.configuracoes (
  id                  int primary key default 1 check (id = 1),
  nome                text not null,
  logo_url            text,
  telefone            text,
  endereco            text,
  dias_cliente_sumido int  not null default 45,
  updated_at          timestamptz not null default now()
);
create trigger trg_configuracoes_updated before update on public.configuracoes
  for each row execute function public.set_updated_at();

-- ---------- Equipe ----------
create table public.usuarios (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text not null,
  papel      papel_usuario not null default 'barbeiro',
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.barbeiros (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  foto_url            text,
  usuario_id          uuid unique references public.usuarios (id) on delete set null,
  ativo               boolean not null default true,
  comissao_padrao_pct numeric(5, 2),           -- preparado, não usado no MVP
  created_at          timestamptz not null default now()
);

-- ---------- Clientes ----------
create table public.clientes (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  telefone       text not null unique check (telefone ~ '^\d{10,11}$'),
  aniversario    date,
  instagram      text,
  preferencias   text,
  observacoes    text,
  aceita_contato boolean not null default false,
  aceite_em      timestamptz,
  origem         origem_cliente not null default 'balcao',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_clientes_nome on public.clientes using btree (lower(nome));
create trigger trg_clientes_updated before update on public.clientes
  for each row execute function public.set_updated_at();

create or replace function public.clientes_normaliza() returns trigger
language plpgsql as $$
begin
  new.telefone := public.normalizar_telefone(new.telefone);
  new.instagram := nullif(ltrim(trim(coalesce(new.instagram, '')), '@'), '');
  if new.aceita_contato and (tg_op = 'INSERT' or not old.aceita_contato) then
    new.aceite_em := now();
  elsif not new.aceita_contato then
    new.aceite_em := null;
  end if;
  return new;
end $$;
create trigger trg_clientes_normaliza before insert or update on public.clientes
  for each row execute function public.clientes_normaliza();

-- ---------- Catálogo ----------
create table public.servicos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  preco_centavos int  not null default 0 check (preco_centavos >= 0),
  duracao_min    int  not null default 30,
  ativo          boolean not null default true,
  ordem          int  not null default 0,
  comissao_pct   numeric(5, 2),                -- preparado, não usado no MVP
  created_at     timestamptz not null default now()
);

create table public.produtos (
  id                   uuid primary key default gen_random_uuid(),
  nome                 text not null,
  tipo                 tipo_produto not null default 'venda',
  unidade              text not null default 'un',
  custo_centavos       int not null default 0 check (custo_centavos >= 0),
  preco_venda_centavos int check (preco_venda_centavos >= 0),
  estoque_atual        numeric(12, 3) not null default 0,
  estoque_minimo       numeric(12, 3) not null default 0,
  ativo                boolean not null default true,
  created_at           timestamptz not null default now()
);

-- Ficha técnica: insumos consumidos por serviço (baixa automática)
create table public.servico_insumos (
  servico_id uuid not null references public.servicos (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  quantidade numeric(12, 3) not null check (quantidade > 0),
  primary key (servico_id, produto_id)
);

-- ---------- Fila (check-in) ----------
create table public.fila (
  id                    uuid primary key default gen_random_uuid(),
  cliente_id            uuid not null references public.clientes (id) on delete cascade,
  barbeiro_preferido_id uuid references public.barbeiros (id) on delete set null,
  barbeiro_id           uuid references public.barbeiros (id) on delete set null, -- quem atendeu
  servico_id            uuid references public.servicos (id) on delete set null,
  status                status_fila not null default 'aguardando',
  origem                origem_cliente not null default 'balcao',
  data                  date not null default public.hoje_sp(),
  chegou_em             timestamptz not null default now(),
  chamado_em            timestamptz,
  finalizado_em         timestamptz
);
create index idx_fila_data_status on public.fila (data, status, chegou_em);

-- ---------- Atendimentos ----------
create table public.atendimentos (
  id                uuid primary key default gen_random_uuid(),
  fila_id           uuid unique references public.fila (id) on delete set null,
  cliente_id        uuid references public.clientes (id) on delete set null,
  barbeiro_id       uuid not null references public.barbeiros (id),
  data              timestamptz not null default now(),
  subtotal_centavos int not null default 0,
  desconto_centavos int not null default 0 check (desconto_centavos >= 0),
  total_centavos    int not null default 0,
  forma_pagamento   forma_pagamento,
  observacoes       text,
  criado_por        uuid default auth.uid() references public.usuarios (id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_atendimentos_data on public.atendimentos (data);
create index idx_atendimentos_cliente on public.atendimentos (cliente_id, data desc);

create table public.atendimento_itens (
  id                      uuid primary key default gen_random_uuid(),
  atendimento_id          uuid not null references public.atendimentos (id) on delete cascade,
  tipo                    tipo_item not null,
  servico_id              uuid references public.servicos (id) on delete set null,
  produto_id              uuid references public.produtos (id) on delete set null,
  descricao               text not null,
  quantidade              numeric(12, 3) not null default 1 check (quantidade > 0),
  preco_unit_centavos     int not null default 0 check (preco_unit_centavos >= 0),
  comissao_valor_centavos int,                 -- preparado, não usado no MVP
  created_at              timestamptz not null default now(),
  check ((tipo = 'servico' and servico_id is not null and produto_id is null)
      or (tipo = 'produto' and produto_id is not null and servico_id is null))
);

create table public.cliente_fotos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes (id) on delete cascade,
  atendimento_id uuid references public.atendimentos (id) on delete set null,
  storage_path   text not null,
  legenda        text,
  criado_por     uuid default auth.uid() references public.usuarios (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ---------- Estoque ----------
-- quantidade com sinal: positiva entra, negativa sai
create table public.movimentacoes_estoque (
  id                  uuid primary key default gen_random_uuid(),
  produto_id          uuid not null references public.produtos (id) on delete cascade,
  tipo                tipo_movimentacao not null,
  quantidade          numeric(12, 3) not null check (quantidade <> 0),
  custo_unit_centavos int,
  atendimento_id      uuid references public.atendimentos (id) on delete cascade,
  atendimento_item_id uuid references public.atendimento_itens (id) on delete cascade,
  observacao          text,
  usuario_id          uuid default auth.uid() references public.usuarios (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index idx_mov_produto on public.movimentacoes_estoque (produto_id, created_at desc);

create table public.alertas (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null default 'estoque_baixo',
  produto_id uuid references public.produtos (id) on delete cascade,
  mensagem   text not null,
  lido       boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Despesas ----------
create table public.categorias_despesa (
  id   uuid primary key default gen_random_uuid(),
  nome text not null unique
);

create table public.despesas (
  id              uuid primary key default gen_random_uuid(),
  categoria_id    uuid references public.categorias_despesa (id) on delete set null,
  descricao       text not null,
  valor_centavos  int  not null check (valor_centavos > 0),
  data            date not null default public.hoje_sp(),
  recorrente      boolean not null default false,
  movimentacao_id uuid references public.movimentacoes_estoque (id) on delete set null,
  criado_por      uuid default auth.uid() references public.usuarios (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index idx_despesas_data on public.despesas (data);

-- >>> migrations/0002_triggers.sql
-- =====================================================================
-- Regras de negócio no banco: totais, baixa automática, alertas
-- =====================================================================

-- ---------- Totais do atendimento ----------
create or replace function public.atendimento_calcula_total() returns trigger
language plpgsql as $$
begin
  new.total_centavos := greatest(new.subtotal_centavos - new.desconto_centavos, 0);
  return new;
end $$;
create trigger trg_atendimento_total before insert or update on public.atendimentos
  for each row execute function public.atendimento_calcula_total();

create or replace function public.recalcular_atendimento(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.atendimentos a
     set subtotal_centavos = coalesce((
           select round(sum(i.quantidade * i.preco_unit_centavos))::int
             from public.atendimento_itens i
            where i.atendimento_id = a.id), 0)
   where a.id = p_id
$$;

-- ---------- Estoque: saldo e alertas ----------
create or replace function public.mov_aplica_saldo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_prod public.produtos%rowtype;
begin
  if tg_op = 'INSERT' then
    update public.produtos set estoque_atual = estoque_atual + new.quantidade
     where id = new.produto_id
     returning * into v_prod;

    if v_prod.estoque_atual <= v_prod.estoque_minimo
       and not exists (select 1 from public.alertas
                        where produto_id = v_prod.id and tipo = 'estoque_baixo' and not lido) then
      insert into public.alertas (tipo, produto_id, mensagem)
      values ('estoque_baixo', v_prod.id,
              format('%s está com %s %s (mínimo %s)', v_prod.nome,
                     trim(to_char(v_prod.estoque_atual, 'FM999999990.###')), v_prod.unidade,
                     trim(to_char(v_prod.estoque_minimo, 'FM999999990.###'))));
    end if;
    return new;
  else -- DELETE: desfaz o efeito
    update public.produtos set estoque_atual = estoque_atual - old.quantidade
     where id = old.produto_id;
    return old;
  end if;
end $$;
create trigger trg_mov_saldo after insert or delete on public.movimentacoes_estoque
  for each row execute function public.mov_aplica_saldo();

-- Se o estoque voltou acima do mínimo, encerra o alerta aberto
create or replace function public.produto_resolve_alerta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estoque_atual > new.estoque_minimo then
    update public.alertas set lido = true
     where produto_id = new.id and tipo = 'estoque_baixo' and not lido;
  end if;
  return new;
end $$;
create trigger trg_produto_resolve_alerta after update of estoque_atual, estoque_minimo on public.produtos
  for each row execute function public.produto_resolve_alerta();

-- ---------- Baixa automática ao registrar item do atendimento ----------
create or replace function public.item_baixa_estoque() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'produto' then
    insert into public.movimentacoes_estoque
      (produto_id, tipo, quantidade, atendimento_id, atendimento_item_id, observacao)
    values (new.produto_id, 'saida_venda', -new.quantidade, new.atendimento_id, new.id,
            'Venda no atendimento');
  else
    insert into public.movimentacoes_estoque
      (produto_id, tipo, quantidade, atendimento_id, atendimento_item_id, observacao)
    select si.produto_id, 'saida_insumo', -(si.quantidade * new.quantidade),
           new.atendimento_id, new.id, 'Insumo do serviço: ' || new.descricao
      from public.servico_insumos si
     where si.servico_id = new.servico_id;
  end if;
  return new;
end $$;
create trigger trg_item_baixa after insert on public.atendimento_itens
  for each row execute function public.item_baixa_estoque();

-- Itens removidos: as movimentações vinculadas são apagadas (cascade) e o saldo volta.
create or replace function public.item_recalcula() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.recalcular_atendimento(coalesce(new.atendimento_id, old.atendimento_id));
  return null;
end $$;
create trigger trg_item_recalcula after insert or update or delete on public.atendimento_itens
  for each row execute function public.item_recalcula();

-- ---------- Novo usuário do Auth vira membro da equipe ----------
-- O primeiro usuário criado vira 'dono'; os seguintes, 'barbeiro'.
-- Deixe o cadastro público DESLIGADO no Supabase (Auth > Sign In / Providers).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (id, nome, papel)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    case
      when not exists (select 1 from public.usuarios where papel = 'dono') then 'dono'::papel_usuario
      else 'barbeiro'::papel_usuario
    end
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- >>> migrations/0003_rls.sql
-- =====================================================================
-- Segurança: RLS por papel (dono x barbeiro)
-- O público (totem / QR / TV) NÃO lê tabelas: usa só as funções da 0004.
-- =====================================================================

create or replace function public.papel_atual() returns papel_usuario
language sql stable security definer set search_path = public as $$
  select papel from public.usuarios where id = auth.uid() and ativo
$$;

create or replace function public.is_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select public.papel_atual() is not null
$$;

create or replace function public.is_dono() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.papel_atual() = 'dono', false)
$$;

alter table public.configuracoes         enable row level security;
alter table public.usuarios              enable row level security;
alter table public.barbeiros             enable row level security;
alter table public.clientes              enable row level security;
alter table public.cliente_fotos         enable row level security;
alter table public.servicos              enable row level security;
alter table public.produtos              enable row level security;
alter table public.servico_insumos       enable row level security;
alter table public.fila                  enable row level security;
alter table public.atendimentos          enable row level security;
alter table public.atendimento_itens     enable row level security;
alter table public.movimentacoes_estoque enable row level security;
alter table public.alertas               enable row level security;
alter table public.categorias_despesa    enable row level security;
alter table public.despesas              enable row level security;

-- Leitura para toda a equipe, escrita só do dono
do $$
declare t text;
begin
  foreach t in array array['configuracoes', 'usuarios', 'barbeiros', 'servicos', 'produtos',
                           'servico_insumos', 'movimentacoes_estoque']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_equipe())',
                   t || '_select_equipe', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_dono()) with check (public.is_dono())',
                   t || '_write_dono', t);
  end loop;
end $$;

-- Equipe inteira trabalha (ler, criar, editar); só o dono apaga
do $$
declare t text;
begin
  foreach t in array array['clientes', 'cliente_fotos', 'fila', 'atendimentos', 'atendimento_itens']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_equipe())',
                   t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_equipe())',
                   t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_equipe()) with check (public.is_equipe())',
                   t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_dono())',
                   t || '_delete', t);
  end loop;
end $$;

-- Só o dono: financeiro e alertas
do $$
declare t text;
begin
  foreach t in array array['alertas', 'categorias_despesa', 'despesas']
  loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_dono()) with check (public.is_dono())',
                   t || '_dono', t);
  end loop;
end $$;

-- O barbeiro pode excluir foto que ele mesmo subiu
create policy cliente_fotos_delete_autor on public.cliente_fotos
  for delete to authenticated using (criado_por = auth.uid());

-- >>> migrations/0004_funcoes.sql
-- =====================================================================
-- Funções: check-in público, fila da TV, resumo mensal, listas
-- =====================================================================

-- "Will Santos" -> "Will S."
create or replace function public.nome_exibicao(p_nome text) returns text
language sql immutable as $$
  select case
    when array_length(p, 1) > 1 then p[1] || ' ' || left(p[array_length(p, 1)], 1) || '.'
    else coalesce(p[1], '')
  end
  from (select regexp_split_to_array(trim(coalesce(p_nome, '')), '\s+') as p) x
$$;

-- Posição (1, 2, 3...) de quem está aguardando hoje
create or replace function public.fila_posicao(p_fila_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
    from public.fila f, public.fila me
   where me.id = p_fila_id
     and me.status = 'aguardando'
     and f.data = me.data
     and f.status = 'aguardando'
     and f.chegou_em <= me.chegou_em
$$;

-- ---------- Público: check-in ----------
create or replace function public.checkin_opcoes() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'barbearia', (select nome from public.configuracoes where id = 1),
    'servicos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'preco_centavos', preco_centavos)
                                           order by ordem, nome)
                            from public.servicos where ativo), '[]'::jsonb),
    'barbeiros', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome) order by nome)
                             from public.barbeiros where ativo), '[]'::jsonb)
  )
$$;

-- Devolve só o mínimo: se existe e o primeiro nome
create or replace function public.checkin_buscar(p_telefone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tel text := public.normalizar_telefone(p_telefone);
  v_cli public.clientes%rowtype;
  v_fila uuid;
begin
  if length(v_tel) not between 10 and 11 then
    raise exception 'Telefone inválido' using errcode = '22023';
  end if;
  select * into v_cli from public.clientes where telefone = v_tel;
  if not found then
    return jsonb_build_object('encontrado', false);
  end if;
  select id into v_fila from public.fila
   where cliente_id = v_cli.id and data = public.hoje_sp()
     and status in ('aguardando', 'em_atendimento')
   limit 1;
  return jsonb_build_object(
    'encontrado', true,
    'primeiro_nome', split_part(trim(v_cli.nome), ' ', 1),
    'fila_id', v_fila
  );
end $$;

create or replace function public.checkin_registrar(
  p_telefone       text,
  p_nome           text default null,
  p_servico_id     uuid default null,
  p_barbeiro_id    uuid default null,
  p_aceita_contato boolean default false,
  p_origem         origem_cliente default 'totem'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tel  text := public.normalizar_telefone(p_telefone);
  v_cli  public.clientes%rowtype;
  v_fila public.fila%rowtype;
  v_novo boolean := false;
begin
  if length(v_tel) not between 10 and 11 then
    raise exception 'Telefone inválido' using errcode = '22023';
  end if;

  select * into v_cli from public.clientes where telefone = v_tel;
  if not found then
    if coalesce(trim(p_nome), '') = '' then
      raise exception 'Informe o nome' using errcode = '22023';
    end if;
    insert into public.clientes (nome, telefone, aceita_contato, origem)
    values (initcap(trim(p_nome)), v_tel, coalesce(p_aceita_contato, false), p_origem)
    returning * into v_cli;
    v_novo := true;
  elsif p_aceita_contato and not v_cli.aceita_contato then
    update public.clientes set aceita_contato = true where id = v_cli.id;
  end if;

  -- Já está na fila hoje? Não duplica.
  select * into v_fila from public.fila
   where cliente_id = v_cli.id and data = public.hoje_sp()
     and status in ('aguardando', 'em_atendimento')
   limit 1;

  if not found then
    insert into public.fila (cliente_id, servico_id, barbeiro_preferido_id, origem)
    values (v_cli.id,
            (select id from public.servicos where id = p_servico_id and ativo),
            (select id from public.barbeiros where id = p_barbeiro_id and ativo),
            p_origem)
    returning * into v_fila;
    return jsonb_build_object('fila_id', v_fila.id, 'posicao', public.fila_posicao(v_fila.id),
                              'primeiro_nome', split_part(v_cli.nome, ' ', 1),
                              'cliente_novo', v_novo, 'ja_estava', false);
  end if;

  return jsonb_build_object('fila_id', v_fila.id, 'posicao', public.fila_posicao(v_fila.id),
                            'primeiro_nome', split_part(v_cli.nome, ' ', 1),
                            'cliente_novo', v_novo, 'ja_estava', true);
end $$;

-- Status de uma entrada (tela "minha posição" no celular)
create or replace function public.fila_status(p_fila_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'status', f.status,
    'posicao', public.fila_posicao(f.id),
    'primeiro_nome', split_part(c.nome, ' ', 1),
    'barbeiro', b.nome
  )
  from public.fila f
  join public.clientes c on c.id = f.cliente_id
  left join public.barbeiros b on b.id = f.barbeiro_id
  where f.id = p_fila_id and f.data = public.hoje_sp()
$$;

-- Fila de hoje para a TV (só nome de exibição)
create or replace function public.fila_publica() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'barbearia', (select nome from public.configuracoes where id = 1),
    'atendendo', coalesce((
      select jsonb_agg(jsonb_build_object('barbeiro', b.nome, 'cliente', public.nome_exibicao(c.nome))
                       order by f.chamado_em)
        from public.fila f
        join public.clientes c on c.id = f.cliente_id
        left join public.barbeiros b on b.id = f.barbeiro_id
       where f.data = public.hoje_sp() and f.status = 'em_atendimento'), '[]'::jsonb),
    'aguardando', coalesce((
      select jsonb_agg(jsonb_build_object('posicao', x.pos, 'cliente', x.cliente, 'preferencia', x.pref)
                       order by x.pos)
        from (select row_number() over (order by f.chegou_em) as pos,
                     public.nome_exibicao(c.nome) as cliente,
                     b.nome as pref
                from public.fila f
                join public.clientes c on c.id = f.cliente_id
                left join public.barbeiros b on b.id = f.barbeiro_preferido_id
               where f.data = public.hoje_sp() and f.status = 'aguardando') x), '[]'::jsonb)
  )
$$;

-- ---------- Equipe: listas ----------
create or replace view public.vw_clientes with (security_invoker = true) as
select c.*,
       (select max(a.data) from public.atendimentos a where a.cliente_id = c.id) as ultima_visita,
       (select count(*)    from public.atendimentos a where a.cliente_id = c.id)::int as total_visitas
  from public.clientes c;

create or replace function public.clientes_sumidos(p_dias int default null) returns setof public.vw_clientes
language sql stable security invoker set search_path = public as $$
  select * from public.vw_clientes
   where ultima_visita is not null
     and ultima_visita < now() - make_interval(days => coalesce(p_dias,
           (select dias_cliente_sumido from public.configuracoes where id = 1), 45))
   order by ultima_visita desc
$$;

create or replace function public.aniversariantes(p_mes int) returns setof public.vw_clientes
language sql stable security invoker set search_path = public as $$
  select * from public.vw_clientes
   where aniversario is not null and extract(month from aniversario) = p_mes
   order by extract(day from aniversario), nome
$$;

-- ---------- Resumo mensal ----------
-- Dono recebe tudo; barbeiro recebe só quantidade de atendimentos.
create or replace function public.resumo_mensal(p_mes date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ini   date := date_trunc('month', p_mes)::date;
  v_fim   date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_papel papel_usuario := public.papel_atual();
  v_qtd   jsonb;
  v_res   jsonb;
begin
  if v_papel is null then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  create temporary table if not exists _at on commit drop as
    select * from public.atendimentos where false;
  truncate _at;
  insert into _at
    select * from public.atendimentos
     where (data at time zone 'America/Sao_Paulo')::date >= v_ini
       and (data at time zone 'America/Sao_Paulo')::date <  v_fim;

  v_qtd := jsonb_build_object(
    'mes', to_char(v_ini, 'YYYY-MM'),
    'atendimentos', (select count(*) from _at),
    'por_barbeiro', coalesce((
      select jsonb_agg(jsonb_build_object('barbeiro', b.nome, 'atendimentos', x.qtd,
                                          'faturamento_centavos', x.fat) order by x.qtd desc)
        from (select barbeiro_id, count(*) as qtd, sum(total_centavos) as fat
                from _at group by barbeiro_id) x
        join public.barbeiros b on b.id = x.barbeiro_id), '[]'::jsonb)
  );

  if v_papel <> 'dono' then
    -- remove valores
    return jsonb_set(v_qtd, '{por_barbeiro}', coalesce((
      select jsonb_agg(e - 'faturamento_centavos') from jsonb_array_elements(v_qtd -> 'por_barbeiro') e),
      '[]'::jsonb));
  end if;

  v_res := v_qtd || jsonb_build_object(
    'faturamento_centavos', (select coalesce(sum(total_centavos), 0) from _at),
    'descontos_centavos',   (select coalesce(sum(desconto_centavos), 0) from _at),
    'despesas_centavos',    (select coalesce(sum(valor_centavos), 0) from public.despesas
                              where data >= v_ini and data < v_fim),
    'ticket_medio_centavos',(select coalesce(round(avg(total_centavos)), 0)::int from _at),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d, 'atendimentos', q, 'faturamento_centavos', f) order by d)
        from (select (data at time zone 'America/Sao_Paulo')::date as d, count(*) q, sum(total_centavos) f
                from _at group by 1) x), '[]'::jsonb),
    'por_pagamento', coalesce((
      select jsonb_agg(jsonb_build_object('forma', coalesce(forma_pagamento::text, 'nao_informado'),
                                          'qtd', q, 'total_centavos', t) order by t desc)
        from (select forma_pagamento, count(*) q, sum(total_centavos) t from _at group by 1) x), '[]'::jsonb),
    'top_servicos', coalesce((
      select jsonb_agg(jsonb_build_object('nome', descricao, 'qtd', q, 'receita_centavos', r) order by q desc)
        from (select i.descricao, sum(i.quantidade) q, round(sum(i.quantidade * i.preco_unit_centavos)) r
                from public.atendimento_itens i join _at a on a.id = i.atendimento_id
               where i.tipo = 'servico' group by 1 order by 2 desc limit 10) x), '[]'::jsonb),
    'top_produtos', coalesce((
      select jsonb_agg(jsonb_build_object('nome', descricao, 'qtd', q, 'receita_centavos', r) order by q desc)
        from (select i.descricao, sum(i.quantidade) q, round(sum(i.quantidade * i.preco_unit_centavos)) r
                from public.atendimento_itens i join _at a on a.id = i.atendimento_id
               where i.tipo = 'produto' group by 1 order by 2 desc limit 10) x), '[]'::jsonb),
    'despesas_por_categoria', coalesce((
      select jsonb_agg(jsonb_build_object('categoria', coalesce(c.nome, 'Sem categoria'), 'total_centavos', t)
                       order by t desc)
        from (select categoria_id, sum(valor_centavos) t from public.despesas
               where data >= v_ini and data < v_fim group by 1) x
        left join public.categorias_despesa c on c.id = x.categoria_id), '[]'::jsonb),
    'clientes_atendidos', (select count(distinct cliente_id) from _at where cliente_id is not null),
    'clientes_novos', (
      select count(distinct a.cliente_id) from _at a
       where a.cliente_id is not null
         and not exists (select 1 from public.atendimentos p
                          where p.cliente_id = a.cliente_id
                            and (p.data at time zone 'America/Sao_Paulo')::date < v_ini)),
    'clientes_cadastrados_no_mes', (
      select count(*) from public.clientes
       where (created_at at time zone 'America/Sao_Paulo')::date >= v_ini
         and (created_at at time zone 'America/Sao_Paulo')::date <  v_fim)
  );

  return v_res || jsonb_build_object(
    'clientes_recorrentes', (v_res ->> 'clientes_atendidos')::int - (v_res ->> 'clientes_novos')::int,
    'lucro_centavos', (v_res ->> 'faturamento_centavos')::bigint - (v_res ->> 'despesas_centavos')::bigint
  );
end $$;

-- ---------- Permissões de execução ----------
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;
grant  execute on function public.checkin_opcoes()   to anon;
grant  execute on function public.checkin_buscar(text) to anon;
grant  execute on function public.checkin_registrar(text, text, uuid, uuid, boolean, origem_cliente) to anon;
grant  execute on function public.fila_status(uuid)  to anon;
grant  execute on function public.fila_publica()     to anon;
-- usados dentro de defaults/triggers
grant  execute on function public.hoje_sp()          to anon;
grant  execute on function public.normalizar_telefone(text) to anon;
grant  execute on function public.nome_exibicao(text) to anon;

-- >>> migrations/0005_storage_realtime.sql
-- =====================================================================
-- Recursos específicos do Supabase: Storage (fotos) e Realtime (fila)
-- =====================================================================

-- Bucket privado para fotos de corte (até 5 MB, só imagens)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-clientes', 'fotos-clientes', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "fotos_select_equipe" on storage.objects
  for select to authenticated using (bucket_id = 'fotos-clientes' and public.is_equipe());

create policy "fotos_insert_equipe" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos-clientes' and public.is_equipe());

create policy "fotos_delete_equipe" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos-clientes' and public.is_equipe());

-- Painel da equipe recebe mudanças da fila em tempo real
alter publication supabase_realtime add table public.fila;

-- >>> seed.sql
-- =====================================================================
-- Dados iniciais da Barbearia Jean Rodrigues
-- Preços e produtos são EXEMPLOS: ajuste em Configurações / Estoque.
-- =====================================================================

insert into public.configuracoes (id, nome) values (1, 'Barbearia Jean Rodrigues')
on conflict (id) do nothing;

insert into public.categorias_despesa (nome) values
  ('Aluguel'), ('Água / Luz / Internet'), ('Compra de estoque'), ('Manutenção'),
  ('Marketing'), ('Impostos e taxas'), ('Outros')
on conflict (nome) do nothing;

insert into public.barbeiros (nome) values ('Jean Rodrigues'), ('Barbeiro 2');

insert into public.servicos (nome, preco_centavos, duracao_min, ordem) values
  ('Corte',          4000, 30, 1),
  ('Barba',          3000, 20, 2),
  ('Corte + Barba',  6000, 50, 3),
  ('Sobrancelha',    1500, 10, 4),
  ('Pigmentação',    3000, 20, 5);

insert into public.produtos (nome, tipo, unidade, custo_centavos, preco_venda_centavos, estoque_atual, estoque_minimo) values
  ('Pomada modeladora', 'venda',  'un',  1800, 4500, 0, 3),
  ('Óleo para barba',   'venda',  'un',  1500, 3500, 0, 3),
  ('Lâmina descartável','insumo', 'un',    50, null, 0, 50),
  ('Refrigerante lata', 'bar',    'un',   300,  600, 0, 12),
  ('Água mineral',      'bar',    'un',   150,  400, 0, 12);

-- Ficha técnica de exemplo: cada serviço com navalha usa 1 lâmina
insert into public.servico_insumos (servico_id, produto_id, quantidade)
select s.id, p.id, 1
  from public.servicos s, public.produtos p
 where p.nome = 'Lâmina descartável'
   and s.nome in ('Corte', 'Barba', 'Corte + Barba', 'Sobrancelha');
