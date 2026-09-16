/**
 * Erros de regra de negocio.
 *
 * A mensagem sempre chega pronta para o jogador ler — nada de texto tecnico
 * na interface. O `codigo` existe para a interface decidir o que mostrar
 * (por exemplo, abrir a tela de pagamento quando a entrada foi bloqueada
 * por debito).
 */
export type CodigoDeErro =
  | "nao_autenticado"
  | "sem_permissao"
  | "nao_encontrado"
  | "dados_invalidos"
  | "regra_violada"
  | "debito_pendente"
  | "lista_fechada"
  | "sem_vaga"
  | "prazo_expirado"
  | "conflito"
  | "servico_indisponivel";

export class ErroDeRegra extends Error {
  readonly codigo: CodigoDeErro;
  readonly detalhes?: Record<string, unknown>;

  constructor(codigo: CodigoDeErro, mensagem: string, detalhes?: Record<string, unknown>) {
    super(mensagem);
    this.name = "ErroDeRegra";
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

export function erroDeRegra(
  codigo: CodigoDeErro,
  mensagem: string,
  detalhes?: Record<string, unknown>,
): ErroDeRegra {
  return new ErroDeRegra(codigo, mensagem, detalhes);
}

/** Resultado padrao das Server Actions consumidas pelos formularios. */
export type Resultado<T = undefined> =
  | { ok: true; dados: T }
  | { ok: false; codigo: CodigoDeErro; mensagem: string };

export function sucesso(): Resultado<undefined>;
export function sucesso<T>(dados: T): Resultado<T>;
export function sucesso<T>(dados?: T): Resultado<T | undefined> {
  return { ok: true, dados };
}

export function falha(codigo: CodigoDeErro, mensagem: string): Resultado<never> {
  return { ok: false, codigo, mensagem };
}

/**
 * Converte qualquer excecao no formato que a interface entende, sem deixar
 * detalhe interno vazar para a tela.
 */
export function comoResultado(erro: unknown): Resultado<never> {
  if (erro instanceof ErroDeRegra) {
    return { ok: false, codigo: erro.codigo, mensagem: erro.message };
  }
  console.error("[canelada] erro inesperado:", erro);
  return {
    ok: false,
    codigo: "servico_indisponivel",
    mensagem: "Não foi possível concluir agora. Tente de novo em instantes.",
  };
}
