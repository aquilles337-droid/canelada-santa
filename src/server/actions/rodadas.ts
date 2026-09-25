"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/server/auth/sessao";
import {
  abrirRodada,
  cancelarRodada,
  criarRodada,
  editarRodada,
  fecharLista,
  finalizarRodada,
  iniciarRodada,
  reabrirLista,
} from "@/server/services/rodadas";
import { lerConfiguracoes } from "@/server/services/configuracoes";
import { lerDinheiro } from "@/lib/format";
import { comoResultado, falha, sucesso, type Resultado } from "@/lib/erros";
import type { Round } from "@/lib/supabase/tipos";
import { paraUTC } from "@/lib/fuso";

const esquema = z.object({
  titulo: z.string().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do racha"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Informe o horário do racha"),
  local: z.string().min(2, "Informe o local"),
  endereco: z.string().optional(),
  vagas: z.coerce.number().int().min(2, "Informe quantas vagas"),
  times: z.coerce.number().int().min(2, "Informe quantos times"),
  jogadoresPorTime: z.string().optional(),
  minutos: z.coerce.number().int().min(1, "Informe a duração da partida"),
  gols: z.coerce.number().int().min(1, "Informe os gols para vencer"),
  fechamentoData: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe quando a lista fecha"),
  fechamentoHora: z.string().regex(/^\d{2}:\d{2}$/, "Informe o horário de fechamento"),
  valorAvulso: z.string().optional(),
  regras: z.string().optional(),
});

export async function criarRodadaAction(
  _anterior: unknown,
  formulario: FormData,
): Promise<Resultado<Round>> {
  try {
    const admin = await exigirAdmin();

    const bruto = esquema.safeParse(Object.fromEntries(formulario));
    if (!bruto.success) {
      return falha("dados_invalidos", bruto.error.issues[0]?.message ?? "Confira os dados do racha.");
    }

    const dados = bruto.data;
    const jogadoresPorTime = dados.jogadoresPorTime?.trim()
      ? Number(dados.jogadoresPorTime)
      : null;

    const rodada = await criarRodada(
      {
        titulo: dados.titulo ?? null,
        comecaEm: paraUTC(dados.data, dados.hora),
        local: dados.local,
        endereco: dados.endereco ?? null,
        capacidade: dados.vagas,
        quantidadeDeTimes: dados.times,
        jogadoresPorTime: Number.isFinite(jogadoresPorTime) ? jogadoresPorTime : null,
        minutosPorPartida: dados.minutos,
        golsParaVencer: dados.gols,
        listaFechaEm: paraUTC(dados.fechamentoData, dados.fechamentoHora),
        precoAvulsoCentavos: dados.valorAvulso ? lerDinheiro(dados.valorAvulso) : null,
        regras: dados.regras ?? null,
      },
      admin.id,
    );

    revalidatePath("/admin/rodadas");
    revalidatePath("/inicio");
    return sucesso(rodada);
  } catch (erro) {
    return comoResultado(erro);
  }
}

const esquemaDeEdicao = esquema.extend({
  id: z.string().uuid("Racha inválido"),
});

/**
 * Altera um racha que ja existe.
 *
 * Devolve quantas pessoas foram chamadas da fila, porque aumentar as vagas
 * e a edicao que mexe na vida dos outros: a tela precisa dizer isso em vez
 * de so avisar "salvo".
 */
export async function editarRodadaAction(
  _anterior: unknown,
  formulario: FormData,
): Promise<Resultado<{ rodada: Round; chamadosDaFila: number }>> {
  try {
    const admin = await exigirAdmin();

    const bruto = esquemaDeEdicao.safeParse(Object.fromEntries(formulario));
    if (!bruto.success) {
      return falha("dados_invalidos", bruto.error.issues[0]?.message ?? "Confira os dados do racha.");
    }

    const dados = bruto.data;
    const porTime = dados.jogadoresPorTime?.trim() ? Number(dados.jogadoresPorTime) : null;

    const resultado = await editarRodada(
      dados.id,
      {
        titulo: dados.titulo ?? null,
        comecaEm: paraUTC(dados.data, dados.hora),
        local: dados.local,
        endereco: dados.endereco ?? null,
        capacidade: dados.vagas,
        quantidadeDeTimes: dados.times,
        jogadoresPorTime: porTime !== null && Number.isFinite(porTime) ? porTime : null,
        minutosPorPartida: dados.minutos,
        golsParaVencer: dados.gols,
        listaFechaEm: paraUTC(dados.fechamentoData, dados.fechamentoHora),
        regras: dados.regras ?? null,
      },
      admin.id,
    );

    revalidatePath("/admin/rodadas");
    revalidatePath(`/admin/rodadas/${dados.id}`);
    revalidatePath(`/racha/${dados.id}`);
    revalidatePath("/inicio");
    return sucesso(resultado);
  } catch (erro) {
    return comoResultado(erro);
  }
}

/** Valores sugeridos para o formulario de nova rodada. */
export async function padroesDaRodada(): Promise<
  Resultado<{
    vagas: number;
    times: number;
    minutos: number;
    gols: number;
    horasParaFechar: number;
    valorAvulsoCentavos: number;
  }>
> {
  try {
    await exigirAdmin();
    const c = await lerConfiguracoes();

    return sucesso({
      vagas: c.default_capacity,
      times: c.default_teams_count,
      minutos: c.default_match_minutes,
      gols: c.default_goals_to_win,
      horasParaFechar: c.default_list_close_hours_before,
      valorAvulsoCentavos: c.casual_price_cents,
    });
  } catch (erro) {
    return comoResultado(erro);
  }
}

async function acaoDeCicloDeVida(
  rodadaId: string,
  executar: (id: string, atorId: string) => Promise<Round>,
): Promise<Resultado<Round>> {
  try {
    const admin = await exigirAdmin();
    const rodada = await executar(rodadaId, admin.id);

    revalidatePath("/admin/rodadas");
    revalidatePath(`/admin/rodadas/${rodadaId}`);
    revalidatePath(`/racha/${rodadaId}`);
    revalidatePath("/inicio");
    return sucesso(rodada);
  } catch (erro) {
    return comoResultado(erro);
  }
}

// Em arquivos "use server" todo export precisa ser uma funcao assincrona
// declarada — o empacotador nao reconhece constantes com arrow function.
export async function abrirRodadaAction(id: string): Promise<Resultado<Round>> {
  return acaoDeCicloDeVida(id, abrirRodada);
}

export async function fecharListaAction(id: string): Promise<Resultado<Round>> {
  return acaoDeCicloDeVida(id, fecharLista);
}

export async function iniciarRodadaAction(id: string): Promise<Resultado<Round>> {
  return acaoDeCicloDeVida(id, iniciarRodada);
}

export async function finalizarRodadaAction(id: string): Promise<Resultado<Round>> {
  return acaoDeCicloDeVida(id, finalizarRodada);
}

export async function cancelarRodadaAction(id: string): Promise<Resultado<Round>> {
  return acaoDeCicloDeVida(id, cancelarRodada);
}

/**
 * Reabre a lista de um racha que ja fechou.
 *
 * Recebe o novo horario de fechamento em data e hora separadas, no fuso do
 * grupo — é o mesmo par de campos do formulario de criacao.
 */
export async function reabrirListaAction(
  rodadaId: string,
  data: string,
  hora: string,
): Promise<Resultado<Round>> {
  const formato = z.object({
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data em que a lista fecha"),
    hora: z.string().regex(/^\d{2}:\d{2}$/, "Informe o horário em que a lista fecha"),
  });

  const bruto = formato.safeParse({ data, hora });
  if (!bruto.success) {
    return falha("dados_invalidos", bruto.error.issues[0]?.message ?? "Confira o horário.");
  }

  return acaoDeCicloDeVida(rodadaId, (id, ator) =>
    reabrirLista(id, paraUTC(bruto.data.data, bruto.data.hora), ator),
  );
}
