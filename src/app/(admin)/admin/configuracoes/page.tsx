import type { Metadata } from "next";
import { exigirAdmin } from "@/server/auth/sessao";
import { lerConfiguracoes } from "@/server/services/configuracoes";
import { clienteAdmin } from "@/lib/supabase/admin";
import { Cartao, CabecalhoCartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { formatarDataHora } from "@/lib/format";
import { FormularioConfiguracoes } from "./FormularioConfiguracoes";

export const metadata: Metadata = { title: "Configurações" };

export default async function PaginaConfiguracoes() {
  await exigirAdmin();
  const configuracoes = await lerConfiguracoes();

  // As tarefas agendadas são o que faz a fila andar sozinha. Mostrar as
  // últimas execuções deixa o administrador conferir, sem abrir terminal,
  // se o cron do servidor está mesmo chamando o aplicativo.
  const { data: execucoes } = await clienteAdmin()
    .from("job_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(8);

  const ultima = execucoes?.[0];

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <div>
        <h1 className="titulo-display text-2xl">
          Configurações do <span className="texto-ouro">Canelada Santa</span>
        </h1>
        <p className="mt-1 text-xs text-cinza">
          Mudar um valor aqui não altera rodadas que já existem: cada rodada guarda os valores
          que valiam quando foi criada.
        </p>
      </div>

      <FormularioConfiguracoes configuracoes={configuracoes} />

      <Cartao>
        <CabecalhoCartao
          titulo="Tarefas automáticas"
          icone={<span aria-hidden>⏱️</span>}
          acao={
            ultima ? (
              <Selo tom={ultima.status === "error" ? "vermelho" : "verde"}>
                {ultima.status === "error" ? "Com erro" : "Rodando"}
              </Selo>
            ) : (
              <Selo tom="ambar">Nunca rodou</Selo>
            )
          }
        />

        {execucoes && execucoes.length > 0 ? (
          <ul className="flex flex-col divide-y divide-linha">
            {execucoes.map((execucao) => (
              <li key={execucao.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{execucao.job}</span>
                <span className="text-[11px] text-cinza-escuro">
                  {formatarDataHora(execucao.started_at)}
                </span>
                <Selo tom={execucao.status === "error" ? "vermelho" : "verde"}>
                  {execucao.status === "error" ? "erro" : "ok"}
                </Selo>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-ambar/40 bg-ambar/10 px-4 py-3 text-sm text-ambar">
            O cron do servidor ainda não chamou o aplicativo. Sem ele, a lista não fecha sozinha
            e a fila não anda. O README explica como configurar em um minuto.
          </p>
        )}
      </Cartao>
    </div>
  );
}
