/**
 * Tipos do banco do Canelada Santa.
 *
 * Escritos a mao e mantidos junto com as migrations em supabase/migrations.
 * Ao alterar uma migration, atualize o tipo correspondente aqui — e o que
 * garante que uma coluna renomeada quebre a compilacao em vez de virar
 * `undefined` em producao.
 */

export type UserRole = "player" | "admin";
export type MemberStatus = "active" | "inactive" | "suspended" | "banned";
export type PlayerPosition = "goleiro" | "fixo" | "ala" | "pivo" | "linha";
export type RoundStatus = "draft" | "open" | "closed" | "in_progress" | "finished" | "cancelled";
export type ParticipantKind = "monthly" | "casual";
export type ParticipationStatus =
  | "confirmed"
  | "waiting"
  | "invited"
  | "declined"
  | "cancelled"
  | "removed";
export type AttendanceStatus = "pending" | "present" | "absent";
export type GuestStatus = "waiting" | "confirmed" | "cancelled" | "removed";
export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";
export type MatchResult = "team_a" | "team_b" | "draw";
export type MatchEventKind = "goal" | "assist" | "own_goal";
export type VoteKind = "mvp" | "bagre";
export type ChargeType = "monthly" | "match" | "guest" | "fine";
export type ChargeStatus = "pending" | "paid" | "expired" | "cancelled" | "waived";
export type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded" | "expired";
export type MembershipStatus = "pending" | "paid" | "overdue" | "waived" | "cancelled";
export type JobStatus = "running" | "success" | "error";
export type FineSubtype = "late_cancel" | "no_show";

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type Profile = {
  id: string;
  full_name: string;
  nickname: string | null;
  phone: string;
  photo_url: string | null;
  position: PlayerPosition;
  is_goalkeeper: boolean;
  weight_kg: number | null;
  height_cm: number | null;
  role: UserRole;
  status: MemberStatus;
  is_member: boolean;
  member_since: string | null;
  joined_at: string;
  banned_at: string | null;
  banned_reason: string | null;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type CategoriaNota = {
  slug: string;
  label: string;
  min: number;
  max: number;
}

export type PesosDeTime = {
  balance: number;
  size: number;
  concentration: number;
  repetition: number;
  physical: number;
  repetitionWindow: number;
}

export type Settings = {
  id: boolean;
  monthly_fee_cents: number;
  casual_price_cents: number;
  guest_of_member_price_cents: number;
  guest_of_casual_price_cents: number;
  allow_casual_guests: boolean;
  guest_quota_per_member: number;
  late_cancel_fine_cents: number;
  no_show_multiplier: number;
  cancel_deadline_hours: number;
  waitlist_unlock_hours: number;
  waitlist_accept_minutes: number;
  waitlist_accept_minutes_urgent: number;
  waitlist_urgent_threshold_hours: number;
  member_can_reclaim_slot: boolean;
  default_capacity: number;
  default_teams_count: number;
  default_match_minutes: number;
  default_goals_to_win: number;
  default_list_close_hours_before: number;
  rating_categories: CategoriaNota[];
  default_rating: number;
  min_votes_for_rating: number;
  monthly_due_day: number;
  season_start_month: number;
  season_start_day: number;
  block_on_debt: boolean;
  recurring_card_enabled: boolean;
  team_weights: PesosDeTime;
  group_name: string;
  updated_by: string | null;
  updated_at: string;
}

export type Invitation = {
  id: string;
  code: string;
  note: string | null;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

export type Season = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
  created_at: string;
}

/** Snapshot de precos gravado na rodada — nao muda quando o admin altera as configuracoes. */
export type PrecosDaRodada = {
  casual_price_cents: number;
  guest_of_member_price_cents: number;
  guest_of_casual_price_cents: number;
  allow_casual_guests: boolean;
  guest_quota_per_member: number;
}

/** Snapshot das multas gravado na rodada. */
export type RegrasDeMulta = {
  late_cancel_fine_cents: number;
  no_show_multiplier: number;
  cancel_deadline_hours: number;
}

export type Round = {
  id: string;
  season_id: string;
  number: number;
  title: string | null;
  starts_at: string;
  venue: string;
  address: string | null;
  capacity: number;
  teams_count: number;
  players_per_team: number | null;
  match_minutes: number;
  goals_to_win: number;
  list_opens_at: string;
  list_closes_at: string;
  waitlist_unlock_at: string;
  cancel_deadline_hours: number;
  pricing: PrecosDaRodada;
  fine_rules: RegrasDeMulta;
  rules: string | null;
  status: RoundStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  finished_at: string | null;
}

export type RoundParticipant = {
  id: string;
  round_id: string;
  profile_id: string;
  kind: ParticipantKind;
  priority_tier: number;
  status: ParticipationStatus;
  joined_at: string;
  confirmed_at: string | null;
  invited_at: string | null;
  invite_expires_at: string | null;
  cancelled_at: string | null;
  cancel_was_late: boolean;
  attendance: AttendanceStatus;
  absence_justified: boolean | null;
  absence_note: string | null;
  attendance_marked_by: string | null;
  attendance_marked_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RoundGuest = {
  id: string;
  round_id: string;
  host_profile_id: string;
  name: string;
  skill_level: number;
  status: GuestStatus;
  attendance: AttendanceStatus;
  created_at: string;
  confirmed_at: string | null;
  updated_at: string;
}

export type Team = {
  id: string;
  round_id: string;
  idx: number;
  name: string;
  color: string;
  rating_total: number;
  created_at: string;
}

export type TeamMember = {
  id: string;
  team_id: string;
  participant_id: string | null;
  guest_id: string | null;
  is_goalkeeper: boolean;
  rating_snapshot: number;
  created_at: string;
}

/** Registro do sorteio de desempate (regra do time que ganha fica). */
export type RegistroDeSorteio = {
  motivo: "empate_uma_equipe_fora";
  times_sorteados: string[];
  time_que_saiu: string;
  semente: number;
  decidido_em: string;
}

export type Match = {
  id: string;
  round_id: string;
  seq: number;
  team_a_id: string;
  team_b_id: string;
  score_a: number;
  score_b: number;
  status: MatchStatus;
  result: MatchResult | null;
  tiebreak: RegistroDeSorteio | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export type MatchEvent = {
  id: string;
  match_id: string;
  kind: MatchEventKind;
  team_id: string;
  participant_id: string | null;
  guest_id: string | null;
  related_event_id: string | null;
  minute: number | null;
  created_by: string | null;
  created_at: string;
}

export type PlayerRatingVote = {
  id: string;
  voter_id: string;
  target_id: string;
  score: number;
  created_at: string;
  updated_at: string;
}

export type RoundVote = {
  id: string;
  round_id: string;
  voter_id: string;
  target_id: string;
  kind: VoteKind;
  created_at: string;
}

export type Membership = {
  id: string;
  profile_id: string;
  competence: string;
  amount_cents: number;
  due_date: string;
  status: MembershipStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Charge = {
  id: string;
  profile_id: string;
  round_id: string | null;
  guest_id: string | null;
  membership_id: string | null;
  type: ChargeType;
  subtype: string | null;
  amount_cents: number;
  status: ChargeStatus;
  description: string;
  due_date: string | null;
  idempotency_key: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

export type Payment = {
  id: string;
  charge_id: string;
  provider: string;
  provider_payment_id: string | null;
  external_reference: string;
  method: string;
  status: PaymentStatus;
  amount_cents: number;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  raw: Json | null;
  created_at: string;
  updated_at: string;
}

export type WebhookEvent = {
  id: string;
  provider: string;
  provider_event_id: string;
  topic: string | null;
  payload: Json;
  received_at: string;
  processed_at: string | null;
  status: string;
  error: string | null;
}

export type PushSubscriptionRow = {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  enabled: boolean;
  failure_count: number;
  last_success_at: string | null;
  created_at: string;
}

export type NotificationRow = {
  id: string;
  profile_id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  data: Json | null;
  read_at: string | null;
  pushed_at: string | null;
  created_at: string;
}

export type RoundPhoto = {
  id: string;
  round_id: string;
  storage_path: string;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export type Achievement = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  created_at: string;
}

export type PlayerAchievement = {
  id: string;
  profile_id: string;
  achievement_id: string;
  season_id: string | null;
  round_id: string | null;
  awarded_at: string;
}

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: Json | null;
  after: Json | null;
  created_at: string;
}

export type JobRun = {
  id: string;
  job: string;
  status: JobStatus;
  started_at: string;
  finished_at: string | null;
  result: Json | null;
  error: string | null;
}

export type VPlayerRating = {
  profile_id: string;
  votes_count: number;
  avg_score: number;
}

export type VRoundVoteTally = {
  round_id: string;
  kind: VoteKind;
  target_id: string;
  votes: number;
}

export type VPlayerEffectiveRating = {
  profile_id: string;
  votes_count: number;
  rating: number;
  has_enough_votes: boolean;
}

type Tabela<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type Visao<Row> = { Row: Row; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: Tabela<Profile>;
      settings: Tabela<Settings>;
      invitations: Tabela<Invitation>;
      seasons: Tabela<Season>;
      rounds: Tabela<Round>;
      round_participants: Tabela<RoundParticipant>;
      round_guests: Tabela<RoundGuest>;
      teams: Tabela<Team>;
      team_members: Tabela<TeamMember>;
      matches: Tabela<Match>;
      match_events: Tabela<MatchEvent>;
      player_rating_votes: Tabela<PlayerRatingVote>;
      round_votes: Tabela<RoundVote>;
      memberships: Tabela<Membership>;
      charges: Tabela<Charge>;
      payments: Tabela<Payment>;
      webhook_events: Tabela<WebhookEvent>;
      push_subscriptions: Tabela<PushSubscriptionRow>;
      notifications: Tabela<NotificationRow>;
      round_photos: Tabela<RoundPhoto>;
      achievements: Tabela<Achievement>;
      player_achievements: Tabela<PlayerAchievement>;
      audit_logs: Tabela<AuditLog>;
      job_runs: Tabela<JobRun>;
    };
    Views: {
      v_player_rating: Visao<VPlayerRating>;
      v_round_vote_tally: Visao<VRoundVoteTally>;
      v_player_effective_rating: Visao<VPlayerEffectiveRating>;
    };
    Functions: {
      vagas_ocupadas: { Args: { p_round_id: string }; Returns: number };
      reservar_vaga: {
        Args: {
          p_round_id: string;
          p_profile_id: string;
          p_kind: ParticipantKind;
          p_tier: number;
          p_pode_ocupar_vaga: boolean;
        };
        Returns: RoundParticipant;
      };
      aceitar_vaga: { Args: { p_participant_id: string }; Returns: RoundParticipant };
      promover_fila: {
        Args: { p_round_id: string; p_permitir_avulsos: boolean; p_expira_em: string };
        Returns: RoundParticipant[];
      };
      expirar_convites_de_vaga: {
        Args: { p_round_id?: string | null };
        Returns: RoundParticipant[];
      };
    };
    Enums: {
      user_role: UserRole;
      member_status: MemberStatus;
      player_position: PlayerPosition;
      round_status: RoundStatus;
      participant_kind: ParticipantKind;
      participation_status: ParticipationStatus;
      attendance_status: AttendanceStatus;
      guest_status: GuestStatus;
      match_status: MatchStatus;
      match_result: MatchResult;
      match_event_kind: MatchEventKind;
      vote_kind: VoteKind;
      charge_type: ChargeType;
      charge_status: ChargeStatus;
      payment_status: PaymentStatus;
      membership_status: MembershipStatus;
      job_status: JobStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
