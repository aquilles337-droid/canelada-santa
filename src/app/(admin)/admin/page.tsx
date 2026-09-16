import type { Metadata } from "next";
import { exigirAdmin } from "@/server/auth/sessao";
import { Cartao } from "@/components/ui/Cartao";

export const metadata: Metadata = { title: "Painel" };

export default async function PaginaAdmin() {
  const admin = await exigirAdmin();

  return (
    <div className="flex flex-col gap-4 animate-subir">
      <Cartao destaque>
        <h1 className="titulo-display text-xl">Olá, {admin.full_name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-cinza">Painel do Canelada Santa.</p>
      </Cartao>
    </div>
  );
}
