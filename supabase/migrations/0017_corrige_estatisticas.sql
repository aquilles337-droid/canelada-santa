-- ============================================================
-- Canelada Santa — corrige a contagem das estatísticas
-- ============================================================
-- A visão anterior juntava, numa consulta só, fontes com granularidades
-- diferentes: gols vinham por RODADA, mas resultados vinham por PARTIDA.
-- Cada gol acabava contado uma vez para cada partida que o jogador
-- disputou. Quem fez 6 gols numa rodada de 7 partidas aparecia com 42.
--
-- A eleição de craque e bagre multiplicava mais uma vez, e por isso
-- vitórias, derrotas e empates também saíam inflados para quem foi eleito.
--
-- A correção é somar cada fonte ANTES de juntar: cada pedaço passa a ter
-- exatamente uma linha por jogador e temporada, e a junção não multiplica
-- mais nada.
--
-- Nenhum número fica guardado em coluna: a estatística continua sendo
-- calculada na hora, então o ranking se corrige sozinho assim que esta
-- migration roda — não há dado velho para consertar.

-- As colunas trocam de tipo (bigint/numeric para int), e "create or replace"
-- não aceita troca de tipo. O drop é sem cascade de propósito: se um dia
-- alguma outra visão passar a depender desta, o drop falha alto em vez de
-- levar a dependente junto em silêncio.
drop view if exists public.v_estatisticas_por_temporada;

create view public.v_estatisticas_por_temporada as
with aptas as (
  select profile_id, season_id, count(distinct round_id)::int as rodadas_aptas
  from public.v_rodadas_aptas
  group by profile_id, season_id
),
presencas as (
  -- Só rodadas em que o jogador estava apto entram na conta — é o que
  -- mantém a assiduidade justa com quem entrou no meio da temporada.
  select
    a.profile_id,
    a.season_id,
    count(*) filter (where rp.attendance = 'present')::int as presencas,
    count(*) filter (where rp.attendance = 'absent')::int  as faltas,
    count(*) filter (
      where rp.attendance = 'absent' and rp.absence_justified
    )::int                                                 as faltas_justificadas
  from public.v_rodadas_aptas a
  left join public.round_participants rp
    on rp.profile_id = a.profile_id and rp.round_id = a.round_id
  group by a.profile_id, a.season_id
),
gols as (
  -- v_participacoes_em_gols já vem com uma linha por jogador e rodada.
  select
    a.profile_id,
    a.season_id,
    sum(g.gols)::int         as gols,
    sum(g.assistencias)::int as assistencias
  from public.v_rodadas_aptas a
  join public.v_participacoes_em_gols g
    on g.profile_id = a.profile_id and g.round_id = a.round_id
  group by a.profile_id, a.season_id
),
resultados as (
  -- Aqui sim há várias linhas por rodada, uma por partida — e é justamente
  -- esse número que inflava tudo antes de a soma ser feita em separado.
  select
    a.profile_id,
    a.season_id,
    count(*) filter (where res.desfecho = 'vitoria')::int as vitorias,
    count(*) filter (where res.desfecho = 'derrota')::int as derrotas,
    count(*) filter (where res.desfecho = 'empate')::int  as empates
  from public.v_rodadas_aptas a
  join public.v_resultados_por_jogador res
    on res.profile_id = a.profile_id and res.round_id = a.round_id
  group by a.profile_id, a.season_id
),
eleicoes as (
  select
    a.profile_id,
    a.season_id,
    count(*) filter (where el.kind = 'mvp')   as craques,
    count(*) filter (where el.kind = 'bagre') as bagres
  from public.v_rodadas_aptas a
  join public.v_eleitos_da_rodada el
    on el.profile_id = a.profile_id and el.round_id = a.round_id
  group by a.profile_id, a.season_id
)
select
  a.profile_id,
  a.season_id,
  a.rodadas_aptas,
  coalesce(p.presencas, 0)           as presencas,
  coalesce(p.faltas, 0)              as faltas,
  coalesce(p.faltas_justificadas, 0) as faltas_justificadas,
  coalesce(g.gols, 0)                as gols,
  coalesce(g.assistencias, 0)        as assistencias,
  coalesce(r.vitorias, 0)            as vitorias,
  coalesce(r.derrotas, 0)            as derrotas,
  coalesce(r.empates, 0)             as empates,
  coalesce(e.craques, 0)::int        as craques,
  coalesce(e.bagres, 0)::int         as bagres
from aptas a
left join presencas  p on p.profile_id = a.profile_id and p.season_id = a.season_id
left join gols       g on g.profile_id = a.profile_id and g.season_id = a.season_id
left join resultados r on r.profile_id = a.profile_id and r.season_id = a.season_id
left join eleicoes   e on e.profile_id = a.profile_id and e.season_id = a.season_id;

grant select on public.v_estatisticas_por_temporada to authenticated;
