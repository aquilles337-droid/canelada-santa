import type { Metadata } from "next";
import { Brasao } from "@/components/brand/Brasao";

export const metadata: Metadata = { title: "Sem conexão" };

/** Tela mostrada pelo service worker quando o celular está sem internet. */
export default function PaginaOffline() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Brasao tamanho={120} />
      <div>
        <h1 className="titulo-display text-2xl">Sem conexão</h1>
        <p className="mt-2 max-w-xs text-sm text-cinza">
          Você está sem internet agora. Assim que o sinal voltar, o aplicativo carrega tudo de novo.
        </p>
      </div>
      <p className="text-xs text-cinza-escuro">Canelada Santa</p>
    </main>
  );
}
