@echo off
:: Desabilita exibição dos comandos internos para um visual limpo
title CARRASCO FIT - CONTROLE DE ACESSO FACIAL
color 0f

:: Ajusta as dimensões físicas da janela do CMD para caber perfeitamente o layout (96 colunas x 32 linhas)
mode con: cols=96 lines=32

:: Navega de forma segura para o diretório de execução onde este arquivo .bat está localizado
cd /d "%~dp0"

echo ==================================================================
echo             CARRASCO FIT - CONTROLE DE ACESSO FISICO
echo ==================================================================
echo  [INFO] Inicializando o Agente de Acesso Local...
echo  [INFO] Verificando integridade da aplicacao...
echo.

:: Libera de forma proativa a porta 8000 se ela estiver em uso por uma instancia travada do Node/Agente
echo  [INFO] Verificando se a porta 8000 esta ocupada...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    echo  [AVISO] Porta 8000 ocupada pelo Processo PID %%a. Liberando porta...
    taskkill /f /pid %%a >nul 2>&1
)
echo  [INFO] Porta 8000 pronta para uso.
echo.

:: Verifica se a pasta node_modules existe (se for a primeira execução do cliente)
if not exist "node_modules" (
    echo  [ALERTA] Dependencias locais nao localizadas!
    echo  [Acao] Executando instalacao silenciosa, por favor aguarde...
    call npm install --quiet
    echo  [SUCESSO] Dependencias instaladas.
    echo.
)

:: Verifica se o build compilado em JS existe
if not exist "dist\cli-dashboard.js" (
    echo  [ALERTA] Build compilado em JS nao localizado!
    echo  [Acao] Compilando arquivos TypeScript...
    call cmd /c "npm run build"
    echo  [SUCESSO] Compilacao concluida.
    echo.
)

echo  [INFO] Inicializando Painel Interativo de Acessos...
echo  ------------------------------------------------------------------
echo.

:: Executa a aplicação usando o Node nativo sobre o build compilado (alta performance)
node dist/cli-dashboard.js

:: Mantém o console aberto se a aplicação for encerrada por algum motivo
echo.
echo  [AVISO] A aplicacao foi encerrada.
pause
