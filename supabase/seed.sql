-- ============================================================
-- Canelada Santa — seed (seguro para producao)
-- ============================================================
-- Nao cria usuarios nem dados ficticios. Apenas garante o que o sistema
-- precisa para funcionar no primeiro acesso: a temporada corrente e o
-- catalogo de conquistas.

-- ------------------------------------------------------------
-- Temporada corrente, calculada a partir das configuracoes.
-- A virada padrao e 10 de janeiro: a temporada 2026 vai de 10/01/2026 a
-- 09/01/2027. O historico antigo nunca e apagado — cria-se outra temporada.
-- ------------------------------------------------------------
do $$
declare
  s            public.settings%rowtype;
  season_start date;
  season_year  integer;
begin
  select * into s from public.settings where id;

  season_year := extract(year from current_date)::int;
  season_start := make_date(season_year, s.season_start_month, s.season_start_day);
  if current_date < season_start then
    season_year := season_year - 1;
    season_start := make_date(season_year, s.season_start_month, s.season_start_day);
  end if;

  if not exists (select 1 from public.seasons where starts_on = season_start) then
    insert into public.seasons (name, starts_on, ends_on, is_current)
    values (
      'Temporada ' || season_year,
      season_start,
      (season_start + interval '1 year' - interval '1 day')::date,
      true
    );
  end if;
end
$$;

-- ------------------------------------------------------------
-- Conquistas
-- ------------------------------------------------------------
insert into public.achievements (slug, name, description, icon) values
  ('artilheiro_temporada', 'Artilheiro da temporada', 'Maior numero de gols na temporada', '⚽'),
  ('garcom_temporada',     'Garcom da temporada',     'Maior numero de assistencias na temporada', '🎩'),
  ('craque_temporada',     'Craque da temporada',     'Mais eleicoes de craque da rodada', '🏆'),
  ('bagre_temporada',      'Bagre da temporada',      'Mais eleicoes de bagre da rodada', '🥔'),
  ('presenca_de_ouro',     'Presenca de ouro',        'Maior assiduidade da temporada', '📅'),
  ('sequencia_de_fogo',    'Sequencia de fogo',       'Maior sequencia de rachas seguidos', '🔥'),
  ('muralha',              'Muralha',                 'Goleiro com mais vitorias na temporada', '🧤'),
  ('primeiro_racha',       'Primeiro racha',          'Jogou o primeiro racha pelo Canelada Santa', '🎉')
on conflict (slug) do nothing;
