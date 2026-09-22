#!/usr/bin/env node
/**
 * Apaga do Storage os arquivos de foto que não pertencem mais a nenhuma
 * rodada — o rastro que o reinício de temporada deixa para trás.
 *
 *   npm run fotos:limpar          # mostra o que apagaria, sem apagar
 *   npm run fotos:limpar -- --sim # apaga de verdade
 *
 * Por que existe: o Supabase proíbe apagar linha de storage.objects por
 * SQL, justamente para o arquivo não ficar órfão no disco. Quem apaga
 * arquivo é a Storage API, e é por ela que este script passa.
 *
 * Órfão aqui tem definição estreita de propósito: arquivo no balde
 * fotos-rodadas que NÃO tem linha correspondente em round_photos. Foto de
 * rodada que ainda existe nunca é tocada.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BALDE = "fotos-rodadas";

// O Next lê o .env.local sozinho; um script solto, não. No servidor as
// variáveis já vêm do ambiente, então o arquivo é opcional.
function carregarEnvLocal() {
  let texto;
  try {
    texto = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const linha of texto.split("\n")) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual < 0) continue;
    const chave = limpa.slice(0, igual).trim();
    if (process.env[chave]) continue;
    process.env[chave] = limpa.slice(igual + 1).trim().replace(/^["']|["']$/g, "");
  }
}

// Lista o balde inteiro, inclusive o que está dentro de pastas.
async function listarTudo(cliente, prefixo = "") {
  const encontrados = [];
  let pagina = 0;

  for (;;) {
    const { data, error } = await cliente.storage
      .from(BALDE)
      .list(prefixo, { limit: 100, offset: pagina * 100 });

    if (error) throw new Error(`Nao deu para listar "${prefixo || "/"}": ${error.message}`);
    if (!data || data.length === 0) break;

    for (const item of data) {
      const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
      // Pasta vem sem id; arquivo vem com id.
      if (item.id) encontrados.push(caminho);
      else encontrados.push(...(await listarTudo(cliente, caminho)));
    }

    if (data.length < 100) break;
    pagina += 1;
  }

  return encontrados;
}

async function principal() {
  carregarEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chave) {
    console.error("");
    console.error("Faltam as chaves do Supabase.");
    console.error("Preencha NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    console.error("");
    process.exit(1);
  }

  const apagarDeVerdade = process.argv.includes("--sim");
  const cliente = createClient(url, chave, { auth: { persistSession: false } });

  const { data: fotos, error } = await cliente.from("round_photos").select("storage_path");
  if (error) {
    console.error(`Nao deu para ler as fotos das rodadas: ${error.message}`);
    process.exit(1);
  }

  const emUso = new Set((fotos ?? []).map((f) => f.storage_path));
  const noBalde = await listarTudo(cliente);
  const orfaos = noBalde.filter((caminho) => !emUso.has(caminho));

  console.log("");
  console.log(`Arquivos no balde ${BALDE}: ${noBalde.length}`);
  console.log(`Ainda em uso por alguma rodada: ${emUso.size}`);
  console.log(`Orfaos (sem dono):             ${orfaos.length}`);
  console.log("");

  if (orfaos.length === 0) {
    console.log("Nada a limpar.");
    console.log("");
    return;
  }

  if (!apagarDeVerdade) {
    for (const caminho of orfaos.slice(0, 20)) console.log(`  • ${caminho}`);
    if (orfaos.length > 20) console.log(`  … e mais ${orfaos.length - 20}`);
    console.log("");
    console.log("Isto foi so um ensaio. Para apagar de verdade:");
    console.log("  npm run fotos:limpar -- --sim");
    console.log("");
    return;
  }

  // A Storage API aceita 100 por vez sem reclamar do tamanho da requisicao.
  let apagados = 0;
  for (let i = 0; i < orfaos.length; i += 100) {
    const lote = orfaos.slice(i, i + 100);
    const { error: erroRemocao } = await cliente.storage.from(BALDE).remove(lote);
    if (erroRemocao) {
      console.error(`Falhou ao apagar um lote: ${erroRemocao.message}`);
      process.exit(1);
    }
    apagados += lote.length;
    console.log(`  ${apagados}/${orfaos.length} apagados`);
  }

  console.log("");
  console.log(`Pronto: ${apagados} arquivos orfaos apagados do Storage.`);
  console.log("");
}

principal().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
