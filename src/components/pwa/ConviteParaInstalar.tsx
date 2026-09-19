"use client";

import { useEffect, useState } from "react";
import { Botao } from "@/components/ui/Botao";
import { Brasao } from "@/components/brand/Brasao";
import { detectarPlataforma, ehSafari, estaInstalado } from "@/lib/dispositivo";
import { useEstaNoCliente } from "./useEstaNoCliente";

/**
 * Convite para instalar o aplicativo.
 *
 * Nenhum navegador permite instalar à força — a instalação é sempre um gesto
 * da pessoa. O que dá para fazer é explicar bem o que ela ganha e mostrar o
 * caminho certo do aparelho dela: no Android existe botão, no iPhone só o
 * menu Compartilhar do Safari.
 *
 * Quem adia volta a ver o convite depois de alguns dias — instalar é o que
 * faz o aviso de vaga chegar, então não é detalhe. Some de vez assim que o
 * aplicativo estiver instalado.
 */

interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CHAVE_ADIADO = "canelada:instalar-adiado-ate";
const DIAS_DE_ADIAMENTO = 3;

function estaAdiado(): boolean {
  try {
    const ate = localStorage.getItem(CHAVE_ADIADO);
    return ate !== null && Date.now() < Number(ate);
  } catch {
    return false;
  }
}

function adiar(): void {
  try {
    localStorage.setItem(CHAVE_ADIADO, String(Date.now() + DIAS_DE_ADIAMENTO * 86_400_000));
  } catch {
    // Sem armazenamento, o convite volta na próxima visita. Tudo bem.
  }
}

function PassoAPasso({ passos }: { passos: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {passos.map((passo, indice) => (
        <li key={indice} className="flex items-start gap-2.5 text-sm">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ouro text-[11px] font-bold text-carvao">
            {indice + 1}
          </span>
          <span className="text-osso/90">{passo}</span>
        </li>
      ))}
    </ol>
  );
}

export function ConviteParaInstalar() {
  const noCliente = useEstaNoCliente();
  const [eventoDoAndroid, setEventoDoAndroid] = useState<EventoDeInstalacao | null>(null);
  const [adiadoAgora, setAdiadoAgora] = useState(false);
  const [mostrandoPassos, setMostrandoPassos] = useState(false);

  useEffect(() => {
    const aoPoderInstalar = (e: Event) => {
      e.preventDefault();
      setEventoDoAndroid(e as EventoDeInstalacao);
    };

    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    return () => window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
  }, []);

  if (!noCliente) return null;
  if (estaInstalado()) return null;
  if (adiadoAgora || estaAdiado()) return null;

  const plataforma = detectarPlataforma();

  const dispensar = () => {
    adiar();
    setAdiadoAgora(true);
  };

  const instalarNoAndroid = async () => {
    if (!eventoDoAndroid) return;
    await eventoDoAndroid.prompt();
    await eventoDoAndroid.userChoice;
    dispensar();
  };

  return (
    <div className="superficie relative overflow-hidden border-ouro/40 p-4 animate-subir">
      <span aria-hidden className="faixa-diagonal pointer-events-none absolute inset-y-0 right-0 w-20 opacity-40" />

      <div className="relative flex items-start gap-3">
        <Brasao tamanho={52} />
        <div className="min-w-0 flex-1">
          <p className="titulo-display text-lg leading-tight">
            Instale o <span className="texto-ouro">Canelada Santa</span>
          </p>
          <p className="mt-1 text-sm text-cinza">
            É assim que o aviso de vaga chega no seu celular. Quem responde primeiro leva a vaga —
            e sem o aplicativo instalado, você fica sabendo por último.
          </p>
        </div>
      </div>

      <ul className="relative mt-3 flex flex-col gap-1 text-xs text-cinza-escuro">
        <li>⚡ Abre direto da tela inicial, sem digitar endereço</li>
        <li>🔔 Recebe aviso quando abre vaga e quando os times saem</li>
        <li>📶 Funciona mesmo com a internet ruim da quadra</li>
      </ul>

      {/* Android: o próprio navegador instala, é um toque. */}
      {plataforma === "android" && eventoDoAndroid && (
        <div className="relative mt-4 flex gap-2">
          <Botao tamanho="lg" larguraTotal onClick={instalarNoAndroid}>
            Instalar agora
          </Botao>
          <Botao variante="fantasma" tamanho="lg" onClick={dispensar}>
            Depois
          </Botao>
        </div>
      )}

      {/* Android sem o evento disponível: ensinamos pelo menu. */}
      {plataforma === "android" && !eventoDoAndroid && (
        <div className="relative mt-4 flex flex-col gap-3">
          <PassoAPasso
            passos={[
              <>
                Toque nos <strong>três pontinhos</strong> (⋮), no canto do navegador
              </>,
              <>
                Escolha <strong>Instalar aplicativo</strong> ou{" "}
                <strong>Adicionar à tela inicial</strong>
              </>,
              <>
                Confirme em <strong>Instalar</strong>
              </>,
            ]}
          />
          <Botao variante="fantasma" larguraTotal onClick={dispensar}>
            Já instalei
          </Botao>
        </div>
      )}

      {/* iPhone: não existe botão, só o menu Compartilhar do Safari. */}
      {plataforma === "ios" && (
        <div className="relative mt-4 flex flex-col gap-3">
          {!ehSafari() && (
            <p className="rounded-xl border border-ambar/40 bg-ambar/10 px-3 py-2 text-xs text-ambar">
              No iPhone, só o <strong>Safari</strong> instala. Abra este mesmo endereço no Safari e
              siga os passos.
            </p>
          )}

          <PassoAPasso
            passos={[
              <>
                Toque em <strong>Compartilhar</strong> <span aria-hidden>􀈂</span> — o quadradinho
                com a seta para cima, embaixo na tela
              </>,
              <>
                Role para baixo e escolha <strong>Adicionar à Tela de Início</strong>
              </>,
              <>
                Toque em <strong>Adicionar</strong>, no canto de cima
              </>,
            ]}
          />

          <p className="text-xs text-cinza-escuro">
            Pronto: o escudo do Canelada Santa aparece junto com seus outros aplicativos.
          </p>

          <Botao variante="fantasma" larguraTotal onClick={dispensar}>
            Já instalei
          </Botao>
        </div>
      )}

      {/* Computador: instalação existe, mas o importante é abrir no celular. */}
      {plataforma === "desktop" && (
        <div className="relative mt-4 flex flex-col gap-3">
          {mostrandoPassos ? (
            <PassoAPasso
              passos={[
                <>
                  Clique no ícone de <strong>instalar</strong> na barra de endereço (⊕ ou uma tela
                  com seta)
                </>,
                <>
                  Confirme em <strong>Instalar</strong>
                </>,
              ]}
            />
          ) : (
            <p className="text-sm text-cinza">
              O Canelada Santa foi feito para o celular. Abra este endereço no seu telefone para
              instalar.
            </p>
          )}

          <div className="flex gap-2">
            {eventoDoAndroid ? (
              <Botao larguraTotal onClick={instalarNoAndroid}>
                Instalar aqui
              </Botao>
            ) : (
              <Botao variante="escuro" larguraTotal onClick={() => setMostrandoPassos(true)}>
                Instalar no computador
              </Botao>
            )}
            <Botao variante="fantasma" onClick={dispensar}>
              Depois
            </Botao>
          </div>
        </div>
      )}
    </div>
  );
}
