/**
 * Geração equilibrada de times.
 *
 * O GOLEIRO É DO GOL, NÃO DO TIME. Ele não entra em time nenhum: fica no
 * gol e a linha é que gira na frente dele com o "quem ganha fica". Com dois
 * goleiros, cada um pega um gol e passa a noite ali; com três ou mais, eles
 * se revezam entre as partidas (a regra do revezamento está em
 * src/domain/goleiros.ts).
 *
 * É isso que faz 18 jogadores com 2 goleiros virarem 4 times de 4 em vez de
 * 5 + 5 + 4 + 4: só os 16 de linha entram na divisão.
 *
 * Prioridade das regras da linha, na ordem que o grupo definiu:
 *
 *   1. equilíbrio das forças
 *   2. quantidade de jogadores por time
 *   3. variedade de companheiros em relação às rodadas anteriores
 *
 * Peso e altura são guardados e entram como sinal de desempate com peso
 * mínimo. Eles NÃO são tratados como habilidade: um jogador não fica melhor
 * por ser mais alto.
 *
 * O resultado é determinístico dada a semente — "GERAR NOVAMENTE" usa outra
 * semente e chega a um arranjo diferente, igualmente equilibrado.
 */

import { embaralhar, geradorAleatorio } from "@/lib/utils";
import type { PesosDeTime } from "@/lib/supabase/tipos";

export interface JogadorParaSorteio {
  /** Identificador da participação (jogador) ou do convidado. */
  id: string;
  nome: string;
  /** Nota de 0 a 10 já consolidada. */
  nota: number;
  ehGoleiro: boolean;
  pesoKg: number | null;
  alturaCm: number | null;
  ehConvidado: boolean;
}

/** Um time é só a linha: o goleiro fica no gol, fora de qualquer time. */
export interface TimeGerado {
  indice: number;
  linha: JogadorParaSorteio[];
  somaDeNotas: number;
}

export interface ResultadoDoSorteio {
  times: TimeGerado[];
  /**
   * Os goleiros da rodada, do mais bem avaliado para o menos. Não pertencem
   * a time nenhum: a ordem aqui é a ordem em que eles entram no gol.
   */
  goleiros: JogadorParaSorteio[];
  custo: number;
  avisos: string[];
}

export interface EntradaDoSorteio {
  jogadores: JogadorParaSorteio[];
  quantidadeDeTimes: number;
  pesos: PesosDeTime;
  /** Quantas vezes cada dupla já jogou junta nas últimas rodadas. */
  historicoDeDuplas?: Map<string, number>;
  semente: number;
  /** Quantos arranjos diferentes tentar antes de escolher o melhor. */
  tentativas?: number;
}

/** Chave estável de uma dupla, independente da ordem. */
export function chaveDaDupla(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

function variancia(valores: number[]): number {
  if (valores.length <= 1) return 0;
  const m = media(valores);
  return media(valores.map((v) => (v - m) ** 2));
}

function recalcularSoma(time: TimeGerado): void {
  time.somaDeNotas = time.linha.reduce((soma, j) => soma + j.nota, 0);
}

/**
 * Custo de um arranjo. Quanto menor, melhor.
 *
 * Cada parcela mede uma coisa só, e o peso define o quanto ela importa —
 * é assim que a ordem de prioridade do grupo vira número.
 */
export function custoDoArranjo(
  times: TimeGerado[],
  pesos: PesosDeTime,
  historicoDeDuplas: Map<string, number>,
): number {
  const somas = times.map((t) => t.somaDeNotas);
  const tamanhos = times.map((t) => t.linha.length);

  // 1. Equilíbrio: a diferença entre as forças dos times.
  const desequilibrio = variancia(somas);

  // 2. Quantidade: times com número de jogadores muito diferente.
  const desigualdadeDeTamanho = variancia(tamanhos);

  // 3. Concentração: evita juntar os muito fortes (ou os muito fracos) num
  //    time só, mesmo quando a soma das notas fecha.
  //
  //    O corte é feito por NOTA, não por posição na lista: se vários jogadores
  //    empatam na nota, ou todos entram no grupo ou nenhum entra. Cortar por
  //    posição criaria um "forte" e um "fraco" imaginários entre jogadores
  //    idênticos, e o sorteio passaria a perseguir uma diferença que não existe.
  const todos = times.flatMap((t) => t.linha).sort((a, b) => b.nota - a.nota);
  const corte = Math.max(1, Math.round(todos.length / 4));

  const limiteForte = todos[corte - 1]?.nota ?? 0;
  const limiteFraco = todos[todos.length - corte]?.nota ?? 0;
  const fortes = new Set(todos.filter((j) => j.nota >= limiteForte).map((j) => j.id));
  const fracos = new Set(todos.filter((j) => j.nota <= limiteFraco).map((j) => j.id));

  // Quando o grupo inteiro cai no mesmo grupo, não há o que separar.
  const varianciaDe = (grupo: Set<string>) =>
    grupo.size >= todos.length
      ? 0
      : variancia(times.map((t) => t.linha.filter((j) => grupo.has(j.id)).length));

  const concentracao = varianciaDe(fortes) + varianciaDe(fracos);

  // 4. Variedade: penaliza repetir as mesmas duplas das últimas rodadas.
  let repeticao = 0;
  if (historicoDeDuplas.size > 0) {
    for (const time of times) {
      const integrantes = time.linha;
      for (let i = 0; i < integrantes.length; i++) {
        for (let j = i + 1; j < integrantes.length; j++) {
          const a = integrantes[i];
          const b = integrantes[j];
          if (a && b) repeticao += historicoDeDuplas.get(chaveDaDupla(a.id, b.id)) ?? 0;
        }
      }
    }
  }

  // 5. Sinal físico, com peso mínimo. Só desempata arranjos já equivalentes.
  const pesoMedio = times.map((t) => {
    const comPeso = t.linha.filter((j) => j.pesoKg != null);
    return comPeso.length > 0 ? media(comPeso.map((j) => j.pesoKg as number)) : 0;
  });
  const alturaMedia = times.map((t) => {
    const comAltura = t.linha.filter((j) => j.alturaCm != null);
    return comAltura.length > 0 ? media(comAltura.map((j) => j.alturaCm as number)) : 0;
  });

  // Dividimos para trazer peso e altura para a mesma ordem de grandeza das
  // notas; sem isso um único quilo pesaria mais que um gol de diferença.
  const fisico = variancia(pesoMedio) / 100 + variancia(alturaMedia) / 100;

  return (
    pesos.balance * desequilibrio +
    pesos.size * desigualdadeDeTamanho +
    pesos.concentration * concentracao +
    pesos.repetition * repeticao +
    pesos.physical * fisico
  );
}

/**
 * Avisos sobre os goleiros.
 *
 * O sorteio não decide nada sobre eles — quem decide quem vai a cada gol é
 * o revezamento, partida a partida. Aqui só se diz ao administrador o que
 * ele precisa saber antes de a bola rolar.
 */
function avisosDosGoleiros(goleiros: JogadorParaSorteio[]): string[] {
  if (goleiros.length === 0) {
    return ["Nenhum goleiro confirmado. Combinem quem pega em cada gol."];
  }
  if (goleiros.length === 1) {
    return [
      `Só ${goleiros[0]?.nome} está marcado como goleiro. ` +
        "Um gol fica sem goleiro fixo — combinem quem pega.",
    ];
  }
  if (goleiros.length === 2) {
    return ["Os dois goleiros ficam no gol a rodada toda; a linha é que gira."];
  }
  return [
    `${goleiros.length} goleiros: dois em campo por vez, revezando a cada partida.`,
  ];
}

/**
 * Distribuição inicial em zigue-zague (snake draft): o time que escolhe por
 * último numa rodada escolhe primeiro na seguinte. Já nasce quase
 * equilibrado, e a busca local só refina.
 */
function distribuicaoInicial(
  linha: JogadorParaSorteio[],
  times: TimeGerado[],
  aleatorio: () => number,
): void {
  // Embaralhar antes de ordenar faz jogadores de nota igual trocarem de
  // posição entre uma geração e outra, dando variedade sem perder equilíbrio.
  const ordenados = embaralhar(linha, aleatorio).sort((a, b) => b.nota - a.nota);

  let indice = 0;
  let sentido = 1;

  for (const jogador of ordenados) {
    times[indice]?.linha.push(jogador);

    if (times.length === 1) continue;

    if (sentido === 1 && indice === times.length - 1) sentido = -1;
    else if (sentido === -1 && indice === 0) sentido = 1;
    else indice += sentido;
  }

  for (const time of times) recalcularSoma(time);
}

/**
 * Distribuição aleatória, respeitando o tamanho dos times.
 *
 * Serve de ponto de partida alternativo: a busca local a partir de arranjos
 * diferentes cai em soluções diferentes, quase sempre igualmente boas. É o
 * que faz o "GERAR NOVAMENTE" devolver times realmente novos em vez de
 * repetir o mesmo resultado.
 */
function distribuicaoAleatoria(
  linha: JogadorParaSorteio[],
  times: TimeGerado[],
  aleatorio: () => number,
): void {
  const sorteados = embaralhar(linha, aleatorio);

  sorteados.forEach((jogador, i) => {
    times[i % times.length]?.linha.push(jogador);
  });

  for (const time of times) recalcularSoma(time);
}

/**
 * Busca local: troca dois jogadores de linha de times diferentes sempre que
 * a troca melhora o arranjo, até não haver mais melhora.
 */
function refinar(
  times: TimeGerado[],
  pesos: PesosDeTime,
  historicoDeDuplas: Map<string, number>,
  limiteDePassadas = 60,
): number {
  let custoAtual = custoDoArranjo(times, pesos, historicoDeDuplas);

  for (let passada = 0; passada < limiteDePassadas; passada++) {
    let melhorGanho = 0;
    let melhorTroca: { a: number; i: number; b: number; j: number } | null = null;

    for (let a = 0; a < times.length; a++) {
      for (let b = a + 1; b < times.length; b++) {
        const timeA = times[a];
        const timeB = times[b];
        if (!timeA || !timeB) continue;

        for (let i = 0; i < timeA.linha.length; i++) {
          for (let j = 0; j < timeB.linha.length; j++) {
            const jogadorA = timeA.linha[i];
            const jogadorB = timeB.linha[j];
            if (!jogadorA || !jogadorB) continue;

            timeA.linha[i] = jogadorB;
            timeB.linha[j] = jogadorA;
            recalcularSoma(timeA);
            recalcularSoma(timeB);

            const novoCusto = custoDoArranjo(times, pesos, historicoDeDuplas);
            const ganho = custoAtual - novoCusto;

            timeA.linha[i] = jogadorA;
            timeB.linha[j] = jogadorB;
            recalcularSoma(timeA);
            recalcularSoma(timeB);

            if (ganho > melhorGanho + 1e-9) {
              melhorGanho = ganho;
              melhorTroca = { a, i, b, j };
            }
          }
        }
      }
    }

    if (!melhorTroca) break;

    const timeA = times[melhorTroca.a];
    const timeB = times[melhorTroca.b];
    if (!timeA || !timeB) break;

    const jogadorA = timeA.linha[melhorTroca.i];
    const jogadorB = timeB.linha[melhorTroca.j];
    if (!jogadorA || !jogadorB) break;

    timeA.linha[melhorTroca.i] = jogadorB;
    timeB.linha[melhorTroca.j] = jogadorA;
    recalcularSoma(timeA);
    recalcularSoma(timeB);

    custoAtual -= melhorGanho;
  }

  return custoAtual;
}

function arranjoVazio(quantidadeDeTimes: number): TimeGerado[] {
  return Array.from({ length: quantidadeDeTimes }, (_, i) => ({
    indice: i + 1,
    goleiro: null,
    linha: [],
    somaDeNotas: 0,
  }));
}

/** Gera os times equilibrados. Função pura: mesma entrada, mesmo resultado. */
export function gerarTimesEquilibrados(entrada: EntradaDoSorteio): ResultadoDoSorteio {
  const quantidadeDeTimes = Math.max(1, Math.floor(entrada.quantidadeDeTimes));
  const historicoDeDuplas = entrada.historicoDeDuplas ?? new Map<string, number>();
  const tentativas = Math.max(1, entrada.tentativas ?? 12);

  if (entrada.jogadores.length === 0) {
    return {
      times: arranjoVazio(quantidadeDeTimes),
      goleiros: [],
      custo: 0,
      avisos: ["Nenhum jogador confirmado para sortear."],
    };
  }

  // Do melhor avaliado para o menos: é a ordem em que eles entram no gol.
  const goleiros = entrada.jogadores
    .filter((j) => j.ehGoleiro)
    .sort((a, b) => b.nota - a.nota);
  const linha = entrada.jogadores.filter((j) => !j.ehGoleiro);
  const avisos = avisosDosGoleiros(goleiros);

  // Várias tentativas com sementes diferentes: a busca local pode parar num
  // arranjo bom mas não ótimo, então geramos alguns e escolhemos entre os
  // melhores.
  const candidatos: ResultadoDoSorteio[] = [];

  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    const aleatorio = geradorAleatorio(entrada.semente + tentativa * 7919);
    const times = arranjoVazio(quantidadeDeTimes);

    // A primeira tentativa parte do zigue-zague, que já nasce equilibrado.
    // As demais partem de arranjos aleatórios, para a busca local explorar
    // soluções diferentes em vez de convergir sempre para a mesma.
    if (tentativa === 0) distribuicaoInicial(linha, times, aleatorio);
    else distribuicaoAleatoria(linha, times, aleatorio);

    const custo = refinar(times, entrada.pesos, historicoDeDuplas);

    candidatos.push({ times, goleiros, custo, avisos });
  }

  // Entre os arranjos praticamente empatados, sorteamos um.
  //
  // Escolher sempre o de menor custo faria o "GERAR NOVAMENTE" devolver
  // exatamente os mesmos times, porque a busca local costuma convergir para o
  // mesmo ótimo. Aceitar qualquer arranjo dentro de uma margem estreita dá
  // variedade de verdade sem piorar o equilíbrio de forma perceptível.
  const menorCusto = Math.min(...candidatos.map((c) => c.custo));
  const margem = Math.max(0.02, menorCusto * 0.08);
  const empatados = candidatos.filter((c) => c.custo <= menorCusto + margem);

  const escolha = geradorAleatorio(entrada.semente);
  const resultado = empatados[Math.floor(escolha() * empatados.length)] ?? candidatos[0]!;

  // Time 1 é sempre o mais forte: fica mais fácil conferir de bate-pronto
  // que a diferença entre o primeiro e o último é pequena.
  resultado.times.sort((a, b) => b.somaDeNotas - a.somaDeNotas);
  resultado.times.forEach((time, i) => {
    time.indice = i + 1;
  });

  return resultado;
}

/** Diferença entre o time mais forte e o mais fraco — o número que o grupo olha. */
export function diferencaEntreTimes(times: TimeGerado[]): number {
  if (times.length === 0) return 0;
  const somas = times.map((t) => t.somaDeNotas);
  return Math.max(...somas) - Math.min(...somas);
}

/** Monta o histórico de duplas a partir das formações das rodadas anteriores. */
export function montarHistoricoDeDuplas(
  rodadasAnteriores: { times: string[][] }[],
): Map<string, number> {
  const historico = new Map<string, number>();

  for (const rodada of rodadasAnteriores) {
    for (const time of rodada.times) {
      for (let i = 0; i < time.length; i++) {
        for (let j = i + 1; j < time.length; j++) {
          const a = time[i];
          const b = time[j];
          if (!a || !b) continue;
          const chave = chaveDaDupla(a, b);
          historico.set(chave, (historico.get(chave) ?? 0) + 1);
        }
      }
    }
  }

  return historico;
}
