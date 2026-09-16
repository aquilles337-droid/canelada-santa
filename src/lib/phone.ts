/**
 * Telefone e a identidade de login do Canelada Santa.
 *
 * O Supabase Auth so oferece login por telefone com um provedor de SMS pago.
 * Como o grupo nao precisa de verificacao por SMS (o acesso ja e controlado
 * por convite), guardamos no Auth um e-mail sintetico derivado do telefone e
 * mantemos o telefone real no perfil. Para o jogador, a tela pede apenas
 * telefone e senha.
 */

const DDI_BRASIL = "55";

/** Mantem somente digitos. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Normaliza um telefone brasileiro para o formato guardado no banco:
 * 55 + DDD + numero (ex.: 5582988887777). Aceita o que a pessoa digitar —
 * com parenteses, traco, espaco, com ou sem o 55 na frente.
 *
 * Retorna null quando o numero nao e um telefone brasileiro plausivel.
 */
export function normalizarTelefone(entrada: string): string | null {
  let digitos = apenasDigitos(entrada);

  // Remove o zero de operadora digitado antes do DDD.
  if (digitos.length > 11 && digitos.startsWith("0")) {
    digitos = digitos.slice(1);
  }

  if (digitos.startsWith(DDI_BRASIL) && (digitos.length === 12 || digitos.length === 13)) {
    digitos = digitos.slice(2);
  }

  // Sobram DDD (2) + numero (8 fixo ou 9 celular).
  if (digitos.length !== 10 && digitos.length !== 11) return null;

  const ddd = Number(digitos.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;

  // Celular de 9 digitos sempre comeca com 9.
  if (digitos.length === 11 && digitos[2] !== "9") return null;

  return DDI_BRASIL + digitos;
}

/** Exibe o telefone como o brasileiro le: (82) 98888-7777. */
export function formatarTelefone(normalizado: string): string {
  const d = apenasDigitos(normalizado);
  const local = d.startsWith(DDI_BRASIL) && d.length >= 12 ? d.slice(2) : d;

  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return normalizado;
}

/** Mascara progressiva para o campo de digitacao. */
export function mascararTelefone(entrada: string): string {
  const d = apenasDigitos(entrada).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** E-mail sintetico usado internamente pelo Supabase Auth. */
export function emailDoTelefone(telefoneNormalizado: string, dominio: string): string {
  return `${telefoneNormalizado}@${dominio}`;
}

/** Link direto de conversa no WhatsApp. */
export function linkWhatsapp(telefoneNormalizado: string, texto?: string): string {
  const base = `https://wa.me/${telefoneNormalizado}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
