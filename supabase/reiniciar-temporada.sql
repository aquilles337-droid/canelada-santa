-- ============================================================
-- Canelada Santa — REINICIAR A TEMPORADA
-- ============================================================
-- Apaga TODO o movimento da temporada atual: rodadas, listas de presença,
-- convidados, times, partidas, gols, votação, fotos, conquistas e o
-- financeiro. O grupo volta ao estado de primeiro dia, com a mesma
-- temporada e as mesmas configurações.
--
-- O QUE CONTINUA DE PÉ:
--   • os jogadores e suas contas (ninguém precisa se cadastrar de novo)
--   • quem é administrador, quem é mensalista, quem está banido
--   • todas as configurações do racha (valores, prazos, horários)
--   • a temporada em si e o catálogo de conquistas
--   • as notas que os jogadores deram uns aos outros (veja a chave abaixo)
--   • os aparelhos que já aceitaram notificação
--
-- ⚠️ NÃO TEM VOLTA. Antes de rodar, vale tirar um backup no painel do
--    Supabase: Database → Backups.
--
-- COMO USAR
--   1. Rode `supabase/conferir-dados-da-temporada.sql` para ver o que existe.
--   2. Abra este arquivo, troque `confirmo := false` por `confirmo := true`.
--   3. Cole tudo no SQL Editor do Supabase e rode.
--   4. A tabela que aparece no fim tem de mostrar zero em tudo.
-- ============================================================

do $$
declare
  -- ----------------------------------------------------------
  -- AS CHAVES DO REINÍCIO
  -- ----------------------------------------------------------

  -- ⚠️ Enquanto isto for false, o script não apaga nada. É de propósito:
  -- ninguém reinicia a temporada por colar um arquivo sem querer.
  confirmo boolean := false;

  -- As notas que os jogadores deram uns aos outros NÃO são dado de
  -- temporada: são o retrato de como cada um joga, e é o que o sorteio usa
  -- para equilibrar os times. Na virada de ano de verdade elas continuam.
  -- Troque para true só se as avaliações também tiverem sido de teste.
  apagar_avaliacoes boolean := false;

  -- O financeiro não é preso a temporada: mensalidade tem MÊS, não
  -- temporada. Com true, apaga o histórico financeiro inteiro — é o
  -- "reiniciar agora" de verdade, e a mensalidade do mês é gerada de novo
  -- na próxima passagem da tarefa automática. Com false, apaga só o que
  -- está preso às rodadas desta temporada e aos meses dela.
  apagar_financeiro_inteiro boolean := true;

  -- Apaga também os arquivos das fotos no Storage. Com false, as linhas
  -- somem do banco mas as imagens ficam ocupando espaço sem ninguém para
  -- olhar para elas.
  apagar_arquivos_das_fotos boolean := true;

  -- Avisos, registros de webhook e histórico das tarefas automáticas.
  apagar_registros_tecnicos boolean := true;

  -- Os códigos de convite criados até agora. Com false, os links que você
  -- já mandou para o pessoal continuam valendo.
  apagar_convites boolean := false;

  -- ----------------------------------------------------------
  v_temporada   uuid;
  v_alvo        uuid[];
  v_nome        text;
  v_inicio      date;
  v_fim         date;
  v_rodadas     int;
  v_cobrancas   int;
  v_mensalidades int;
  v_fotos       int;
begin
  if not confirmo then
    raise exception using
      message = 'Reinicio NAO executado: troque "confirmo := false" por "confirmo := true" no topo do arquivo.',
      hint    = 'Rode antes o supabase/conferir-dados-da-temporada.sql para ver o que seria apagado.';
  end if;

  select id, name, starts_on, ends_on
    into v_temporada, v_nome, v_inicio, v_fim
  from public.seasons where is_current;

  if v_temporada is null then
    raise exception 'Nenhuma temporada corrente. Rode o supabase/seed.sql primeiro.';
  end if;

  raise notice 'Reiniciando a % (% a %)', v_nome, v_inicio, v_fim;

  -- Guarda quais rodadas somem. Tudo que é preso a rodada cai junto por
  -- cascata: presenças, convidados, times, partidas, gols, votos e fotos.
  select coalesce(array_agg(id), '{}') into v_alvo
  from public.rounds where season_id = v_temporada;

  v_rodadas := coalesce(array_length(v_alvo, 1), 0);

  -- ----------------------------------------------------------
  -- 1. Arquivos das fotos — antes das rodadas, senão o caminho se perde
  -- ----------------------------------------------------------
  if apagar_arquivos_das_fotos then
    delete from storage.objects
    where bucket_id = 'fotos-rodadas'
      and name in (
        select storage_path from public.round_photos
        where round_id = any (v_alvo)
      );
    get diagnostics v_fotos = row_count;
    raise notice '  % arquivos de foto apagados do Storage', v_fotos;
  end if;

  -- ----------------------------------------------------------
  -- 2. Financeiro — antes das rodadas e das mensalidades
  -- ----------------------------------------------------------
  -- A ordem importa: a cobrança de mensalidade EXIGE uma mensalidade, e a
  -- de convidado EXIGE um convidado. Se a rodada ou a mensalidade sumisse
  -- primeiro, a cobrança ficaria órfã e o banco recusaria a operação
  -- inteira. Os pagamentos (os PIX gerados) caem por cascata com a cobrança.
  if apagar_financeiro_inteiro then
    delete from public.charges;
    get diagnostics v_cobrancas = row_count;
    delete from public.memberships;
    get diagnostics v_mensalidades = row_count;
  else
    delete from public.charges
    where round_id = any (v_alvo)
       or guest_id in (
            select id from public.round_guests
            where round_id = any (v_alvo)
          )
       or membership_id in (
            select id from public.memberships
            where competence between date_trunc('month', v_inicio)::date and v_fim
          );
    get diagnostics v_cobrancas = row_count;

    delete from public.memberships
    where competence between date_trunc('month', v_inicio)::date and v_fim;
    get diagnostics v_mensalidades = row_count;
  end if;
  raise notice '  % cobrancas e % mensalidades apagadas', v_cobrancas, v_mensalidades;

  -- ----------------------------------------------------------
  -- 3. Conquistas da temporada
  -- ----------------------------------------------------------
  -- Só as entregas. O catálogo de conquistas continua intacto.
  delete from public.player_achievements
  where season_id = v_temporada
     or round_id = any (v_alvo);

  -- ----------------------------------------------------------
  -- 4. As rodadas — leva tudo junto
  -- ----------------------------------------------------------
  delete from public.rounds where id = any (v_alvo);
  raise notice '  % rodadas apagadas (com listas, times, partidas, gols, votos e fotos)', v_rodadas;

  -- ----------------------------------------------------------
  -- 5. Opcionais
  -- ----------------------------------------------------------
  if apagar_avaliacoes then
    delete from public.player_rating_votes;
    raise notice '  notas entre jogadores apagadas';
  end if;

  if apagar_registros_tecnicos then
    delete from public.notifications;
    delete from public.webhook_events;
    delete from public.job_runs;
    delete from public.audit_logs;
    raise notice '  avisos e registros tecnicos apagados';
  end if;

  if apagar_convites then
    delete from public.invitations;
    raise notice '  convites apagados';
  end if;

  raise notice 'Pronto. A % comeca do zero.', v_nome;
end
$$;

-- ============================================================
-- Conferência: depois do reinício, tem de dar zero em tudo
-- ============================================================
with temporada as (
  select id, name from public.seasons where is_current
),
alvo as (
  select r.id from public.rounds r join temporada t on t.id = r.season_id
)
select * from (
  select 1 as ordem, 'temporada'  as item, (select name from temporada) as quantidade
  union all
  select 2, 'rodadas',        count(*)::text from alvo
  union all
  select 3, 'partidas',       count(*)::text from public.matches where round_id in (select id from alvo)
  union all
  select 4, 'gols',           count(*)::text from public.match_events
    where match_id in (select id from public.matches where round_id in (select id from alvo))
  union all
  select 5, 'cobrancas',      count(*)::text from public.charges
  union all
  select 6, 'mensalidades',   count(*)::text from public.memberships
  union all
  select 7, 'conquistas dadas', count(*)::text from public.player_achievements
    where season_id = (select id from temporada)
  union all
  select 8, 'jogadores mantidos', count(*)::text from public.profiles
  union all
  select 9, 'administradores mantidos', count(*)::text from public.profiles where role = 'admin'
) linhas
order by ordem;
