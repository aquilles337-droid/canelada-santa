-- ============================================================
-- Canelada Santa — tipos e extensoes
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Papel do usuario. Administrador tambem e jogador: 'admin' concede
-- permissao, nunca isenta de presenca, pagamento ou ranking.
create type public.user_role as enum ('player', 'admin');

create type public.member_status as enum ('active', 'inactive', 'suspended', 'banned');

create type public.player_position as enum ('goleiro', 'fixo', 'ala', 'pivo', 'linha');

create type public.round_status as enum ('draft', 'open', 'closed', 'in_progress', 'finished', 'cancelled');

-- monthly = mensalista, casual = avulso. Define a faixa de prioridade na fila.
create type public.participant_kind as enum ('monthly', 'casual');

create type public.participation_status as enum (
  'confirmed',  -- ocupa vaga
  'waiting',    -- na lista de espera
  'invited',    -- subiu da espera e tem prazo para aceitar
  'declined',   -- respondeu NAO VOU
  'cancelled',  -- desistiu depois de confirmar
  'removed'     -- retirado pelo administrador
);

create type public.attendance_status as enum ('pending', 'present', 'absent');

create type public.guest_status as enum ('waiting', 'confirmed', 'cancelled', 'removed');

create type public.match_status as enum ('scheduled', 'live', 'finished', 'cancelled');

create type public.match_result as enum ('team_a', 'team_b', 'draw');

create type public.match_event_kind as enum ('goal', 'assist', 'own_goal');

create type public.vote_kind as enum ('mvp', 'bagre');

create type public.charge_type as enum ('monthly', 'match', 'guest', 'fine');

create type public.charge_status as enum ('pending', 'paid', 'expired', 'cancelled', 'waived');

create type public.payment_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'expired');

create type public.membership_status as enum ('pending', 'paid', 'overdue', 'waived', 'cancelled');

create type public.job_status as enum ('running', 'success', 'error');
