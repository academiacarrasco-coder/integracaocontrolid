@echo off
title Carrasco Fit - Recepcao Standalone
color 0A

echo ====================================================
echo    CARRASCO FIT - CONTROLE DE ACESSO STANDALONE
echo ====================================================
echo.
echo [1/2] Iniciando Servidor Local de Desenvolvimento...
echo.

:: Abre o servidor web na porta 3000 em segundo plano
start /b cmd /c npm run dev

:: Aguarda 3 segundos para inicializacao do servidor
timeout /t 3 /nobreak >nul

echo [2/2] Abrindo Aplicativo de Recepcao em Modo Desktop...
echo.

:: Tenta abrir com o Google Chrome no modo Aplicativo (sem abas ou barras de navegacao)
start chrome --app=http://localhost:3000/recepcao

:: Caso nao tenha o Chrome, abre no Microsoft Edge no modo Aplicativo
if %errorlevel% neq 0 (
    start msedge --app=http://localhost:3000/recepcao
)

echo.
echo [OK] Aplicativo de recepcao iniciado com sucesso!
echo Este terminal pode ser minimizado. Nao o feche para manter o servidor ativo.
echo ====================================================
