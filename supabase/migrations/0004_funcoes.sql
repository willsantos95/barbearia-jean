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
