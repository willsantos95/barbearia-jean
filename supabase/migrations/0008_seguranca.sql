-- =====================================================================
-- Endurecimento de segurança (code review de 03/11/2026)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Limite de tentativas nas funções públicas (check-in)
--    Impede varrer telefones para descobrir nomes e encher a base de spam.
-- ---------------------------------------------------------------------
create table if not exists public.limite_requisicoes (
  id        bigserial primary key,
  acao      text not null,
  ip        text not null,
  criado_em timestamptz not null default now()
);
create index if not exists idx_limite_acao_ip on public.limite_requisicoes (acao, ip, criado_em);
create index if not exists idx_limite_acao    on public.limite_requisicoes (acao, criado_em);
alter table public.limite_requisicoes enable row level security; -- sem políticas: ninguém lê pela API

-- IP real do cliente (Supabase fica atrás da Cloudflare)
create or replace function public.ip_requisicao() returns text
language plpgsql stable as $$
declare
  h json;
  v text;
begin
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then
    h := null;
  end;
  v := coalesce(
    h ->> 'cf-connecting-ip',
    -- último salto do x-forwarded-for (o primeiro pode ser forjado pelo cliente)
    trim(reverse(split_part(reverse(coalesce(h ->> 'x-forwarded-for', '')), ',', 1)))
  );
  return coalesce(nullif(v, ''), 'sem-ip');
end $$;

create or replace function public.checar_limite(
  p_acao text, p_max_ip int, p_max_global int, p_janela interval
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ip text := public.ip_requisicao();
begin
  if random() < 0.05 then
    delete from public.limite_requisicoes where criado_em < now() - interval '1 day';
  end if;

  if (select count(*) from public.limite_requisicoes
       where acao = p_acao and ip = v_ip and criado_em > now() - p_janela) >= p_max_ip
     or (select count(*) from public.limite_requisicoes
          where acao = p_acao and criado_em > now() - p_janela) >= p_max_global then
    raise exception 'Muitas tentativas. Aguarde alguns minutos ou chame alguém da equipe.' using errcode = 'P0001';
  end if;

  insert into public.limite_requisicoes (acao, ip) values (p_acao, v_ip);
end $$;

-- Busca: agora VOLATILE (precisa gravar a tentativa) e com limite para o público
create or replace function public.checkin_buscar(p_telefone text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_tel text := public.normalizar_telefone(p_telefone);
  v_cli public.clientes%rowtype;
  v_fila uuid;
begin
  if not public.is_equipe() then
    perform public.checar_limite('checkin_buscar', 30, 600, interval '10 minutes');
  end if;
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
  v_nome text := regexp_replace(trim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_cli  public.clientes%rowtype;
  v_fila public.fila%rowtype;
  v_novo boolean := false;
  v_origem origem_cliente := p_origem;
begin
  if not public.is_equipe() then
    perform public.checar_limite('checkin_registrar', 10, 120, interval '10 minutes');
    if v_origem = 'balcao' then v_origem := 'totem'; end if; -- público não registra como balcão
  end if;
  if length(v_tel) not between 10 and 11 then
    raise exception 'Telefone inválido' using errcode = '22023';
  end if;
  if length(v_nome) > 60 then
    raise exception 'Nome muito longo' using errcode = '22023';
  end if;

  select * into v_cli from public.clientes where telefone = v_tel;
  if not found then
    if length(v_nome) < 2 then
      raise exception 'Informe o nome' using errcode = '22023';
    end if;
    insert into public.clientes (nome, telefone, aceita_contato, origem)
    values (initcap(v_nome), v_tel, coalesce(p_aceita_contato, false), v_origem)
    returning * into v_cli;
    v_novo := true;
  elsif p_aceita_contato and not v_cli.aceita_contato then
    update public.clientes set aceita_contato = true where id = v_cli.id;
  end if;

  select * into v_fila from public.fila
   where cliente_id = v_cli.id and data = public.hoje_sp()
     and status in ('aguardando', 'em_atendimento')
   limit 1;

  if not found then
    insert into public.fila (cliente_id, servico_id, barbeiro_preferido_id, origem)
    values (v_cli.id,
            (select id from public.servicos where id = p_servico_id and ativo),
            (select id from public.barbeiros where id = p_barbeiro_id and ativo),
            v_origem)
    returning * into v_fila;
    return jsonb_build_object('fila_id', v_fila.id, 'posicao', public.fila_posicao(v_fila.id),
                              'primeiro_nome', split_part(v_cli.nome, ' ', 1),
                              'cliente_novo', v_novo, 'ja_estava', false);
  end if;

  return jsonb_build_object('fila_id', v_fila.id, 'posicao', public.fila_posicao(v_fila.id),
                            'primeiro_nome', split_part(v_cli.nome, ' ', 1),
                            'cliente_novo', v_novo, 'ja_estava', true);
end $$;

alter table public.clientes
  add constraint clientes_nome_tamanho check (char_length(nome) between 1 and 120) not valid;

-- ---------------------------------------------------------------------
-- 2. Novo usuário do Auth nasce SEM acesso (exceto o primeiro = dono).
--    Se o cadastro público for religado por engano, ninguém entra sozinho.
--    Logins criados pelo painel (Configurações > Equipe) já saem ativos.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_primeiro boolean := not exists (select 1 from public.usuarios where papel = 'dono');
begin
  insert into public.usuarios (id, nome, papel, ativo)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)), 80),
    case when v_primeiro then 'dono'::papel_usuario else 'barbeiro'::papel_usuario end,
    v_primeiro
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Atendimentos: barbeiro só grava pelas funções (preço vem do catálogo)
--    e só lê os próprios atendimentos. Dono continua com acesso total.
-- ---------------------------------------------------------------------
drop policy if exists atendimentos_select on public.atendimentos;
drop policy if exists atendimentos_insert on public.atendimentos;
drop policy if exists atendimentos_update on public.atendimentos;
drop policy if exists atendimento_itens_select on public.atendimento_itens;
drop policy if exists atendimento_itens_insert on public.atendimento_itens;
drop policy if exists atendimento_itens_update on public.atendimento_itens;

create or replace function public.meus_barbeiros() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.barbeiros where usuario_id = auth.uid()
$$;

create policy atendimentos_select_dono on public.atendimentos
  for select to authenticated using (public.is_dono());
create policy atendimentos_select_proprio on public.atendimentos
  for select to authenticated using (public.is_equipe() and barbeiro_id in (select public.meus_barbeiros()));
create policy atendimentos_write_dono on public.atendimentos
  for update to authenticated using (public.is_dono()) with check (public.is_dono());
create policy atendimentos_insert_dono on public.atendimentos
  for insert to authenticated with check (public.is_dono());

create policy atendimento_itens_select_dono on public.atendimento_itens
  for select to authenticated using (public.is_dono());
create policy atendimento_itens_select_proprio on public.atendimento_itens
  for select to authenticated using (
    public.is_equipe() and exists (
      select 1 from public.atendimentos a
       where a.id = atendimento_id and a.barbeiro_id in (select public.meus_barbeiros())));
create policy atendimento_itens_write_dono on public.atendimento_itens
  for update to authenticated using (public.is_dono()) with check (public.is_dono());
create policy atendimento_itens_insert_dono on public.atendimento_itens
  for insert to authenticated with check (public.is_dono());

-- Histórico na ficha do cliente: todos os atendimentos, valores só para o dono
create or replace function public.historico_cliente(p_cliente_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_dono boolean := public.is_dono();
begin
  if not public.is_equipe() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(x order by x ->> 'data' desc)
      from (
        select jsonb_build_object(
                 'id', a.id,
                 'data', a.data,
                 'barbeiro', b.nome,
                 'forma_pagamento', case when v_dono then a.forma_pagamento::text end,
                 'total_centavos', case when v_dono then a.total_centavos end,
                 'observacoes', a.observacoes,
                 'itens', coalesce((select jsonb_agg(jsonb_build_object('descricao', i.descricao, 'quantidade', i.quantidade))
                                      from public.atendimento_itens i where i.atendimento_id = a.id), '[]'::jsonb)
               ) as x
          from public.atendimentos a
          left join public.barbeiros b on b.id = a.barbeiro_id
         where a.cliente_id = p_cliente_id
         order by a.data desc
         limit 30
      ) t
  ), '[]'::jsonb);
end $$;

-- A lista de clientes (última visita / nº de visitas) continua completa para a equipe.
-- A view passa a rodar como dona e filtra pela equipe explicitamente.
create or replace view public.vw_clientes with (security_invoker = false) as
select c.*,
       (select max(a.data) from public.atendimentos a where a.cliente_id = c.id) as ultima_visita,
       (select count(*)    from public.atendimentos a where a.cliente_id = c.id)::int as total_visitas
  from public.clientes c
 where public.is_equipe();

-- ---------------------------------------------------------------------
-- 4. Movimentações de estoque (custos): só o dono lê
-- ---------------------------------------------------------------------
drop policy if exists movimentacoes_estoque_select_equipe on public.movimentacoes_estoque;

-- ---------------------------------------------------------------------
-- 5. Papel anônimo não tem nenhum privilégio direto em tabelas/views.
--    O público usa só as funções de check-in / fila / TV.
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- ---------------------------------------------------------------------
-- 6. Permissões de execução das funções novas/alteradas
-- ---------------------------------------------------------------------
revoke execute on function public.ip_requisicao() from public, anon;
revoke execute on function public.checar_limite(text, int, int, interval) from public, anon, authenticated;
revoke execute on function public.meus_barbeiros() from public, anon;
revoke execute on function public.historico_cliente(uuid) from public, anon;
grant  execute on function public.meus_barbeiros() to authenticated;
grant  execute on function public.historico_cliente(uuid) to authenticated;
grant  execute on function public.checkin_buscar(text) to anon, authenticated;
grant  execute on function public.checkin_registrar(text, text, uuid, uuid, boolean, origem_cliente) to anon, authenticated;
