import type { Metadata } from "next";
import { exigirAdmin } from "@/server/auth/sessao";
import { lerConfiguracoes } from "@/server/services/configuracoes";
import { FormularioConfiguracoes } from "./FormularioConfiguracoes";

export const metadata: Metadata = { title: "Configurações" };

export default async function PaginaConfiguracoes() {
  await exigirAdmin();
  const configuracoes = await lerConfiguracoes();

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
    </div>
  );
}
