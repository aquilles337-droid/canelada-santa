import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brasao } from "@/components/brand/Brasao";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";

export const metadata: Metadata = { title: "Tenho um convite" };

/** Entrada por codigo digitado, para quem recebeu o convite ditado no grupo. */
export default function PaginaCodigoDeConvite() {
  async function abrir(formulario: FormData) {
    "use server";
    const codigo = String(formulario.get("codigo") ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    redirect(codigo ? `/convite/${codigo}` : "/convite");
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center gap-7 animate-subir">
        <Brasao tamanho={120} prioridade />
        <div className="superficie w-full p-6">
          <form action={abrir} className="flex flex-col gap-4">
            <Campo
              name="codigo"
              rotulo="Código do convite"
              placeholder="ABCD2345"
              autoCapitalize="characters"
              autoComplete="off"
              className="[&_input]:text-center [&_input]:tracking-[0.35em] [&_input]:uppercase [&_input]:font-bold"
              required
            />
            <Botao type="submit" tamanho="lg" larguraTotal>
              Continuar
            </Botao>
          </form>
        </div>
      </div>
    </main>
  );
}
