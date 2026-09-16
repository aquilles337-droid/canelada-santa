"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { entrar } from "@/server/actions/auth";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { mascararTelefone } from "@/lib/phone";

export function FormularioEntrar({ destino }: { destino?: string }) {
  const router = useRouter();
  const [telefone, setTelefone] = useState("");
  const [estado, acao, enviando] = useActionState(entrar, null);

  useEffect(() => {
    if (estado?.ok) {
      router.replace(estado.dados.destino);
      router.refresh();
    }
  }, [estado, router]);

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      {destino && <input type="hidden" name="destino" value={destino} />}

      <Campo
        name="telefone"
        rotulo="Telefone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder="(82) 98888-7777"
        value={telefone}
        onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
        required
      />

      <Campo
        name="senha"
        rotulo="Senha"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        required
      />

      {estado && !estado.ok && (
        <p className="rounded-xl border border-vermelho/40 bg-vermelho/10 px-4 py-3 text-sm text-vermelho">
          {estado.mensagem}
        </p>
      )}

      <Botao type="submit" tamanho="lg" larguraTotal carregando={enviando}>
        Entrar
      </Botao>
    </form>
  );
}
