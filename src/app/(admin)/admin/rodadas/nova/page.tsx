import type { Metadata } from "next";
import { exigirAdmin } from "@/server/auth/sessao";
import { lerConfiguracoes } from "@/server/services/configuracoes";
import { FormularioNovaRodada } from "./FormularioNovaRodada";

export const metadata: Metadata = { title: "Novo racha" };

export default async function PaginaNovaRodada() {
  await exigirAdmin();
  const configuracoes = await lerConfiguracoes();

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <h1 className="titulo-display text-2xl">
        Novo <span className="texto-ouro">racha</span>
      </h1>

      <FormularioNovaRodada
        padroes={{
          vagas: configuracoes.default_capacity,
          times: configuracoes.default_teams_count,
          minutos: configuracoes.default_match_minutes,
          gols: configuracoes.default_goals_to_win,
          horasParaFechar: configuracoes.default_list_close_hours_before,
          valorAvulsoCentavos: configuracoes.casual_price_cents,
        }}
      />
    </div>
  );
}
