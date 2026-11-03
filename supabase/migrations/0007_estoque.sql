-- =====================================================================
-- Dia 3: entrada (compra) e ajuste (contagem) de estoque — só o dono
-- =====================================================================

-- Entrada: soma ao estoque, atualiza o custo e (opcional) lança a despesa
create or replace function public.estoque_entrada(
  p_produto_id          uuid,
  p_quantidade          numeric,
  p_custo_unit_centavos int default null,
  p_gerar_despesa       boolean default true,
  p_observacao          text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_mov  uuid;
  v_prod public.produtos%rowtype;
  v_cat  uuid;
begin
  if not public.is_dono() then
    raise exception 'Só o dono pode lançar entradas' using errcode = '42501';
  end if;
  if coalesce(p_quantidade, 0) <= 0 then
    raise exception 'Quantidade deve ser maior que zero' using errcode = 'P0001';
  end if;

  select * into v_prod from public.produtos where id = p_produto_id;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'P0001';
  end if;

  insert into public.movimentacoes_estoque (produto_id, tipo, quantidade, custo_unit_centavos, observacao)
  values (p_produto_id, 'entrada', p_quantidade, p_custo_unit_centavos, nullif(trim(coalesce(p_observacao, '')), ''))
  returning id into v_mov;

  if p_custo_unit_centavos is not null and p_custo_unit_centavos >= 0 then
    update public.produtos set custo_centavos = p_custo_unit_centavos where id = p_produto_id;
  end if;

  if p_gerar_despesa and coalesce(p_custo_unit_centavos, 0) > 0 then
    select id into v_cat from public.categorias_despesa where nome = 'Compra de estoque';
    insert into public.despesas (categoria_id, descricao, valor_centavos, movimentacao_id)
    values (v_cat,
            format('Compra: %s %s de %s', trim(to_char(p_quantidade, 'FM999999990.###')), v_prod.unidade, v_prod.nome),
            round(p_quantidade * p_custo_unit_centavos)::int,
            v_mov);
  end if;

  return v_mov;
end $$;

-- Ajuste: informa a quantidade contada; registra a diferença
create or replace function public.estoque_ajuste(
  p_produto_id uuid,
  p_quantidade_contada numeric,
  p_observacao text default null
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_atual numeric;
  v_delta numeric;
begin
  if not public.is_dono() then
    raise exception 'Só o dono pode ajustar o estoque' using errcode = '42501';
  end if;
  if p_quantidade_contada is null or p_quantidade_contada < 0 then
    raise exception 'Quantidade inválida' using errcode = 'P0001';
  end if;

  select estoque_atual into v_atual from public.produtos where id = p_produto_id for update;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'P0001';
  end if;

  v_delta := p_quantidade_contada - v_atual;
  if v_delta <> 0 then
    insert into public.movimentacoes_estoque (produto_id, tipo, quantidade, observacao)
    values (p_produto_id, 'ajuste', v_delta,
            coalesce(nullif(trim(coalesce(p_observacao, '')), ''), 'Ajuste por contagem'));
  end if;
  return v_delta;
end $$;

revoke execute on function public.estoque_entrada(uuid, numeric, int, boolean, text) from public, anon;
revoke execute on function public.estoque_ajuste(uuid, numeric, text) from public, anon;
grant  execute on function public.estoque_entrada(uuid, numeric, int, boolean, text) to authenticated;
grant  execute on function public.estoque_ajuste(uuid, numeric, text) to authenticated;
