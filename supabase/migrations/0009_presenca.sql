-- ============================================================
-- Canelada Santa — alocacao atomica de vaga
-- ============================================================
-- As REGRAS (quem pode entrar, se a janela dos avulsos abriu, se ha debito)
-- ficam na camada de dominio em TypeScript, onde sao testadas isoladamente.
-- O que mora aqui e apenas a GARANTIA de que duas pessoas apertando VOU no
-- mesmo instante nao ocupam a mesma vaga: a rodada e travada, as vagas sao
-- contadas e a decisao final e gravada numa unica transacao.

-- Vagas ocupadas = confirmados + convidados da fila (o convite segura a vaga
-- ate o prazo terminar).
create or replace function public.vagas_ocupadas(p_round_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.round_participants
  where round_id = p_round_id and status in ('confirmed', 'invited');
$$;

/**
 * Reserva a vaga do jogador na rodada.
 *
 * p_pode_ocupar_vaga e decidido pela camada de dominio: mensalista pode
 * sempre; avulso so depois da janela das 5 horas. Quando nao pode ocupar,
 * ou quando nao ha vaga, a pessoa entra na lista de espera.
 *
 * Quem ja participou e desistiu entra de novo com joined_at atualizado, ou
 * seja, vai para o fim da fila da sua faixa — nao guarda lugar de antes.
 */
create or replace function public.reservar_vaga(
  p_round_id          uuid,
  p_profile_id        uuid,
  p_kind              public.participant_kind,
  p_tier              integer,
  p_pode_ocupar_vaga  boolean
)
returns public.round_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rodada     public.rounds%rowtype;
  v_ocupadas   integer;
  v_situacao   public.participation_status;
  v_agora      timestamptz := now();
  v_resultado  public.round_participants%rowtype;
begin
  -- Trava a rodada: a contagem de vagas abaixo passa a ser confiavel.
  select * into v_rodada from public.rounds where id = p_round_id for update;

  if not found then
    raise exception 'rodada_nao_encontrada';
  end if;

  select public.vagas_ocupadas(p_round_id) into v_ocupadas;

  if p_pode_ocupar_vaga and v_ocupadas < v_rodada.capacity then
    v_situacao := 'confirmed';
  else
    v_situacao := 'waiting';
  end if;

  insert into public.round_participants as rp
    (round_id, profile_id, kind, priority_tier, status, joined_at, confirmed_at)
  values (
    p_round_id, p_profile_id, p_kind, p_tier::smallint, v_situacao, v_agora,
    case when v_situacao = 'confirmed' then v_agora else null end
  )
  on conflict (round_id, profile_id) do update
    set kind          = excluded.kind,
        priority_tier = excluded.priority_tier,
        status        = excluded.status,
        joined_at     = excluded.joined_at,
        confirmed_at  = excluded.confirmed_at,
        cancelled_at  = null,
        cancel_was_late = false,
        invited_at    = null,
        invite_expires_at = null
    where rp.status in ('declined', 'cancelled', 'removed')
  returning * into v_resultado;

  if v_resultado.id is null then
    -- O ON CONFLICT nao atualizou: a pessoa ja esta ativa nesta lista.
    raise exception 'ja_esta_na_lista';
  end if;

  return v_resultado;
end;
$$;

/**
 * Aceita a vaga oferecida pela lista de espera.
 *
 * Recusa se o prazo ja passou ou se a situacao mudou — o convite e
 * consumido uma unica vez.
 */
create or replace function public.aceitar_vaga(p_participant_id uuid)
returns public.round_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_participante public.round_participants%rowtype;
  v_resultado    public.round_participants%rowtype;
begin
  select * into v_participante
  from public.round_participants
  where id = p_participant_id
  for update;

  if not found then
    raise exception 'participacao_nao_encontrada';
  end if;

  if v_participante.status <> 'invited' then
    raise exception 'convite_indisponivel';
  end if;

  if v_participante.invite_expires_at is not null and v_participante.invite_expires_at <= now() then
    raise exception 'convite_expirado';
  end if;

  update public.round_participants
  set status = 'confirmed',
      confirmed_at = now(),
      invite_expires_at = null
  where id = p_participant_id
  returning * into v_resultado;

  return v_resultado;
end;
$$;

/**
 * Chama da fila quantas pessoas couberem nas vagas livres.
 *
 * p_permitir_avulsos vem da camada de dominio (janela das 5 horas). A ordem
 * e sempre faixa de prioridade e, dentro dela, quem confirmou primeiro:
 * assiduidade nunca entra nesse criterio.
 */
create or replace function public.promover_fila(
  p_round_id          uuid,
  p_permitir_avulsos  boolean,
  p_expira_em         timestamptz
)
returns setof public.round_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rodada   public.rounds%rowtype;
  v_livres   integer;
begin
  select * into v_rodada from public.rounds where id = p_round_id for update;

  if not found then
    raise exception 'rodada_nao_encontrada';
  end if;

  v_livres := v_rodada.capacity - public.vagas_ocupadas(p_round_id);

  if v_livres <= 0 then
    return;
  end if;

  return query
  with proximos as (
    select id
    from public.round_participants
    where round_id = p_round_id
      and status = 'waiting'
      and (p_permitir_avulsos or priority_tier = 0)
    order by priority_tier, joined_at, id
    limit v_livres
    for update
  )
  update public.round_participants rp
  set status = 'invited',
      invited_at = now(),
      invite_expires_at = p_expira_em
  from proximos
  where rp.id = proximos.id
  returning rp.*;
end;
$$;

/**
 * Devolve a vaga de quem nao respondeu no prazo.
 *
 * A pessoa volta para o fim da fila da sua faixa (joined_at e atualizado),
 * para nao travar a chamada dos proximos indefinidamente.
 */
create or replace function public.expirar_convites_de_vaga(p_round_id uuid default null)
returns setof public.round_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update public.round_participants
  set status = 'waiting',
      joined_at = now(),
      invited_at = null,
      invite_expires_at = null
  where status = 'invited'
    and invite_expires_at is not null
    and invite_expires_at <= now()
    and (p_round_id is null or round_id = p_round_id)
  returning *;
end;
$$;

revoke all on function public.reservar_vaga(uuid, uuid, public.participant_kind, integer, boolean) from public, anon, authenticated;
revoke all on function public.aceitar_vaga(uuid) from public, anon, authenticated;
revoke all on function public.promover_fila(uuid, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.expirar_convites_de_vaga(uuid) from public, anon, authenticated;
