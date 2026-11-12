import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Version affichée à l'accueil (demande du porteur de projet, 12/11/2026) : « majeur.mineur » vient de jeu/package.json
// (à changer à la main pour une étape importante), le dernier nombre est le nombre d'enregistrements git du dossier jeu/
// (il monte tout seul). La date est celle de la construction, donc de la mise en ligne.
const git = (args: string) => {
  try {
    return execSync(`git ${args}`, { cwd: fileURLToPath(new URL('.', import.meta.url)), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};
const base = (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')).version as string).split('.').slice(0, 2).join('.');
const numero = git('rev-list --count HEAD -- :/jeu');

// base relative : la version compilée peut être posée dans un sous-dossier du site (§10).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { fs: { allow: ['../..'] } },
  define: {
    __VERSION__: JSON.stringify(numero ? `${base}.${numero}` : base),
    __COMMIT__: JSON.stringify(git('rev-parse --short HEAD')),
    __DATE_VERSION__: JSON.stringify(new Date().toISOString()),
  },
});
