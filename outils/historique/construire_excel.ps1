param([string]$Src, [string]$Dst)
$ErrorActionPreference = 'Stop'
$log = New-Object System.Collections.ArrayList
function L($cat,$msg){ [void]$log.Add(@($cat,$msg)) }
function ColName([int]$n){ $s=''; while($n -gt 0){ $m=($n-1)%26; $s=[char](65+$m)+$s; $n=[int][math]::Floor(($n-1)/26) }; $s }
function Norm($s){ $t=$s.Normalize([Text.NormalizationForm]::FormD); $t=($t.ToCharArray() | Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne 'NonSpacingMark' }) -join ''; ($t.ToLower() -replace "[^a-z0-9 ]",' ' -replace '\s+',' ').Trim() }
function Slug($s){ (Norm $s) -replace ' ','-' }

$xl = New-Object -ComObject Excel.Application; $xl.Visible=$false; $xl.DisplayAlerts=$false; $xl.ScreenUpdating=$false
try {
# ================= 1. Lecture de l'ancien fichier =================
$wbS = $xl.Workbooks.Open($Src, 0, $true)
$Grid = $wbS.Worksheets.Item('Clat 31 mars 2025').Range('A1:FD900').Value2
$wbS.Close($false)

# ================= 2. Courses =================
$manualYear = @{ 'F'=1968; 'BG'=1993; 'CX'=2008; 'DE'=2010; 'DW'=2016; 'DX'=2016; 'EH'=2020; 'EM'=2022; 'EN'=2022; 'EX'=2024 }
$rename = @{ 'Istambul'='Istanbul'; 'L Aurore'="L'Aurore"; 'BOC Challenge 82 83'='BOC Challenge'; 'Portimao G. O. R.'='Portimao Global Ocean Race'; 'T. Bretagne-Martinique'='Transat Bretagne-Martinique' }
$courses = @()
for($c=3; $c -le 156; $c++){
  $Lc = ColName $c
  if($Lc -in 'AJ','AK','FA'){ continue }
  $orig = "$($Grid[1,$c])".Trim()
  if(-not $orig){ continue }
  if($manualYear.ContainsKey($Lc)){ $y=$manualYear[$Lc] }
  elseif($orig -match '(19|20)\d\d'){ $y=[int]$matches[0] }
  elseif($orig -match '\b(\d\d)\b'){ $n=[int]$matches[1]; $y= if($n -lt 30){2000+$n}else{1900+$n} }
  else { throw "Année inconnue pour $Lc $orig" }
  $base = $orig; foreach($k in $rename.Keys){ $base = $base.Replace($k,$rename[$k]) }
  $base = ($base -replace '\b(19|20)\d\d\b','' -replace '\b\d\d\b','' -replace '\s+',' ').Trim()
  $name = "$base $y"
  if($orig -match 'Mini Transat'){ $type='Mini Transat' }
  elseif($orig -match 'Vendée Globe|Golden Globe|Global Solo|Arkea Ultim'){ $type='Tour du monde' }
  elseif($orig -match 'BOC|Around Alone|Portimao'){ $type='Tour du monde à étapes' }
  elseif($orig -match 'Figaro|Aurore|Trophée BPE|Bretagne-Martinique|Cap Istambul'){ $type='Figaro' }
  else { $type='Transat' }
  if($type -eq 'Mini Transat'){ $cls='Mini 6.50' }
  elseif($type -eq 'Figaro'){ $cls='Figaro' }
  elseif($orig -match 'Vendée Globe|Vendée Arctic|New York|Retour à la Base|B to B'){ $cls='IMOCA' }
  elseif($orig -match 'Arkea Ultim'){ $cls='Ultim' }
  elseif($orig -match 'Golden Globe' -and $y -ge 2018){ $cls='Golden Globe (rétro)' }
  else { $cls='Non renseignée' }
  $rem = @()
  if($orig -match 'Jacques Vabre'){ $rem += 'Course en double : à confirmer dans un classement solo' }
  if($orig -match 'Golden Globe|Global Solo|Arkea Ultim|Vendée Arctic|Bermudes|Retour à la Base|New York|Calero|B to B|Trophée BPE|Portimao|Cap Istambul|Transpac|La Baule|Bretagne-Martinique'){ $rem += 'Type de barème déduit (absent de l''ancien onglet Dotation) : à confirmer' }
  if($cls -ne 'Non renseignée'){ $rem += 'Classe par défaut déduite du nom de la course' }
  if($name -ne $orig){ L 'Course renommée' "$orig -> $name" }
  $courses += [pscustomobject]@{ Ordre=$courses.Count+1; Course=$name; Annee=$y; Type=$type; Classe=$cls; Origine=$orig; Remarque=($rem -join ' ; '); Col=$c }
}

# ================= 3. Skippers + résultats =================
$fix = @{ 'Poupon Phillipe'='Poupon Philippe'; 'Soldini Giovani'='Soldini Giovanni'; 'Petengill Steve'='Pettengill Steve'; 'Stockes Francis'='Stokes Francis' }
$sk = [ordered]@{}
for($r=3; $r -le 900; $r++){
  $raw = "$($Grid[$r,2])"; if(-not $raw.Trim()){ continue }
  $nm = ($raw -replace '\s+',' ').Trim()
  if($fix.ContainsKey($nm)){ L 'Nom corrigé' "$nm -> $($fix[$nm])"; $nm=$fix[$nm] }
  $k = Norm $nm
  if(-not $sk.Contains($k)){ $sk[$k] = @{ Nom=$nm; Res=@{}; Lignes=@() } }
  else { L 'Doublon fusionné' "$nm (lignes $($sk[$k].Lignes -join ',') et $r de l'onglet Clat 31 mars 2025)" }
  $sk[$k].Lignes += $r
  foreach($co in $courses){
    $cell = $Grid[$r,$co.Col]
    if($cell -is [double] -and $cell -ne 0){
      if($sk[$k].Res.ContainsKey($co.Col)){
        $old=$sk[$k].Res[$co.Col]
        if($old -eq $cell){ L 'Résultat en double supprimé' "$nm / $($co.Course) : $cell pts comptés deux fois" }
        else { L 'Conflit' "$nm / $($co.Course) : $old et $cell -> conservé $([math]::Max($old,$cell))"; $sk[$k].Res[$co.Col]=[math]::Max($old,$cell) }
      } else { $sk[$k].Res[$co.Col]=$cell }
    } elseif($cell -is [string] -and $cell -ne '' -and $cell.Trim() -eq '') { L 'Cellule vide nettoyée' "$nm / $($co.Course) contenait un espace" }
  }
}
$rows = @()
foreach($co in $courses){
  $list = foreach($s in $sk.Values){ if($s.Res.ContainsKey($co.Col)){ [pscustomobject]@{C=$co.Course; S=$s.Nom; P=$s.Res[$co.Col]} } }
  $rows += @($list | Sort-Object @{e='P';Descending=$true}, S)
}
"Courses: $($courses.Count)  Skippers: $($sk.Count)  Résultats: $($rows.Count)"

# ================= 4. Classeur =================
$wb = $xl.Workbooks.Add()
$wb.Styles.Item('Normal').Font.Name = 'Arial'; $wb.Styles.Item('Normal').Font.Size = 10
$names = 'Lisez-moi','Classement skippers','Classement bateaux','Paramètres','Résultats','Records','Bateaux','Courses','Skippers','Types de records','Classes','Barème','Contrôles','Journal'
while($wb.Worksheets.Count -lt $names.Count){ [void]$wb.Worksheets.Add([Type]::Missing, $wb.Worksheets.Item($wb.Worksheets.Count)) }
for($i=1;$i -le $names.Count;$i++){ $wb.Worksheets.Item($i).Name = $names[$i-1] }
function WS($n){ $wb.Worksheets.Item($n) }
function Put($sheet,[string]$addr,$data){
  $nr=$data.Count; $nc=$data[0].Count; $a = New-Object 'object[,]' $nr,$nc
  for($i=0;$i -lt $nr;$i++){ for($j=0;$j -lt $nc;$j++){ $a[$i,$j]=$data[$i][$j] } }
  $rg = $sheet.Range($addr).Resize($nr,$nc)
  try { $rg.Value2 = $a } catch { throw "Put $($sheet.Name)!$addr ${nr}x${nc} : $($_.Exception.Message)" }
  return ,$rg }
function MkTable($sheet,$rg,$name,$style='TableStyleMedium2'){ $lo=$sheet.ListObjects.Add(1,$rg,[Type]::Missing,1); $lo.Name=$name; $lo.TableStyle=$style; $lo }
function Calc($lo,$name,$formula,$fmt=$null){ $cl=$lo.ListColumns.Add(); $cl.Name=$name; $cl.DataBodyRange.Formula=$formula; $cl.Range.Interior.Color=$script:grey; if($fmt){ $cl.DataBodyRange.NumberFormat=$fmt }; $cl }
function ListVal($lo,$col,$src,$strict=$true){ $dv=$lo.ListColumns.Item($col).DataBodyRange.Validation; $dv.Delete(); $dv.Add(3,1,1,$src); $dv.ShowError=$strict }
function InputHdr($lo,$cols){ foreach($n in $cols){ $lo.ListColumns.Item($n).Range.Cells.Item(1).Interior.Color = $script:yellow } }
function Intro($sheet,$text){ $sheet.Range('A1').Formula=$text; $sheet.Range('A1').Font.Italic=$true }
$script:yellow = 0x99FFFF; $script:grey = 0xEEEEEE

# --- Paramètres
$sh = WS 'Paramètres'
Intro $sh 'Réglages du système de notation. Modifier les cellules jaunes, puis Données > Actualiser tout.'
$rg = Put $sh 'A3' @(
 @('Paramètre','Valeur','Explication'),
 @('Année de démarrage',1960,'Première année prise en compte dans la notation (« all time »).'),
 @('Année de référence','','Année « actuelle » des classements glissants. Par défaut l''année en cours ; mettre 1985 pour revoir le classement de 1985.'),
 @('Fenêtre longue (années)',20,'Classement glissant long : les N dernières années, année de référence incluse.'),
 @('Fenêtre courte (années)',10,'Classement glissant court.'),
 @('Filtre classe','Toutes','« Toutes » ou une classe (IMOCA, Ultim, Figaro…) : filtre les deux classements.'),
 @('Réduction ancien record',0.3,'Part du bonus perdue quand un record est battu (0,3 = l''ancien détenteur garde 70 %).'))
$tP = MkTable $sh $rg 'tParametres' 'TableStyleLight9'
$tP.ListColumns.Item('Valeur').DataBodyRange.Cells.Item(2).Formula = '=YEAR(TODAY())'
$tP.ListColumns.Item('Valeur').DataBodyRange.Cells.Item(6).NumberFormat = '0%'
$tP.ListColumns.Item('Valeur').DataBodyRange.Interior.Color = $yellow
$tP.ListColumns.Item('Valeur').DataBodyRange.HorizontalAlignment = -4108
$sh.Columns.AutoFit() | Out-Null

# --- Classes
$sh = WS 'Classes'
Intro $sh 'Liste des classes de bateaux (utilisée par Bateaux, Courses et le filtre de classement). « Toutes » sert uniquement au filtre.'
$cl = @(@('Classe','Description'),@('Toutes','Valeur de filtre uniquement : toutes classes'),@('IMOCA','Monocoques 60 pieds (Vendée Globe…)'),@('Ultim','Grands trimarans de course au large'),@('Ocean Fifty','Trimarans 50 pieds (ex-Multi50)'),@('Class40','Monocoques 40 pieds'),@('Figaro','Monotypes du circuit Figaro / Solitaire'),@('Mini 6.50','Monocoques 6,50 m'),@('Golden Globe (rétro)','Bateaux d''avant 1988, sans électronique'),@('Monocoque (autre)','Monocoques hors classes ci-dessus'),@('Multicoque (autre)','Multicoques hors classes ci-dessus'),@('Non renseignée','Classe inconnue (souvent : course multi-classes historique)'))
$rg = Put $sh 'A3' $cl; $tCl = MkTable $sh $rg 'tClasses' 'TableStyleLight9'; $sh.Columns.AutoFit() | Out-Null
$dv = $tP.ListColumns.Item('Valeur').DataBodyRange.Cells.Item(5).Validation; $dv.Delete(); $dv.Add(3,1,1,'=INDIRECT("tClasses[Classe]")')

# --- Barème
$sh = WS 'Barème'
Intro $sh 'Barème des points (repris de l''onglet « Dotation Points »). Tout le tableau est modifiable.'
$b = @(
 @('Type','Catégorie','1er','2e','3e','4e','5e','6e','7e','8e et +','Victoire étape','Remarque'),
 @('Transat','Scratch',150,90,50,30,10,5,5,5,0,'Transat anglaise, Route du Rhum et autres transats'),
 @('Transat','Classe',75,45,25,15,10,5,5,5,0,'Classement mono 60'', 50'' ou 40'''),
 @('Tour du monde à étapes','Scratch',240,160,100,80,60,40,20,10,20,'BOC, Around Alone, Velux'),
 @('Tour du monde à étapes','Classe 50',120,80,50,40,30,20,10,10,10,'Vainqueur classe 50'''),
 @('Tour du monde à étapes','Corinthian',60,40,25,0,0,0,0,0,10,''),
 @('Tour du monde','Scratch',300,220,160,120,90,70,50,25,0,'Golden Globe et Vendée Globe'),
 @('Tour du monde','Terminé avec escale',10,10,10,10,10,10,10,10,0,'Terminé mais avec escale'),
 @('Figaro','Scratch',100,70,30,0,0,0,0,0,10,'Figaro et transats Figaro en solo'),
 @('Mini Transat','Scratch',100,70,30,0,0,0,0,0,0,''))
$rg = Put $sh 'A3' $b; $tB = MkTable $sh $rg 'tBareme'
[void](Calc $tB 'Clé' '=[@Type]&"|"&[@Catégorie]'); $sh.Columns.AutoFit() | Out-Null

# --- Courses
$sh = WS 'Courses'
$d = @(,@('ID','Ordre','Course','Année','Type barème','Classe par défaut','Nom d''origine','Remarque'))
foreach($co in $courses){ $d += ,@((Slug $co.Course),$co.Ordre,$co.Course,$co.Annee,$co.Type,$co.Classe,$co.Origine,$co.Remarque) }
$rg = Put $sh 'A1' $d; $tC = MkTable $sh $rg 'tCourses'
ListVal $tC 'Type barème' '=INDIRECT("tBareme[Type]")'; ListVal $tC 'Classe par défaut' '=INDIRECT("tClasses[Classe]")'
$sh.Columns.AutoFit() | Out-Null; $sh.Columns.Item(8).ColumnWidth = 80

# --- Skippers
$sh = WS 'Skippers'
$d = @(,@('ID','Skipper','Nationalité','Remarque'))
foreach($s in ($sk.Values | Sort-Object { Norm $_.Nom })){ $rem = if($s.Lignes.Count -gt 1){'Fusion de doublons de l''ancien fichier : vérifier qu''il s''agit bien de la même personne'}else{''}; $d += ,@((Slug $s.Nom),$s.Nom,'',$rem) }
$rg = Put $sh 'A1' $d; $tS = MkTable $sh $rg 'tSkippers'; $sh.Columns.AutoFit() | Out-Null

# --- Bateaux
$sh = WS 'Bateaux'
$rg = Put $sh 'A1' @(@('ID','Nom','Classe','Année de lancement','Architecte','Chantier','Anciens noms','Remarque'),@('','','','','','','',''))
$tBa = MkTable $sh $rg 'tBateaux'
ListVal $tBa 'Classe' '=INDIRECT("tClasses[Classe]")'
InputHdr $tBa @('ID','Nom','Classe','Année de lancement','Architecte','Chantier','Anciens noms')
$sh.Range('J1').Formula = 'ID : identifiant unique et stable, par ex. « imoca-2023-macif-sante-prevoyance ». Le bateau garde son ID même s''il change de nom (noter les anciens noms).'
$sh.Range('J1').Font.Italic = $true
foreach($i in 1..8){ $sh.Columns.Item($i).ColumnWidth = 18 }

# --- Types de records
$sh = WS 'Types de records'
Intro $sh 'Chaque record homologué rapporte un bonus. Détenteur actuel : 100 % ; ancien détenteur : bonus réduit (voir Paramètres).'
$rg = Put $sh 'A3' @(
 @('Record','Bonus','Description'),
 @('Tour du monde en solitaire',300,'Record autour du monde en solitaire sans escale (WSSRC). Bonus = une victoire au Vendée Globe.'),
 @('Traversée Atlantique Nord en solitaire',150,'New York – Cap Lizard (WSSRC). Bonus = une victoire sur la Route du Rhum.'),
 @('Distance en 24 h en solitaire',100,'Plus grande distance parcourue en 24 h en solitaire (WSSRC).'))
$tRD = MkTable $sh $rg 'tRecordsDef' 'TableStyleLight9'
$tRD.ListColumns.Item('Bonus').DataBodyRange.Interior.Color = $yellow
$sh.Columns.AutoFit() | Out-Null

# --- Résultats
$sh = WS 'Résultats'
$d = @(,@('Course','Skipper','Bateau','Catégorie','Place','Victoires étape','Points saisis','Remarque'))
foreach($x in $rows){ $d += ,@($x.C,$x.S,'','','','',$x.P,'Points repris de l''ancien fichier') }
$rg = Put $sh 'A1' $d; $tR = MkTable $sh $rg 'tResultats'
[void](Calc $tR 'Année' '=IFERROR(INDEX(tCourses[Année],MATCH([@Course],tCourses[Course],0)),"")')
[void](Calc $tR 'Type barème' '=IFERROR(INDEX(tCourses[Type barème],MATCH([@Course],tCourses[Course],0)),"?")')
[void](Calc $tR 'Classe' '=IF([@Bateau]<>"",IFERROR(INDEX(tBateaux[Classe],MATCH([@Bateau],tBateaux[ID],0)),"?"),IFERROR(INDEX(tCourses[Classe par défaut],MATCH([@Course],tCourses[Course],0)),"Non renseignée"))')
[void](Calc $tR 'Points' '=IF([@[Points saisis]]<>"",[@[Points saisis]],IF([@Place]="",0,IFERROR(INDEX(tBareme[[1er]:[8e et +]],MATCH([@[Type barème]]&"|"&[@Catégorie],tBareme[Clé],0),MIN([@Place],8)),0)+N([@[Victoires étape]])*IFERROR(INDEX(tBareme[Victoire étape],MATCH([@[Type barème]]&"|"&[@Catégorie],tBareme[Clé],0)),0)))')
InputHdr $tR @('Course','Skipper','Bateau','Catégorie','Place','Victoires étape','Points saisis')
ListVal $tR 'Course' '=INDIRECT("tCourses[Course]")'; ListVal $tR 'Skipper' '=INDIRECT("tSkippers[Skipper]")'; ListVal $tR 'Bateau' '=INDIRECT("tBateaux[ID]")'
ListVal $tR 'Catégorie' 'Scratch,Classe,Classe 50,Corinthian,Terminé avec escale' $false
$sh.Columns.AutoFit() | Out-Null; $sh.Columns.Item(8).ColumnWidth = 30
$sh.Activate(); $xl.ActiveWindow.SplitRow=1; $xl.ActiveWindow.FreezePanes=$true

# --- Records (historique du record du tour du monde en solitaire, à vérifier)
$sh = WS 'Records'
$recs = @(
 @('Tour du monde en solitaire','Joyon Francis','',(Get-Date '2004-02-03').ToOADate(),'72 j 22 h 54 min','IDEC – source WSSRC, à vérifier'),
 @('Tour du monde en solitaire','Mc Arthur Ellen','',(Get-Date '2005-02-07').ToOADate(),'71 j 14 h 18 min','B&Q – source WSSRC, à vérifier'),
 @('Tour du monde en solitaire','Joyon Francis','',(Get-Date '2008-01-20').ToOADate(),'57 j 13 h 34 min','IDEC 2 – source WSSRC, à vérifier'),
 @('Tour du monde en solitaire','Coville Thomas','',(Get-Date '2016-12-25').ToOADate(),'49 j 3 h 7 min','Sodebo Ultim – source WSSRC, à vérifier'),
 @('Tour du monde en solitaire','Gabart Francois','',(Get-Date '2017-12-17').ToOADate(),'42 j 16 h 40 min','Macif – source WSSRC, à vérifier'))
$d = @(,@('Record','Skipper','Bateau','Date','Temps / performance','Remarque')) + $recs
$rg = Put $sh 'A1' $d; $tRe = MkTable $sh $rg 'tRecords'
$dateRg = $tRe.ListColumns.Item('Date').DataBodyRange
try { $dateRg.NumberFormat = 'dd/mm/yyyy' } catch { try { $dateRg.NumberFormatLocal = 'jj/mm/aaaa' } catch { Write-Output ('format date ignoré: ' + $_.Exception.Message) } }
[void](Calc $tRe 'Année' '=IF([@Date]="","",YEAR([@Date]))')
[void](Calc $tRe 'Statut' '=IF([@Record]="","",IF(COUNTIFS(tRecords[Record],[@Record],tRecords[Date],">"&[@Date])=0,"Actuel","Ancien"))')
[void](Calc $tRe 'Compté' '=IF(COUNTIFS(tRecords[Record],[@Record],tRecords[Skipper],[@Skipper],tRecords[Date],">"&[@Date])=0,1,0)')
[void](Calc $tRe 'Classe' '=IF([@Bateau]<>"",IFERROR(INDEX(tBateaux[Classe],MATCH([@Bateau],tBateaux[ID],0)),"?"),"Non renseignée")')
[void](Calc $tRe 'Bonus' '=IFERROR(INDEX(tRecordsDef[Bonus],MATCH([@Record],tRecordsDef[Record],0)),0)*[@Compté]*IF([@Statut]="Actuel",1,1-INDEX(tParametres[Valeur],MATCH("Réduction ancien record",tParametres[Paramètre],0)))' '0')
InputHdr $tRe @('Record','Skipper','Bateau','Date','Temps / performance')
ListVal $tRe 'Record' '=INDIRECT("tRecordsDef[Record]")'; ListVal $tRe 'Skipper' '=INDIRECT("tSkippers[Skipper]")'; ListVal $tRe 'Bateau' '=INDIRECT("tBateaux[ID]")'
$sh.Columns.AutoFit() | Out-Null
$sh.Range('M1').Formula = 'Une ligne par record établi (y compris les records battus depuis). « Compté » = 0 quand le même marin a amélioré son propre record : seul son meilleur compte.'
$sh.Range('M1').Font.Italic = $true

# --- Contrôles
$sh = WS 'Contrôles'
$ctl = @(
 @('Contrôle','Nombre','Ce qu''il faut faire si > 0'),
 @('Résultats dont la course n''existe pas dans Courses','=SUMPRODUCT(--(COUNTIF(tCourses[Course],tResultats[Course])=0))','Créer la course dans Courses ou corriger le nom'),
 @('Résultats dont le skipper n''existe pas dans Skippers','=SUMPRODUCT(--(COUNTIF(tSkippers[Skipper],tResultats[Skipper])=0))','Ajouter le skipper ou corriger l''orthographe'),
 @('Résultats dont le bateau n''existe pas dans Bateaux','=SUMPRODUCT((tResultats[Bateau]<>"")*(COUNTIF(tBateaux[ID],tResultats[Bateau])=0))','Créer le bateau dans Bateaux'),
 @('Résultats en double (même course + même skipper)','=SUMPRODUCT(--(COUNTIFS(tResultats[Course],tResultats[Course],tResultats[Skipper],tResultats[Skipper])>1))','Supprimer la ligne en trop'),
 @('Courses dont le type n''a pas de barème','=SUMPRODUCT(--(COUNTIF(tBareme[Type],tCourses[Type barème])=0))','Ajouter le type dans Barème'),
 @('Résultats avec une place mais une catégorie sans barème','=SUMPRODUCT((tResultats[Place]<>"")*(tResultats[Points saisis]="")*(COUNTIF(tBareme[Clé],tResultats[Type barème]&"|"&tResultats[Catégorie])=0))','Renseigner la catégorie (ex. Scratch)'),
 @('Skippers en double','=SUMPRODUCT(--(COUNTIF(tSkippers[Skipper],tSkippers[Skipper])>1))','Fusionner les deux lignes'),
 @('Bateaux : ID en double','=SUMPRODUCT((tBateaux[ID]<>"")*(COUNTIF(tBateaux[ID],tBateaux[ID])>1))','Chaque bateau doit avoir un ID unique'),
 @('Bateaux dont la classe est inconnue','=SUMPRODUCT((tBateaux[ID]<>"")*(COUNTIF(tClasses[Classe],tBateaux[Classe])=0))','Choisir une classe de l''onglet Classes'),
 @('Records dont le type n''existe pas','=SUMPRODUCT((tRecords[Record]<>"")*(COUNTIF(tRecordsDef[Record],tRecords[Record])=0))','Créer le type dans Types de records'),
 @('Records dont le skipper n''existe pas','=SUMPRODUCT((tRecords[Skipper]<>"")*(COUNTIF(tSkippers[Skipper],tRecords[Skipper])=0))','Ajouter le skipper ou corriger le nom'))
$rg = Put $sh 'A1' $ctl; $tK = MkTable $sh $rg 'tControles' 'TableStyleLight9'; $sh.Columns.AutoFit() | Out-Null
$fc = $tK.ListColumns.Item('Nombre').DataBodyRange.FormatConditions.Add(1,3,'=0'); $fc.Interior.Color = 0xCCFFCC
$fc = $tK.ListColumns.Item('Nombre').DataBodyRange.FormatConditions.Add(1,4,'=0'); $fc.Interior.Color = 0x9999FF

# --- Journal
$sh = WS 'Journal'
$d = @(,@('Type','Détail')); foreach($e in $log){ $d += ,@($e[0],$e[1]) }
$rg = Put $sh 'A1' $d; [void](MkTable $sh $rg 'tJournal' 'TableStyleLight1'); $sh.Columns.AutoFit() | Out-Null

# ================= 5. Power Query =================
$mParams = @'
let
    P = Excel.CurrentWorkbook(){[Name="tParametres"]}[Content],
    V = (n as text) => P{[Paramètre = n]}[Valeur],
    Resultat = [
        Debut = Number.From(V("Année de démarrage")),
        Ref = Number.From(V("Année de référence")),
        Long = Number.From(V("Fenêtre longue (années)")),
        Court = Number.From(V("Fenêtre courte (années)")),
        Classe = if V("Filtre classe") = null then "Toutes" else Text.From(V("Filtre classe"))
    ]
in
    Resultat
'@
$mPoints = @'
let
    R = Excel.CurrentWorkbook(){[Name="tResultats"]}[Content],
    R1 = Table.RenameColumns(Table.SelectColumns(R, {"Skipper", "Bateau", "Année", "Classe", "Points", "Course"}), {{"Course", "Libellé"}}),
    R2 = Table.AddColumn(R1, "Source", each "Course", type text),
    K = Excel.CurrentWorkbook(){[Name="tRecords"]}[Content],
    K1 = Table.RenameColumns(Table.SelectColumns(K, {"Skipper", "Bateau", "Année", "Classe", "Bonus", "Record"}), {{"Bonus", "Points"}, {"Record", "Libellé"}}),
    K2 = Table.AddColumn(K1, "Source", each "Record", type text),
    U = Table.Combine({R2, K2}),
    T = Table.TransformColumnTypes(U, {{"Année", Int64.Type}, {"Points", type number}, {"Skipper", type text}, {"Bateau", type text}, {"Classe", type text}, {"Libellé", type text}}),
    E = Table.RemoveRowsWithErrors(T, {"Année", "Points", "Skipper", "Bateau"}),
    F = Table.SelectRows(E, each [Points] <> null and [Points] > 0 and [Année] <> null)
in
    F
'@
$mFn = @'
(cle as text) as table =>
let
    P = Params,
    Src = Table.SelectRows(Points, each
        Record.Field(_, cle) <> null and Record.Field(_, cle) <> ""
        and [Année] >= P[Debut] and [Année] <= P[Ref]
        and (P[Classe] = "Toutes" or P[Classe] = "" or [Classe] = P[Classe])),
    Somme = (t as table, minAn as number) => List.Sum({0} & Table.SelectRows(t, (r) => r[Année] >= minAn)[Points]),
    G = Table.Group(Src, {cle}, {
        {"PtsAll", each List.Sum([Points]), type number},
        {"PtsLong", each Somme(_, P[Ref] - P[Long] + 1), type number},
        {"PtsCourt", each Somme(_, P[Ref] - P[Court] + 1), type number},
        {"PtsAn", each Somme(_, P[Ref]), type number},
        {"Courses", each Table.RowCount(Table.SelectRows(_, (r) => r[Source] = "Course")), Int64.Type},
        {"Records", each Table.RowCount(Table.SelectRows(_, (r) => r[Source] = "Record")), Int64.Type},
        {"Meilleure perf", each Table.Max(_, "Points")[Libellé], type text},
        {"Première", each List.Min([Année]), Int64.Type},
        {"Dernière", each List.Max([Année]), Int64.Type}}),
    Rk = (t as table, col as text) as table =>
        let L = List.Buffer(Table.Column(t, col))
        in Table.AddColumn(t, "Rang_" & col, (r) => if Record.Field(r, col) > 0 then 1 + List.Count(List.Select(L, (x) => x > Record.Field(r, col))) else null, Int64.Type),
    A = Rk(Rk(Rk(Rk(G, "PtsAll"), "PtsLong"), "PtsCourt"), "PtsAn"),
    S = Table.Sort(A, {{"PtsAll", Order.Descending}, {cle, Order.Ascending}}),
    O = Table.SelectColumns(S, {"Rang_PtsAll", cle, "PtsAll", "Rang_PtsLong", "PtsLong", "Rang_PtsCourt", "PtsCourt", "Rang_PtsAn", "PtsAn", "Courses", "Records", "Meilleure perf", "Première", "Dernière"}),
    Ln = Text.From(P[Long]), Cn = Text.From(P[Court]), An = Text.From(P[Ref]),
    N = Table.RenameColumns(O, {
        {"Rang_PtsAll", "Rang all time"}, {"PtsAll", "Points all time"},
        {"Rang_PtsLong", "Rang " & Ln & " ans"}, {"PtsLong", "Points " & Ln & " ans"},
        {"Rang_PtsCourt", "Rang " & Cn & " ans"}, {"PtsCourt", "Points " & Cn & " ans"},
        {"Rang_PtsAn", "Rang " & An}, {"PtsAn", "Points " & An},
        {"Courses", "Nb courses"}, {"Records", "Nb records"}, {"Première", "Première année"}, {"Dernière", "Dernière année"}})
in
    N
'@
$mSk = @'
let
    Resultat = fnClassement("Skipper")
in
    Resultat
'@
$mBa = @'
let
    C = fnClassement("Bateau"),
    B = Table.SelectColumns(Excel.CurrentWorkbook(){[Name="tBateaux"]}[Content], {"ID", "Nom", "Classe", "Année de lancement"}),
    B1 = Table.TransformColumnTypes(B, {{"ID", type text}, {"Nom", type text}, {"Classe", type text}}),
    J = Table.NestedJoin(C, {"Bateau"}, B1, {"ID"}, "B", JoinKind.LeftOuter),
    X = Table.ExpandTableColumn(J, "B", {"Nom", "Classe", "Année de lancement"}, {"Nom du bateau", "Classe", "Lancement"}),
    Cols = List.InsertRange(Table.ColumnNames(C), 2, {"Nom du bateau", "Classe", "Lancement"}),
    R = Table.ReorderColumns(X, Cols),
    S = Table.Sort(R, {{"Points all time", Order.Descending}, {"Bateau", Order.Ascending}})
in
    S
'@
[void]$wb.Queries.Add('Params', $mParams, 'Lit les réglages de l''onglet Paramètres')
[void]$wb.Queries.Add('Points', $mPoints, 'Tous les points : résultats de course + bonus de records')
[void]$wb.Queries.Add('fnClassement', $mFn, 'Classements glissants (all time, fenêtre longue, courte, année) par skipper ou bateau')
[void]$wb.Queries.Add('Classement_Skippers', $mSk, 'Classement des skippers')
[void]$wb.Queries.Add('Classement_Bateaux', $mBa, 'Classement des bateaux')

function LoadQ($sheet,$q,$addr){
  $lo = $sheet.ListObjects.Add(0, "OLEDB;Provider=Microsoft.Mashup.OleDb.1;Data Source=`$Workbook`$;Location=$q;Extended Properties=`"`"", [Type]::Missing, 1, $sheet.Range($addr))
  $lo.Name = "t$q"; $lo.TableStyle='TableStyleMedium2'
  $lo.QueryTable.CommandType = 2; $lo.QueryTable.CommandText = "SELECT * FROM [$q]"
  $lo.QueryTable.BackgroundQuery = $false; $lo.QueryTable.RefreshStyle = 1
  $lo.QueryTable.Refresh($false) | Out-Null; $lo }
$ctx = '="Référence " & INDEX(tParametres[Valeur],2) & "  |  all time depuis " & INDEX(tParametres[Valeur],1) & "  |  fenêtres " & INDEX(tParametres[Valeur],3) & " et " & INDEX(tParametres[Valeur],4) & " ans  |  classe : " & INDEX(tParametres[Valeur],5) & "   →  Données > Actualiser tout après modification"'
foreach($pair in @(@('Classement skippers','Classement_Skippers','CLASSEMENT DES SKIPPERS'),@('Classement bateaux','Classement_Bateaux','CLASSEMENT DES BATEAUX'))){
  $sh = WS $pair[0]
  $sh.Range('A1').Formula = $pair[2]; $sh.Range('A1').Font.Bold=$true; $sh.Range('A1').Font.Size=13
  $sh.Range('A2').Formula = $ctx; $sh.Range('A2').Font.Italic=$true
  [void](LoadQ $sh $pair[1] 'A4')
  $sh.Columns.AutoFit() | Out-Null; $sh.Columns.Item(1).ColumnWidth = 12
  $sh.Activate(); $xl.ActiveWindow.SplitRow=4; $xl.ActiveWindow.FreezePanes=$true
}
(WS 'Classement bateaux').Range('A3').Formula = 'Vide tant qu''aucun bateau n''est renseigné dans Résultats ou Records (colonne Bateau = ID de l''onglet Bateaux).'

# ================= 6. Lisez-moi =================
$sh = WS 'Lisez-moi'
$txt = @(
 'MÉMOIRE DU LARGE – Notation des skippers et des bateaux en solitaire',
 '',
 'PRINCIPE',
 '• Chaque résultat de course rapporte des points (onglet Barème). Chaque record rapporte un bonus (onglet Types de records).',
 '• Les classements sont glissants par rapport à l''« Année de référence » (onglet Paramètres) : all time, 20 ans, 10 ans, année en cours.',
 '• Filtre par classe : Paramètres > Filtre classe (IMOCA, Ultim, Figaro…), puis Données > Actualiser tout.',
 '• Records : le détenteur actuel touche 100 % du bonus. Quand le record est battu, l''ancien détenteur garde le bonus moins la réduction (30 % par défaut).',
 '  Un marin qui bat son propre record n''est compté qu''une fois, avec son meilleur temps.',
 '',
 'ONGLETS À REMPLIR (en-têtes jaunes)',
 '• Résultats : une ligne = un skipper sur une course (+ son bateau si connu).',
 '• Records : une ligne = un record établi (on garde aussi les records battus).',
 '• Bateaux : un bateau = un ID unique et stable (il garde son ID s''il change de nom).',
 '• Courses, Skippers, Classes, Types de records, Barème, Paramètres : les référentiels.',
 '',
 'ONGLETS CALCULÉS (ne pas saisir)',
 '• Classement skippers, Classement bateaux : Power Query. Données > Actualiser tout.',
 '• Contrôles : doit afficher 0 partout.',
 '• Journal : corrections faites lors de la migration depuis classement_solo.xls.',
 '',
 'METTRE À JOUR',
 '1. Nouvelle course : ajouter une ligne dans Courses (Course « Nom Année », Année, Type barème, Classe par défaut).',
 '2. Nouveau skipper / nouveau bateau : l''ajouter dans Skippers / Bateaux.',
 '3. Nouveaux résultats : lignes dans Résultats avec Course, Skipper, Bateau, Catégorie (ex. Scratch) et Place. Laisser « Points saisis » vide.',
 '4. Nouveau record : ligne dans Records (le statut Actuel / Ancien se calcule tout seul).',
 '5. Données > Actualiser tout, puis vérifier Contrôles.',
 '',
 'LIEN AVEC LE SITE',
 '• Les colonnes ID (Skippers, Courses, Bateaux) sont les clés stables à utiliser côté site. Ne jamais les modifier une fois publiées.',
 '',
 'LIMITES CONNUES',
 '• Résultats historiques : points repris tels quels (« Points saisis »), sans place ni bateau. Un changement de barème ne s''applique qu''aux résultats saisis avec une place.',
 '• Classe des courses historiques multi-classes (Route du Rhum, Transat, BOC…) : « Non renseignée » tant que le bateau n''est pas saisi.',
 '• Records déjà saisis : historique du tour du monde en solitaire, à vérifier auprès du WSSRC.'
)
for($i=0;$i -lt $txt.Count;$i++){ $sh.Cells.Item($i+1,1).Formula = $txt[$i] }
$sh.Range('A1').Font.Size=14; $sh.Range('A1').Font.Bold=$true
for($i=0;$i -lt $txt.Count;$i++){ if($txt[$i] -and ($txt[$i] -ceq $txt[$i].ToUpper())){ $sh.Cells.Item($i+1,1).Font.Bold=$true } }
$sh.Columns.Item(1).ColumnWidth = 130
$sh.Activate()

$wb.SaveAs($Dst, 51)
"Journal: $($log.Count) entrées"
$wb.Close($false)
} finally { $xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl); [GC]::Collect() }
