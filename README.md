<div align="center">
  <img src="public/brand/brasao.jpg" alt="Canelada Santa" width="180" />

  # Canelada Santa

  **O aplicativo oficial do nosso racha.**

  Lista de presença com prioridade de mensalista, cobrança por PIX,
  times equilibrados no sorteio, modo jogo e estatísticas por temporada.
</div>

---

## O que o aplicativo faz

| Para o jogador | Para o administrador |
|---|---|
| Confirma presença em um toque | Cria a rodada em passos, com resumo antes de abrir |
| Vê a posição na lista de espera | Acompanha confirmados, espera e pagamentos |
| Recebe aviso quando abre vaga | Gera times equilibrados e compartilha no WhatsApp |
| Paga mensalidade e avulso por PIX | Marca presença e falta, com multa automática |
| Leva convidado dentro da cota | Dá baixa em quem pagou na quadra |
| Acompanha placar ao vivo | Controla o jogo: cronômetro, gols e "quem ganha fica" |
| Vota no craque e no bagre | Ajusta todos os valores e prazos do grupo |
| Vê ranking, histórico e Hall da Fama | Convida gente nova por link, código ou QR |

---

## Sumário

1. [Antes de começar](#1-antes-de-começar)
2. [Configurar o Supabase](#2-configurar-o-supabase)
3. [Configurar o Mercado Pago](#3-configurar-o-mercado-pago)
4. [Gerar as chaves de notificação](#4-gerar-as-chaves-de-notificação)
5. [Rodar na sua máquina](#5-rodar-na-sua-máquina)
6. [Colocar no ar na Hostinger](#6-colocar-no-ar-na-hostinger)
7. [Ligar as tarefas automáticas](#7-ligar-as-tarefas-automáticas)
8. [Primeiro acesso do grupo](#8-primeiro-acesso-do-grupo)
9. [Como o sistema funciona por dentro](#9-como-o-sistema-funciona-por-dentro)
10. [Testes e verificação](#10-testes-e-verificação)
11. [Perguntas frequentes](#11-perguntas-frequentes)

---

## 1. Antes de começar

Você vai precisar de:

- **Node.js 20 ou mais novo** — confira com `node -v`
- Uma conta no **Supabase** (banco de dados e login)
- Uma conta no **Mercado Pago** (para receber por PIX)
- Um servidor para hospedar — o guia assume **VPS da Hostinger com Node**

Baixe o projeto e instale:

```bash
git clone https://github.com/aquilles337-droid/canelada-santa.git
cd canelada-santa
npm install
cp .env.example .env.local
```

O arquivo `.env.local` é onde ficam as chaves. **Ele nunca vai para o GitHub** — já está
protegido no `.gitignore`. As seções 2, 3 e 4 explicam de onde vem cada chave.

---

## 2. Configurar o Supabase

O Supabase guarda os jogadores, as rodadas, os pagamentos e cuida do login.

### 2.1 Criar o projeto

1. Entre em **https://supabase.com** e faça login.
2. Clique em **New project**.
3. Preencha:
   - **Name**: `canelada-santa`
   - **Database Password**: crie uma senha forte e **guarde num lugar seguro** — ela não
     aparece de novo
   - **Region**: `South America (São Paulo)`
4. Clique em **Create new project** e aguarde cerca de dois minutos.

### 2.2 Pegar as três chaves

No painel do projeto, vá em **Project Settings** (a engrenagem, embaixo à esquerda) →
**API Keys**.

| O que copiar | Onde está | Vai para |
|---|---|---|
| **Project URL** | Em cima, algo como `https://abcdefgh.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon / public** | Chave pública | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role** | Clique em **Reveal** para mostrar | `SUPABASE_SERVICE_ROLE_KEY` |

> ⚠️ A chave **service_role** ignora todas as regras de segurança do banco. Ela só pode viver
> no servidor, nunca num site, num print ou numa mensagem. O código já garante isso: qualquer
> tentativa de usá-la no navegador faz a compilação falhar.

Cole no `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL="https://abcdefgh.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."
```

### 2.3 Criar as tabelas

No painel do Supabase, abra o **SQL Editor** (ícone de banco de dados, no menu da esquerda) e
rode **na ordem**, um arquivo por vez, copiando e colando o conteúdo:

```
supabase/migrations/0001_types.sql
supabase/migrations/0002_core.sql
supabase/migrations/0003_rounds.sql
supabase/migrations/0004_teams_matches.sql
supabase/migrations/0005_finance.sql
supabase/migrations/0006_votes_social.sql
supabase/migrations/0007_functions_views.sql
supabase/migrations/0008_rls.sql
supabase/migrations/0009_presenca.sql
supabase/migrations/0010_financeiro_regras.sql
supabase/migrations/0011_pagamentos.sql
supabase/migrations/0012_estatisticas.sql
supabase/migrations/0013_fotos.sql
supabase/migrations/0014_corrige_guarda_de_perfil.sql
supabase/migrations/0015_sincroniza_mensalidade.sql
supabase/migrations/0016_reabrir_cobranca.sql
```

Depois rode o `supabase/seed.sql`, que cria a temporada atual e o catálogo de conquistas.

> Se preferir a linha de comando, com a CLI do Supabase instalada:
> `supabase link --project-ref SEU_REF && supabase db push`

### 2.3.1 Conferir se ficou tudo

Cole `supabase/verificar-instalacao.sql` no SQL Editor e rode. Ele lista o que falta.
Se responder **"o banco esta completo"**, pode seguir. Qualquer linha com **FALTANDO** aponta a
migration que não passou — rode aquele arquivo de novo e confira o erro que ele der.

Vale a pena rodar sempre que uma tela der erro de servidor: quase todo erro assim é um objeto
do banco que ficou para trás.

### 2.4 Ajustar o login

O Canelada Santa entra por **telefone e senha**. Por baixo, o Supabase guarda um e-mail
criado a partir do telefone — isso evita pagar por SMS sem mudar nada para quem usa.

Em **Authentication → Sign In / Providers**:

- **Email**: ligado
- **Confirm email**: **desligado** (o e-mail é interno e não existe de verdade)
- **Phone**: pode deixar desligado

Em **Authentication → URL Configuration**, coloque o endereço do seu site em **Site URL**.

---

## 3. Configurar o Mercado Pago

É o que permite o pessoal pagar mensalidade e avulso por PIX dentro do aplicativo, com baixa
automática.

### 3.1 Criar a aplicação

1. Entre em **https://www.mercadopago.com.br/developers/panel** com a conta que **recebe** o
   dinheiro do racha.
2. No menu da esquerda, clique em **Suas integrações**.
3. Clique em **Criar aplicação**.
4. Preencha:
   - **Nome da aplicação**: `Canelada Santa`
   - **Produto que você vai integrar**: escolha **Pagamentos online**
   - **Plataforma de e-commerce?** → **Não**
   - **Como você vai processar pagamentos?** → **Checkout Transparente** (ou "API de Pagamentos")
5. Clique em **Criar aplicação**.

### 3.2 Pegar o Access Token

1. Dentro da aplicação recém-criada, no menu da esquerda, clique em
   **Credenciais de produção**.
2. Se pedir, complete os dados da conta (nome, CPF/CNPJ, atividade) — o Mercado Pago exige
   isso antes de liberar produção.
3. Copie o **Access Token**. Ele começa com `APP_USR-`.

```env
MP_ACCESS_TOKEN="APP_USR-0000000000000000-000000-abcdef..."
PAYMENT_PROVIDER="mercadopago"
```

> 💡 Para testar sem cobrar ninguém de verdade, use **Credenciais de teste** no mesmo menu,
> ou simplesmente deixe `PAYMENT_PROVIDER="mock"`. No modo `mock`, o aplicativo gera um PIX
> de mentira e o fluxo inteiro funciona sem tocar em dinheiro real.

### 3.3 Configurar o aviso de pagamento (webhook)

É **o passo mais importante** do Mercado Pago. Sem ele, o pagamento cai na sua conta mas o
aplicativo nunca fica sabendo, e a pendência do jogador não some.

1. Na mesma aplicação, no menu da esquerda, clique em **Webhooks** (ou **Notificações →
   Webhooks**).
2. Clique em **Configurar notificações**.
3. Em **URL de produção**, coloque o endereço do seu site seguido do caminho do webhook:

   ```
   https://SEU-DOMINIO.com.br/api/webhooks/mercadopago
   ```

4. Em **Eventos**, marque **Pagamentos** (`payment`). Pode deixar o resto desmarcado.
5. Clique em **Salvar**.
6. Depois de salvar, a tela mostra uma **Assinatura secreta** (*Secret key* / *Chave secreta*).
   Clique no olho ou em **Copiar** e guarde.

```env
MP_WEBHOOK_SECRET="sua-assinatura-secreta-aqui"
```

> 🔒 Essa assinatura é o que prova que o aviso veio mesmo do Mercado Pago. O aplicativo
> confere a assinatura de cada notificação e, mesmo quando ela é válida, **vai perguntar ao
> Mercado Pago qual é a situação real do pagamento** antes de dar qualquer coisa como paga.
> Ninguém consegue liberar um pagamento mandando uma mensagem forjada.

### 3.4 Conferir que funcionou

Depois que o site estiver no ar:

1. Abra `https://SEU-DOMINIO.com.br/api/webhooks/mercadopago` no navegador. Deve responder
   `{"servico":"canelada-santa","webhook":"mercadopago"}`.
2. No painel do Mercado Pago, em **Webhooks**, use o botão **Simular** e escolha o evento de
   pagamento. A resposta precisa ser **200**.

---

## 4. Gerar as chaves de notificação

São elas que permitem avisar no celular que abriu vaga. Rode:

```bash
npm run gen:vapid
```

O comando imprime quatro linhas prontas. Copie para o `.env.local`:

```env
VAPID_PUBLIC_KEY="B..."
VAPID_PRIVATE_KEY="..."
NEXT_PUBLIC_VAPID_PUBLIC_KEY="B..."
VAPID_SUBJECT="mailto:seu-email@exemplo.com"
```

Gere também o segredo das tarefas automáticas:

```bash
openssl rand -hex 32
```

```env
CRON_SECRET="cole-o-resultado-aqui"
```

> As notificações são opcionais: sem essas chaves o aplicativo funciona normalmente, só deixa
> de avisar no celular — os avisos continuam aparecendo dentro do aplicativo.

---

## 5. Rodar na sua máquina

```bash
npm run dev
```

Abra **http://localhost:3000**.

### Criar o primeiro administrador

Ninguém entra sem convite — inclusive você. Para criar o primeiro acesso:

1. No Supabase, abra o **SQL Editor** e rode:

   ```sql
   insert into public.invitations (code, max_uses, note)
   values ('PRIMEIRO', 1, 'primeiro administrador');
   ```

2. Acesse **http://localhost:3000/convite/PRIMEIRO** e faça seu cadastro.
3. De volta ao SQL Editor, promova sua conta (troque pelo seu telefone com DDI 55):

   ```sql
   update public.profiles
   set role = 'admin', is_member = true
   where phone = '5582988887777';
   ```

4. Recarregue o aplicativo. O atalho **Admin** aparece na barra de baixo.

Daqui em diante é tudo pela interface: **Admin → Jogadores → Convidar jogador** gera link,
código e QR Code para mandar no grupo.

---

## 6. Colocar no ar na Hostinger

Estas instruções são para **VPS com Node.js**. Hospedagem compartilhada não roda Next.js.

```bash
# conectado ao servidor por SSH
git clone https://github.com/aquilles337-droid/canelada-santa.git
cd canelada-santa
npm ci
cp .env.example .env     # preencha com as chaves reais
npm run build
```

Mantenha o aplicativo rodando com PM2:

```bash
npm install -g pm2
pm2 start npm --name canelada-santa -- start
pm2 save
pm2 startup        # siga a linha que ele imprimir, para subir sozinho no reboot
```

Aponte o domínio para o servidor e coloque o Nginx na frente, com HTTPS:

```nginx
server {
    server_name seu-dominio.com.br;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo certbot --nginx -d seu-dominio.com.br
```

> 📱 **O HTTPS não é opcional.** Sem ele o celular não instala o aplicativo na tela inicial e
> as notificações não funcionam.

Depois de subir, ajuste no `.env` do servidor:

```env
NEXT_PUBLIC_APP_URL="https://seu-dominio.com.br"
```

E rode `npm run build && pm2 restart canelada-santa`.

---

## 7. Ligar as tarefas automáticas

São elas que fecham a lista no horário, liberam as vagas para os avulsos cinco horas antes,
chamam a próxima pessoa da fila, recolhem a vaga de quem não respondeu e geram a mensalidade
do mês. **Sem isso, nada acontece sozinho.**

O jeito de ligar depende de onde o aplicativo está hospedado.

### Se você tem VPS (acesso por SSH)

```bash
crontab -e
```

```cron
* * * * * curl -fsS -m 50 -H "x-cron-secret: SEU_CRON_SECRET" https://seu-dominio.com.br/api/cron/tick > /dev/null 2>&1
```

### Se você está em hospedagem gerenciada (sem SSH)

Você não tem terminal, então alguém de fora precisa fazer a chamada. Três
caminhos, em ordem de recomendação:

**1. O agendador do próprio painel.** Procure por **Cron Jobs** no hPanel. Se existir,
cadastre o mesmo comando `curl` da caixa acima.

**2. Um serviço de cron gratuito** — [cron-job.org](https://cron-job.org) é o mais simples:

   - **URL**: `https://seu-dominio.com.br/api/cron/tick`
   - **Intervalo**: a cada 1 minuto
   - Em **Advanced / Headers**, acrescente o cabeçalho
     `x-cron-secret` com o valor do seu `CRON_SECRET`

**3. O GitHub**, usando `.github/workflows/tarefas-agendadas.yml`, que já vem no
   repositório. Cadastre `APP_URL` e `CRON_SECRET` em
   *Settings → Secrets and variables → Actions*. Duas limitações: o agendamento só
   roda a partir da **branch padrão**, e o horário atrasa de 5 a 15 minutos quando o
   GitHub está cheio.

> 🔒 Seja qual for o caminho, o `CRON_SECRET` vai num **cabeçalho**, nunca na
> URL — endereço fica gravado em log de servidor, cabeçalho não.

Para conferir se está funcionando, entre no aplicativo como administrador e vá em
**Admin → Ajustes**. No final da página, o cartão **Tarefas automáticas** mostra as últimas
execuções. Se aparecer "O cron do servidor ainda não chamou o aplicativo", algo está errado
na linha acima.

---

## 8. Primeiro acesso do grupo

1. **Admin → Ajustes**: confira mensalidade, valor do avulso, multas, cota de convidados e os
   padrões da rodada. Nada disso está fixo no código — tudo se muda por aqui.
2. **Admin → Jogadores**: gere um convite e mande no grupo do WhatsApp.
3. Conforme o pessoal entrar, marque quem é **mensalista**.
4. **Admin → Jogadores → Gerenciar** também é onde se promove outro administrador.
5. Peça para todo mundo abrir o **Perfil** e **ativar as notificações** — é assim que o aviso
   de vaga chega.
6. **Admin → Rachas → Novo racha**: crie a primeira rodada. A lista abre e o grupo é avisado.

---

## 9. Como o sistema funciona por dentro

### Quem tem direito à vaga

- **Mensalista tem prioridade** sobre avulso, sempre.
- Dentro da mesma faixa, **entra quem confirmou primeiro**. Assiduidade é estatística de
  resenha e **nunca** decide vaga.
- **Até cinco horas antes** do racha, a vaga fica guardada para mensalistas: o avulso espera
  mesmo que esteja sobrando lugar.
- **Cinco horas antes**, as vagas que os mensalistas não ocuparam liberam para os avulsos, na
  ordem da fila.
- **Vaga confirmada é definitiva.** Um mensalista que aparece depois vai para o topo da
  espera e só entra se alguém cancelar — ninguém é tirado de dentro.
- Quem é chamado da fila tem prazo para responder (90 minutos, ou 30 quando falta pouco para
  a bola rolar). Passou o prazo, a vaga vai para o próximo.

### Dinheiro

- Todo valor é guardado em **centavos inteiros**, nunca com casas decimais quebradas.
- Cada cobrança tem uma **chave única**: a mesma regra nunca cobra a mesma pessoa duas vezes
  pelo mesmo motivo.
- **O aplicativo nunca confirma pagamento sozinho.** Voltar para a tela depois de pagar não
  muda nada — quem confirma é o aviso do Mercado Pago, e mesmo assim o sistema consulta a
  situação real antes de dar baixa.
- Quem está devendo de rodada anterior não entra em racha novo (ajustável em Ajustes).
- Cada rodada guarda os **valores que valiam quando foi criada**. Mudar a mensalidade hoje
  não reescreve o que aconteceu mês passado.

### Times

- Goleiros são separados e distribuídos **um por time** — nunca entram no sorteio da linha.
- O sorteio busca o menor desequilíbrio possível entre as somas de nota, evitando concentrar
  os mais fortes (ou os mais fracos) num time só.
- Peso e altura são guardados e pesam **muito pouco**: servem de desempate, nunca de
  habilidade.
- **Gerar novamente** devolve times de verdade diferentes, com o mesmo nível de equilíbrio.

### Durante o jogo

- Quem ganha fica; quem perde sai.
- No empate: com **duas ou mais equipes fora**, as duas que estavam em campo saem. Com
  **apenas uma equipe fora**, o aplicativo **sorteia** quem sai — e grava o sorteio no
  histórico da partida, com horário e tudo, para não sobrar discussão.
- Registrar gol e assistência é **opcional**. O que o grupo não registrar, o sistema não
  inventa.

### Estrutura do código

```
src/domain/      as regras do racha, sem banco e sem tela — é o que os testes cobrem
src/server/      serviços, pagamentos, tarefas agendadas e as ações do servidor
src/app/         as telas e os endpoints
supabase/        as migrações do banco e as asserções que as validam
```

---

## 10. Testes e verificação

```bash
npm test          # regras do racha (fila, multas, times, estatísticas…)
npm run typecheck # tipos
npm run lint      # padrões de código
npm run build     # build de produção
npm run db:local  # sobe um PostgreSQL temporário e valida as migrações
```

O `npm run db:local` sobe um banco de verdade na sua máquina, aplica todas as migrações e
**tenta violar cada regra**, exigindo que o banco recuse: entrar duas vezes na mesma lista,
votar em si mesmo, cobrar a mesma coisa duas vezes, um webhook repetido confirmar o pagamento
de novo. Se alguma proteção sumir numa alteração futura, isso quebra antes de chegar no
Supabase.

---

## 11. Perguntas frequentes

**O pessoal pode entrar sem convite?**
Não. Cadastro só por convite de administrador — link, código ditado ou QR Code.

**O administrador também joga?**
Sim. Ele confirma presença, paga, entra no sorteio e aparece no ranking como qualquer um.
Ser administrador é só permissão, nunca isenção.

**Quem votou em quem aparece?**
Nunca. Tanto a nota do jogador quanto craque e bagre são anônimos: a tela recebe apenas a
contagem. Ninguém vota em si mesmo.

**Alguém pagou em dinheiro na quadra. E agora?**
**Admin → Dinheiro**, ache a pessoa e clique em **Pagou**. A baixa fica registrada com o nome
de quem deu.

**Marquei uma falta errada.**
Marque de novo. A multa anterior é cancelada antes de qualquer nova ser criada.

**O que acontece na virada do ano?**
No dia configurado (10 de janeiro, por padrão) começa uma temporada nova e as estatísticas
passam a contar nela. **Nada é apagado**: o histórico e o Hall da Fama continuam com tudo.

**Posso mudar os valores depois?**
Pode, a qualquer momento, em **Admin → Ajustes**. As rodadas que já existem não mudam.

---

<div align="center">
  <sub>⚽ Canelada Santa · Nossa Senhora do Carmo · Futsal</sub>
</div>
