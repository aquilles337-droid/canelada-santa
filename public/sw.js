/* eslint-disable */
/**
 * Service worker do Canelada Santa.
 *
 * Três responsabilidades:
 *
 *   1. Guardar o essencial do aplicativo para ele abrir mesmo sem internet,
 *      caindo numa tela de "sem conexão" honesta em vez de erro do navegador.
 *   2. Receber as notificações do Web Push.
 *   3. Levar a pessoa direto para a tela certa quando ela toca no aviso.
 *
 * Escrito à mão de propósito: é pequeno, previsível e não depende de
 * empacotador nenhum.
 */

const VERSAO = "canelada-santa-v1";
const CACHE_ESTATICO = `${VERSAO}-estatico`;
const CACHE_PAGINAS = `${VERSAO}-paginas`;
const PAGINA_OFFLINE = "/offline";

const ESSENCIAIS = [
  PAGINA_OFFLINE,
  "/manifest.webmanifest",
  "/brand/brasao.jpg",
  "/icons/icone-192.png",
  "/icons/icone-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_ESTATICO)
      .then((cache) => cache.addAll(ESSENCIAIS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes.filter((nome) => !nome.startsWith(VERSAO)).map((nome) => caches.delete(nome)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;

  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin) return;

  // Nada de API no cache: presença, pagamento e placar precisam ser sempre
  // o dado de agora, nunca uma cópia velha.
  if (url.pathname.startsWith("/api/")) return;

  // Navegação: tenta a rede e, sem conexão, mostra a última versão vista ou
  // a tela de offline.
  if (requisicao.mode === "navigate") {
    evento.respondWith(
      fetch(requisicao)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE_PAGINAS).then((cache) => cache.put(requisicao, copia));
          return resposta;
        })
        .catch(async () => {
          const guardada = await caches.match(requisicao);
          return guardada || caches.match(PAGINA_OFFLINE);
        }),
    );
    return;
  }

  // Arquivos estáticos: cache primeiro, porque não mudam sem mudar de nome.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/")
  ) {
    evento.respondWith(
      caches.match(requisicao).then(
        (guardada) =>
          guardada ||
          fetch(requisicao).then((resposta) => {
            const copia = resposta.clone();
            caches.open(CACHE_ESTATICO).then((cache) => cache.put(requisicao, copia));
            return resposta;
          }),
      ),
    );
  }
});

self.addEventListener("push", (evento) => {
  if (!evento.data) return;

  let dados;
  try {
    dados = evento.data.json();
  } catch {
    dados = { title: "Canelada Santa", body: evento.data.text() };
  }

  evento.waitUntil(
    self.registration.showNotification(dados.title || "Canelada Santa", {
      body: dados.body || "",
      icon: "/icons/icone-192.png",
      badge: "/icons/icone-96.png",
      tag: dados.tag || "canelada-santa",
      renotify: true,
      data: { url: dados.url || "/inicio" },
      vibrate: [80, 40, 80],
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || "/inicio";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      // Se o aplicativo já está aberto, só leva para a tela certa.
      for (const janela of janelas) {
        if (janela.url.includes(self.location.origin) && "focus" in janela) {
          janela.navigate(destino);
          return janela.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
