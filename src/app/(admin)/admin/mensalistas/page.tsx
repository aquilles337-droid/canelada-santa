import type { Metadata } from "next";
import { exigirAdmin } from "@/server/auth/sessao";
import { panoramaDeMensalistas } from "@/server/services/mensalidades";
import { lerConfiguracoes } from "@/server/services/configuracoes";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Avatar } from "@/components/ui/Avatar";
import { Selo } from "@/components/ui/Selo";
import { EstadoVazio } from "@/components/ui/Estados";
import { formatarData, formatarDinheiro, mesAno } from "@/lib/format";
import type { Profile } from "@/lib/supabase/tipos";
import { GerarMensalidades } from "./GerarMensalidades";

export const metadata: Metadata = { title: "Mensalistas" };

function LinhaDeJogador({
  jogador,
  detalhe,
  selo,
}: {
  jogador: Profile;
  detalhe?: string;
  selo: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar nome={jogador.full_name} fotoUrl={jogador.photo_url} tamanho="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{jogador.full_name}</p>
        {detalhe && <p className="text-[11px] text-cinza-escuro">{detalhe}</p>}
      </div>
      {selo}
    </li>
  );
}

export default async function PaginaAdminMensalistas() {
  await exigirAdmin();

  const [panorama, configuracoes] = await Promise.all([panoramaDeMensalistas(), lerConfiguracoes()]);
  const competencia = mesAno(`${panorama.competencia}T12:00:00.000Z`);

  const emAberto =
    panorama.pendentes.reduce((s, m) => s + m.amount_cents, 0) +
    panorama.inadimplentes.reduce((s, m) => s + m.amount_cents, 0);

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <Cartao destaque>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-cinza">Mensalidade</p>
            <p className="titulo-display text-2xl texto-ouro">
              {formatarDinheiro(configuracoes.monthly_fee_cents)}
            </p>
            <p className="mt-0.5 text-xs capitalize text-cinza">{competencia}</p>
          </div>
          <GerarMensalidades />
        </div>
      </Cartao>

      <div className="grid grid-cols-3 gap-2">
        {[
          { rotulo: "Em dia", valor: panorama.emDia.length, cor: "text-verde" },
          { rotulo: "Em aberto", valor: panorama.pendentes.length, cor: "text-ambar" },
          { rotulo: "Vencidas", valor: panorama.inadimplentes.length, cor: "text-vermelho" },
        ].map((item) => (
          <Cartao key={item.rotulo} className="p-3 text-center">
            <p className={`titulo-display text-2xl ${item.cor}`}>{item.valor}</p>
            <p className="text-[10px] uppercase tracking-wider text-cinza">{item.rotulo}</p>
          </Cartao>
        ))}
      </div>

      {emAberto > 0 && (
        <Cartao className="text-center">
          <p className="text-[11px] uppercase tracking-[0.25em] text-cinza">A receber neste mês</p>
          <p className="titulo-display mt-1 text-3xl text-vermelho">{formatarDinheiro(emAberto)}</p>
        </Cartao>
      )}

      {panorama.inadimplentes.length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo={`Inadimplentes (${panorama.inadimplentes.length})`} icone={<span aria-hidden>⚠️</span>} />
          <ul className="flex flex-col divide-y divide-linha">
            {panorama.inadimplentes.map((m) => (
              <LinhaDeJogador
                key={m.id}
                jogador={m.jogador}
                detalhe={`Venceu em ${formatarData(m.due_date)}`}
                selo={<Selo tom="vermelho">{formatarDinheiro(m.amount_cents)}</Selo>}
              />
            ))}
          </ul>
          <p className="mt-3 text-xs text-cinza-escuro">
            Quem está aqui não consegue entrar em racha novo enquanto não quitar.
          </p>
        </Cartao>
      )}

      {panorama.pendentes.length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo={`Em aberto (${panorama.pendentes.length})`} />
          <ul className="flex flex-col divide-y divide-linha">
            {panorama.pendentes.map((m) => (
              <LinhaDeJogador
                key={m.id}
                jogador={m.jogador}
                detalhe={`Vence em ${formatarData(m.due_date)}`}
                selo={<Selo tom="ambar">{formatarDinheiro(m.amount_cents)}</Selo>}
              />
            ))}
          </ul>
        </Cartao>
      )}

      {panorama.emDia.length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo={`Em dia (${panorama.emDia.length})`} />
          <ul className="flex flex-col divide-y divide-linha">
            {panorama.emDia.map((m) => (
              <LinhaDeJogador
                key={m.id}
                jogador={m.jogador}
                selo={<Selo tom="verde">{m.status === "waived" ? "Perdoada" : "Paga"}</Selo>}
              />
            ))}
          </ul>
        </Cartao>
      )}

      {panorama.semMensalidade.length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo={`Sem mensalidade gerada (${panorama.semMensalidade.length})`} />
          <ul className="flex flex-col divide-y divide-linha">
            {panorama.semMensalidade.map((jogador) => (
              <LinhaDeJogador key={jogador.id} jogador={jogador} selo={<Selo tom="neutro">Pendente</Selo>} />
            ))}
          </ul>
          <p className="mt-3 text-xs text-cinza-escuro">
            Use &ldquo;Gerar mês&rdquo; para criar as mensalidades que faltam.
          </p>
        </Cartao>
      )}

      {panorama.emDia.length === 0 &&
        panorama.pendentes.length === 0 &&
        panorama.inadimplentes.length === 0 &&
        panorama.semMensalidade.length === 0 && (
          <EstadoVazio
            icone="📅"
            titulo="Nenhum mensalista ainda"
            descricao="Marque jogadores como mensalistas na tela de Jogadores."
          />
        )}
    </div>
  );
}
