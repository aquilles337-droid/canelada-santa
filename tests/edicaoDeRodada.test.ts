import { describe, expect, it } from "vitest";
import {
  avaliarEdicao,
  avaliarReabertura,
  type EdicaoDaRodada,
  type RodadaParaEditar,
} from "@/domain/edicaoDeRodada";

const AGORA = new Date("2026-03-10T12:00:00Z");
const COMECO = new Date("2026-03-14T23:00:00Z");
const FECHAMENTO = new Date("2026-03-14T18:00:00Z");

function rodada(ajustes: Partial<RodadaParaEditar> = {}): RodadaParaEditar {
  return {
    situacao: "open",
    capacidade: 20,
    vagasOcupadas: 14,
    comecaEm: COMECO,
    listaFechaEm: FECHAMENTO,
    local: "Arena do Carmo",
    ...ajustes,
  };
}

function edicao(ajustes: Partial<EdicaoDaRodada> = {}): EdicaoDaRodada {
  return {
    capacidade: 20,
    quantidadeDeTimes: 4,
    jogadoresPorTime: null,
    minutosPorPartida: 10,
    golsParaVencer: 2,
    comecaEm: COMECO,
    listaFechaEm: FECHAMENTO,
    local: "Arena do Carmo",
    ...ajustes,
  };
}

describe("edição de rodada", () => {
  it("aceita uma edição que não mexe em nada", () => {
    const veredito = avaliarEdicao(rodada(), edicao(), AGORA);
    expect(veredito.problemas).toEqual([]);
    expect(veredito.chamarFila).toBe(false);
    expect(veredito.avisarOGrupo).toBe(false);
  });

  it("aumentar as vagas manda chamar a fila", () => {
    const veredito = avaliarEdicao(rodada(), edicao({ capacidade: 24 }), AGORA);
    expect(veredito.problemas).toEqual([]);
    expect(veredito.chamarFila).toBe(true);
  });

  it("reduzir as vagas até o número de quem já tem vaga é permitido", () => {
    const veredito = avaliarEdicao(rodada({ vagasOcupadas: 14 }), edicao({ capacidade: 14 }), AGORA);
    expect(veredito.problemas).toEqual([]);
    expect(veredito.chamarFila).toBe(false);
  });

  it("reduzir abaixo de quem já tem vaga é recusado, dizendo quantos são", () => {
    const veredito = avaliarEdicao(rodada({ vagasOcupadas: 14 }), edicao({ capacidade: 12 }), AGORA);
    expect(veredito.problemas).toHaveLength(1);
    expect(veredito.problemas[0]).toContain("14");
    expect(veredito.problemas[0]).toContain("12");
  });

  it("quem foi chamado da fila conta como vaga ocupada", () => {
    // 10 confirmados + 2 chamados esperando resposta = 12 vagas presas.
    const veredito = avaliarEdicao(rodada({ vagasOcupadas: 12 }), edicao({ capacidade: 11 }), AGORA);
    expect(veredito.problemas[0]).toContain("12");
  });

  it("menos de duas vagas não é racha", () => {
    const veredito = avaliarEdicao(rodada({ vagasOcupadas: 0 }), edicao({ capacidade: 1 }), AGORA);
    expect(veredito.problemas[0]).toContain("pelo menos 2");
  });

  it("vaga quebrada é recusada", () => {
    const veredito = avaliarEdicao(rodada({ vagasOcupadas: 0 }), edicao({ capacidade: 12.5 }), AGORA);
    expect(veredito.problemas[0]).toContain("inteiro");
  });

  it("menos de dois times é recusado", () => {
    const veredito = avaliarEdicao(rodada(), edicao({ quantidadeDeTimes: 1 }), AGORA);
    expect(veredito.problemas[0]).toContain("2 times");
  });

  it("a lista não pode fechar depois do começo", () => {
    const veredito = avaliarEdicao(
      rodada(),
      edicao({ listaFechaEm: new Date(COMECO.getTime() + 3_600_000) }),
      AGORA,
    );
    expect(veredito.problemas[0]).toContain("fechar antes");
  });

  it("racha que ainda não começou não pode ser marcado para trás", () => {
    const passado = new Date(AGORA.getTime() - 3_600_000);
    const veredito = avaliarEdicao(
      rodada(),
      edicao({ comecaEm: passado, listaFechaEm: new Date(passado.getTime() - 3_600_000) }),
      AGORA,
    );
    expect(veredito.problemas[0]).toContain("futuro");
  });

  it("racha em andamento pode ter a data corrigida para trás", () => {
    const passado = new Date(AGORA.getTime() - 3_600_000);
    const veredito = avaliarEdicao(
      rodada({ situacao: "in_progress" }),
      edicao({ comecaEm: passado, listaFechaEm: new Date(passado.getTime() - 3_600_000) }),
      AGORA,
    );
    expect(veredito.problemas).toEqual([]);
  });

  it("racha encerrado não se edita, e nem adianta conferir o resto", () => {
    const veredito = avaliarEdicao(
      rodada({ situacao: "finished" }),
      edicao({ capacidade: 1, quantidadeDeTimes: 0 }),
      AGORA,
    );
    expect(veredito.problemas).toHaveLength(1);
    expect(veredito.problemas[0]).toContain("encerrado");
  });

  it("racha cancelado não se edita", () => {
    const veredito = avaliarEdicao(rodada({ situacao: "cancelled" }), edicao(), AGORA);
    expect(veredito.problemas[0]).toContain("cancelado");
  });

  it("mudar o horário avisa o grupo", () => {
    const veredito = avaliarEdicao(
      rodada(),
      edicao({ comecaEm: new Date(COMECO.getTime() + 3_600_000) }),
      AGORA,
    );
    expect(veredito.avisarOGrupo).toBe(true);
  });

  it("mudar o local avisa o grupo", () => {
    const veredito = avaliarEdicao(rodada(), edicao({ local: "Quadra da praça" }), AGORA);
    expect(veredito.avisarOGrupo).toBe(true);
  });

  it("rascunho não avisa ninguém: a lista nem abriu", () => {
    const veredito = avaliarEdicao(
      rodada({ situacao: "draft", vagasOcupadas: 0 }),
      edicao({ local: "Quadra da praça" }),
      AGORA,
    );
    expect(veredito.avisarOGrupo).toBe(false);
  });

  it("espaço a mais no nome do local não conta como mudança", () => {
    const veredito = avaliarEdicao(rodada(), edicao({ local: "  Arena do Carmo  " }), AGORA);
    expect(veredito.avisarOGrupo).toBe(false);
  });

  it("aumentar vaga com a edição inválida não chama a fila", () => {
    const veredito = avaliarEdicao(rodada(), edicao({ capacidade: 30, quantidadeDeTimes: 1 }), AGORA);
    expect(veredito.problemas).toHaveLength(1);
    expect(veredito.chamarFila).toBe(false);
  });
});

describe("reabrir a lista", () => {
  const rodada = (situacao: RodadaParaEditar["situacao"], comecaEm = COMECO) => ({
    situacao,
    comecaEm,
  });

  // O antes do racha: COMECO é 14/03 às 23h, AGORA é 10/03 ao meio-dia.
  const novoFechamento = new Date("2026-03-14T20:00:00Z");

  it("uma lista fechada volta a abrir", () => {
    expect(avaliarReabertura(rodada("closed"), novoFechamento, AGORA).problemas).toEqual([]);
  });

  it("lista já aberta não reabre", () => {
    const { problemas } = avaliarReabertura(rodada("open"), novoFechamento, AGORA);
    expect(problemas[0]).toContain("já está aberta");
  });

  it("rascunho manda usar Abrir lista", () => {
    const { problemas } = avaliarReabertura(rodada("draft"), novoFechamento, AGORA);
    expect(problemas[0]).toContain("Abrir lista");
  });

  it("racha em andamento não reabre a lista", () => {
    const { problemas } = avaliarReabertura(rodada("in_progress"), novoFechamento, AGORA);
    expect(problemas[0]).toContain("já começou");
  });

  it("racha encerrado não reabre", () => {
    expect(avaliarReabertura(rodada("finished"), novoFechamento, AGORA).problemas).toHaveLength(1);
  });

  it("racha cancelado não reabre", () => {
    expect(avaliarReabertura(rodada("cancelled"), novoFechamento, AGORA).problemas).toHaveLength(1);
  });

  // Reabrir com horário no passado não reabriria nada: a regra de entrada
  // recusa quem chega depois do fechamento, e a tarefa automática fecha a
  // rodada de novo no minuto seguinte.
  it("o novo fechamento no passado é recusado, com o motivo", () => {
    const passado = new Date(AGORA.getTime() - 60_000);
    const { problemas } = avaliarReabertura(rodada("closed"), passado, AGORA);
    expect(problemas[0]).toContain("fecha sozinha de novo");
  });

  it("o novo fechamento não pode ser depois do início do racha", () => {
    const depois = new Date(COMECO.getTime() + 60_000);
    const { problemas } = avaliarReabertura(rodada("closed"), depois, AGORA);
    expect(problemas[0]).toContain("fechar antes");
  });

  it("fechar exatamente na hora do início é permitido", () => {
    expect(avaliarReabertura(rodada("closed"), COMECO, AGORA).problemas).toEqual([]);
  });

  it("racha que já passou manda editar a data primeiro", () => {
    const jaPassou = new Date(AGORA.getTime() - 3_600_000);
    const { problemas } = avaliarReabertura(rodada("closed", jaPassou), novoFechamento, AGORA);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain("Editar racha");
  });
});
