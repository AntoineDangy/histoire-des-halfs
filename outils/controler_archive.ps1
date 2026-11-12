# Relit une archive datée (outils\extraire_site.ps1) et produit, dans <archive>\analyse :
#   palmares.csv, bateaux.csv, noms_bateaux.csv, correspondance_marins.csv, anomalies.csv
# Usage : powershell -ExecutionPolicy Bypass -File outils\controler_archive.ps1 [-Date 2026-11-05]
param(
  [string]$Racine = $(if (Test-Path 'G:\Mon Drive\Memoire du large - archives') { 'G:\Mon Drive\Memoire du large - archives' } else { Join-Path (Split-Path $PSScriptRoot -Parent) 'archive' }),
  [string]$Date = '',
  [string]$Base = (Join-Path (Split-Path $PSScriptRoot -Parent) 'sorties\Memoire_du_large_classement.xlsx')
)
$ErrorActionPreference = 'Stop'
if (-not $Date) { $Date = (Get-ChildItem $Racine -Directory | Sort-Object Name | Select-Object -Last 1).Name }
$Dossier = Join-Path $Racine $Date
$Sortie = Join-Path $Dossier 'analyse'; New-Item -ItemType Directory -Force $Sortie | Out-Null

function Sans-Accents([string]$s) { $t = $s.Normalize([Text.NormalizationForm]::FormD); (($t.ToCharArray() | Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne 'NonSpacingMark' }) -join '') }
function N([string]$s) { if (-not $s) { return '' }; ((Sans-Accents $s).ToLower() -replace '[^a-z0-9]+', ' ').Trim() }
function Cle([string]$s) { ((N $s) -split ' ' | Where-Object { $_ } | Sort-Object) -join ' ' }   # ordre des mots indifférent
function An($s) { $m = [regex]::Match("$s", '\b(1[89]\d\d|20\d\d)\b'); if ($m.Success) { [int]$m.Value } else { $null } }

$anomalies = New-Object System.Collections.ArrayList
function A($type, $gravite, $marin, $bateau, $annee, $course, $detail) {
  [void]$anomalies.Add([pscustomobject]@{ Type = $type; Gravité = $gravite; Marin = $marin; Bateau = $bateau; Année = $annee; Course = $course; Détail = $detail })
}

# ---------- Lecture de l'archive ----------
$bateaux = @{}
foreach ($f in Get-ChildItem (Join-Path $Dossier 'bateaux') -Recurse -Filter *.json) { $j = Get-Content $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json; $bateaux[$j.id] = $j }
$marins = @{}
foreach ($f in Get-ChildItem (Join-Path $Dossier 'skippers') -Filter *.json) { $j = Get-Content $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json; $marins[$j.id] = $j }
Write-Output "Archive $Date : $($bateaux.Count) bateaux, $($marins.Count) marins"

# ---------- Bateaux : chronologie des noms ----------
$lignesBateaux = @(); $lignesNoms = @(); $nomsParAn = @{}
foreach ($b in $bateaux.Values) {
  $constr = An $b.faits.Construction; if (-not $constr) { $constr = An $b.entete }
  $classe = ($b.entete -split ' · ')[0]
  $lignesBateaux += [pscustomobject]@{ ID = $b.id; Nom = $b.nom; 'Nom actuel' = $b.nom_actuel; Classe = $classe; Construction = $constr; Plan = $b.faits.Plan; 'Nb noms' = @($b.noms).Count; 'Voiles' = ($b.voiles -join ' / ') }
  # événements de nommage datés : baptêmes de la chronologie + « Devient X » de la frise
  $ev = @()
  foreach ($c in $b.chronologie) { if ($c.bapteme -and $c.bapteme.nom) { $ev += [pscustomobject]@{ An = An $c.annee; Nom = $c.bapteme.nom; Source = "chronologie $($c.id)" } } }
  foreach ($y in $b.frise) { foreach ($e in $y.evenements) { if ($e.texte -match '^Devient (.+)$') { $ev += [pscustomobject]@{ An = An $y.annee; Nom = $matches[1]; Source = 'frise' } } } }
  $ev = @($ev | Where-Object { $_.An } | Sort-Object An)
  if ($ev.Count -eq 0 -or $ev[0].An -gt $constr) { $ev = @([pscustomobject]@{ An = $constr; Nom = $(if (@($b.noms).Count) { $b.noms[0].nom } else { $b.nom }); Source = 'premier nom' }) + $ev }
  $nomsParAn[$b.id] = $ev
  $k = 0; foreach ($e in $ev) { $k++; $lignesNoms += [pscustomobject]@{ Bateau = $b.id; Ordre = $k; 'À partir de' = $e.An; Nom = $e.Nom; Source = $e.Source } }
  # contrôles bateau
  if ($constr -and $classe -eq 'IMOCA' -and $constr -lt 1986) { A 'Classe incohérente avec l''année' 'moyenne' '' $b.id $constr '' "Bateau classé IMOCA mais construit en $constr (classe IMOCA / Open 60 : à partir de 1986)" }
  $prev = $null
  foreach ($y in $b.frise) { $ya = An $y.annee; if (-not $ya) { A 'Année invalide' 'haute' '' $b.id $y.annee '' "Année « $($y.annee) » dans la frise" } elseif ($constr -and $ya -lt $constr) { A 'Événement avant construction' 'basse' '' $b.id $ya '' "Frise $ya alors que construction $constr" } }
}
function Nom-A([string]$bid, [int]$annee) { $n = $null; foreach ($e in $nomsParAn[$bid]) { if ($e.An -lt $annee) { $n = $e.Nom } }; @(@($n) + @($nomsParAn[$bid] | Where-Object { $_.An -eq $annee } | ForEach-Object { $_.Nom }) | Where-Object { $_ }) }
function Skippers-A($b, [int]$annee) {
  # skippers cités dans la frise pour l'année (ou l'entrée précédente marquée « suite »)
  $res = @(); $dernier = @()
  foreach ($y in $b.frise) { $ya = An $y.annee; if (-not $ya -or $ya -gt $annee) { break }; if (-not $y.suite -and @($y.liens).Count) { $dernier = @($y.liens | ForEach-Object { $_ -replace '^skippers/', '' }) }; if ($ya -eq $annee) { $res = $dernier } }
  $res
}

# ---------- Palmarès des marins ----------
$palm = @()
foreach ($m in $marins.Values) {
  foreach ($p in $m.palmares) {
    $palm += [pscustomobject]@{ Marin = $m.id; 'Nom marin' = $m.nom; AnnéeBrute = $p.annee; Année = An $p.annee; Course = $p.course; Place = $p.classement.place; Partants = $p.classement.partants; Statut = $p.classement.statut; Classement = $p.classement.brut; Bateau = $p.bateau; 'Nom porté' = $p.nom_bateau; Baptême = $p.bapteme; Rôle = $(if ($p.role) { $p.role } else { 'skipper' }); Classe = $p.classe }
  }
}
foreach ($r in $palm) {
  if (-not $r.Année) { A 'Année invalide' 'haute' $r.Marin $r.Bateau $r.AnnéeBrute $r.Course "Année « $($r.AnnéeBrute) » sur la fiche marin" ; continue }
  if ($r.Année -gt (Get-Date).Year) { A 'Année invalide' 'haute' $r.Marin $r.Bateau $r.Année $r.Course 'Année dans le futur' }
  if (-not $r.Statut) { A 'Classement illisible' 'basse' $r.Marin $r.Bateau $r.Année $r.Course "Classement « $($r.Classement) »" }
  if ($r.Course -match '^\s*(janv|f[eé]v|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[eé]c)\w*\.?\s*$' -or $r.Course -match '\d+\s*-\s*\d+\s*-\s*\d+') { A 'Nom de course bruité' 'moyenne' $r.Marin $r.Bateau $r.Année $r.Course 'Le nom de course semble mal extrait (mois, détail des manches…)' }
  $b = $(if ($r.Bateau) { $bateaux[$r.Bateau] } else { $null })
  if ($b) {
    $constr = An $b.faits.Construction
    if ($constr -and $r.Année -lt $constr) { A 'Résultat avant construction' 'haute' $r.Marin $r.Bateau $r.Année $r.Course "Bateau construit en $constr" }
    if ($r.Classe -eq 'IMOCA' -and $r.Année -lt 1986) { A 'Classe incohérente avec l''année' 'moyenne' $r.Marin $r.Bateau $r.Année $r.Course "Résultat classé IMOCA en $($r.Année)" }
    $attendu = Nom-A $r.Bateau $r.Année
    if (@($attendu).Count -and $r.'Nom porté' -and (@($attendu | ForEach-Object { N $_ }) -notcontains (N $r.'Nom porté'))) {
      $connu = @($b.noms | Where-Object { (N $_.nom) -eq (N $r.'Nom porté') }).Count
      A 'Nom du bateau hors chronologie' $(if ($connu) { 'basse' } else { 'moyenne' }) $r.Marin $r.Bateau $r.Année $r.Course "Nom porté « $($r.'Nom porté') », chronologie : « $($attendu -join ' / ') »$(if (-not $connu) { ' (nom absent de la liste des noms)' })" }
    if ($r.Rôle -eq 'skipper') {
      $sk = Skippers-A $b $r.Année
      if (@($sk).Count -and ($sk -notcontains $r.Marin)) { A 'Attribution douteuse' 'haute' $r.Marin $r.Bateau $r.Année $r.Course "Fiche bateau $($r.Année) : skipper(s) = $($sk -join ', ')" }
    }
  }
}
# même marin sur plusieurs bateaux dans la même course la même année
$palm | Where-Object { $_.Année -and $_.Bateau } | Group-Object Marin, Année, { N $_.Course } | Where-Object { @($_.Group.Bateau | Select-Object -Unique).Count -gt 1 } | ForEach-Object {
  $g = $_.Group; A 'Marin sur plusieurs bateaux' 'haute' $g[0].Marin (($g.Bateau | Select-Object -Unique) -join ' + ') $g[0].Année $g[0].Course (($g | ForEach-Object { "$($_.'Nom porté') $($_.Classement) ($($_.Rôle))" }) -join ' ; ') }
# résultat de la frise bateau absent du palmarès du skipper
foreach ($b in $bateaux.Values) {
  foreach ($y in $b.frise) {
    $ya = An $y.annee; if (-not $ya) { continue }
    $sk = Skippers-A $b $ya
    foreach ($e in $y.evenements) {
      if ($e.type -ne 'ev-race') { continue }
      $rang = ($e.texte -split ' · ')[-1]; $course = ($e.texte -split ' · ')[0]
      foreach ($s in $sk) {
        $m = $marins[$s]; if (-not $m) { continue }
        $ok = @($m.palmares | Where-Object { (An $_.annee) -eq $ya -and $_.bateau -eq $b.id -and $_.classement.brut -eq $rang }).Count
        if (-not $ok) { A 'Résultat absent de la fiche marin' $(if (@($sk).Count -eq 1) { 'moyenne' } else { 'basse' }) $s $b.id $ya $course "La fiche bateau indique « $($e.texte) » mais pas le palmarès du marin$(if (@($sk).Count -gt 1) { ' (plusieurs skippers cette année-là : à vérifier)' })" }
      }
    }
  }
}

# ---------- Homonymes / doublons de marins ----------
$marins.Values | Group-Object { Cle $_.nom } | Where-Object { $_.Count -gt 1 } | ForEach-Object { A 'Doublon de marin' 'haute' (($_.Group.id) -join ' + ') '' '' '' "Même nom : $(($_.Group.nom) -join ' / ')" }

$ids = @($marins.Keys)
foreach ($x in $ids) { if ($x -match '^(eq|co|sk)-') { A 'Identifiant de marin suspect' 'moyenne' $x '' '' '' "Préfixe « $($matches[1])- » dans l'identifiant ($($marins[$x].nom))" } }
foreach ($x in $ids) { foreach ($y in $ids) { if ($x -ne $y -and ($x -split '-').Count -ge 2 -and ($y.EndsWith("-$x") -or $y.StartsWith("$x-"))) { A 'Doublon probable de marin' 'haute' "$x + $y" '' '' '' "« $($marins[$x].nom) » semble être « $($marins[$y].nom) » (nom tronqué)" } } }
# ---------- Correspondance avec la base Excel ----------
$corr = @(); $nomsBase = @{}; $baseRes = @()
if (Test-Path $Base) {
  $xl = New-Object -ComObject Excel.Application; $xl.DisplayAlerts = $false
  try {
    $wb = $xl.Workbooks.Open($Base, 0, $true)
    $sk = $wb.Worksheets.Item('Skippers').ListObjects.Item('tSkippers').DataBodyRange.Value2
    for ($i = 1; $i -le $sk.GetLength(0); $i++) { $nomsBase[(Cle $sk[$i, 2])] = $sk[$i, 2] }
    $rs = $wb.Worksheets.Item('Résultats').ListObjects.Item('tResultats')
    $cols = @{}; $k = 0; foreach ($c in $rs.HeaderRowRange.Value2) { $k++; $cols[$c] = $k }
    $v = $rs.DataBodyRange.Value2
    for ($i = 1; $i -le $v.GetLength(0); $i++) { $baseRes += [pscustomobject]@{ Course = $v[$i, $cols['Course']]; Skipper = $v[$i, $cols['Skipper']]; Points = $v[$i, $cols['Points']] } }
    $wb.Close($false)
  } finally { $xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl) }
}
foreach ($m in $marins.Values) {
  $k = Cle $m.nom
  $corr += [pscustomobject]@{ 'ID site' = $m.id; 'Nom site' = $m.nom; 'Nom base' = $nomsBase[$k]; Statut = $(if ($nomsBase.ContainsKey($k)) { 'trouvé' } else { 'absent de la base' }) }
}
# contrôle croisé Vendée Globe : place déduite des points de la base vs place du site
$placeVG = @{ 300 = 1; 220 = 2; 160 = 3; 120 = 4; 90 = 5; 70 = 6; 50 = 7; 25 = 8 }
$siteParCle = @{}; foreach ($m in $marins.Values) { $siteParCle[(Cle $m.nom)] = $m }
foreach ($r in ($baseRes | Where-Object { $_.Course -like 'Vendée Globe *' })) {
  $an = An $r.Course; $m = $siteParCle[(Cle $r.Skipper)]; if (-not $m) { continue }
  $lig = @($m.palmares | Where-Object { (An $_.annee) -eq $an -and (N $_.course) -like '*vendee globe*' })
  $pb = $placeVG[[int]$r.Points]; $txtBase = $(if ($pb -eq 8) { '8e ou au-delà' } elseif ($pb) { "$pb" + $(if ($pb -eq 1) { 'er' } else { 'e' }) } else { 'inconnue' }) + " ($($r.Points) pts)"
  if ($lig.Count -eq 0) { A 'Base ≠ site' 'moyenne' $m.id '' $an "Vendée Globe $an" "Base : $txtBase ; aucun Vendée Globe $an sur la fiche du site" ; continue }
  $okPlace = @($lig | Where-Object { $_.classement.place -and ($_.classement.place -eq $pb -or ($pb -eq 8 -and $_.classement.place -ge 8)) }).Count
  if (-not $okPlace) { A 'Base ≠ site' $(if ($pb) { 'haute' } else { 'basse' }) $m.id (($lig.bateau) -join ' + ') $an "Vendée Globe $an" "Base : $txtBase ; site : $(($lig | ForEach-Object { "$($_.classement.brut) sur $($_.nom_bateau)$(if ($_.role) { ' (' + $_.role + ')' })" }) -join ' ; ')" }
}

# ---------- Exports ----------
$exp = @{ 'palmares.csv' = $palm; 'bateaux.csv' = $lignesBateaux; 'noms_bateaux.csv' = $lignesNoms; 'correspondance_marins.csv' = $corr; 'anomalies.csv' = ($anomalies | Sort-Object @{e = { @{ haute = 0; moyenne = 1; basse = 2 }[$_.Gravité] } }, Type, Marin) }
foreach ($k in $exp.Keys) { $exp[$k] | Export-Csv (Join-Path $Sortie $k) -Delimiter ';' -NoTypeInformation -Encoding UTF8 }
Write-Output "Palmarès : $($palm.Count) lignes ; marins trouvés dans la base : $(@($corr | Where-Object Statut -eq 'trouvé').Count)/$($corr.Count)"
Write-Output "Anomalies : $($anomalies.Count)"
$anomalies | Group-Object Type | Sort-Object Count -Descending | ForEach-Object { Write-Output ("  {0,5}  {1}" -f $_.Count, $_.Name) }
Write-Output "Fichiers : $Sortie"
