# Outils

Les scripts actuels sont en PowerShell et ne fonctionnent que sous Windows. **Ils sont à porter en Python 3**.

| Script | Rôle |
|---|---|
| `extraire_site.ps1` | Capture les fiches bateaux et marins du site dans `G:\Mon Drive\Memoire du large - archives\AAAA-MM-JJ\` (ou dans `archive/` sans Google Drive), en HTML brut + JSON extrait. Reprend là où elle s'est arrêtée et attend le retour du réseau en cas de coupure. |
| `controler_archive.ps1` | Relit une archive et produit les palmarès extraits, la chronologie des noms, la correspondance avec la base et la liste des anomalies, dans le sous-dossier `analyse` de la capture. Recopier ensuite le résultat dans `controles/AAAA-MM-JJ/`. |
| `historique/construire_excel.ps1` | Ancien script de migration de `sources/classement_solo.xls` vers un classeur Excel. Conservé pour mémoire : le projet n'utilise plus Excel. |

## Exemples (Windows)

Capturer une ou plusieurs classes, ou tout le site :

```
powershell -ExecutionPolicy Bypass -File outils\extraire_site.ps1 -Classes IMOCA
powershell -ExecutionPolicy Bypass -File outils\extraire_site.ps1 -Classes * -TousLesMarins
```

Contrôler la dernière archive :

```
powershell -ExecutionPolicy Bypass -File outils\controler_archive.ps1
```

## Points d'attention connus
- Sur le site, certaines entrées de l'index renvoient vers une recherche (`?q=...`) et non vers une fiche. Elles sont listées à part.
- La frise d'un bateau liste les skippers **de l'année**, pas de chaque course. Les contrôles « résultat absent de la fiche marin » sont donc à prendre avec prudence quand plusieurs skippers se partagent une année.
