import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import type { GoleiroDaRodada } from "@/server/services/times";

/**
 * Os goleiros da rodada.
 *
 * Ficam num cartão só deles porque é isso que eles são: goleiro é do GOL,
 * não de time. A linha gira na frente dele com o "quem ganha fica" — quando
 * o time perde, sai a linha e o goleiro continua ali, recebendo a próxima.
 */
export function CartaoDosGoleiros({ goleiros }: { goleiros: GoleiroDaRodada[] }) {
  if (goleiros.length === 0) {
    return (
      <Cartao>
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-2xl">
            🧤
          </span>
          <div>
            <h3 className="titulo-display text-base">Sem goleiro fixo</h3>
            <p className="text-xs text-cinza-escuro">
              Ninguém da lista está marcado como goleiro. Combinem quem pega cada gol.
            </p>
          </div>
        </div>
      </Cartao>
    );
  }

  const revezam = goleiros.length > 2;

  return (
    <Cartao className="relative overflow-hidden p-0">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-ouro" />

      <div className="flex items-center justify-between gap-3 border-b border-linha px-4 py-3 pl-5">
        <h3 className="titulo-display text-lg text-ouro">
          <span aria-hidden className="mr-1.5">
            🧤
          </span>
          {goleiros.length === 1 ? "Goleiro" : "Goleiros"}
        </h3>
        <Selo tom="neutro">{revezam ? "revezam" : "fixos no gol"}</Selo>
      </div>

      <ul className="flex flex-col divide-y divide-linha/60 px-4 py-1 pl-5">
        {goleiros.map((goleiro, indice) => (
          <li key={goleiro.participacaoId} className="flex items-center gap-2.5 py-2">
            <span aria-hidden className="text-sm">
              🧤
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{goleiro.nome}</span>
            {!revezam && (
              <span className="text-[11px] uppercase tracking-widest text-cinza-escuro">
                Gol {indice + 1}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="border-t border-linha px-4 py-2.5 pl-5 text-[11px] leading-relaxed text-cinza-escuro">
        {goleiros.length === 1
          ? "Só um goleiro na lista: um dos gols fica sem goleiro fixo. Combinem quem pega."
          : revezam
            ? "Dois em campo por vez, revezando a cada partida — entra sempre quem jogou menos. Quem continua não troca de gol."
            : "Cada um fica no seu gol a rodada toda. Quando o time perde, sai a linha e o goleiro fica para receber a próxima."}
      </p>
    </Cartao>
  );
}
