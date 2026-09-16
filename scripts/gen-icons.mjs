#!/usr/bin/env node
/**
 * Gera os icones do PWA a partir do brasao oficial.
 *
 * O brasao NAO e redesenhado nem recolorido: as imagens sao apenas
 * redimensionadas. A versao "maskable" recebe margem para o Android poder
 * recortar em circulo sem cortar o escudo.
 *
 *   npm run gen:icons
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const ORIGEM = path.join(RAIZ, "public/brand/brasao.jpg");
const DESTINO = path.join(RAIZ, "public/icons");
const FUNDO = { r: 10, g: 10, b: 10, alpha: 1 }; // preto carvao da identidade

const tamanhos = [72, 96, 128, 144, 152, 192, 256, 384, 512];

await mkdir(DESTINO, { recursive: true });

for (const tamanho of tamanhos) {
  await sharp(ORIGEM)
    .resize(tamanho, tamanho, { fit: "contain", background: FUNDO })
    .png()
    .toFile(path.join(DESTINO, `icone-${tamanho}.png`));
}

// Apple: sem transparencia, tamanho fixo.
await sharp(ORIGEM)
  .resize(180, 180, { fit: "contain", background: FUNDO })
  .flatten({ background: FUNDO })
  .png()
  .toFile(path.join(DESTINO, "apple-touch-icon.png"));

// Maskable: 80% do quadro, com margem de seguranca.
const interno = Math.round(512 * 0.8);
const margem = Math.round((512 - interno) / 2);
await sharp(ORIGEM)
  .resize(interno, interno, { fit: "contain", background: FUNDO })
  .extend({ top: margem, bottom: margem, left: margem, right: margem, background: FUNDO })
  .png()
  .toFile(path.join(DESTINO, "icone-maskable-512.png"));

// Favicon
await sharp(ORIGEM).resize(32, 32, { fit: "contain", background: FUNDO }).png()
  .toFile(path.join(DESTINO, "favicon-32.png"));

console.log(`✓ ${tamanhos.length + 3} icones gerados em public/icons a partir do brasao oficial`);
