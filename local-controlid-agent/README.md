# Agente Local Control iD — Carrasco Fit 🏋️‍♂️

Este subprojeto contém o **Agente Local** oficial para integração física da controladora de acesso **Control iD iDFace** (ou modelos compatíveis) na rede local da academia com a nuvem do **Carrasco Fit** publicada na Vercel.

---

## ⚙️ 1. O que é o Agente Local?

O agente local é um serviço Node.js com TypeScript extremamente leve que é executado de forma contínua em um computador físico situado na recepção da academia (na mesma rede interna do leitor facial). Ele atua como uma **ponte inteligente de comunicação bidirecional** entre:

1.  **Firebase Firestore (Nuvem):** Escuta a fila de comandos e gerencia status e logs remotamente.
2.  **Control iD iDFace (Rede Física):** Faz as requisições HTTP REST internas locais para o IP privado do equipamento para liberar o acesso ou auditar o hardware.
3.  **Sistema Web (Vercel):** O painel administrativo consome os resultados que o agente escreve no Firestore.

---

## 🔒 2. Por que ele é necessário?

O sistema web administrativo do Carrasco Fit está publicado na nuvem da **Vercel** (`https://https-github-com-academiacarrasco-c-two.vercel.app/`).

Por questões rígidas de segurança de rede privada, **a nuvem da Vercel é incapaz de realizar chamadas de rede diretas a um IP privado de rede local** (como o IP `192.168.1.100` da controladora física na recepção):

```
[ Sistema na Nuvem da Vercel ]
              │
              ▼  (❌ Bloqueado: IP Privado Inalcançável)
   https://192.168.1.100:443/login.fcgi
```

Para contornar essa restrição técnica de forma ultra-segura e sem expor a rede da academia à internet pública (sem necessidade de abrir portas no roteador, configurar IP dinâmico/DDNS ou expor portas locais), utilizamos esta **arquitetura baseada em fila assíncrona**:

```
[ Sistema Carrasco Fit na Vercel ]
              │  (Cria comando pendente)
              ▼
    [ Firebase Firestore ] ◄────────────────────────┐
              │                                      │ (Escreve logs, heartbeats
              │ (Escuta reativa onSnapshot)          │  e resultados físicos)
              ▼                                      │
     [ Agente Local Node.js ] ───────────────────────┘
              │
              │  (Requisição REST local TCP/IP)
              ▼
 [ Control iD iDFace (192.168.1.100) ]
```

---

## 📋 3. Pré-requisitos de Instalação

*   **Node.js:** Versão 18 ou superior instalada na máquina da recepção (recomendado LTS).
*   **Conexão de Rede:** O computador executando o agente deve estar conectado via cabo ou Wi-Fi na mesma sub-rede física da catraca e ter comunicação de ping livre com o IP `192.168.1.100`.
*   **Chave do Firebase:** Um arquivo `service-account.json` administrativo gerado no Console do Firebase.

---

## 🚀 4. Passo a Passo para Implantação na Recepção

### Passo 1: Obter a Chave do Firebase
1.  Acesse o [Console do Firebase](https://console.firebase.google.com/).
2.  Entre no seu projeto e clique no ícone de **Engrenagem (Configurações do Projeto) ⚙️** no topo do menu lateral.
3.  Navegue até a aba **Contas de Serviço (Service Accounts)**.
4.  Clique no botão **Gerar Nova Chave Privada (Generate New Private Key)**.
5.  O console baixará um arquivo `.json` com credenciais administrativas.
6.  Salve este arquivo diretamente na raiz da pasta `local-controlid-agent/` e renomeie-o para:
    `service-account.json`

### Passo 2: Configurar o Arquivo de Ambiente (.env)
Duplique o arquivo `.env.example` para `.env` na raiz da pasta do agente:
```bash
cp .env.example .env
```
Abra o arquivo `.env` em um editor e preencha as variáveis correspondentes:
```ini
CONTROLID_PROTOCOL=https
CONTROLID_IP=192.168.1.100
CONTROLID_PORT=443
CONTROLID_LOGIN=admin
CONTROLID_PASSWORD=admin
CONTROLID_TIMEOUT_MS=7000

FIREBASE_PROJECT_ID=SUA_ID_DO_PROJETO
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# Define 0 para ignorar o aviso de certificado autoassinado (essencial para conexões locais HTTPS)
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Passo 3: Instalar as Dependências do Node.js
Abra um terminal/PowerShell, navegue até a pasta do agente e execute:
```bash
npm install
```

### Passo 4: Compilar e Iniciar o Agente

*   **Modo de Desenvolvimento (Hot Reload):**
    ```bash
    npm run dev
    ```

*   **Modo de Produção (Recomendado):**
    Compile o código TypeScript para Javascript nativo de alto desempenho e inicie o serviço:
    ```bash
    npm run build
    ```
    ```bash
    npm run start
    ```

---

## 🖥️ 5. Executando em Segundo Plano no Windows (Produção)

Na recepção da academia, o ideal é que o agente **inicie automaticamente junto com o Windows** e rode escondido em segundo plano sem que a recepcionista possa fechá-lo acidentalmente por clique.

Para fazer isso de forma profissional, recomendamos o gerenciador de processos **PM2**:

1.  Instale o PM2 globalmente no Windows:
    ```bash
    npm install -g pm2
    ```
2.  Inicie o agente com o PM2 de dentro da pasta `local-controlid-agent`:
    ```bash
    pm2 start dist/index.js --name "carrasco-controlid-agent"
    ```
3.  Garante a inicialização com o boot do Windows (opcional):
    Instale o utilitário `pm2-windows-service` ou simplesmente salve a lista de processos ativos do PM2:
    ```bash
    pm2 save
    ```

Dessa forma, o serviço rodará em segundo plano de forma silenciosa e reativa!

---

## 🔍 6. Guia de Resolução de Problemas (Troubleshooting)

### 🔴 Erro: `Falha de conexão no Heartbeat: leitor facial OFFLINE`
*   **Causa 1:** O computador da recepção perdeu a conectividade de rede com a catraca.
    *   *Solução:* Tente pingar a controladora a partir do terminal (`ping 192.168.1.100`). Verifique se o cabo ethernet da catraca está devidamente plugado no switch/roteador da recepção.
*   **Causa 2:** O IP do equipamento mudou (catraca configurada em DHCP dinâmico).
    *   *Solução:* Configure o IP da controladora física nas configurações internas do iDFace como estático/fixo para `192.168.1.100`.

### 🔴 Erro: `Arquivo de conta de serviço não encontrado em...`
*   **Causa:** O arquivo `service-account.json` não foi colocado na raiz ou possui nome incorreto.
    *   *Solução:* Certifique-se de que o arquivo JSON do Firebase Admin baixado está na raiz da pasta `local-controlid-agent/` com o nome exato de `service-account.json` e que a variável `GOOGLE_APPLICATION_CREDENTIALS` no seu `.env` aponta corretamente para ele.

### 🔴 Erro: `Falha no login com iDFace: Session limit exceeded`
*   **Causa:** Outros scripts legados estão rodando na recepção e consumindo as sessões da controladora sem fechar (a controladora física possui um limite rígido de sessões HTTP simultâneas).
    *   *Solução:* O nosso `ControlIdClient` fecha a sessão de forma limpa imediatamente após cada ação física chamando `/logout.fcgi`. Caso receba esse erro, reinicie o leitor facial iDFace desligando e ligando-o da tomada para limpar as conexões antigas travadas por outros scripts antigos.
