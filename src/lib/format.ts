/**
 * Formatacao para o Brasil: real, data DD/MM/AAAA, hora 24h e fuso
 * America/Maceio. Nenhum texto tecnico chega ao jogador.
 */

export const FUSO = "America/Maceio";
export const LOCALE = "pt-BR";

const moeda = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "BRL" });

/**
 * Centavos inteiros → "R$ 25,00". Dinheiro nunca trafega como decimal.
 *
 * O Intl separa "R$" do valor com espaco nao separavel; trocamos por espaco
 * comum para o texto continuar igual ao ser colado no WhatsApp.
 */
export function formatarDinheiro(centavos: number): string {
  return moeda.format(centavos / 100).replace(/\u00a0/g, " ");
}

/** "25", "25,50", "R$ 25,50" → 2550 centavos. Retorna null se nao der. */
export function lerDinheiro(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  if (!limpo) return null;
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor < 0) return null;
  return Math.round(valor * 100);
}

function fmt(opcoes: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: FUSO, ...opcoes });
}

const fData = fmt({ day: "2-digit", month: "2-digit", year: "numeric" });
const fDataCurta = fmt({ day: "2-digit", month: "2-digit" });
const fHora = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
const fDiaSemana = fmt({ weekday: "long" });
const fMesAno = fmt({ month: "long", year: "numeric" });

export function formatarData(d: Date | string): string {
  return fData.format(new Date(d));
}

export function formatarDataCurta(d: Date | string): string {
  return fDataCurta.format(new Date(d));
}

export function formatarHora(d: Date | string): string {
  return fHora.format(new Date(d));
}

export function formatarDataHora(d: Date | string): string {
  return `${formatarData(d)} às ${formatarHora(d)}`;
}

export function diaDaSemana(d: Date | string): string {
  return fDiaSemana.format(new Date(d)).replace("-feira", "");
}

export function mesAno(d: Date | string): string {
  return fMesAno.format(new Date(d));
}

/** "TERÇA" — usado nos cartoes grandes da tela inicial. */
export function diaDaSemanaCurto(d: Date | string): string {
  return diaDaSemana(d).toUpperCase();
}

/**
 * Distancia ate um momento futuro, em linguagem de grupo de WhatsApp:
 * "em 2 dias", "em 3h20", "em 12 min", "agora".
 */
export function tempoAte(destino: Date | string, agora: Date = new Date()): string {
  const ms = new Date(destino).getTime() - agora.getTime();
  if (ms <= 0) return "agora";

  const minutos = Math.floor(ms / 60_000);
  if (minutos < 1) return "em menos de 1 min";
  if (minutos < 60) return `em ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  const restoMin = minutos % 60;
  if (horas < 24) return restoMin > 0 ? `em ${horas}h${String(restoMin).padStart(2, "0")}` : `em ${horas}h`;

  const dias = Math.floor(horas / 24);
  return dias === 1 ? "em 1 dia" : `em ${dias} dias`;
}

/** Contagem regressiva do cronometro: "07:32". */
export function formatarCronometro(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Percentual com uma casa: 20,0% */
export function formatarPercentual(fracao: number): string {
  return `${(fracao * 100).toFixed(1).replace(".", ",")}%`;
}

/**
 * Nota do jogador: 7,4.
 *
 * O epsilon corrige o arredondamento binario — sem ele, 7,35 vira 7,3
 * porque o numero guardado na memoria e 7,34999...
 */
export function formatarNota(nota: number): string {
  const arredondada = Math.round((nota + Number.EPSILON) * 10) / 10;
  return arredondada.toFixed(1).replace(".", ",");
}

/** "João Pedro da Silva" → "João Silva", para caber no cartao. */
export function nomeCurto(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter((p) => p.length > 2 || /[A-ZÀ-Ý]/.test(p[0] ?? ""));
  if (partes.length <= 1) return nomeCompleto.trim();
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

/** Iniciais para o avatar sem foto. */
export function iniciais(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "?";
  const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? "" : "";
  return (primeira + ultima).toUpperCase();
}

export function plural(n: number, singular: string, pluralForma: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${pluralForma}`;
}
