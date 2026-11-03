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
