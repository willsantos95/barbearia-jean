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
