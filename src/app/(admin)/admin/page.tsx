import type { Metadata } from "next";
import Link from "next/link";
import { exigirAdmin } from "@/server/auth/sessao";
import { carregarRodada, proximaRodada } from "@/server/services/rodadas";
import { panoramaDeMensalistas } from "@/server/services/mensalidades";
import { clienteAdmin } from "@/lib/supabase/admin";
import { CartaoDaRodada } from "@/components/rodada/CartaoDaRodada";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Botao } from "@/components/ui/Botao";
import { EstadoVazio } from "@/components/ui/Estados";
import { formatarDinheiro } from "@/lib/format";

export const metadata: Metadata = { title: "Painel" };

function Numero({
  rotulo,
  valor,
  cor = "text-osso",
}: {
  rotulo: string;
  valor: string | number;
  cor?: string;
}) {
  return (
    <Cartao className="p-3 text-center">
      <p className={`titulo-display text-2xl ${cor}`}>{valor}</p>
      <p className="text-[10px] uppercase leading-tight tracking-wider text-cinza">{rotulo}</p>
    </Cartao>
  );
}

export default async function PaginaAdmin() {
  const admin = await exigirAdmin();
  const proxima = await proximaRodada();

  const [panorama, { count: jogadoresAtivos }, { data: emAberto }] = await Promise.all([
    panoramaDeMensalistas(),
    clienteAdmin().from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    clienteAdmin().from("charges").select("amount_cents").in("status", ["pending", "expired"]),
  ]);

  const totalEmAberto = (emAberto ?? []).reduce((soma, c) => soma + c.amount_cents, 0);

  const dados = proxima ? await carregarRodada(proxima.id) : null;
  const confirmados = dados?.participantes.filter((p) => p.status === "confirmed").length ?? 0;
  const chamados = dados?.participantes.filter((p) => p.status === "invited").length ?? 0;
  const esperando = dados?.participantes.filter((p) => p.status === "waiting").length ?? 0;
  const convidados = dados?.convidados.filter((c) => c.status !== "cancelled").length ?? 0;

  const pagosDaRodada = proxima
    ? (
        await clienteAdmin()
          .from("charges")
          .select("status")
          .eq("round_id", proxima.id)
      ).data ?? []
    : [];

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div>
        <h1 className="titulo-display text-2xl">
          Olá, <span className="texto-ouro">{admin.full_name.split(" ")[0]}</span>
        </h1>
        <p className="text-xs text-cinza">Painel do Canelada Santa</p>
      </div>

      {proxima && dados ? (
        <>
          <CartaoDaRodada
            rodada={proxima}
            confirmados={confirmados + chamados}
            esperando={esperando}
            href={`/admin/rodadas/${proxima.id}`}
            destaque
          />

          <div className="grid grid-cols-3 gap-2">
            <Numero rotulo="Confirmados" valor={`${confirmados}/${proxima.capacity}`} cor="text-verde" />
            <Numero rotulo="Na espera" valor={esperando} cor="text-ambar" />
            <Numero rotulo="Convidados" valor={convidados} />
            <Numero
              rotulo="Pagos"
              valor={pagosDaRodada.filter((c) => c.status === "paid").length}
              cor="text-verde"
            />
            <Numero
              rotulo="Pendentes"
              valor={pagosDaRodada.filter((c) => c.status === "pending").length}
              cor="text-ambar"
            />
            <Numero rotulo="Chamados" valor={chamados} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link href={`/admin/rodadas/${proxima.id}/presenca`}>
              <Botao variante="escuro" larguraTotal>
                Gerenciar presença
              </Botao>
            </Link>
            <Link href={`/admin/rodadas/${proxima.id}`}>
              <Botao variante="escuro" larguraTotal>
                Gerar times
              </Botao>
            </Link>
            <Link href="/admin/pagamentos">
              <Botao variante="escuro" larguraTotal>
                Pagamentos
              </Botao>
            </Link>
            <Link href={`/admin/rodadas/${proxima.id}/jogo`}>
              <Botao larguraTotal>Iniciar jogo</Botao>
            </Link>
          </div>
        </>
      ) : (
        <Cartao>
          <CabecalhoCartao titulo="Próxima rodada" />
          <EstadoVazio
            icone="📅"
            titulo="Nenhum racha marcado"
            descricao="Crie a próxima rodada e a lista abre para o grupo."
            acao={
              <Link href="/admin/rodadas/nova">
                <Botao>Criar racha</Botao>
              </Link>
            }
          />
        </Cartao>
      )}

      <Cartao>
        <CabecalhoCartao titulo="O grupo hoje" icone={<span aria-hidden>👥</span>} />
        <div className="grid grid-cols-3 gap-2">
          <Numero rotulo="Jogadores ativos" valor={jogadoresAtivos ?? 0} />
          <Numero
            rotulo="Mensalistas"
            valor={panorama.emDia.length + panorama.pendentes.length + panorama.inadimplentes.length}
            cor="texto-ouro"
          />
          <Numero rotulo="Inadimplentes" valor={panorama.inadimplentes.length} cor="text-vermelho" />
        </div>

        <Link href="/admin/pagamentos" className="mt-3 block">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-linha bg-carvao/60 px-4 py-3">
            <span className="text-sm text-cinza">A receber</span>
            <span className="titulo-display text-lg text-vermelho">
              {formatarDinheiro(totalEmAberto)}
            </span>
          </div>
        </Link>
      </Cartao>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/admin/rodadas/nova">
          <Botao larguraTotal>Novo racha</Botao>
        </Link>
        <Link href="/admin/jogadores">
          <Botao variante="escuro" larguraTotal>
            Convidar jogador
          </Botao>
        </Link>
      </div>
    </div>
  );
}
