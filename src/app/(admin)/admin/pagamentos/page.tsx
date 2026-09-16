import type { Metadata } from "next";
import { exigirAdmin } from "@/server/auth/sessao";
import { clienteAdmin } from "@/lib/supabase/admin";
import { Cartao } from "@/components/ui/Cartao";
import { EstadoVazio } from "@/components/ui/Estados";
import { CartaoDePagamento } from "@/components/financeiro/CartaoDePagamento";
import { Avatar } from "@/components/ui/Avatar";
import { formatarDinheiro } from "@/lib/format";
import type { Charge, Profile } from "@/lib/supabase/tipos";
import { AcoesDaCobranca } from "./AcoesDaCobranca";

export const metadata: Metadata = { title: "Pagamentos" };

interface CobrancaComJogador extends Charge {
  jogador: Profile;
}

export default async function PaginaAdminPagamentos() {
  await exigirAdmin();

  const { data } = await clienteAdmin()
    .from("charges")
    .select("*, jogador:profiles!charges_profile_id_fkey(*)")
    .in("status", ["pending", "expired"])
    .order("created_at", { ascending: true })
    .limit(200);

  const cobrancas = (data ?? []) as unknown as CobrancaComJogador[];
  const total = cobrancas.reduce((soma, c) => soma + c.amount_cents, 0);

  const porJogador = new Map<string, { jogador: Profile; cobrancas: CobrancaComJogador[]; total: number }>();
  for (const cobranca of cobrancas) {
    const atual = porJogador.get(cobranca.profile_id) ?? {
      jogador: cobranca.jogador,
      cobrancas: [],
      total: 0,
    };
    atual.cobrancas.push(cobranca);
    atual.total += cobranca.amount_cents;
    porJogador.set(cobranca.profile_id, atual);
  }

  const devedores = [...porJogador.values()].sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <Cartao destaque className="text-center">
        <p className="text-[11px] uppercase tracking-[0.25em] text-cinza">A receber</p>
        <p className="titulo-display mt-1 text-4xl texto-ouro">{formatarDinheiro(total)}</p>
        <p className="mt-1 text-xs text-cinza">
          {devedores.length === 0
            ? "Ninguém devendo. Grupo em dia."
            : `${devedores.length} jogador(es) com pendência`}
        </p>
      </Cartao>

      {devedores.length === 0 ? (
        <EstadoVazio icone="💰" titulo="Nenhuma cobrança em aberto" descricao="Todo mundo está em dia." />
      ) : (
        devedores.map(({ jogador, cobrancas: doJogador, total: totalDoJogador }) => (
          <Cartao key={jogador.id}>
            <div className="mb-3 flex items-center gap-3">
              <Avatar nome={jogador.full_name} fotoUrl={jogador.photo_url} tamanho="sm" />
              <p className="min-w-0 flex-1 truncate font-semibold">{jogador.full_name}</p>
              <p className="titulo-display text-lg text-vermelho">{formatarDinheiro(totalDoJogador)}</p>
            </div>

            <div className="flex flex-col gap-2">
              {doJogador.map((cobranca) => (
                <CartaoDePagamento
                  key={cobranca.id}
                  cobranca={cobranca}
                  acao={<AcoesDaCobranca cobrancaId={cobranca.id} />}
                />
              ))}
            </div>
          </Cartao>
        ))
      )}
    </div>
  );
}
