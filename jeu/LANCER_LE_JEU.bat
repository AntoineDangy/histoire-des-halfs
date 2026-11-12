@echo off
rem Lance la bêta du jeu « Course au large » sur ce PC (double-cliquer sur ce fichier).
rem Il faut Node.js (https://nodejs.org, version LTS). La première fois, l'installation prend 1 à 2 minutes.
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installez-le depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Premiere installation des composants du jeu...
  call npm install
)
echo Le jeu s'ouvre dans votre navigateur. Laissez cette fenetre ouverte pendant la partie ; fermez-la pour arreter.
start "" http://localhost:5173
call npm run dev
