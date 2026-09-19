-- ============================================================
-- Canelada Santa — voltar a cobrar
-- ============================================================
-- Perdoar era um caminho sem volta: a competência do mês ficava marcada como
-- perdoada e a geração mensal pulava aquele jogador para sempre, porque já
-- existia linha para o mês. Se o administrador perdoou por engano, ou o
-- combinado mudou, não havia como cobrar de novo.
--
-- O gatilho da migration 0015 sincronizava paid, waived e cancelled. Agora
-- entende também a volta para "em aberto".

create or replace function public.sincronizar_mensalidade()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.membership_id is null or new.status = old.status then
    return new;
  end if;

  if new.status = 'paid' then
    update public.memberships
    set status = 'paid', paid_at = coalesce(new.paid_at, now())
    where id = new.membership_id and status <> 'paid';

  elsif new.status = 'waived' then
    -- Quem já pagou não volta atrás: dinheiro que entrou não vira perdão.
    update public.memberships
    set status = 'waived'
    where id = new.membership_id and status <> 'paid';

  elsif new.status = 'cancelled' then
    update public.memberships
    set status = 'cancelled'
    where id = new.membership_id and status not in ('paid', 'waived');

  elsif new.status = 'pending' then
    -- Voltou a ser cobrada. A tarefa automática marca como vencida de novo
    -- se o prazo já tiver passado — não é aqui que isso se decide.
    update public.memberships
    set status = 'pending', paid_at = null
    where id = new.membership_id and status <> 'paid';
  end if;

  return new;
end;
$$;
