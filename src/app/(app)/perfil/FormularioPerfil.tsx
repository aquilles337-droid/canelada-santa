"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarMeuPerfil } from "@/server/actions/jogadores";
import { enviarFotoDePerfilAction } from "@/server/actions/fotos";
import { EnvioDeFoto } from "@/components/ui/EnvioDeFoto";
import { Botao } from "@/components/ui/Botao";
import { Campo, Selecao } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import type { Profile } from "@/lib/supabase/tipos";

export function FormularioPerfil({ perfil }: { perfil: Profile }) {
  const toast = useToast();
  const router = useRouter();
  const [posicao, setPosicao] = useState<string>(perfil.position);
  const [estado, acao, enviando] = useActionState(salvarMeuPerfil, null);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) toast.sucesso("Perfil salvo.");
    else toast.erro(estado.mensagem);
  }, [estado, toast]);

  return (
    <>
    <div className="mb-4">
      <EnvioDeFoto
        acao={(formulario) => enviarFotoDePerfilAction(null, formulario)}
        rotulo="Minha foto"
        textoDoBotao="Trocar foto"
        larguraMaxima={800}
        aoConcluir={() => router.refresh()}
      />
    </div>

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
