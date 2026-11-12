# Relecture des fiches bateaux par un agent léger

But : vérifier, fiche par fiche, que le site a bien lu les dossiers de l'auteur (noms de baptême, noms successifs,
skippers, années) et repérer les incohérences de chronologie. **Rien n'est corrigé automatiquement** : la relecture
produit des signalements, que l'on valide avant de corriger les règles de lecture du site ou `site/content/`.

## Les trois étapes

1. **Préparer** (Python, gratuit) : `python outils/relecture/preparer.py imoca`
   Pour chaque bateau, met côte à côte la fiche d'origine (lignes numérotées, noms des photos) et ce que le site affiche.
   Fichiers dans `sorties/relecture/<classe>/` (non versionnés, se refont en quelques secondes).
   Prérequis : le site construit (`node site/tools/build.mjs --publish`).
2. **Relire** (agent `relecteur-bateaux`, modèle Haiku, défini dans `.claude/agents/relecteur-bateaux.md`) :
   Claude lance des agents Haiku de 3 fiches chacun. Chaque agent écrit `controles/relecture-bateaux/<classe>/<fiche>.json`.
   `python outils/relecture/preparer.py imoca --a-faire` donne les fiches pas encore relues : **une fiche relue n'est jamais refaite**.
3. **Vérifier** (Python, gratuit) : `python outils/relecture/verifier.py imoca`
   Contrôle que chaque affirmation cite mot pour mot la ligne de la fiche d'origine qu'elle indique. Sinon elle est
   **rejetée** (garde-fou contre l'invention). Écrit `rapport.md` et `ecarts.csv` dans `controles/relecture-bateaux/<classe>/`.

4. **Mesurer** (Python, gratuit), après chaque correction des règles de lecture et reconstruction du site :
   `python outils/relecture/mesurer.py imoca` (`-v` pour des exemples). Compare le site aux relevés vérifiés, famille par famille.

## Ordre des classes

`preparer.py --classes` : imoca, ultim, ocean-fifty, class-40, figaro, puis les classes historiques.
