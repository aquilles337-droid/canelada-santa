-- ============================================================
-- Canelada Santa — mensalidade acompanha a cobrança
-- ============================================================
-- A competência do mês e a cobrança dela são duas linhas em tabelas
-- diferentes que precisam contar a mesma história. Enquanto isso dependeu de
-- cada serviço lembrar de atualizar os dois lugares, deu no que deu: o botão
-- "Pagou" atualizava os dois, o "Perdoar" só atualizava a cobrança — e a
-- mensalidade perdoada continuava em aberto até a tarefa automática marcá-la
-- como vencida. Perdoar a dívida transformava a pessoa em inadimplente.
--
-- Agora a regra vive aqui: mexeu na cobrança da mensalidade, a competência
-- acompanha. Não importa qual caminho do código fez a alteração.

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
  end if;

  return new;
end;
$$;

drop trigger if exists charges_sincroniza_mensalidade on public.charges;

create trigger charges_sincroniza_mensalidade
  after update of status on public.charges
  for each row execute function public.sincronizar_mensalidade();
