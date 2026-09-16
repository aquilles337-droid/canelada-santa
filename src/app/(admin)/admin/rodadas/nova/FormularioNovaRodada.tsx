"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { criarRodadaAction } from "@/server/actions/rodadas";
import { Botao } from "@/components/ui/Botao";
import { Campo, AreaTexto } from "@/components/ui/Campo";
import { Cartao } from "@/components/ui/Cartao";
import { useToast } from "@/components/ui/Toast";
import { formatarDinheiro } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PadroesDoFormulario {
  vagas: number;
  times: number;
  minutos: number;
  gols: number;
  horasParaFechar: number;
  valorAvulsoCentavos: number;
}

const PASSOS = ["Quando", "Onde", "Vagas", "Formato", "Regras", "Confirmar"] as const;

/**
 * Criacao de rodada em passos.
 *
 * O administrador nao precisa entender nada de tecnologia: ele responde uma
 * pergunta por vez e ve um resumo antes de salvar.
 */
export function FormularioNovaRodada({ padroes }: { padroes: PadroesDoFormulario }) {
  const router = useRouter();
  const toast = useToast();
  const [passo, setPasso] = useState(0);
  const [estado, acao, enviando] = useActionState(criarRodadaAction, null);

  const [data, setData] = useState("");
  const [hora, setHora] = useState("20:00");
  const [local, setLocal] = useState("");
  const [endereco, setEndereco] = useState("");
  const [titulo, setTitulo] = useState("");
  const [vagas, setVagas] = useState(String(padroes.vagas));
  const [times, setTimes] = useState(String(padroes.times));
  const [jogadoresPorTime, setJogadoresPorTime] = useState("");
  const [minutos, setMinutos] = useState(String(padroes.minutos));
  const [gols, setGols] = useState(String(padroes.gols));
  const [valorAvulso, setValorAvulso] = useState(
    (padroes.valorAvulsoCentavos / 100).toFixed(2).replace(".", ","),
  );
  const [regras, setRegras] = useState("");

  // Por padrao a lista fecha o mesmo tanto de horas antes que o grupo
  // configurou; o administrador pode mudar no passo do formato.
  const fechamento = useMemo(() => {
    if (!data || !hora) return { data: "", hora: "" };

    const [ano, mes, dia] = data.split("-").map(Number);
    const [h, m] = hora.split(":").map(Number);
    const inicio = new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1, h ?? 0, m ?? 0);
    const alvo = new Date(inicio.getTime() - padroes.horasParaFechar * 3_600_000);

    const dois = (n: number) => String(n).padStart(2, "0");
    return {
      data: `${alvo.getFullYear()}-${dois(alvo.getMonth() + 1)}-${dois(alvo.getDate())}`,
      hora: `${dois(alvo.getHours())}:${dois(alvo.getMinutes())}`,
    };
  }, [data, hora, padroes.horasParaFechar]);

  // Enquanto o administrador nao mexer, o fechamento acompanha a data do
  // racha. Assim que ele edita, o valor escolhido passa a mandar.
  const [fechamentoEditado, setFechamentoEditado] = useState<{ data: string; hora: string } | null>(null);
  const fechamentoData = fechamentoEditado?.data ?? fechamento.data;
  const fechamentoHora = fechamentoEditado?.hora ?? fechamento.hora;

  const editarFechamento = (campo: "data" | "hora", valor: string) =>
    setFechamentoEditado({ data: fechamentoData, hora: fechamentoHora, [campo]: valor });

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      toast.sucesso("Racha criado! A lista já está aberta.");
      router.push(`/admin/rodadas/${estado.dados.id}`);
      router.refresh();
    } else {
      toast.erro(estado.mensagem);
    }
  }, [estado, router, toast]);

  const podeAvancar = (() => {
    switch (passo) {
      case 0:
        return Boolean(data && hora);
      case 1:
        return local.trim().length >= 2;
      case 2:
        return Number(vagas) >= 2 && Number(times) >= 2;
      case 3:
        return Number(minutos) >= 1 && Number(gols) >= 1 && Boolean(fechamentoData && fechamentoHora);
      default:
        return true;
    }
  })();

  const dataLegivel = data ? data.split("-").reverse().join("/") : "—";
  const fechamentoLegivel = fechamentoData ? fechamentoData.split("-").reverse().join("/") : "—";

  return (
    <form action={acao} className="flex flex-col gap-4">
      {/* Campos preservados entre os passos */}
      <input type="hidden" name="titulo" value={titulo} />
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="hora" value={hora} />
      <input type="hidden" name="local" value={local} />
      <input type="hidden" name="endereco" value={endereco} />
      <input type="hidden" name="vagas" value={vagas} />
      <input type="hidden" name="times" value={times} />
      <input type="hidden" name="jogadoresPorTime" value={jogadoresPorTime} />
      <input type="hidden" name="minutos" value={minutos} />
      <input type="hidden" name="gols" value={gols} />
      <input type="hidden" name="fechamentoData" value={fechamentoData} />
      <input type="hidden" name="fechamentoHora" value={fechamentoHora} />
      <input type="hidden" name="valorAvulso" value={valorAvulso} />
      <input type="hidden" name="regras" value={regras} />

      <ol className="flex items-center gap-1.5" aria-label="Etapas">
        {PASSOS.map((nome, indice) => (
          <li
            key={nome}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              indice <= passo ? "bg-ouro" : "bg-elevado",
            )}
            aria-current={indice === passo ? "step" : undefined}
          >
            <span className="sr-only">{nome}</span>
          </li>
        ))}
      </ol>

      <Cartao>
        <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-cinza">
          Passo {passo + 1} de {PASSOS.length} · {PASSOS[passo]}
        </p>

        {passo === 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="titulo-display text-lg">Quando vai ser?</h2>
            <Campo type="date" rotulo="Data" value={data} onChange={(e) => setData(e.target.value)} required />
            <Campo type="time" rotulo="Horário" value={hora} onChange={(e) => setHora(e.target.value)} required />
            <Campo
              rotulo="Nome do racha"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Deixe vazio para numerar automaticamente"
              ajuda="Opcional"
            />
          </div>
        )}

        {passo === 1 && (
          <div className="flex flex-col gap-3">
            <h2 className="titulo-display text-lg">Onde vai ser?</h2>
            <Campo
              rotulo="Local"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Arena Nossa Senhora do Carmo"
              required
            />
            <Campo
              rotulo="Endereço"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, número, bairro"
              ajuda="Opcional"
            />
          </div>
        )}

        {passo === 2 && (
          <div className="flex flex-col gap-3">
            <h2 className="titulo-display text-lg">Quantas vagas?</h2>
            <Campo
              type="number"
              rotulo="Vagas"
              min={2}
              value={vagas}
              onChange={(e) => setVagas(e.target.value)}
              required
            />
            <Campo
              type="number"
              rotulo="Times"
              min={2}
              value={times}
              onChange={(e) => setTimes(e.target.value)}
              required
            />
            <Campo
              type="number"
              rotulo="Jogadores por time"
              min={1}
              value={jogadoresPorTime}
              onChange={(e) => setJogadoresPorTime(e.target.value)}
              ajuda="Opcional — se vazio, o sistema divide igualmente"
            />
          </div>
        )}

        {passo === 3 && (
          <div className="flex flex-col gap-3">
            <h2 className="titulo-display text-lg">Como se joga?</h2>
            <div className="grid grid-cols-2 gap-3">
              <Campo
                type="number"
                rotulo="Minutos"
                min={1}
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
                required
              />
              <Campo
                type="number"
                rotulo="Gols p/ vencer"
                min={1}
                value={gols}
                onChange={(e) => setGols(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo
                type="date"
                rotulo="Lista fecha em"
                value={fechamentoData}
                onChange={(e) => editarFechamento("data", e.target.value)}
                required
              />
              <Campo
                type="time"
                rotulo="Às"
                value={fechamentoHora}
                onChange={(e) => editarFechamento("hora", e.target.value)}
                required
              />
            </div>
            <Campo
              rotulo="Valor do avulso"
              value={valorAvulso}
              onChange={(e) => setValorAvulso(e.target.value)}
              prefixo="R$"
              inputMode="decimal"
              ajuda="Vale só para este racha"
            />
          </div>
        )}

        {passo === 4 && (
          <div className="flex flex-col gap-3">
            <h2 className="titulo-display text-lg">Alguma regra específica?</h2>
            <AreaTexto
              rotulo="Regras do racha"
              value={regras}
              onChange={(e) => setRegras(e.target.value)}
              placeholder="Ex.: sem carrinho, chegou depois das 20h entra no próximo jogo…"
              ajuda="Opcional — aparece na página do racha"
              rows={5}
            />
          </div>
        )}

        {passo === 5 && (
          <div className="flex flex-col gap-3">
            <h2 className="titulo-display text-lg">Confira antes de abrir</h2>
            <dl className="flex flex-col gap-2 text-sm">
              {[
                ["Racha", titulo.trim() || "Numeração automática"],
                ["Data", `${dataLegivel} às ${hora}`],
                ["Local", local || "—"],
                ["Endereço", endereco || "—"],
                ["Vagas", vagas],
                ["Times", times],
                ["Jogadores por time", jogadoresPorTime || "Divisão automática"],
                ["Partida", `${minutos} min · ${gols} gol(s) para vencer`],
                ["Lista fecha", `${fechamentoLegivel} às ${fechamentoHora}`],
                ["Avulso", formatarDinheiro(Math.round(Number(valorAvulso.replace(",", ".")) * 100) || 0)],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="flex justify-between gap-3 border-b border-linha pb-1.5">
                  <dt className="text-cinza">{rotulo}</dt>
                  <dd className="text-right">{valor}</dd>
                </div>
              ))}
            </dl>

            {regras.trim() && (
              <div className="rounded-xl border border-linha bg-carvao/50 p-3">
                <p className="mb-1 text-[11px] uppercase tracking-widest text-cinza">Regras</p>
                <p className="whitespace-pre-line text-sm text-osso/90">{regras}</p>
              </div>
            )}

            <p className="text-xs text-cinza-escuro">
              Ao confirmar, a lista abre e todo mundo do grupo recebe um aviso.
            </p>
          </div>
        )}
      </Cartao>

      <div className="flex gap-2">
        {passo > 0 && (
          <Botao type="button" variante="escuro" onClick={() => setPasso((p) => p - 1)}>
            Voltar
          </Botao>
        )}

        {passo < PASSOS.length - 1 ? (
          <Botao
            type="button"
            larguraTotal
            disabled={!podeAvancar}
            onClick={() => setPasso((p) => p + 1)}
          >
            Continuar
          </Botao>
        ) : (
          <Botao type="submit" larguraTotal tamanho="lg" carregando={enviando}>
            Abrir o racha
          </Botao>
        )}
      </div>
    </form>
  );
}
