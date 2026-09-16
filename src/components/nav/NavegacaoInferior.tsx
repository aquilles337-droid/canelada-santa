"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";
import {
  IconeBola,
  IconeCasa,
  IconeDinheiro,
  IconeEngrenagem,
  IconeJogadores,
  IconePerfil,
  IconeRanking,
} from "./Icones";

export interface ItemNavegacao {
  href: string;
  rotulo: string;
  Icone: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV_JOGADOR: ItemNavegacao[] = [
  { href: "/inicio", rotulo: "Início", Icone: IconeCasa },
  { href: "/racha", rotulo: "Racha", Icone: IconeBola },
  { href: "/ranking", rotulo: "Ranking", Icone: IconeRanking },
  { href: "/perfil", rotulo: "Perfil", Icone: IconePerfil },
];

export const NAV_ADMIN: ItemNavegacao[] = [
  { href: "/admin", rotulo: "Painel", Icone: IconeCasa },
  { href: "/admin/rodadas", rotulo: "Rachas", Icone: IconeBola },
  { href: "/admin/jogadores", rotulo: "Jogadores", Icone: IconeJogadores },
  { href: "/admin/pagamentos", rotulo: "Dinheiro", Icone: IconeDinheiro },
  { href: "/admin/configuracoes", rotulo: "Ajustes", Icone: IconeEngrenagem },
];

/**
 * Navegacao inferior fixa. O aplicativo e usado em pe, com uma mao — os
 * alvos de toque ocupam toda a altura da barra.
 */
export function NavegacaoInferior({
  itens,
  ehAdmin = false,
}: {
  itens: ItemNavegacao[];
  ehAdmin?: boolean;
}) {
  const caminho = usePathname();

  // O primeiro item so acende no caminho exato; os demais aceitam subrotas.
  const ativo = (href: string, indice: number) =>
    indice === 0 ? caminho === href : caminho === href || caminho.startsWith(`${href}/`);

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-linha",
        "bg-carvao/92 backdrop-blur-xl",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label={ehAdmin ? "Navegação do administrador" : "Navegação principal"}
    >
      <ul className="mx-auto flex max-w-lg">
        {itens.map((item, indice) => {
          const estaAtivo = ativo(item.href, indice);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={estaAtivo ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 transition-colors",
                  estaAtivo ? "text-ouro" : "text-cinza-escuro hover:text-cinza",
                )}
              >
                {estaAtivo && (
                  <span
                    aria-hidden
                    className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-linear-to-r from-transparent via-ouro to-transparent"
                  />
                )}
                <item.Icone className="size-6" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">{item.rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
