import type { Metadata } from "next";
import { exigirAtivo } from "@/server/auth/sessao";
import { listarJogadores } from "@/server/services/jogadores";
import { minhasAvaliacoes } from "@/server/services/avaliacoes";
import { lerConfiguracoes } from "@/server/services/configuracoes";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { EstadoVazio } from "@/components/ui/Estados";
import { AvaliarJogador } from "./AvaliarJogador";

export const metadata: Metadata = { title: "Avaliar jogadores" };

export default async function PaginaAvaliar() {
  const perfil = await exigirAtivo();

  const [jogadores, minhas, configuracoes] = await Promise.all([
    listarJogadores({ apenasAtivos: true }),
    minhasAvaliacoes(perfil.id),
    lerConfiguracoes(),
  ]);

  // Ninguém avalia a si mesmo.
  const avaliaveis = jogadores.filter((j) => j.id !== perfil.id);
  const jaAvaliados = avaliaveis.filter((j) => minhas.has(j.id)).length;

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <Cartao destaque>
        <h1 className="titulo-display text-xl">
          Avaliar <span className="texto-ouro">jogadores</span>
        </h1>
        <p className="mt-1 text-sm text-cinza">
          A votação é anônima. Ninguém vê quem deu qual nota — nem o avaliado.
        </p>
        <p className="mt-2 text-xs text-cinza-escuro">
          {jaAvaliados} de {avaliaveis.length} avaliados. Você pode mudar sua nota quando quiser.
        </p>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Nota de 0 a 10" />
        {avaliaveis.length === 0 ? (
          <EstadoVazio icone="👥" titulo="Ninguém para avaliar ainda" />
        ) : (
          <ul className="flex flex-col divide-y divide-linha">
            {avaliaveis.map((jogador) => (
              <AvaliarJogador
                key={jogador.id}
                jogador={{
                  id: jogador.id,
                  nome: jogador.nickname?.trim() || jogador.full_name,
                  fotoUrl: jogador.photo_url,
                  ehGoleiro: jogador.is_goalkeeper,
                }}
                minhaNota={minhas.get(jogador.id) ?? null}
                categorias={configuracoes.rating_categories}
              />
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
