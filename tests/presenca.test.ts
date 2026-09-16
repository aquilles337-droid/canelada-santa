import { describe, expect, it } from "vitest";
import {
  avaliarCancelamento,
  avaliarFalta,
  calcularMulta,
  debitosQueBloqueiam,
  destinoAoEntrar,
  limiteParaCancelarSemMulta,
  podeCancelarSemMulta,
  podeEntrarNaRodada,
  totalDeDebitos,
  vagasLivres,
  type DebitoEmAberto,
} from "@/domain/presenca";
import { AGORA, criarParticipante, criarRodada, criarVarios, emHoras } from "./ajudantes";

function contexto(sobrescrever: Partial<Parameters<typeof podeEntrarNaRodada>[0]> = {}) {
  return {
    rodada: criarRodada(),
    situacaoDoJogador: "active" as const,
    ehMensalista: true,
    participacaoAtual: null,
    debitos: [] as DebitoEmAberto[],
    bloquearPorDebito: true,
    agora: AGORA,
    ...sobrescrever,
  };
}

describe("quem pode entrar na rodada", () => {
  it("deixa entrar um jogador ativo com a lista aberta", () => {
    expect(podeEntrarNaRodada(contexto()).permitido).toBe(true);
  });

  it("recusa depois que a lista fecha", () => {
    const rodada = criarRodada();
    const depoisDoFechamento = new Date(rodada.listaFechaEm.getTime() + 60_000);

    const veredito = podeEntrarNaRodada(contexto({ agora: depoisDoFechamento }));

    expect(veredito.permitido).toBe(false);
    expect(veredito.motivo).toContain("lista");
  });

  it("recusa jogador banido e jogador suspenso", () => {
    expect(podeEntrarNaRodada(contexto({ situacaoDoJogador: "banned" })).permitido).toBe(false);
    expect(podeEntrarNaRodada(contexto({ situacaoDoJogador: "suspended" })).permitido).toBe(false);
  });

  it("recusa quem ja esta na lista", () => {
    const veredito = podeEntrarNaRodada(
      contexto({ participacaoAtual: criarParticipante({ situacao: "waiting" }) }),
    );

    expect(veredito.permitido).toBe(false);
    expect(veredito.motivo).toContain("já está");
  });

  it("deixa entrar de novo quem tinha desistido", () => {
    const veredito = podeEntrarNaRodada(
      contexto({ participacaoAtual: criarParticipante({ situacao: "cancelled" }) }),
    );

    expect(veredito.permitido).toBe(true);
  });
});

describe("bloqueio por debito", () => {
  const debitoAntigo: DebitoEmAberto = {
    id: "c-1",
    tipo: "match",
    situacao: "pending",
    valorCentavos: 1000,
    rodadaId: "rodada-anterior",
    descricao: "Avulso do racha passado",
  };

  it("barra quem tem cobranca em aberto de rodada anterior", () => {
    const veredito = podeEntrarNaRodada(contexto({ debitos: [debitoAntigo] }));

    expect(veredito.permitido).toBe(false);
    expect(veredito.motivo).toContain("pagamento em aberto");
  });

  it("barra quem tem mensalidade vencida", () => {
    const mensalidade: DebitoEmAberto = {
      id: "c-2",
      tipo: "monthly",
      situacao: "pending",
      valorCentavos: 2500,
      rodadaId: null,
      descricao: "Mensalidade de setembro",
    };

    expect(podeEntrarNaRodada(contexto({ debitos: [mensalidade] })).permitido).toBe(false);
  });

  it("nao barra pela cobranca gerada pela propria rodada em que esta entrando", () => {
    const daRodadaAtual: DebitoEmAberto = { ...debitoAntigo, id: "c-3", rodadaId: "rodada-1" };

    expect(debitosQueBloqueiam([daRodadaAtual], "rodada-1")).toHaveLength(0);
    expect(podeEntrarNaRodada(contexto({ debitos: [daRodadaAtual] })).permitido).toBe(true);
  });

  it("ignora cobranca ja paga ou perdoada", () => {
    const paga: DebitoEmAberto = { ...debitoAntigo, id: "c-4", situacao: "paid" };
    const perdoada: DebitoEmAberto = { ...debitoAntigo, id: "c-5", situacao: "waived" };

    expect(debitosQueBloqueiam([paga, perdoada], "rodada-1")).toHaveLength(0);
  });

  it("nao barra ninguem quando o bloqueio por debito esta desligado", () => {
    const veredito = podeEntrarNaRodada(contexto({ debitos: [debitoAntigo], bloquearPorDebito: false }));

    expect(veredito.permitido).toBe(true);
  });

  it("soma os debitos em aberto", () => {
    expect(totalDeDebitos([debitoAntigo, { ...debitoAntigo, id: "c-6", valorCentavos: 1500 }])).toBe(2500);
  });
});

describe("destino ao confirmar presenca", () => {
  const rodada = criarRodada();

  it("mensalista ocupa a vaga na hora", () => {
    expect(destinoAoEntrar({ ehMensalista: true, vagasLivres: 3, rodada, agora: AGORA })).toBe("confirmed");
  });

  it("avulso espera enquanto a janela das 5 horas nao abre, mesmo com vaga", () => {
    expect(destinoAoEntrar({ ehMensalista: false, vagasLivres: 5, rodada, agora: AGORA })).toBe("waiting");
  });

  it("avulso entra direto depois da janela, se houver vaga", () => {
    const naJanela = new Date(rodada.avulsosLiberadosEm.getTime() + 60_000);
    expect(destinoAoEntrar({ ehMensalista: false, vagasLivres: 2, rodada, agora: naJanela })).toBe("confirmed");
  });

  it("mensalista tambem espera quando a lista esta cheia", () => {
    expect(destinoAoEntrar({ ehMensalista: true, vagasLivres: 0, rodada, agora: AGORA })).toBe("waiting");
  });
});

describe("vagas livres", () => {
  it("conta confirmados e convidados da fila como vaga ocupada", () => {
    const participantes = [
      ...criarVarios(8, { situacao: "confirmed" }),
      criarParticipante({ situacao: "invited", conviteExpiraEm: emHoras(AGORA, 1) }),
      criarParticipante({ situacao: "waiting" }),
      criarParticipante({ situacao: "cancelled" }),
    ];

    expect(vagasLivres(10, participantes)).toBe(1);
  });
});

describe("cancelamento e multas", () => {
  const rodada = criarRodada({ comecaEm: emHoras(AGORA, 10) });

  it("sem multa quando cancela dentro do prazo", () => {
    const confirmado = criarParticipante({ situacao: "confirmed" });
    const resultado = avaliarCancelamento(rodada, confirmado, AGORA);

    expect(podeCancelarSemMulta(rodada, AGORA)).toBe(true);
    expect(resultado.geraMulta).toBe(false);
    expect(resultado.valorCentavos).toBe(0);
  });

  it("gera multa quando cancela dentro das 2 horas finais", () => {
    const emCima = new Date(limiteParaCancelarSemMulta(rodada).getTime() + 60_000);
    const confirmado = criarParticipante({ situacao: "confirmed" });

    const resultado = avaliarCancelamento(rodada, confirmado, emCima);

    expect(resultado.geraMulta).toBe(true);
    expect(resultado.valorCentavos).toBe(1000);
  });

  it("nao multa quem estava apenas na espera", () => {
    const emCima = new Date(limiteParaCancelarSemMulta(rodada).getTime() + 60_000);
    const esperando = criarParticipante({ situacao: "waiting" });

    expect(avaliarCancelamento(rodada, esperando, emCima).geraMulta).toBe(false);
  });

  it("falta sem aviso custa o multiplicador configurado sobre a multa tardia", () => {
    expect(calcularMulta(rodada, "late_cancel")).toBe(1000);
    expect(calcularMulta(rodada, "no_show")).toBe(1500);
  });

  it("falta justificada nao gera multa", () => {
    expect(avaliarFalta(rodada, true)).toEqual({ geraMulta: false, valorCentavos: 0 });
  });

  it("falta sem justificativa gera a multa maior", () => {
    expect(avaliarFalta(rodada, false)).toEqual({ geraMulta: true, valorCentavos: 1500 });
  });

  it("usa os valores da rodada, nao os valores atuais das configuracoes", () => {
    // Rodada antiga criada quando a multa era R$ 20 e o multiplicador 2x.
    const rodadaAntiga = criarRodada({
      regrasDeMulta: { late_cancel_fine_cents: 2000, no_show_multiplier: 2, cancel_deadline_hours: 3 },
    });

    expect(calcularMulta(rodadaAntiga, "late_cancel")).toBe(2000);
    expect(calcularMulta(rodadaAntiga, "no_show")).toBe(4000);
  });
});
