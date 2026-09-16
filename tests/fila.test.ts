import { describe, expect, it } from "vitest";
import {
  convitesExpirados,
  filaElegivel,
  janelaDeAvulsosAberta,
  ordenarFila,
  posicaoNaFila,
  prazoParaAceitarVaga,
  promoverDaFila,
  resumirLista,
} from "@/domain/fila";
import { AGORA, criarParticipante, criarRodada, criarVarios, emHoras, PRAZOS_PADRAO } from "./ajudantes";

describe("ordem da fila", () => {
  it("coloca mensalista na frente de avulso mesmo quando o avulso confirmou antes", () => {
    const avulsoAntigo = criarParticipante({
      mensalista: false,
      situacao: "waiting",
      entrouEm: emHoras(AGORA, -48),
    });
    const mensalistaRecente = criarParticipante({
      situacao: "waiting",
      entrouEm: emHoras(AGORA, -1),
    });

    const fila = ordenarFila([avulsoAntigo, mensalistaRecente]);

    expect(fila[0]?.id).toBe(mensalistaRecente.id);
    expect(fila[1]?.id).toBe(avulsoAntigo.id);
  });

  it("dentro da mesma faixa, entra primeiro quem confirmou primeiro", () => {
    const primeiro = criarParticipante({ situacao: "waiting", entrouEm: emHoras(AGORA, -10) });
    const segundo = criarParticipante({ situacao: "waiting", entrouEm: emHoras(AGORA, -5) });

    const fila = ordenarFila([segundo, primeiro]);

    expect(fila.map((p) => p.id)).toEqual([primeiro.id, segundo.id]);
  });
});

describe("janela das 5 horas", () => {
  it("antes da janela, avulso nao e chamado nem com vaga sobrando", () => {
    const rodada = criarRodada({ capacidade: 20 });
    const participantes = [
      ...criarVarios(16, { situacao: "confirmed" }),
      ...criarVarios(4, { mensalista: false, situacao: "waiting" }),
    ];

    const elegiveis = filaElegivel(participantes, rodada, AGORA);
    expect(janelaDeAvulsosAberta(rodada, AGORA)).toBe(false);
    expect(elegiveis).toHaveLength(0);

    expect(promoverDaFila(participantes, rodada, AGORA, PRAZOS_PADRAO)).toHaveLength(0);
  });

  it("na janela, os avulsos ocupam as vagas que os mensalistas nao usaram", () => {
    const rodada = criarRodada({ capacidade: 20 });
    const participantes = [
      ...criarVarios(16, { situacao: "confirmed" }),
      ...criarVarios(4, { mensalista: false, situacao: "waiting" }),
    ];

    // Exemplo do documento: 20 vagas, 16 mensalistas, 4 avulsos esperando.
    const naJanela = new Date(rodada.avulsosLiberadosEm.getTime() + 60_000);
    const promocoes = promoverDaFila(participantes, rodada, naJanela, PRAZOS_PADRAO);

    expect(promocoes).toHaveLength(4);
    expect(promocoes.every((p) => p.participante.tipo === "casual")).toBe(true);
  });

  it("com a lista cheia de mensalistas, os avulsos continuam esperando", () => {
    const rodada = criarRodada({ capacidade: 20 });
    const participantes = [
      ...criarVarios(20, { situacao: "confirmed" }),
      ...criarVarios(4, { mensalista: false, situacao: "waiting" }),
    ];

    const naJanela = new Date(rodada.avulsosLiberadosEm.getTime() + 60_000);
    expect(promoverDaFila(participantes, rodada, naJanela, PRAZOS_PADRAO)).toHaveLength(0);
  });

  it("mensalista atrasado nao derruba avulso que ja esta confirmado", () => {
    const rodada = criarRodada({ capacidade: 20 });
    const naJanela = new Date(rodada.avulsosLiberadosEm.getTime() + 60_000);

    const participantes = [
      ...criarVarios(19, { situacao: "confirmed" }),
      criarParticipante({ mensalista: false, situacao: "confirmed", entrouEm: naJanela }),
      // Mensalista chega depois que a vaga ja foi ocupada.
      criarParticipante({ situacao: "waiting", entrouEm: new Date(naJanela.getTime() + 60_000) }),
    ];

    const promocoes = promoverDaFila(participantes, rodada, new Date(naJanela.getTime() + 120_000), PRAZOS_PADRAO);

    expect(promocoes).toHaveLength(0);
    expect(participantes.filter((p) => p.situacao === "confirmed")).toHaveLength(20);
  });
});

describe("prazo para aceitar a vaga", () => {
  it("dá o prazo cheio quando a vaga surge com bastante antecedencia", () => {
    const rodada = criarRodada({ comecaEm: emHoras(AGORA, 24) });
    const prazo = prazoParaAceitarVaga(rodada, AGORA, PRAZOS_PADRAO);

    expect(prazo.getTime() - AGORA.getTime()).toBe(90 * 60_000);
  });

  it("encurta o prazo quando falta pouco para a bola rolar", () => {
    const rodada = criarRodada({ comecaEm: emHoras(AGORA, 2.5) });
    const prazo = prazoParaAceitarVaga(rodada, AGORA, PRAZOS_PADRAO);

    expect(prazo.getTime() - AGORA.getTime()).toBe(30 * 60_000);
  });

  it("nunca promete prazo que termina depois do inicio do racha", () => {
    const rodada = criarRodada({ comecaEm: emHoras(AGORA, 0.25) });
    const prazo = prazoParaAceitarVaga(rodada, AGORA, PRAZOS_PADRAO);

    expect(prazo.getTime()).toBe(rodada.comecaEm.getTime());
  });
});

describe("convite de vaga", () => {
  it("quem nao responde no prazo perde a vez", () => {
    const expirado = criarParticipante({
      situacao: "invited",
      conviteExpiraEm: emHoras(AGORA, -0.5),
    });
    const noPrazo = criarParticipante({
      situacao: "invited",
      conviteExpiraEm: emHoras(AGORA, 0.5),
    });

    const vencidos = convitesExpirados([expirado, noPrazo], AGORA);

    expect(vencidos.map((p) => p.id)).toEqual([expirado.id]);
  });

  it("quem foi convidado segura a vaga ate o prazo acabar", () => {
    const rodada = criarRodada({ capacidade: 10 });
    const participantes = [
      ...criarVarios(9, { situacao: "confirmed" }),
      criarParticipante({ situacao: "invited", conviteExpiraEm: emHoras(AGORA, 1) }),
      criarParticipante({ situacao: "waiting" }),
    ];

    const resumo = resumirLista(participantes, rodada);

    expect(resumo.vagasLivres).toBe(0);
    expect(promoverDaFila(participantes, rodada, AGORA, PRAZOS_PADRAO)).toHaveLength(0);
  });
});

describe("posicao na fila", () => {
  it("informa a colocacao de quem esta esperando", () => {
    const primeiro = criarParticipante({ situacao: "waiting", entrouEm: emHoras(AGORA, -3) });
    const segundo = criarParticipante({
      mensalista: false,
      situacao: "waiting",
      entrouEm: emHoras(AGORA, -10),
    });

    expect(posicaoNaFila([primeiro, segundo], primeiro.profileId)).toBe(1);
    expect(posicaoNaFila([primeiro, segundo], segundo.profileId)).toBe(2);
  });

  it("devolve nulo para quem nao esta na espera", () => {
    const confirmado = criarParticipante({ situacao: "confirmed" });
    expect(posicaoNaFila([confirmado], confirmado.profileId)).toBeNull();
  });
});
