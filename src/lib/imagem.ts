/**
 * Redução de imagem no navegador, antes de enviar.
 *
 * Foto de celular tem de 3 a 8 MB, e no aplicativo ela aparece como um
 * quadrado pequeno. Subir o arquivo inteiro gasta o 4G de quem está na
 * quadra e demora — então reduzimos aqui, antes de sair do aparelho.
 *
 * Se qualquer coisa falhar (formato exótico, navegador antigo), devolvemos o
 * arquivo original: o servidor ainda vai conferir tipo e tamanho.
 */

export interface OpcoesDeReducao {
  /** Maior lado da imagem, em pixels. */
  larguraMaxima?: number;
  /** De 0 a 1. Acima de 0,85 o arquivo cresce sem ganho visível. */
  qualidade?: number;
}

const PADRAO: Required<OpcoesDeReducao> = {
  larguraMaxima: 1600,
  qualidade: 0.82,
};

export async function reduzirImagem(
  arquivo: File,
  opcoes: OpcoesDeReducao = {},
): Promise<File> {
  const { larguraMaxima, qualidade } = { ...PADRAO, ...opcoes };

  if (!arquivo.type.startsWith("image/")) return arquivo;
  // GIF animado perderia a animação ao passar pelo canvas.
  if (arquivo.type === "image/gif") return arquivo;

  try {
    // `from-image` respeita a orientação gravada pela câmera: sem isso, foto
    // tirada de lado sobe deitada.
    const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });

    const maiorLado = Math.max(imagem.width, imagem.height);
    const escala = maiorLado > larguraMaxima ? larguraMaxima / maiorLado : 1;

    const largura = Math.round(imagem.width * escala);
    const altura = Math.round(imagem.height * escala);

    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;

    const contexto = tela.getContext("2d");
    if (!contexto) return arquivo;

    contexto.drawImage(imagem, 0, 0, largura, altura);
    imagem.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      tela.toBlob(resolve, "image/jpeg", qualidade),
    );

    if (!blob) return arquivo;
    // Se a "redução" engordou o arquivo, fica o original.
    if (blob.size >= arquivo.size) return arquivo;

    const nome = arquivo.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${nome}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return arquivo;
  }
}

/** "3,4 MB", "820 KB" — para mostrar ao jogador o que foi economizado. */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
