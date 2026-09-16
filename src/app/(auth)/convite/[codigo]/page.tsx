import type { Metadata } from "next";
import Link from "next/link";
import { Brasao } from "@/components/brand/Brasao";
import { Botao } from "@/components/ui/Botao";
import { validarConvite } from "@/server/services/convites";
import { ErroDeRegra } from "@/lib/erros";
import { FormularioCadastro } from "./FormularioCadastro";

export const metadata: Metadata = { title: "Convite" };

export default async function PaginaConvite({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;

  let problema: string | null = null;
  try {
    await validarConvite(codigo);
  } catch (erro) {
    problema = erro instanceof ErroDeRegra ? erro.message : "Convite inválido.";
  }

  return (
    <main className="min-h-dvh flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center gap-7 animate-subir">
        <div className="flex flex-col items-center gap-3 text-center">
          <Brasao tamanho={120} prioridade />
          <h1 className="titulo-display text-2xl">
            Você foi convidado
            <span className="block texto-ouro">para o Canelada Santa</span>
          </h1>
        </div>

        {problema ? (
          <div className="superficie w-full p-6 flex flex-col items-center gap-4 text-center">
            <span className="text-4xl" aria-hidden>
              🚫
            </span>
            <p className="text-osso">{problema}</p>
            <p className="text-sm text-cinza">Peça um convite novo a um administrador do grupo.</p>
            <Link href="/entrar" className="w-full">
              <Botao variante="escuro" larguraTotal>
                Já tenho conta
              </Botao>
            </Link>
          </div>
        ) : (
          <>
            <div className="superficie w-full p-6">
              <FormularioCadastro codigo={codigo.toUpperCase()} />
            </div>
            <Link href="/entrar" className="text-sm text-cinza hover:text-ouro transition-colors">
              Já tenho conta — entrar
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
