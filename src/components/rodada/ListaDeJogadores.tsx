import { Avatar } from "@/components/ui/Avatar";
import { Selo } from "@/components/ui/Selo";
import { EstadoVazio } from "@/components/ui/Estados";
import { formatarHora } from "@/lib/format";
import type { Profile, RoundParticipant } from "@/lib/supabase/tipos";

export interface LinhaDeJogador {
  participacao: RoundParticipant;
  perfil: Profile;
}

/**
 * Lista de quem esta dentro ou esperando. A numeracao ajuda o grupo a
 * conferir a lista do jeito que ja fazia no WhatsApp.
 */
export function ListaDeJogadores({
  jogadores,
  vazio,
  mostrarHorario = false,
  numerar = true,
}: {
  jogadores: LinhaDeJogador[];
  vazio: { titulo: string; descricao?: string; icone?: string };
  mostrarHorario?: boolean;
  numerar?: boolean;
}) {
  if (jogadores.length === 0) {
    return <EstadoVazio icone={vazio.icone ?? "⚽"} titulo={vazio.titulo} descricao={vazio.descricao} />;
  }

  return (
    <ol className="flex flex-col divide-y divide-linha">
      {jogadores.map(({ participacao, perfil }, indice) => (
        <li key={participacao.id} className="flex items-center gap-3 py-2.5">
          {numerar && (
            <span className="w-5 shrink-0 text-right text-xs font-bold text-cinza-escuro tabular-nums">
              {indice + 1}
            </span>
          )}
          <Avatar nome={perfil.full_name} fotoUrl={perfil.photo_url} tamanho="sm" goleiro={perfil.is_goalkeeper} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{perfil.nickname?.trim() || perfil.full_name}</p>
            {mostrarHorario && (
              <p className="text-[11px] text-cinza-escuro">
                Entrou às {formatarHora(participacao.joined_at)}
              </p>
            )}
          </div>
          {participacao.kind === "monthly" ? (
            <Selo tom="ouro">Mensalista</Selo>
          ) : (
            <Selo tom="neutro">Avulso</Selo>
          )}
        </li>
      ))}
    </ol>
  );
}
