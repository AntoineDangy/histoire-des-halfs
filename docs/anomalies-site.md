# Anomalies repérées sur le site (capture IMOCA du 05/11/2026)

Source : https://histoire-des-halfs.pages.dev (index `data/search.json`, fiches bateaux et fiches marins)
Périmètre : 142 bateaux IMOCA, 573 marins liés, 8 713 lignes de palmarès
Détail complet : `controles/2026-11-05/anomalies.csv` (une ligne par anomalie). Données : `palmares.csv`, `bateaux.csv`, `noms_bateaux.csv`, `correspondance_marins.csv`

## Synthèse : 614 signalements

- Gravité haute : 130
- Gravité moyenne : 137
- Gravité basse : 347 (souvent à vérifier plutôt que de vraies erreurs)

## À corriger en priorité côté site

1. **Un même marin sous plusieurs identifiants.** Une partie des « attributions douteuses » en découle.
   - Jean-Pierre Dick : `pierre-dick`, `j-pierre-dick` et `jean-pierre-dick`
   - Charles Caudrelier : `charles-caudrelier` et `charles-caudrelier-benac`
   - Andrew Cape : `andrew-cape` et `navigateur-andrew-cape`
   - Servane Escoffier : `servane-escoffier` et `eq-servane-escoffier`, avec un préfixe « Éq » parasite
   - Derek Hatfield : `derek-hatfield` et `dereck-hartfield` (variante d'orthographe)
2. **Résultats attribués au mauvais marin (84 cas).** Il s'agit de marins simplement *cités* dans une fiche bateau.
   - Exemple : au Vendée Globe 1989, Loïc Peyron est crédité de la 3e place sur *Eclipse* et d'un abandon sur *Fleury-Michon*. Ce sont les résultats de Van den Heede et de Poupon ; Peyron avait seulement porté assistance à Poupon.
3. **Années invalides (17).** Années « 55 » ou « 5555 », par exemple sur Vento di Sardegna, Corum Butler, Disque d'Or 3, ou sur la fiche de Jean Le Cam (Transat AG2R).
4. **Résultats antérieurs à la construction du bateau (7).** Par exemple Generali Concorde (construit en 1993) crédité du Globe Challenge 1989.
5. **Noms de course mal extraits (17).** Exemples : « juil », « Tour de Bretagne 16 - 10 - 1 - 8 - … », ou un classement inclus dans le nom de la course (« DNF 207 Imagin'Act… »).
6. **5 IMOCA de l'index sans fiche propre.** Lauriane, Mega Ditto'S, Mission America, Shiraishi et « ?? » renvoient vers une recherche au lieu d'une fiche.

## À vérifier

- **Bateaux d'avant 1986 classés IMOCA (30).** Par exemple Thursday Child (1983) et C.C.A.S. (1982). Ce sont des ancêtres des 60 pieds Open : faut-il une classe « pré-IMOCA » ?
- **Même marin sur deux bateaux dans la même course la même année (15).**
- **Nom porté incohérent avec la chronologie de renommage du bateau (64).**
- **Écarts avec l'ancien classement des solitaires (Vendée Globe, 25 cas).** Par exemple Vincent Riou, Vendée Globe 2008 : 3e dans l'ancien classement, « 300e/500 » sur le site.

## Limites de ce contrôle

- La frise d'un bateau liste les skippers **de l'année**, pas de chaque course. Quand deux skippers se partagent une année, une course est attendue chez les deux. D'où 324 signalements « résultat absent de la fiche marin », pour la plupart en gravité basse.
- La correspondance avec la base Excel se fait par nom exact (à l'ordre des mots près). Les variantes d'orthographe (« Loik » / « Loïc ») ne sont pas encore rapprochées.

## Autres constats

- **846 bateaux de l'index du site n'ont pas de fiche propre** : leur lien renvoie vers une recherche (`?q=...`). La liste figure dans `controles/2026-11-05/bateaux_sans_fiche.csv`.
- Le fichier `robots.txt` du site interdit l'indexation par les moteurs de recherche (`Disallow: /`). C'est normal pour un site en construction, mais il faudra le retirer à la mise en ligne définitive.
