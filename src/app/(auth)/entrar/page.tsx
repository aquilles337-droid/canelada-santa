import type { Metadata } from "next";
import { Brasao } from "@/components/brand/Brasao";
import { FormularioEntrar } from "./FormularioEntrar";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const { destino } = await searchParams;

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center gap-8 animate-subir">
        <div className="flex flex-col items-center gap-4">
          <Brasao tamanho={148} prioridade />
          <p className="text-xs uppercase tracking-[0.35em] text-cinza-escuro">
            O aplicativo oficial do racha
          </p>
        </div>

        <div className="superficie w-full p-6">
          <FormularioEntrar destino={destino} />
        </div>

        <p className="text-center text-xs text-cinza-escuro leading-relaxed">
          Só entra quem recebeu convite.
          <br />
          Sem convite, fale com um administrador do grupo.
        </p>
      </div>
    </main>
  );
}
