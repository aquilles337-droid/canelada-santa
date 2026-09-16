import type { Metadata } from "next";
import { exigirAdmin } from "@/server/auth/sessao";
import { listarJogadores } from "@/server/services/jogadores";
import { Avatar } from "@/components/ui/Avatar";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { EstadoVazio } from "@/components/ui/Estados";
import { formatarTelefone } from "@/lib/phone";
import { AcoesDoJogador } from "./AcoesDoJogador";
import { PainelDeConvites } from "./PainelDeConvites";

export const metadata: Metadata = { title: "Jogadores" };

export default async function PaginaAdminJogadores({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const admin = await exigirAdmin();
  const { busca } = await searchParams;
  const jogadores = await listarJogadores({ busca });

  const mensalistas = jogadores.filter((j) => j.is_member && j.status === "active").length;
  const ativos = jogadores.filter((j) => j.status === "active").length;

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div className="grid grid-cols-3 gap-2">
        {[
          { rotulo: "No grupo", valor: jogadores.length },
          { rotulo: "Ativos", valor: ativos },
          { rotulo: "Mensalistas", valor: mensalistas },
        ].map((item) => (
          <Cartao key={item.rotulo} className="p-3 text-center">
            <p className="titulo-display text-2xl texto-ouro">{item.valor}</p>
            <p className="text-[10px] uppercase tracking-wider text-cinza">{item.rotulo}</p>
          </Cartao>
        ))}
      </div>

      <PainelDeConvites />

      <Cartao>
        <CabecalhoCartao titulo={`Jogadores (${jogadores.length})`} />

        <form className="mb-3">
          <input
            name="busca"
            defaultValue={busca ?? ""}
            placeholder="Buscar por nome ou telefone"
            className="h-11 w-full rounded-xl border border-linha bg-carvao/80 px-4 text-sm text-osso placeholder:text-cinza-escuro focus:border-ouro/60 focus:outline-none"
          />
        </form>

        {jogadores.length === 0 ? (
          <EstadoVazio
            icone="👥"
            titulo="Ninguém por aqui ainda"
            descricao="Gere um convite acima e mande no grupo do WhatsApp."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-linha">
            {jogadores.map((jogador) => (
              <li key={jogador.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar
                  nome={jogador.full_name}
                  fotoUrl={jogador.photo_url}
                  goleiro={jogador.is_goalkeeper}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{jogador.full_name}</p>
                  <p className="text-xs text-cinza">{formatarTelefone(jogador.phone)}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {jogador.is_member && <Selo tom="ouro">Mensalista</Selo>}
                    {jogador.role === "admin" && <Selo tom="azul">Admin</Selo>}
                    {jogador.status === "banned" && <Selo tom="vermelho">Banido</Selo>}
                    {jogador.status === "suspended" && <Selo tom="ambar">Suspenso</Selo>}
                    {jogador.status === "inactive" && <Selo tom="neutro">Inativo</Selo>}
                  </div>
                </div>
                <AcoesDoJogador jogador={jogador} souEu={jogador.id === admin.id} />
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
