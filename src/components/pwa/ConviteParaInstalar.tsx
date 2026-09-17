"use client";

import { useEffect, useState } from "react";
import { Botao } from "@/components/ui/Botao";
import { Brasao } from "@/components/brand/Brasao";

/**
 * Convite para instalar o aplicativo na tela inicial.
 *
 * O Android avisa o site quando a instalação é possível; guardamos esse
 * aviso e mostramos um convite discreto. Quem dispensa não vê de novo
 * naquele aparelho.
 *
 * O convite só existe depois que o navegador avisa, então nada é renderizado
 * no servidor — e não há diferença entre o que o servidor manda e o que o
 * celular mostra.
 */

interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CHAVE_DISPENSADO = "canelada:convite-instalar-dispensado";

function foiDispensado(): boolean {
  try {
    return localStorage.getItem(CHAVE_DISPENSADO) === "1";
  } catch {
    // Navegador em modo privado pode bloquear o armazenamento.
    return false;
  }
}

export function ConviteParaInstalar() {
  const [evento, setEvento] = useState<EventoDeInstalacao | null>(null);

  useEffect(() => {
    const aoPoderInstalar = (e: Event) => {
      e.preventDefault();
      if (foiDispensado()) return;
      setEvento(e as EventoDeInstalacao);
    };

    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    return () => window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
  }, []);

  if (!evento) return null;

  const dispensar = () => {
    setEvento(null);
    try {
      localStorage.setItem(CHAVE_DISPENSADO, "1");
    } catch {
      // Sem armazenamento, o convite volta na próxima visita. Tudo bem.
    }
  };

  return (
    <div className="superficie flex items-center gap-3 border-ouro/30 p-3 animate-subir">
      <Brasao tamanho={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Instale o Canelada Santa</p>
        <p className="text-xs text-cinza-escuro">Abre como aplicativo, direto da tela inicial.</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Botao
          tamanho="sm"
          onClick={async () => {
            await evento.prompt();
            await evento.userChoice;
            dispensar();
          }}
        >
          Instalar
        </Botao>
        <Botao variante="fantasma" tamanho="sm" onClick={dispensar} aria-label="Dispensar convite">
          ✕
        </Botao>
      </div>
    </div>
  );
}
