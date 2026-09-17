-- ============================================================
-- Canelada Santa — armazenamento de fotos
-- ============================================================
-- Dois espaços separados: as fotos das rodadas e os retratos de perfil.
-- Ambos são públicos para leitura (o grupo se enxerga), mas a escrita só
-- acontece pelo backend, com service role, depois de validar quem é quem e
-- o que está sendo enviado.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('fotos-rodadas', 'fotos-rodadas', true, 8388608,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('fotos-perfil', 'fotos-perfil', true, 4194304,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Leitura liberada para qualquer pessoa com o link da imagem.
-- (Os nomes de arquivo são gerados pelo servidor, nunca sequenciais.)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'canelada_fotos_leitura'
  ) then
    create policy canelada_fotos_leitura on storage.objects
      for select to public
      using (bucket_id in ('fotos-rodadas', 'fotos-perfil'));
  end if;
end
$$;
