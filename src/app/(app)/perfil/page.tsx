import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/auth/sessao";
import { Avatar } from "@/components/ui/Avatar";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { formatarData } from "@/lib/format";
import { formatarTelefone } from "@/lib/phone";
import Link from "next/link";
import { cobrancasEmAberto } from "@/server/services/cobrancas";
import { Botao } from "@/components/ui/Botao";
import { ResumoFinanceiro } from "@/components/financeiro/CartaoDePagamento";
import { AtivarNotificacoes } from "@/components/pwa/AtivarNotificacoes";
import { FormularioPerfil } from "./FormularioPerfil";
import { BotaoSair } from "./BotaoSair";

export const metadata: Metadata = { title: "Meu perfil" };

const NOME_POSICAO: Record<string, string> = {
  goleiro: "Goleiro",
  fixo: "Fixo",
  ala: "Ala",
  pivo: "Pivô",
  linha: "Linha",
};

export default async function PaginaPerfil() {
  const perfil = await usuarioAtual();
  if (!perfil) redirect("/entrar");

  const emAberto = await cobrancasEmAberto(perfil.id);
  const totalEmAberto = emAberto.reduce((soma, c) => soma + c.amount_cents, 0);

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <Cartao destaque className="flex items-center gap-4">
        <Avatar nome={perfil.full_name} fotoUrl={perfil.photo_url} tamanho="xl" goleiro={perfil.is_goalkeeper} />
        <div className="min-w-0 flex-1">
          <h1 className="titulo-display text-xl truncate">{perfil.full_name}</h1>
          <p className="text-sm text-cinza">{formatarTelefone(perfil.phone)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Selo tom="neutro">{NOME_POSICAO[perfil.position] ?? "Linha"}</Selo>
            {perfil.is_member ? <Selo tom="ouro">Mensalista</Selo> : <Selo tom="neutro">Avulso</Selo>}
            {perfil.role === "admin" && <Selo tom="azul">Administrador</Selo>}
            {perfil.status === "banned" && <Selo tom="vermelho">Bloqueado</Selo>}
            {perfil.status === "suspended" && <Selo tom="ambar">Suspenso</Selo>}
          </div>
        </div>
      </Cartao>

      <ResumoFinanceiro totalEmAbertoCentavos={totalEmAberto} />

      <Cartao>
        <CabecalhoCartao titulo="Meus dados" />
        <FormularioPerfil perfil={perfil} />
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Notificações" icone={<span aria-hidden>🔔</span>} />
        <AtivarNotificacoes
          chavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
          preferenciaLigada={perfil.notifications_enabled}
        />
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Atalhos" />
        <div className="flex flex-col gap-2">
          <Link href="/avaliar">
            <Botao variante="escuro" larguraTotal>
              Avaliar jogadores
            </Botao>
          </Link>
          <Link href="/perfil/pagamentos">
            <Botao variante="escuro" larguraTotal>
              Meus pagamentos
            </Botao>
          </Link>
          <Link href="/historico">
            <Botao variante="escuro" larguraTotal>
              Histórico de rachas
            </Botao>
          </Link>
          <Link href="/hall-da-fama">
            <Botao variante="escuro" larguraTotal>
              Hall da Fama
            </Botao>
          </Link>
          <Link href="/resenha">
            <Botao variante="escuro" larguraTotal>
              Resenha da temporada
            </Botao>
          </Link>
        </div>
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Conta" />
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-cinza">No grupo desde</dt>
            <dd>{formatarData(perfil.joined_at)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cinza">Telefone</dt>
            <dd>{formatarTelefone(perfil.phone)}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <BotaoSair />
        </div>
      </Cartao>
    </div>
  );
}
