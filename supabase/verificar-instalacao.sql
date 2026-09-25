-- ============================================================
-- Canelada Santa — conferir se o banco está completo
-- ============================================================
-- Cole isto no SQL Editor do Supabase. Ele lista tudo que o aplicativo
-- precisa e marca o que está faltando. Se aparecer qualquer linha com
-- FALTANDO, é só rodar a migration correspondente em supabase/migrations.

with esperado(tipo, objeto) as (
  values
    -- tabelas
    ('tabela','profiles'),('tabela','settings'),('tabela','invitations'),
    ('tabela','seasons'),('tabela','rounds'),('tabela','round_participants'),
    ('tabela','round_guests'),('tabela','teams'),('tabela','team_members'),
    ('tabela','matches'),('tabela','match_events'),('tabela','player_rating_votes'),
    ('tabela','round_votes'),('tabela','memberships'),('tabela','charges'),
    ('tabela','payments'),('tabela','webhook_events'),('tabela','push_subscriptions'),
    ('tabela','notifications'),('tabela','round_photos'),('tabela','achievements'),('tabela','round_goalkeepers'),
    ('tabela','player_achievements'),('tabela','audit_logs'),('tabela','job_runs'),
    -- visões
    ('visao','v_player_rating'),('visao','v_round_vote_tally'),
    ('visao','v_player_effective_rating'),('visao','v_resultados_por_jogador'),
    ('visao','v_participacoes_em_gols'),('visao','v_eleitos_da_rodada'),
    ('visao','v_rodadas_aptas'),('visao','v_estatisticas_por_temporada'),
    ('visao','v_presencas_em_ordem'),
    -- funções
    ('funcao','is_admin'),('funcao','is_active_user'),('funcao','guard_profile_privileges'),
    ('funcao','touch_updated_at'),('funcao','vagas_ocupadas'),('funcao','reservar_vaga'),
    ('funcao','aceitar_vaga'),('funcao','promover_fila'),('funcao','expirar_convites_de_vaga'),
    ('funcao','convidados_usados_no_mes'),('funcao','consolidar_convidados'),
    ('funcao','confirmar_pagamento')
),
existente as (
  select
    e.tipo,
    e.objeto,
    case
      when e.tipo in ('tabela','visao') then exists (
        select 1 from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = e.objeto
          and c.relkind = case when e.tipo = 'tabela' then 'r' else 'v' end
      )
      else exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = e.objeto
      )
    end as tem
  from esperado e
)
select tipo, objeto, case when tem then 'ok' else '>>> FALTANDO <<<' end as situacao
from existente
where not tem

union all

select 'dado', 'linha de configuracoes', '>>> FALTANDO (rode o seed) <<<'
where not exists (select 1 from public.settings where id)

union all

select 'dado', 'temporada corrente', '>>> FALTANDO (rode o seed) <<<'
where not exists (select 1 from public.seasons where is_current)

union all

select 'resumo', 'tudo certo', 'o banco esta completo'
where not exists (select 1 from existente where not tem)
  and exists (select 1 from public.settings where id)
  and exists (select 1 from public.seasons where is_current)

order by 1, 2;
