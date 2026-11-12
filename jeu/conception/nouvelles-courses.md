# Nouvelles courses : cahier de conception (10/11/2026, à valider)

Demande du porteur de projet : Transat Café L'Or (en double), Vendée Globe (IMOCA), The Ocean Race (tour du monde par
étapes), Arkéa Ultim Challenge (Ultim), Globe 40 (Class40, en double), une transat Lorient – Bermudes – Lorient
(Ocean Fifty, sans escale, en double).

## 1. Les courses

| Course | Classe(s) | Format | Parcours | Carte | Particularités |
|---|---|---|---|---|---|
| **Transat Café L'Or** | Ultim, IMOCA, Ocean Fifty, Class40 | Double | Le Havre → Fort-de-France (Martinique) ; en 2025, un parcours par classe | Atlantique (actuelle, élargie à la Manche) | Ex-Transat Jacques-Vabre |
| **Lorient – Bermudes – Lorient** | Ocean Fifty | Double, sans escale | Lorient → tour des Bermudes → Lorient | Atlantique (élargie aux Bermudes) | Parcours défini par le porteur de projet ; une marque à contourner |
| **Vendée Globe** | IMOCA | Solitaire, sans escale ni assistance | Les Sables-d'Olonne → caps de Bonne-Espérance, Leeuwin, Horn → Les Sables | Monde | Zone d'exclusion des glaces ; escale = abandon |
| **Arkéa Ultim Challenge – Brest** | Ultim | Solitaire, tour du monde d'ouest en est | Brest → trois caps → Brest | Monde | Escales techniques autorisées (au moins 24 h en 2024) |
| **Globe 40** | Class40 | Double, par étapes | Lorient → Cadix (prologue) → Mindelo → La Réunion → Sydney → Valparaíso → Recife → Lorient | Monde | Un des deux skippers peut changer à chaque étape |
| **The Ocean Race** | IMOCA | En équipage, par étapes | Étapes autour du monde (en 2023 : Alicante, Cap-Vert, Le Cap, Itajaí, Newport, Aarhus, La Haye, Gênes) | Monde | Classement aux points par étape |

## 2. La course en double

- Le joueur choisit un **skipper** (son bateau fait la course) et un **co-skipper**.
- **Les bonus des deux marins s'ajoutent**, leurs compromis aussi : former l'équipage devient une tactique.
- Proposition : deux marins de la même classe, avec deux compétences différentes (pas de cumul d'une même compétence).
- Globe 40 : on peut changer de co-skipper entre deux étapes.

## 3. Les courses par étapes

- Chaque étape est une course, d'un port à un autre ; à l'arrivée, escale : bateau réparé, voiles remises à neuf.
- Proposition : classement général au **temps cumulé** (Globe 40), ou **aux points** par étape (The Ocean Race, comme
  dans la vraie course). À valider.

## 4. La carte du monde

- Nouvelle carte générée comme celle de la Route du Rhum (côtes réelles), mais avec des cases plus grandes
  (environ 60 milles), pour que le tour du monde reste jouable en un nombre raisonnable de tours.
- Zone d'exclusion des glaces dans les mers du Sud (déjà prévue dans le moteur).
- Durée cible à fixer : par exemple 20 à 25 tours pour un Vendée Globe (un tour ≈ 3 jours).

## 5. Ordre de réalisation proposé

1. **Transat Café L'Or** : la carte actuelle suffit (élargie à la Manche) ; on crée la mécanique du double.
2. **Lorient – Bermudes – Lorient** : même carte élargie ; une marque à contourner.
3. **Carte du monde et Vendée Globe**.
4. **Arkéa Ultim Challenge** (même carte ; escales techniques).
5. **Globe 40** (étapes et double).
6. **The Ocean Race** (étapes, équipage, points).

## Transat Café L'Or : réalisée le 10/11/2026 (non publiée)

Marques par classe (édition 2025) : Ultim, Ascension à tribord ; IMOCA, Canaries à tribord ; Ocean Fifty, Sal à tribord ;
Class40, Açores à tribord. Une autre source évoque Fernando de Noronha et l'archipel Saint-Pierre-et-Saint-Paul :
probablement une édition plus ancienne, non retenue. Figaro Nautisme signale qu'en 2025 la course des Class40 s'est
courue en deux temps et que le parcours des Ultim a été raccourci : le jeu suit le parcours annoncé au départ.

## Tours du monde : décisions et plan (12/11/2026)

Demande du porteur de projet : préparer l'Arkéa Ultim Challenge, le Vendée Globe et la Globe 40.

**Décisions du porteur de projet (12/11/2026)**
- Un tour de jeu = **3 jours** de course sur les tours du monde (2 jours : trop long ; 4 jours : distances par tour peu crédibles). Objectifs du porteur de projet : Vendée Globe 20 à 25 tours (60 à 70 jours), Arkéa 15 à 20 tours. Mesuré : Vendée Globe ≈ 23 tours (69 jours), Arkéa ≈ 17 tours (51 jours).
- **Vraie distance** : sur la carte du monde (Mercator), une case fait 1° de longitude, soit 60 milles à l'équateur et
  moins vers les pôles (60 × cos latitude). Le moteur compte les vrais milles : dans le Grand Sud, un bateau franchit
  plus de cases par tour.

**Règles officielles retenues**
- Globe 40 (avis de course, 2e édition, globe40.com) : en double, prologue Lorient → Cadix (coefficient 0,5), puis
  6 étapes : Cadix → Mindelo (1), Mindelo → La Réunion (3), La Réunion → Sydney (2), Sydney → Valparaíso (3),
  Valparaíso → Recife (2), Recife → Lorient (2). Classement aux points (RCV annexe A 5.3, système de points a minima :
  1 point au 1er, 2 au 2e…), multipliés par le coefficient de l'étape ; le plus petit total gagne. Un des deux
  membres d'équipage peut changer à chaque étape.
- Arkéa Ultim Challenge – Brest : solitaire, Brest → caps de Bonne-Espérance, Leeuwin, Horn → Brest ; escales
  techniques autorisées, sans limite de nombre, d'au moins 24 heures (Figaro Nautisme, instructions de course 2023).
- Vendée Globe : solitaire, sans escale ni assistance (une escale = abandon) ; Les Sables-d'Olonne → trois caps à
  bâbord → Les Sables-d'Olonne ; zone d'exclusion des glaces (dessinée de façon stylisée, à vérifier).

**Choix techniques**
- Carte du monde « déroulée » : de 45° W à 5° E du tour suivant (410° de longitude), l'Atlantique est dessiné deux
  fois, au départ (à gauche) et à l'arrivée (à droite). Le moteur n'a pas à gérer une carte qui boucle.
- Les étapes de la Globe 40 ont chacune leur carte (comme une course), et la partie enchaîne les étapes.

**Ordre** : 1) générateur de la carte du monde ; 2) vraie distance dans le moteur ; 3) Vendée Globe ; 4) Arkéa Ultim
Challenge (même carte, escales de 24 h = 1 tour d'arrêt, à valider) ; 5) Globe 40 (étapes, points, double).

## Sources

- Parcours 2025 par classe : outremers360.com ; Figaro Nautisme ; bateaux.com (Ocean Fifty autour de Sal, IMOCA 4 350 milles).

- Transat Café L'Or 2025 (double, Le Havre → Fort-de-France, quatre classes) : Figaro Nautisme, boatnews.com.
- Arkéa Ultim Challenge – Brest (solitaire, trois caps, escales techniques) : Figaro Nautisme, bateaux.com.
- Globe 40 (étapes, double, changement de skipper) : site officiel globe40.com ; avis de course de la 2e édition (déc. 2024) : https://globe40.com/wp-content/uploads/2025/01/AVIS-DE-COURSE-globe40-2ed-dec-24-FR-2.pdf
- Arkéa Ultim Challenge, escales techniques d'au moins 24 h : figaronautisme.meteoconsult.fr (2023-12-22, « ce que disent les Instructions de Course ») ; bateaux.com (article 44883).
- The Ocean Race 2023 (étapes) : à vérifier sur le site officiel avant de coder.
