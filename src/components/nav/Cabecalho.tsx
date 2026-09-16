import Link from "next/link";
import { Brasao } from "@/components/brand/Brasao";
import { Avatar } from "@/components/ui/Avatar";
import type { Profile } from "@/lib/supabase/tipos";
import { cn } from "@/lib/utils";

/**
 * Cabecalho do aplicativo: brasao a esquerda, atalho para o perfil a
 * direita. A faixa diagonal dourada amarra a interface ao escudo.
 */
export function Cabecalho({
  perfil,
  titulo,
  className,
}: {
  perfil: Profile;
  titulo?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-linha bg-carvao/92 backdrop-blur-xl",
        className,
      )}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="relative mx-auto flex max-w-lg items-center gap-3 px-4 py-2.5">
        <span aria-hidden className="faixa-diagonal absolute inset-y-0 right-0 w-20 opacity-40" />

        <Link href="/inicio" className="flex items-center gap-2.5" aria-label="Início">
          <Brasao tamanho={38} prioridade />
          <span className="titulo-display text-base leading-none">
            {titulo ?? (
              <>
                Canelada
                <span className="texto-ouro"> Santa</span>
              </>
            )}
          </span>
        </Link>

        <Link href="/perfil" className="relative z-10 ml-auto" aria-label="Meu perfil">
          <Avatar nome={perfil.full_name} fotoUrl={perfil.photo_url} tamanho="sm" goleiro={perfil.is_goalkeeper} />
        </Link>
      </div>
    </header>
  );
}
