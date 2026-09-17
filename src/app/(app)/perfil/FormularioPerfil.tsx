"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { salvarMeuPerfil } from "@/server/actions/jogadores";
import { enviarFotoDePerfilAction } from "@/server/actions/fotos";
import { Botao } from "@/components/ui/Botao";
import { Campo, Selecao } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import type { Profile } from "@/lib/supabase/tipos";

export function FormularioPerfil({ perfil }: { perfil: Profile }) {
  const toast = useToast();
  const campoDaFoto = useRef<HTMLInputElement>(null);
  const [posicao, setPosicao] = useState<string>(perfil.position);
  const [estado, acao, enviando] = useActionState(salvarMeuPerfil, null);
  const [estadoDaFoto, acaoDaFoto, enviandoFoto] = useActionState(enviarFotoDePerfilAction, null);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) toast.sucesso("Perfil salvo.");
    else toast.erro(estado.mensagem);
  }, [estado, toast]);

  useEffect(() => {
    if (!estadoDaFoto) return;
    if (estadoDaFoto.ok) {
      toast.sucesso("Foto atualizada.");
      if (campoDaFoto.current) campoDaFoto.current.value = "";
    } else {
      toast.erro(estadoDaFoto.mensagem);
    }
  }, [estadoDaFoto, toast]);

  return (
    <>
    <form action={acaoDaFoto} className="mb-4 flex flex-col gap-2">
      <p className="text-xs uppercase tracking-widest text-cinza">Minha foto</p>
      <input
        ref={campoDaFoto}
        type="file"
        name="foto"
        accept="image/jpeg,image/png,image/webp"
        required
        className="w-full rounded-xl border border-linha bg-carvao/70 px-3 py-2.5 text-sm text-cinza file:mr-3 file:rounded-lg file:border-0 file:bg-elevado file:px-3 file:py-1.5 file:text-xs file:text-osso"
      />
      <Botao type="submit" variante="escuro" larguraTotal carregando={enviandoFoto}>
        Trocar foto
      </Botao>
    </form>

    <form action={acao} className="flex flex-col gap-4">
      <Campo name="nome" rotulo="Nome completo" defaultValue={perfil.full_name} required />
      <Campo name="apelido" rotulo="Apelido" defaultValue={perfil.nickname ?? ""} ajuda="Como o grupo te chama" />

      <Selecao name="posicao" rotulo="Posição" value={posicao} onChange={(e) => setPosicao(e.target.value)}>
        <option value="linha">Linha</option>
        <option value="fixo">Fixo</option>
        <option value="ala">Ala</option>
        <option value="pivo">Pivô</option>
        <option value="goleiro">Goleiro</option>
      </Selecao>

      {posicao !== "goleiro" && (
        <label className="flex items-center gap-3 rounded-xl border border-linha bg-carvao/60 px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            name="goleiro"
            defaultChecked={perfil.is_goalkeeper}
            className="size-5 accent-[#c9a227]"
          />
          <span className="text-sm text-osso">
            Também pego de goleiro
            <span className="block text-xs text-cinza-escuro">
              O sorteio distribui um goleiro por time.
            </span>
          </span>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo
          name="peso"
          rotulo="Peso (kg)"
          inputMode="decimal"
          defaultValue={perfil.weight_kg ?? ""}
          ajuda="Opcional"
        />
        <Campo
          name="altura"
          rotulo="Altura (cm)"
          inputMode="numeric"
          defaultValue={perfil.height_cm ?? ""}
          ajuda="Opcional"
        />
      </div>

      <Botao type="submit" larguraTotal carregando={enviando}>
        Salvar
      </Botao>
    </form>
    </>
  );
}
