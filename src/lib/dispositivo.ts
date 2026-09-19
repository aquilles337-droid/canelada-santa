/**
 * Reconhecimento do aparelho, para ensinar a instalação certa.
 *
 * O caminho muda bastante entre plataformas: o Android oferece um botão, o
 * iPhone exige o menu Compartilhar do Safari e não avisa nada ao site. Sem
 * distinguir, a instrução fica errada para metade do grupo.
 */

export type Plataforma = "ios" | "android" | "desktop";

export function detectarPlataforma(): Plataforma {
  if (typeof navigator === "undefined") return "desktop";

  const agente = navigator.userAgent;

  // O iPad moderno se apresenta como Mac; o toque é o que entrega.
  const ehIpadNovo = /Macintosh/.test(agente) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(agente) || ehIpadNovo) return "ios";

  if (/Android/i.test(agente)) return "android";
  return "desktop";
}

/** Já está rodando como aplicativo instalado? */
export function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;

  const comoAplicativo = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  // O Safari do iPhone usa uma propriedade própria, fora do padrão.
  const noIphone = (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return comoAplicativo || noIphone;
}

/** No iPhone, só o Safari instala — Chrome e Firefox por lá não têm o recurso. */
export function ehSafari(): boolean {
  if (typeof navigator === "undefined") return false;

  const agente = navigator.userAgent;
  return /Safari/.test(agente) && !/CriOS|FxiOS|EdgiOS|Chrome|Android/.test(agente);
}
