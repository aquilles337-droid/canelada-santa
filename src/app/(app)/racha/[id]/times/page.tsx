import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/server/auth/sessao";
import { carregarRodada, nomeDaRodada } from "@/server/services/rodadas";
import { goleirosDaRodada, textoParaWhatsapp, timesDaRodada } from "@/server/services/times";
import { CartaoDeTime } from "@/components/times/CartaoDeTime";
import { CartaoDosGoleiros } from "@/components/times/CartaoDosGoleiros";
import { Botao } from "@/components/ui/Botao";
import { EstadoVazio } from "@/components/ui/Estados";
import { ErroDeRegra } from "@/lib/erros";

export const metadata: Metadata = { title: "Times" };

export default async function PaginaTimesDaRodada({ params }: { params: Promise<{ id: string }> }) {
  await exigirUsuario();
  const { id } = await params;

  let rodada;
  try {
    ({ rodada } = await carregarRodada(id));
  } catch (erro) {
    if (erro instanceof ErroDeRegra && erro.codigo === "nao_encontrado") notFound();
    throw erro;
  }

  const [times, goleiros] = await Promise.all([timesDaRodada(id), goleirosDaRodada(id)]);
  const texto = textoParaWhatsapp(nomeDaRodada(rodada), times, goleiros);

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-cinza">{nomeDaRodada(rodada)}</p>
        <h1 className="titulo-display text-2xl">
          Times da <span className="texto-ouro">rodada</span>
        </h1>
      </div>

      {times.length === 0 ? (
        <EstadoVazio
          icone="🎽"
          titulo="Times ainda não sorteados"
          descricao="O administrador gera os times quando a lista fechar."
        />
      ) : (
        <>
          {/* O goleiro não está em time nenhum: ele é do gol. */}
          <CartaoDosGoleiros goleiros={goleiros} />

          <div className="flex flex-col gap-3">
            {times.map((time) => (
              <CartaoDeTime key={time.id} time={time} />
            ))}
          </div>

          <a
            href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <Botao variante="sucesso" larguraTotal tamanho="lg">
              Compartilhar no WhatsApp
            </Botao>
          </a>
        </>
      )}
    </div>
  );
}
