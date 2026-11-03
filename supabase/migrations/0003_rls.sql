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
