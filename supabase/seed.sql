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
