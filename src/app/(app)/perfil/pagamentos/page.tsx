import type { Metadata } from "next";
import { exigirUsuario } from "@/server/auth/sessao";
import { cobrancasEmAberto, historicoDeCobrancas } from "@/server/services/cobrancas";
import { mensalidadesDoJogador } from "@/server/services/mensalidades";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { EstadoVazio } from "@/components/ui/Estados";
import { CartaoDePagamento } from "@/components/financeiro/CartaoDePagamento";
import { PagarComPix } from "@/components/financeiro/PagarComPix";
import { Selo } from "@/components/ui/Selo";
import { formatarDinheiro, mesAno } from "@/lib/format";

export const metadata: Metadata = { title: "Meus pagamentos" };

export default async function PaginaMeusPagamentos() {
  const perfil = await exigirUsuario();

  const [emAberto, historico, mensalidades] = await Promise.all([
    cobrancasEmAberto(perfil.id),
    historicoDeCobrancas(perfil.id),
    mensalidadesDoJogador(perfil.id, 12),
  ]);

  const total = emAberto.reduce((soma, c) => soma + c.amount_cents, 0);
  const pagas = historico.filter((c) => c.status === "paid");

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <Cartao destaque={total > 0} className="text-center">
        <p className="text-[11px] uppercase tracking-[0.25em] text-cinza">Em aberto</p>
        <p className={`titulo-display mt-1 text-4xl ${total > 0 ? "text-vermelho" : "texto-ouro"}`}>
          {formatarDinheiro(total)}
        </p>
        <p className="mt-1 text-xs text-cinza">
          {total > 0
            ? "Enquanto houver pagamento em aberto, você não entra em racha novo."
            : "Tudo em dia. Bom jogo! ⚽"}
        </p>
      </Cartao>

      {emAberto.length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo={`A pagar (${emAberto.length})`} />
          <div className="flex flex-col gap-3">
            {emAberto.map((cobranca) => (
              <CartaoDePagamento
                key={cobranca.id}
                cobranca={cobranca}
                rodape={<PagarComPix cobrancaId={cobranca.id} />}
              />
            ))}
          </div>
        </Cartao>
      )}

      {perfil.is_member && (
        <Cartao>
          <CabecalhoCartao titulo="Minhas mensalidades" icone={<span aria-hidden>📅</span>} />
          {mensalidades.length === 0 ? (
            <EstadoVazio icone="📅" titulo="Nenhuma mensalidade gerada ainda" />
          ) : (
            <ul className="flex flex-col divide-y divide-linha">
              {mensalidades.map((mensalidade) => (
                <li key={mensalidade.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">
                      {mesAno(`${mensalidade.competence}T12:00:00.000Z`)}
                    </p>
                    <p className="text-[11px] text-cinza-escuro">
                      {formatarDinheiro(mensalidade.amount_cents)}
                    </p>
                  </div>
                  <Selo
                    tom={
                      mensalidade.status === "paid"
                        ? "verde"
                        : mensalidade.status === "overdue"
                          ? "vermelho"
                          : mensalidade.status === "waived"
                            ? "neutro"
                            : "ambar"
                    }
                  >
                    {mensalidade.status === "paid"
                      ? "Paga"
                      : mensalidade.status === "overdue"
                        ? "Vencida"
                        : mensalidade.status === "waived"
                          ? "Perdoada"
                          : "Em aberto"}
                  </Selo>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      )}

      <Cartao>
        <CabecalhoCartao titulo="Histórico" />
        {pagas.length === 0 ? (
          <EstadoVazio icone="🧾" titulo="Nenhum pagamento ainda" />
        ) : (
          <div className="flex flex-col gap-2">
            {pagas.map((cobranca) => (
              <CartaoDePagamento key={cobranca.id} cobranca={cobranca} />
            ))}
          </div>
        )}
      </Cartao>
    </div>
  );
}
