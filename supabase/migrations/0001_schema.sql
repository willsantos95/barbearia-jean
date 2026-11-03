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
