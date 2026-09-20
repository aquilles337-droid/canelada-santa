-- ============================================================
-- Canelada Santa — o que existe hoje na temporada
-- ============================================================
-- Só LÊ, não apaga nada. Rode antes de reiniciar a temporada para ver o
-- tamanho do estrago que o reinício vai fazer.
--
-- Cole no SQL Editor do Supabase e rode.

with temporada as (
  select id, name, starts_on, ends_on from public.seasons where is_current
),
alvo as (
  select r.id from public.rounds r join temporada t on t.id = r.season_id
)
select * from (
  select 1 as ordem, 'temporada'            as item, (select name from temporada) as quantidade
  union all
  select 2, 'rodadas',            count(*)::text from alvo
  union all
  select 3, 'presencas na lista', count(*)::text from public.round_participants where round_id in (select id from alvo)
  union all
  select 4, 'convidados',         count(*)::text from public.round_guests       where round_id in (select id from alvo)
  union all
  select 5, 'times',              count(*)::text from public.teams              where round_id in (select id from alvo)
  union all
  select 6, 'partidas',           count(*)::text from public.matches            where round_id in (select id from alvo)
  union all
  select 7, 'gols e assistencias', count(*)::text from public.match_events
    where match_id in (select id from public.matches where round_id in (select id from alvo))
  union all
  select 8, 'votos de craque e bagre', count(*)::text from public.round_votes   where round_id in (select id from alvo)
  union all
  select 9, 'fotos das rodadas',  count(*)::text from public.round_photos       where round_id in (select id from alvo)
  union all
  select 10, 'conquistas dadas',  count(*)::text from public.player_achievements
    where season_id = (select id from temporada)
  union all
  select 11, 'mensalidades',      count(*)::text from public.memberships
  union all
  select 12, 'cobrancas',         count(*)::text from public.charges
  union all
  select 13, 'pagamentos',        count(*)::text from public.payments
  union all
  select 14, 'notas entre jogadores (NAO sao da temporada)', count(*)::text from public.player_rating_votes
  union all
  select 15, 'jogadores cadastrados (o reinicio NAO apaga)', count(*)::text from public.profiles
) linhas
order by ordem;
