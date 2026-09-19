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

interface ItemNavegacao {
  href: string;
  rotulo: string;
  Icone: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * As listas vivem AQUI DENTRO, num módulo de cliente, e nunca são exportadas.
 *
 * Um componente de servidor que importe um valor de um módulo de cliente não
 * recebe o valor: recebe um marcador de referência. Era o que acontecia antes
 * — o layout fazia `[...NAV_JOGADOR]` e quebrava em produção com
 * "is not iterable", porque aquilo nunca foi um array de verdade.
 *
 * Agora a única coisa que atravessa a fronteira é um texto: a variante.
 */
const NAV_JOGADOR: ItemNavegacao[] = [
  { href: "/inicio", rotulo: "Início", Icone: IconeCasa },
  { href: "/racha", rotulo: "Racha", Icone: IconeBola },
  { href: "/ranking", rotulo: "Ranking", Icone: IconeRanking },
  { href: "/perfil", rotulo: "Perfil", Icone: IconePerfil },
];

const ITEM_ADMIN: ItemNavegacao = {
  href: "/admin",
  rotulo: "Admin",
  Icone: IconeEngrenagem,
};

const NAV_ADMIN: ItemNavegacao[] = [
  { href: "/admin", rotulo: "Painel", Icone: IconeCasa },
  { href: "/admin/rodadas", rotulo: "Rachas", Icone: IconeBola },
  { href: "/admin/jogadores", rotulo: "Jogadores", Icone: IconeJogadores },
  { href: "/admin/pagamentos", rotulo: "Dinheiro", Icone: IconeDinheiro },
  { href: "/admin/configuracoes", rotulo: "Ajustes", Icone: IconeEngrenagem },
];

/**
 * Qual barra mostrar:
 *
 * - `jogador`       — as quatro abas de sempre
 * - `jogador-admin` — as mesmas quatro, mais o atalho para o painel
 * - `admin`         — a barra do painel administrativo
 */
export type VarianteDeNavegacao = "jogador" | "jogador-admin" | "admin";

const POR_VARIANTE: Record<VarianteDeNavegacao, ItemNavegacao[]> = {
  jogador: NAV_JOGADOR,
  "jogador-admin": [...NAV_JOGADOR, ITEM_ADMIN],
  admin: NAV_ADMIN,
};

/**
 * Navegacao inferior fixa. O aplicativo e usado em pe, com uma mao — os
 * alvos de toque ocupam toda a altura da barra.
 */
export function NavegacaoInferior({ variante }: { variante: VarianteDeNavegacao }) {
  const caminho = usePathname();
  const itens = POR_VARIANTE[variante];
  const ehAdmin = variante === "admin";

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
