# Carrasco Fit — Agente Local de Acesso (Control iD iDFace)

Este subprojeto contém o **Agente Local** em Node.js/TypeScript encarregado de sincronizar a fila de comandos de liberação física de catracas e relatar status de conectividade do equipamento da **Control iD** diretamente com o banco de dados do Carrasco Fit na nuvem.

Esta arquitetura híbrida evita qualquer bloqueio de rede (CORS ou IP inalcançável) quando a aplicação está publicada na nuvem (Vercel), pois toda a ponte é estabelecida de forma assíncrona por meio do **Google Cloud Firestore**.

---

## 🛠️ Requisitos de Instalação

1.  **Node.js LTS** (Versão 18 ou superior) instalado no computador local que permanecerá ligado na academia.
2.  O computador deve estar conectado na **mesma rede local (LAN)** que a catraca física (IP `192.168.1.100`).
3.  Acesso à internet para comunicação com o Firestore.

---

## 📦 Passos de Configuração

### Passo 1: Obter a Chave de Serviço do Firebase
1.  Acesse o [Firebase Console](https://console.firebase.google.com/).
2.  Abra o seu projeto **Carrasco Fit**.
3.  No menu superior esquerdo, clique na engrenagem ao lado de "Visão geral do projeto" e selecione **Configurações do projeto**.
4.  Acesse a aba **Contas de serviço**.
5.  Clique no botão **Gerar nova chave privada**.
6.  Salve o arquivo JSON baixado dentro da pasta `agent-local` com o nome de `serviceAccountKey.json`.
    > ⚠️ **IMPORTANTE:** Nunca compartilhe ou envie este arquivo JSON para repositórios públicos (Git), pois ele concede acesso administrativo ao seu banco. Ele já está listado no `.gitignore` global.

### Passo 2: Configurar o Arquivo `.env`
1.  Duplique o arquivo `.env.example` nesta pasta e renomeie-o para `.env`.
2.  Abra o `.env` e ajuste as credenciais de acordo com a sua academia:
    ```ini
    # Endereço local da catraca
    CATRACA_IP=192.168.1.100
    CATRACA_PORT=443
    CATRACA_PROTOCOL=https
    
    # Credenciais do equipamento
    CATRACA_USER=admin
    CATRACA_PASSWORD=admin
    
    # Modelo e acionamento
    CATRACA_MODEL=idface
    CATRACA_RELEASE_ACTION=sec_box
    ```

---

## 🚀 Como Executar o Agente

Abra o terminal (Prompt de Comando ou PowerShell) na pasta `agent-local` e execute os seguintes comandos:

### 1. Instalar as dependências
```bash
npm install
```

### 2. Iniciar em modo de desenvolvimento (escuta ativa)
```bash
npm run dev
```

### 3. Iniciar em modo de produção
Para rodar de forma contínua em segundo plano na recepção, compile e inicie o serviço:
```bash
npm run build
npm run start
```

*Dica profissional:* Em ambientes de produção do Windows, recomenda-se configurar o script compilado `dist/agent.js` para ser executado como um **Serviço do Windows** usando ferramentas como o `PM2` (`pm2 start dist/agent.js --name "carrasco-agent"`) ou o `NSSM` (Non-Sucking Service Manager) para que ele seja iniciado automaticamente sempre que o computador da recepção for ligado.

---

## 🔒 Funcionamento e Segurança do Fluxo
*   **Comandos Pendentes:** O Agente monitora a coleção `hardwareCommands` buscando status `pending`. Ao capturar, altera para `processing` antes de acionar a porta física da catraca, evitando pulsos duplos no relé.
*   **Heartbeat Online/Offline:** A cada 10 segundos o agente valida a conexão com a catraca local e atualiza o status de rede no Firestore. Isso faz com que o painel web exiba instantaneamente a bolinha verde de conectado.
*   **Privacidade:** Nenhuma senha ou dado restrito de autenticação trafega pela nuvem; todas as chamadas sensíveis ocorrem localmente de forma encriptada.
