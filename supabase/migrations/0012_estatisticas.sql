-- ============================================================
-- Canelada Santa — estatísticas
-- ============================================================
-- As estatísticas são calculadas por visões, não por colunas acumuladas.
-- Assim nenhum número fica dessincronizado quando um gol é desfeito, uma
-- falta é justificada depois ou o administrador corrige um placar.
--
-- Tudo é recortado por temporada, e o histórico antigo continua intacto:
-- a virada de temporada cria uma nova, nunca apaga a anterior.

-- ------------------------------------------------------------
-- Resultado de cada jogador em cada partida
-- ------------------------------------------------------------
create view public.v_resultados_por_jogador as
select
  rp.profile_id,
  r.id        as round_id,
  r.season_id,
  m.id        as match_id,
  case
    when (m.team_a_id = tm.team_id and m.result = 'team_a')
      or (m.team_b_id = tm.team_id and m.result = 'team_b') then 'vitoria'
    when m.result = 'draw' then 'empate'
    else 'derrota'
  end         as desfecho
from public.round_participants rp
join public.team_members tm on tm.participant_id = rp.id
join public.teams t         on t.id = tm.team_id
join public.rounds r        on r.id = rp.round_id
join public.matches m       on m.round_id = r.id and (m.team_a_id = t.id or m.team_b_id = t.id)
where m.status = 'finished' and m.result is not null;

-- ------------------------------------------------------------
-- Gols e assistências por jogador, por rodada
-- ------------------------------------------------------------
create view public.v_participacoes_em_gols as
select
  rp.profile_id,
  r.id         as round_id,
  r.season_id,
  count(*) filter (where e.kind = 'goal')     as gols,
  count(*) filter (where e.kind = 'assist')   as assistencias,
  count(*) filter (where e.kind = 'own_goal') as gols_contra
from public.match_events e
join public.round_participants rp on rp.id = e.participant_id
join public.rounds r              on r.id = rp.round_id
group by rp.profile_id, r.id, r.season_id;

-- ------------------------------------------------------------
-- Craque e bagre da rodada já apurados
-- ------------------------------------------------------------
-- Guarda apenas o mais votado de cada rodada. Empate no topo não elege
-- ninguém: a tela mostra a disputa empatada em vez de escolher às cegas.
create view public.v_eleitos_da_rodada as
with contagem as (
  select
    v.round_id,
    v.kind,
    v.target_id,
    count(*)                                                                  as votos,
    rank() over (partition by v.round_id, v.kind order by count(*) desc)      as posicao,
    count(*) over (partition by v.round_id, v.kind, count(*))                 as empatados
  from public.round_votes v
  group by v.round_id, v.kind, v.target_id
)
select c.round_id, r.season_id, c.kind, c.target_id as profile_id, c.votos
from contagem c
join public.rounds r on r.id = c.round_id
where c.posicao = 1 and c.empatados = 1;

-- ------------------------------------------------------------
-- Rodadas em que cada jogador estava apto
-- ------------------------------------------------------------
-- Denominador da assiduidade. "Apto" é a rodada finalizada que aconteceu
-- depois da entrada do jogador no grupo e antes de um eventual banimento.
-- O critério está documentado aqui porque o documento do racha não o define.
create view public.v_rodadas_aptas as
select
  p.id        as profile_id,
  r.id        as round_id,
  r.season_id
from public.profiles p
join public.rounds r
  on r.status = 'finished'
 and r.starts_at >= p.joined_at
 and (p.banned_at is null or r.starts_at < p.banned_at);

-- ------------------------------------------------------------
-- Estatísticas por jogador e temporada
-- ------------------------------------------------------------
create view public.v_estatisticas_por_temporada as
select
  aptas.profile_id,
  aptas.season_id,
  count(distinct aptas.round_id)                                                  as rodadas_aptas,
  count(distinct rp.round_id) filter (where rp.attendance = 'present')             as presencas,
  count(distinct rp.round_id) filter (where rp.attendance = 'absent')              as faltas,
  count(distinct rp.round_id) filter (
    where rp.attendance = 'absent' and rp.absence_justified
  )                                                                               as faltas_justificadas,
  coalesce(sum(gols.gols), 0)                                                     as gols,
  coalesce(sum(gols.assistencias), 0)                                             as assistencias,
  count(res.match_id) filter (where res.desfecho = 'vitoria')                     as vitorias,
  count(res.match_id) filter (where res.desfecho = 'derrota')                     as derrotas,
  count(res.match_id) filter (where res.desfecho = 'empate')                      as empates,
  count(distinct eleitos.round_id) filter (where eleitos.kind = 'mvp')            as craques,
  count(distinct eleitos.round_id) filter (where eleitos.kind = 'bagre')          as bagres
from public.v_rodadas_aptas aptas
left join public.round_participants rp
  on rp.profile_id = aptas.profile_id and rp.round_id = aptas.round_id
left join public.v_participacoes_em_gols gols
  on gols.profile_id = aptas.profile_id and gols.round_id = aptas.round_id
left join public.v_resultados_por_jogador res
  on res.profile_id = aptas.profile_id and res.round_id = aptas.round_id
left join public.v_eleitos_da_rodada eleitos
  on eleitos.profile_id = aptas.profile_id and eleitos.round_id = aptas.round_id
group by aptas.profile_id, aptas.season_id;

-- ------------------------------------------------------------
-- Presenças de cada jogador em ordem, para calcular sequência
-- ------------------------------------------------------------
create view public.v_presencas_em_ordem as
select
  rp.profile_id,
  r.season_id,
  r.id        as round_id,
  r.starts_at,
  rp.attendance
from public.round_participants rp
join public.rounds r on r.id = rp.round_id
where r.status = 'finished'
order by rp.profile_id, r.starts_at;

grant select on public.v_resultados_por_jogador to authenticated;
grant select on public.v_participacoes_em_gols to authenticated;
grant select on public.v_eleitos_da_rodada to authenticated;
grant select on public.v_rodadas_aptas to authenticated;
grant select on public.v_estatisticas_por_temporada to authenticated;
grant select on public.v_presencas_em_ordem to authenticated;
