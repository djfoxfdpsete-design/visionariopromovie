@echo off
echo Iniciando envio para o GitHub...
echo.

cd /d "C:\Users\uso\.gemini\antigravity\scratch\migracao_ia_studio"

echo 1. Adicionando arquivos...
git add .

echo 2. Criando pacote (Commit)...
git commit -m "Envio automatico via script"

echo 3. Enviando para a nuvem (Push)...
git push -f origin main

echo.
echo ===================================================
echo SE APARECEU "Everything up-to-date", DEU CERTO!
echo SE APARECEU "writing objects... 100%", DEU CERTO!
echo ===================================================
echo.
pause
