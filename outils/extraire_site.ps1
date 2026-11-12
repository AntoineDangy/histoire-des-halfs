# Capture des fiches du site Mémoire du large (bateaux + marins) dans une archive datée.
# Pour chaque page : le HTML brut (.html) et les données extraites (.json).
# Usage :  powershell -ExecutionPolicy Bypass -File outils\extraire_site.ps1 -Classes IMOCA
#          (-Classes "IMOCA","Ultim" ... ou "*" pour toutes les classes)
# Relancer la même commande le même jour reprend là où la capture s'est arrêtée.
param(
  [string[]]$Classes = @('IMOCA'),
  [string]$Site = 'https://histoire-des-halfs.pages.dev',
  # Archives sur Google Drive si le lecteur est présent, sinon dans le dossier local archive/ (hors Git)
  [string]$Racine = $(if (Test-Path 'G:\Mon Drive') { 'G:\Mon Drive\Memoire du large - archives' } else { Join-Path (Split-Path $PSScriptRoot -Parent) 'archive' }),
  [string]$Date = (Get-Date -Format 'yyyy-MM-dd'),
  [int]$PauseMs = 250,
  [switch]$TousLesMarins   # capture aussi les marins de l'index qui ne sont liés à aucun bateau capturé
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Dossier = Join-Path $Racine $Date
New-Item -ItemType Directory -Force $Dossier | Out-Null
$utf8 = New-Object Text.UTF8Encoding $false

function Test-Reseau { try { [void](Invoke-WebRequest -UseBasicParsing -Uri "$Site/robots.txt" -TimeoutSec 20); $true } catch { $false } }
function Attendre-Reseau {
  # coupure réseau : on attend le retour (test toutes les 30 s, 12 h maximum) puis on reprend
  if (Test-Reseau) { return }
  Write-Output "  $(Get-Date -Format 'HH:mm:ss') réseau indisponible : attente du retour…"
  $limite = (Get-Date).AddHours(12)
  while (-not (Test-Reseau)) { if ((Get-Date) -gt $limite) { throw 'Réseau absent depuis 12 h : arrêt' }; Start-Sleep -Seconds 30 }
  Write-Output "  $(Get-Date -Format 'HH:mm:ss') réseau revenu : reprise"
}
function Get-Page([string]$chemin) {
  for ($essai = 1; $essai -le 4; $essai++) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -Uri "$Site/$chemin" -TimeoutSec 60 -UserAgent 'MemoireDuLarge-archive/1.0'
      Start-Sleep -Milliseconds $PauseMs
      return $utf8.GetString($r.RawContentStream.ToArray())
    } catch {
      $code = $null; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
      if ($code -eq 404) { throw "Page introuvable (404) : $chemin" }   # erreur du site, inutile d'insister
      if ($essai -eq 4) { throw "Échec $chemin : $($_.Exception.Message)" }
      Attendre-Reseau
      Start-Sleep -Seconds (3 * $essai)
    }
  }
}
function Lire-Json([string]$f) { try { Get-Content $f -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $null } }
function T([string]$s) { if ($null -eq $s) { return '' }; ([Net.WebUtility]::HtmlDecode(($s -replace '<[^>]+>', ' ')) -replace '\s+', ' ').Trim() }
function Slug([string]$href) { ($href -replace '^(\.\./)+', '' -replace '^/', '').Trim('/') }
function M([string]$s, [string]$re) { $m = [regex]::Match($s, $re); if ($m.Success) { $m.Groups[1].Value } else { $null } }
function All([string]$s, [string]$re) { [regex]::Matches($s, $re) }
function Rang([string]$r) {
  $r = (T $r)
  $o = [ordered]@{ brut = $r; place = $null; partants = $null; statut = $null }
  if ($r -match '^(\d+)\s*(?:er|e|ème|eme)?\s*/\s*(\d+)') { $o.place = [int]$matches[1]; $o.partants = [int]$matches[2]; $o.statut = 'classé' }
  elseif ($r -match '^([A-Za-z?]+)\s*/\s*(\d+)') { $o.statut = $matches[1].ToUpper(); $o.partants = [int]$matches[2] }
  elseif ($r -match '^(\d+)\s*(?:er|e)\b') { $o.place = [int]$matches[1]; $o.statut = 'classé' }
  $o
}
function Save($rel, $html, $data) {
  $f = Join-Path $Dossier $rel
  New-Item -ItemType Directory -Force (Split-Path $f -Parent) | Out-Null
  [IO.File]::WriteAllText("$f.html", $html, $utf8)
  [IO.File]::WriteAllText("$f.json", ($data | ConvertTo-Json -Depth 10), $utf8)
}
function Frise([string]$h) {
  $bloc = M $h '<ol class="frise">(.*?)</ol>\s*</section>'
  if (-not $bloc) { return @() }
  foreach ($li in ($bloc -split '<li class="yr">' | Select-Object -Skip 1)) {
    $sk = [regex]::Match($li, '<span class="sk( cont)?" title="([^"]*)">(.*?)</span><span class="fy">')
    [ordered]@{
      annee      = M $li '<span class="fy">([^<]*)</span>'
      titre      = T $sk.Groups[2].Value
      suite      = $sk.Groups[1].Success
      liens      = @(All $sk.Groups[3].Value 'href="([^"]+)"' | ForEach-Object { Slug $_.Groups[1].Value })
      evenements = @(All $li '<li class="(ev-[\w-]+)"><a href="([^"]*)"(?: title="([^"]*)")?><i></i>(.*?)</a></li>' | ForEach-Object {
          [ordered]@{ type = $_.Groups[1].Value; lien = $_.Groups[2].Value; detail = T $_.Groups[3].Value; texte = T $_.Groups[4].Value } })
    }
  }
}
function Timeline([string]$h, [string]$ancre) {
  $i = $h.IndexOf($ancre); if ($i -lt 0) { return @() }
  $bloc = M $h.Substring($i) '<ol class="timeline">(.*?)</ol>\s*</section>'
  if (-not $bloc) { return @() }
  foreach ($li in ($bloc -split '<li (?=(?:id="e\d+" )?class="ev)' | Select-Object -Skip 1)) {
    $ren = [regex]::Match($li, '<div class="rename-tag">.*?<b>(.*?)</b>\s*(?:<span class="sail">(.*?)</span>)?')
    [ordered]@{
      id      = M $li '^id="(e\d+)"'
      annee   = T (M $li '<div class="year">([^<]*)')
      badges  = @(All $li '<span class="badge [^"]*">(.*?)</span>' | ForEach-Object { T $_.Groups[1].Value })
      bapteme = if ($ren.Success) { [ordered]@{ nom = T $ren.Groups[1].Value; voile = T $ren.Groups[2].Value } } else { $null }
      marins  = @(All $li 'href="(?:\.\./)+skippers/([^/"]+)/"' | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
      bateaux = @(All $li 'href="((?:\.\./)+(?!skippers|photos)[\w-]+/[^"#]+/)"' | ForEach-Object { Slug $_.Groups[1].Value } | Select-Object -Unique)
      texte   = T ((($li -replace '^[^>]*>', '') -replace '<div class="year">.*?</div>', '') -replace '<div class="gallery">.*?</div>', '')
    }
  }
}

function Parse-Bateau([string]$id, [string]$html) {
  $h = $html -replace '\s+', ' '
  $faits = [ordered]@{}
  $aside = M $h '<aside class="facts">(.*?)</aside>'
  if ($aside) { foreach ($m in (All $aside '<dt>(.*?)</dt>\s*<dd>(.*?)</dd>')) { $faits[(T $m.Groups[1].Value)] = T $m.Groups[2].Value } }
  [ordered]@{
    type       = 'bateau'
    id         = $id
    url        = "$Site/$id/"
    capture    = $Date
    entete     = T (M $h '<div class="eyebrow">(.*?)</div>')
    nom        = T (M $h '<h1>(.*?)</h1>')
    nom_actuel = T (M $h '<p class="now">.*?<b>(.*?)</b>')
    voiles     = @(T (M $h '<div class="sail big">(.*?)</div>') -split ' · ' | Where-Object { $_ })
    noms       = @(All (M $h '<ul class="names"[^>]*>(.*?)</ul>') '<li>(.*?)(?:<span class="sail">(.*?)</span>)?</li>' | ForEach-Object { [ordered]@{ nom = T $_.Groups[1].Value; voile = T $_.Groups[2].Value } })
    faits      = $faits
    frise      = @(Frise $h)
    chronologie = @(Timeline $h 'Chronologie détaillée')
  }
}
function Parse-Marin([string]$id, [string]$html) {
  $h = $html -replace '\s+', ' '
  $tbody = M $h '<table[^>]*>.*?<tbody>(.*?)</tbody>'
  [ordered]@{
    type     = 'marin'
    id       = $id
    url      = "$Site/skippers/$id/"
    capture  = $Date
    entete   = T (M $h '<div class="eyebrow">(.*?)</div>')
    nom      = T (M $h '<h1>(.*?)</h1>')
    stats    = $(  $s = [ordered]@{}; foreach ($m in (All $h '<div><b>(.*?)</b><span>(.*?)</span></div>')) { $s[(T $m.Groups[2].Value)] = T $m.Groups[1].Value }; $s )
    bateaux  = @(All $h '<a class="card" href="([^"]+)"><span class="meta">(.*?)</span><b>(.*?)</b><span class="meta">(.*?)</span></a>' | ForEach-Object {
        $meta = (T $_.Groups[2].Value) -split ' · ', 2
        [ordered]@{ bateau = Slug $_.Groups[1].Value; classe = $meta[0]; role = $(if ($meta.Count -gt 1) { $meta[1] } else { '' }); nom = T $_.Groups[3].Value; periode = T $_.Groups[4].Value } })
    palmares = @(if ($tbody) { All $tbody '<tr[^>]*>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td class="rank-cell">(.*?)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*</tr>' | ForEach-Object {
        $cb = $_.Groups[4].Value
        [ordered]@{
          annee       = T $_.Groups[1].Value
          course      = T $_.Groups[2].Value
          classement  = Rang $_.Groups[3].Value
          bateau      = $(if ($cb -match 'href="([^"]+)"') { Slug $matches[1] } else { $null })
          nom_bateau  = T (M $cb '<a [^>]*>(.*?)</a>')
          bapteme     = T (M $cb 'title="Baptisé ([^"]*)"')
          role        = (T (M $cb '<span class="meta">(.*?)</span>')) -replace '^·\s*', ''
          classe      = T $_.Groups[5].Value
        } } })
    frise    = @(Frise $h)
    faits_marquants = @(Timeline $h 'Faits marquants')
  }
}

# ---------- 1. Index du site ----------
$indexJson = Get-Page 'data/search.json'
[IO.File]::WriteAllText((Join-Path $Dossier 'search.json'), $indexJson, $utf8)
$index = $indexJson | ConvertFrom-Json
$tous = @($index | Where-Object { $_.c -ne 'Skipper' -and ($Classes -contains '*' -or $Classes -contains $_.c) })
$sansFiche = @($tous | Where-Object { $_.u -match '\?' })
$cibles = @($tous | Where-Object { $_.u -notmatch '\?' })
$sansFiche | ForEach-Object { [pscustomobject]@{ Classe = $_.c; Nom = $_.n; Lien = $_.u } } | Export-Csv (Join-Path $Dossier 'bateaux_sans_fiche.csv') -Delimiter ';' -NoTypeInformation -Encoding UTF8
Write-Output "Bateaux à capturer : $($cibles.Count) ($($Classes -join ', ')) ; sans fiche propre : $($sansFiche.Count)"

# ---------- 2. Bateaux ----------
$marins = New-Object 'System.Collections.Generic.HashSet[string]'
$n = 0; $erreurs = @()
foreach ($b in $cibles) {
  $n++; $id = Slug $b.u; $f = Join-Path $Dossier "bateaux/$id.json"
  try {
    $data = $(if (Test-Path $f) { Lire-Json $f } else { $null })   # fichier absent ou tronqué => on recapture
    if (-not $data) { $html = Get-Page "$id/"; $data = Parse-Bateau $id $html; Save "bateaux/$id" $html $data }
    foreach ($y in $data.frise) { foreach ($l in $y.liens) { if ($l -like 'skippers/*') { [void]$marins.Add(($l -replace '^skippers/', '')) } } }
    foreach ($c in $data.chronologie) { foreach ($m in $c.marins) { [void]$marins.Add($m) } }
  } catch { $erreurs += "$id : $($_.Exception.Message)" }
  if ($n % 25 -eq 0) { Write-Output "  bateaux $n/$($cibles.Count)" }
}
if ($TousLesMarins) { foreach ($s in ($index | Where-Object { $_.c -eq 'Skipper' -and $_.u -notmatch '\?' })) { [void]$marins.Add(((Slug $s.u) -replace '^skippers/', '')) } }
Write-Output "Marins à capturer : $($marins.Count)"

# ---------- 3. Marins ----------
$n = 0
foreach ($m in $marins) {
  $n++; $f = Join-Path $Dossier "skippers/$m.json"
  try { if (-not (Test-Path $f) -or -not (Lire-Json $f)) { $html = Get-Page "skippers/$m/"; Save "skippers/$m" $html (Parse-Marin $m $html) } }
  catch { $erreurs += "skippers/$m : $($_.Exception.Message)" }
  if ($n % 50 -eq 0) { Write-Output "  marins $n/$($marins.Count)" }
}
[IO.File]::WriteAllLines((Join-Path $Dossier 'erreurs_capture.txt'), [string[]]$erreurs, $utf8)
Write-Output "Terminé : $($cibles.Count) bateaux, $($marins.Count) marins, $($erreurs.Count) erreur(s). Archive : $Dossier"
