#!/usr/bin/env node
/**
 * Gera o par de chaves VAPID usado pelas notificações (Web Push).
 *
 *   npm run gen:vapid
 *
 * Copie a saída para o seu .env. A chave pública também vai para
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY, porque o navegador precisa dela para
 * assinar a inscrição. A privada NUNCA sai do servidor.
 */
import webpush from "web-push";

const chaves = webpush.generateVAPIDKeys();

console.log("");
console.log("Cole estas linhas no seu arquivo .env:");
console.log("");
console.log(`VAPID_PUBLIC_KEY="${chaves.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${chaves.privateKey}"`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${chaves.publicKey}"`);
console.log(`VAPID_SUBJECT="mailto:seu-email@exemplo.com"`);
console.log("");
console.log("Guarde a chave privada: ela nunca deve ir para o navegador nem para o repositório.");
console.log("");
