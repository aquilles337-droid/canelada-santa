-- ============================================================
-- Canelada Santa — o goleiro é do gol, não do time
-- ============================================================
-- No racha, a linha gira com o "quem ganha fica" e o goleiro continua no
-- gol dele. Numa noite de sete partidas, o mesmo goleiro joga por vários
-- times diferentes.
--
-- O modelo anterior não sabia disso: o resultado de cada jogador vinha do
-- time a que ele pertencia na rodada inteira (team_members). Para o goleiro
-- isso saía errado a noite toda — ele ficava preso ao time do primeiro
-- sorteio, ganhando e perdendo junto com gente que já tinha saído de campo.
--
-- A correção tem duas partes:
--
--   1. O goleiro deixa de entrar em time de linha. Ele passa a ser da
--      RODADA (round_goalkeepers), e cada PARTIDA registra quem estava em
--      cada gol.
--   2. O resultado do goleiro passa a ser contado pelo lado que ele
--      defendeu naquela partida.
--
-- É também o que faz 18 jogadores com 2 goleiros virarem 4 times de 4 em
-- vez de 5 + 5 + 4 + 4: só os 16 de linha entram na divisão.

-- ------------------------------------------------------------
-- Os goleiros da rodada
-- ------------------------------------------------------------
-- Eles não pertencem a time nenhum, então precisam de lugar próprio. A
-- ordem (idx) é a ordem em que entram no gol: com dois goleiros ela é a
-- escalação fixa da noite; com três ou mais, o ponto de partida do
-- revezamento.
create table if not exists public.round_goalkeepers (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references public.rounds (id) on delete cascade,
  participant_id uuid not null references public.round_participants (id) on delete cascade,
  idx            smallint not null check (idx > 0),
  created_at     timestamptz not null default now(),
  constraint round_goalkeepers_unique unique (round_id, participant_id),
  constraint round_goalkeepers_unique_idx unique (round_id, idx)
);

create index if not exists round_goalkeepers_round_idx
  on public.round_goalkeepers (round_id, idx);

-- ------------------------------------------------------------
-- Quem estava em cada gol, partida a partida
-- ------------------------------------------------------------
-- Nulo é caso real, não falha: racha sem goleiro marcado, ou com um só,
-- deixa um dos gols sem dono e o grupo combina na hora.
alter table public.matches
  add column if not exists goalkeeper_a_id uuid references public.round_participants (id) on delete set null,
  add column if not exists goalkeeper_b_id uuid references public.round_participants (id) on delete set null;

-- Ninguém defende os dois gols na mesma partida.
alter table public.matches
  drop constraint if exists matches_goleiros_distintos;
alter table public.matches
  add constraint matches_goleiros_distintos check (
    goalkeeper_a_id is null
    or goalkeeper_b_id is null
    or goalkeeper_a_id <> goalkeeper_b_id
  );

create index if not exists matches_goleiro_a_idx on public.matches (goalkeeper_a_id);
create index if not exists matches_goleiro_b_idx on public.matches (goalkeeper_b_id);

-- ------------------------------------------------------------
-- Segurança
-- ------------------------------------------------------------
alter table public.round_goalkeepers enable row level security;

drop policy if exists round_goalkeepers_select on public.round_goalkeepers;
create policy round_goalkeepers_select on public.round_goalkeepers
  for select to authenticated using (public.is_active_user());

drop policy if exists round_goalkeepers_admin on public.round_goalkeepers;
create policy round_goalkeepers_admin on public.round_goalkeepers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.round_goalkeepers to authenticated;

-- ------------------------------------------------------------
-- Resultado de cada jogador em cada partida
-- ------------------------------------------------------------
-- Duas metades que não se sobrepõem: a linha entra pelo time, o goleiro
-- entra pelo gol que defendeu. Como o goleiro não é mais membro de time de
-- linha, ninguém aparece nas duas.
--
-- O "union all" seria errado aqui: em rodadas antigas, criadas antes desta
-- migration, o goleiro ESTÁ em team_members. O "union" (sem all) descarta a
-- linha repetida quando as duas metades concordam, e nas antigas elas
-- concordam — o goleiro tinha o resultado do time mesmo.
drop view if exists public.v_resultados_por_jogador cascade;

create view public.v_resultados_por_jogador as
-- Linha: o resultado vem do time.
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
where m.status = 'finished' and m.result is not null

union

-- Goleiro: o resultado vem do GOL que ele defendeu naquela partida.
select
  rp.profile_id,
  r.id        as round_id,
  r.season_id,
  m.id        as match_id,
  case
    when (m.goalkeeper_a_id = rp.id and m.result = 'team_a')
      or (m.goalkeeper_b_id = rp.id and m.result = 'team_b') then 'vitoria'
    when m.result = 'draw' then 'empate'
    else 'derrota'
  end         as desfecho
from public.matches m
join public.round_participants rp
  on rp.id in (m.goalkeeper_a_id, m.goalkeeper_b_id)
join public.rounds r on r.id = m.round_id
where m.status = 'finished' and m.result is not null;

grant select on public.v_resultados_por_jogador to authenticated;

-- ------------------------------------------------------------
-- A visão de estatísticas depende da de cima e caiu no cascade
-- ------------------------------------------------------------
-- É a mesma da migration 0017, recriada aqui porque o "drop ... cascade"
-- acima a levou junto. A correção do fan-out continua valendo: cada fonte é
-- somada ANTES de juntar.
create or replace view public.v_estatisticas_por_temporada as
with aptas as (
  select profile_id, season_id, count(distinct round_id)::int as rodadas_aptas
  from public.v_rodadas_aptas
  group by profile_id, season_id
),
presencas as (
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
