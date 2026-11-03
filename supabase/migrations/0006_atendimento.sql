-- =====================================================================
-- Dia 2: operações da fila e finalização do atendimento (atômica)
-- =====================================================================

-- Chama um cliente da fila para a cadeira de um barbeiro
create or replace function public.fila_chamar(p_fila_id uuid, p_barbeiro_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_equipe() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  update public.fila
     set status = 'em_atendimento', barbeiro_id = p_barbeiro_id, chamado_em = now()
   where id = p_fila_id and status = 'aguardando';
  if not found then
    raise exception 'Esse cliente não está mais aguardando' using errcode = 'P0001';
  end if;
end $$;

-- Finaliza: cria atendimento + itens (preços do catálogo) e fecha a fila.
-- p_itens: [{"tipo":"servico","id":"<uuid>","quantidade":1}, {"tipo":"produto","id":"<uuid>","quantidade":2}]
create or replace function public.finalizar_atendimento(
  p_fila_id     uuid,
  p_barbeiro_id uuid,
  p_itens       jsonb,
  p_desconto_centavos int default 0,
  p_forma_pagamento   forma_pagamento default null,
  p_observacoes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_fila public.fila%rowtype;
  v_at   uuid;
  v_item jsonb;
  v_qtd  numeric;
begin
  if not public.is_equipe() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  select * into v_fila from public.fila where id = p_fila_id for update;
  if not found then
    raise exception 'Entrada da fila não encontrada' using errcode = 'P0001';
  end if;
  if v_fila.status in ('finalizado', 'desistiu') then
    raise exception 'Esse atendimento já foi encerrado' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) = 0 then
    raise exception 'Adicione pelo menos um serviço ou produto' using errcode = 'P0001';
  end if;

  insert into public.atendimentos (fila_id, cliente_id, barbeiro_id, desconto_centavos, forma_pagamento, observacoes)
  values (p_fila_id, v_fila.cliente_id, p_barbeiro_id, greatest(coalesce(p_desconto_centavos, 0), 0),
          p_forma_pagamento, nullif(trim(coalesce(p_observacoes, '')), ''))
  returning id into v_at;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := greatest(coalesce((v_item ->> 'quantidade')::numeric, 1), 0.001);
    if v_item ->> 'tipo' = 'servico' then
      insert into public.atendimento_itens (atendimento_id, tipo, servico_id, descricao, quantidade, preco_unit_centavos)
      select v_at, 'servico', s.id, s.nome, v_qtd, s.preco_centavos
        from public.servicos s where s.id = (v_item ->> 'id')::uuid;
    else
      insert into public.atendimento_itens (atendimento_id, tipo, produto_id, descricao, quantidade, preco_unit_centavos)
      select v_at, 'produto', p.id, p.nome, v_qtd, coalesce(p.preco_venda_centavos, 0)
        from public.produtos p where p.id = (v_item ->> 'id')::uuid and p.tipo <> 'insumo';
    end if;
  end loop;

  update public.fila
     set status = 'finalizado', barbeiro_id = p_barbeiro_id,
         chamado_em = coalesce(chamado_em, now()), finalizado_em = now()
   where id = p_fila_id;

  return v_at;
end $$;

revoke execute on function public.fila_chamar(uuid, uuid) from public, anon;
revoke execute on function public.finalizar_atendimento(uuid, uuid, jsonb, int, forma_pagamento, text) from public, anon;
grant  execute on function public.fila_chamar(uuid, uuid) to authenticated;
grant  execute on function public.finalizar_atendimento(uuid, uuid, jsonb, int, forma_pagamento, text) to authenticated;
