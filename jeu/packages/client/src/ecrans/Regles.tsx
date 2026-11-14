import { textePlage } from '@cal/engine';
import { D } from '../commun';

/**
 * Les règles du jeu, claires et imagées (10/11/2026). Les chiffres sont lus dans les réglages du jeu
 * (regles.json, voiles.json, familles.json) : la page reste juste quand on rééquilibre.
 */

const R = D.regles;
const V = (id: string) => D.voiles.find((v) => v.id === id)!;

/** Petit dé dessiné : points de 1 à 6, couleur selon l'effet. */
function De({ n, fond, encre = '#04121f' }: { n: number; fond: string; encre?: string }) {
  const p: Record<number, [number, number][]> = {
    1: [[20, 20]], 2: [[12, 12], [28, 28]], 3: [[11, 11], [20, 20], [29, 29]],
    4: [[12, 12], [28, 12], [12, 28], [28, 28]], 5: [[11, 11], [29, 11], [20, 20], [11, 29], [29, 29]],
    6: [[12, 10], [28, 10], [12, 20], [28, 20], [12, 30], [28, 30]],
  };
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-label={`Face ${n}`}>
      <rect x="2" y="2" width="36" height="36" rx="8" fill={fond} />
      {p[n].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.6" fill={encre} />)}
    </svg>
  );
}

/** Rose des allures : le vent vient du haut. */
function RoseAllures() {
  const secteur = (a0: number, a1: number, couleur: string) => {
    const r = 70, rad = (a: number) => ((a - 90) * Math.PI) / 180;
    const p = (a: number) => `${100 + r * Math.cos(rad(a))} ${100 + r * Math.sin(rad(a))}`;
    return <path d={`M100 100 L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`} fill={couleur} opacity="0.85" />;
  };
  return (
    <svg viewBox="0 0 200 200" width="220" height="220" role="img" aria-label="Rose des allures : face au vent on louvoie, puis près, travers, largue et vent arrière">
      {secteur(-45, 45, '#5c6f80')}
      {secteur(45, 80, '#3dd6f5')}{secteur(-80, -45, '#3dd6f5')}
      {secteur(80, 120, '#4cc38a')}{secteur(-120, -80, '#4cc38a')}
      {secteur(120, 160, '#ffd166')}{secteur(-160, -120, '#ffd166')}
      {secteur(160, 200, '#ff9f43')}
      <path d="M100 6 L100 30 M92 22 L100 32 L108 22" stroke="#ff9f43" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M100 82 Q108 98 106 118 L94 118 Q92 98 100 82 Z" fill="#e6eef5" />
      <text x="100" y="52" textAnchor="middle" fontSize="11" fill="#e6eef5" fontWeight="700">louvoyage</text>
      <text x="140" y="74" textAnchor="middle" fontSize="11" fill="#04121f" fontWeight="700">près</text>
      <text x="146" y="104" textAnchor="middle" fontSize="11" fill="#04121f" fontWeight="700">travers</text>
      <text x="134" y="140" textAnchor="middle" fontSize="11" fill="#04121f" fontWeight="700">largue</text>
      <text x="100" y="160" textAnchor="middle" fontSize="11" fill="#04121f" fontWeight="700">vent arrière</text>
    </svg>
  );
}

/** Barre d'usure illustrée : nombre de tours avant que la voile explose, à F7. */
function UsureVoile({ id }: { id: string }) {
  const u = R.usure;
  const parTour = u?.par_tour[id]?.[3] ?? 0;
  const tours = parTour ? Math.ceil((u?.seuil ?? 100) / parTour) : null;
  const largeur = tours ? Math.min(100, (tours / 15) * 100) : 100;
  return (
    <div className="regles-usure">
      <span className="regles-usure-nom">{V(id).nom_court}</span>
      <span className="regles-usure-barre"><span style={{ width: `${largeur}%`, background: tours && tours <= 4 ? '#ff5d5d' : tours && tours <= 8 ? '#ffb347' : '#4cc38a' }} /></span>
      <span className="regles-usure-tours">{tours ? `${tours} tours à F7` : 'ne s\'use pas'}</span>
    </div>
  );
}

function Bloc({ titre, accroche, children }: { titre: string; accroche?: string; children: React.ReactNode }) {
  return (
    <section className="panneau regles-bloc">
      <h2>{titre}</h2>
      {accroche && <p className="regles-accroche">{accroche}</p>}
      {children}
    </section>
  );
}

export default function Regles({ onRetour }: { onRetour: () => void }) {
  const tempete = R.tempete ?? {};
  const facesTempete = (f: number) => (Array.isArray(tempete[String(f)]) ? (tempete[String(f)] as number[]) : []);
  return (
    <div className="ecran regles">
      <div className="contenu">
        <div className="lbl">Course au large · règles du jeu</div>
        <h1>Traverser l'Atlantique, plus vite que les autres</h1>
        <p className="regles-intro">
          Route du Rhum, Transat Café L'Or, Rolex Fastnet Race : vous êtes à la barre d'un vrai bateau de course, face à de vrais marins.
          À chaque tour, un choix : <b>un cap et une voile</b>. Puis la mer décide. Le premier qui coupe la ligne a gagné.
        </p>

        <Bloc titre="Un tour en quatre temps" accroche="Tout le monde joue en même temps, en secret.">
          <ol className="regles-temps">
            <li><span className="regles-num">1</span><b>Vous choisissez</b> un cap (16 directions) et une voile, avec le vent du moment.</li>
            <li><span className="regles-num">2</span><b>Les dés du vent</b> : il tourne de 45° (ou pas) et forcit ou mollit, parfois jusqu'à la tempête. Les systèmes météo bougent avec les dés. Votre choix doit tenir le coup. À partir de F{R.vent_fort?.a_partir_de ?? 8}, la face +2 du dé de force compte −1 : une tempête finit par retomber.</li>
            <li><span className="regles-num">3</span><b>Le dé du large</b> : une carte, une question… ou rien. La part du hasard et du savoir.</li>
            <li><span className="regles-num">4</span><b>Vous avancez</b> avec le nouveau vent, le long du trajet tracé sur la carte : bords de louvoyage et dérive du courant compris. Le dernier au classement bouge en premier.</li>
          </ol>
        </Bloc>

        <div className="grille-2">
          <Bloc titre="Le vent et les allures" accroche="La flèche orange montre d'où vient le vent.">
            <div className="regles-image"><RoseAllures /></div>
            <ul className="regles-liste">
              <li><b>Face au vent</b> (moins de 45°) : on louvoie, en tirant des bords. Avec une voile de près, on avance de {Math.round((R.louvoyage?.coefficient ?? 0.6) * 100)} % de la distance au près ; avec une voile de portant, on reste planté.</li>
              <li><b>Plus le vent est fort, plus on va vite</b>… jusqu'à un certain point : le vent peut monter au-delà de F8 (jusqu'à F{R.force_max}), et c'est la tempête, avec son dé.</li>
              <li><b>Au départ</b>, le vent est tiré au hasard : direction et force (F2 à F5).</li>
            </ul>
          </Bloc>

          <Bloc titre="Les voiles" accroche="La bonne voile, au bon moment. Toute la course est là.">
            <ul className="regles-voiles">
              <li><b>Spi</b> : le roi du vent arrière, à partir du grand largue ({String(V('spi').angle_min ?? 135).replace('.', ',')}° du vent). Tient {textePlage(V('spi'))}.</li>
              <li><b>Spi gros temps</b> (monocoques) : le spi des fortes brises, à partir du grand largue (135° du vent). Tient {textePlage(V('spi_gros_temps'))}.</li>
              <li><b>Gennaker</b> : rapide et nerveux, au largue, à partir de {String(V('gennaker').angle_min ?? 112.5).replace('.', ',')}° du vent, jamais au près ni au travers. Tient {textePlage(V('gennaker'))}.</li>
              <li><b>Code 0</b> : du travers au largue ({V('code0').angle_min ?? 90}° du vent et plus), sur le bout-dehors. Tient {textePlage(V('code0'))}.</li>
              <li><b>Solent</b> : la voile à tout faire, au près comme au travers, {textePlage(V('solent'))}.</li>
              <li><b>J3 / foc</b> : la voile de brise, solide, {textePlage(V('j3'))}.</li>
              <li><b>Voilure réduite</b> : grand-voile arisée et tourmentin, pour survivre, {textePlage(V('reduite'))}. Au-delà, on se met à la cape, à sec de toile.</li>
            </ul>
            <p className="muted">Ces plages sont les mêmes pour toutes les classes. Une voile hors de sa plage pour le vent du moment est grisée : on ne peut pas la choisir. Mais si le vent forcit après votre choix, il y a <b>trop de toile</b> : la voile lâche, le bateau ne fait qu'un tiers de sa route et ne lance pas le dé du large (sur un multicoque, le largueur automatique d'écoute évite le chavirage, mais la voile lâche aussi). Une <b>carte réparation</b> repêche la voile, avec 40 % d'usure en plus. Si le vent <b>tourne</b> et que la voile ne porte plus, ou sort de sa plage à la nouvelle allure, on change de voile : la manœuvre coûte la moitié de la route et la carte du large du tour.</p>
          </Bloc>
        </div>

        <Bloc titre="Les voiles s'usent" accroche="Pousser fort, c'est rapide… jusqu'au moment où ça casse.">
          <p className="muted">Chaque tour use la voile d'avant hissée, d'autant plus vite que le vent est fort. À 100 %, elle explose. La barre sous chaque voile, dans le tableau de bord, montre son usure. Pour une transat :</p>
          <div className="regles-usures">
            {['spi', 'gennaker', 'code0', 'solent', 'j3'].map((id) => <UsureVoile key={id} id={id} />)}
          </div>
          <p className="muted">Une escale au port remet les voiles à neuf. La grand-voile ne s'use pas, mais une avarie peut l'abîmer. Les Ultims usent plus vite leurs voiles, les Class40 moins vite.</p>
        </Bloc>

        <div className="grille-2">
          <Bloc titre="Le dé du large" accroche="Un seul dé, à chaque tour, pour chaque bateau.">
            <div className="regles-des">
              <div>{(R.de_du_large?.carte ?? [4, 5, 6]).map((n) => <De key={n} n={n} fond="#ffd166" />)}<span><b>Carte du large</b> : un tiers de bonnes nouvelles (dauphins, belle risée), un tiers d'histoires de mer sans effet, un tiers d'avaries (OFNI, nuit sans sommeil…).</span></div>
              <div>{(R.de_du_large?.question ?? [2, 3]).map((n) => <De key={n} n={n} fond="#3dd6f5" />)}<span><b>Question de culture marine</b> : bonne réponse, bonne manœuvre. Mauvaise réponse : la voile s'use de {R.usure?.mauvaise_reponse ?? 20} %.</span></div>
              <div><De n={1} fond="#5c6f80" encre="#e6eef5" /><span><b>Rien</b> : la mer vous laisse tranquille.</span></div>
            </div>
            <p className="muted">Vous lancez vous-même le dé (en réseau, chacun lance le sien). Une avarie vous fait perdre une part de votre avance, parfois pendant plusieurs tours. Vous partez avec {R.reparations_depart} cartes réparation : elles permettent de limiter l'impact de l'avarie. Gardez-en une pour le gros temps.</p>
          </Bloc>

          <Bloc titre="La tempête" accroche="Au-delà de force 8, la mer peut tout prendre. Le vent général peut y monter, les fronts aussi.">
            <div className="regles-des">
              {[9, 10, 11].map((f) => (
                <div key={f}>
                  <span className="regles-force">F{f}</span>
                  {[1, 2, 3, 4, 5, 6].map((n) => <De key={n} n={n} fond={facesTempete(f).includes(n) ? '#ff5d5d' : '#1f3d5a'} encre={facesTempete(f).includes(n) ? '#ffffff' : '#9fb3c8'} />)}
                </div>
              ))}
            </div>
            <p className="muted">Faces rouges : <b>démâtage</b> pour un monocoque (il ne reste qu'un gréement de fortune) ou <b>chavirage</b> pour un multicoque. Démâté, le monocoque rentre par la mer au port d'escale le plus proche (250 milles par tour au plus, sans couper la terre ni les rails interdits), y répare 1 tour et repart avec des voiles neuves ; sans port (Fastnet), c'est la fin de course. Un multicoque chaviré abandonne.</p>
            <p className="muted"><b>À la cape</b> : à partir de force {R.a_la_cape?.force_min ?? 10}, aucune voile ne tient, même la voilure réduite. À sec de toile, le bateau dérive d'une case sous le vent, sans choisir sa direction et sans dé du large. Il encaisse mieux : seul un 6 démâte ou fait chavirer.</p>
            <p className="muted"><b>Un seul dé par tempête</b> : un bateau dont le gréement a tenu à une force ne relance pas le dé tant que le vent ne dépasse pas cette force. Il le relance si le vent monte plus haut, ou lors d'une nouvelle tempête.</p>
          </Bloc>
        </div>

        <Bloc titre="La météo, votre premier adversaire" accroche="Lisez le ciel : il dessine la route.">
          <div className="regles-meteo">
            <div><span className="regles-pastille" style={{ background: 'rgba(61,214,245,0.35)' }} /><b>Alizés</b> : un vent régulier qui pousse vers les Antilles. Les dés le font varier dans sa plage : du Nord à l'Est dans l'hémisphère nord, du Sud à l'Est dans l'hémisphère sud. Aller les chercher coûte un détour… et rapporte gros.</div>
            <div><span className="regles-pastille" style={{ background: 'rgba(255,255,255,0.25)' }} /><b>Le vent de votre zone</b> : alizés, front, molle ou vent général, les dés font évoluer le vent là où vous êtes, et c'est celui-là qui s'affiche.</div>
            <div><span className="regles-pastille" style={{ background: 'rgba(255,110,110,0.45)' }} /><b>Fronts</b> : annoncés à l'avance. Vent fort dans le front, puis bascule du vent dans la traîne. À éviter, ou à attaquer.</div>
            <div><span className="regles-pastille" style={{ background: 'rgba(150,190,255,0.45)' }} /><b>Anticyclone</b> : calme au centre, vent qui tourne autour dans le sens des aiguilles d'une montre. On le contourne.</div>
            <div><span className="regles-pastille" style={{ background: 'rgba(255,226,166,0.45)' }} /><b>Molle</b> : petit temps instable près de l'arrivée. La course peut se jouer à la fin.</div>
            <div><span className="regles-pastille" style={{ background: 'rgba(220,230,240,0.45)' }} /><b>Brume</b> : on avance moins vite, on ne voit plus les autres… et on peut les percuter.</div>
            <div><span className="regles-pastille" style={{ background: 'rgba(170,225,255,0.45)' }} /><b>Courants et marées</b> : courant des Canaries, marées de la Manche (elles s'inversent à chaque tour). La dérive s'ajoute au déplacement, en cours de route.</div>
            <div><span className="regles-pastille" style={{ background: 'rgba(120,120,140,0.45)' }} /><b>Pot-au-noir</b> (Transat Café L'Or) : le bateau s'arrête au milieu. Au tour suivant, il lance le dé : pair, il repart ; impair, il passe son tour.</div>
          </div>
        </Bloc>

        <div className="grille-2">
          <Bloc titre="Sur l'eau, entre concurrents">
            <ul className="regles-liste">
              <li><b>Jamais deux bateaux sur la même case</b> : le bateau déjà en place a la priorité ; celui qui arrive s'arrête juste avant, sur son trajet.</li>
              <li><b>Collision</b> : seulement dans la brume, quand on finit sur la case d'un concurrent qu'on ne voyait pas. Les deux perdent une carte réparation et un tour.</li>
              <li><b>Zones interdites</b> (rails de cargos, ou DST, dessinés sur la carte : Ouessant, les Scilly, Land's End…) : on ne les traverse pas.</li>
              <li><b>Marques de parcours</b> : à respecter, du bon côté. Le Fastnet Rock se contourne en le laissant à bâbord : sans le tour complet, la marque ne compte pas.</li>
              <li><b>Ports</b> : on peut s'arrêter dans un port d'escale (bouton « ⚓ port ») : voiles neuves, puis on repart au tour suivant. Démâté, on y est rapatrié par la mer.</li>
            </ul>
          </Bloc>

          <Bloc titre="Des marins et des bateaux">
            <ul className="regles-liste">
              <li><b>Cinq classes</b> : Ultim, IMOCA, Ocean Fifty, Class40, et les bateaux de légende (Vintage, avec un classement des monocoques et un des multicoques).</li>
              <li><b>Jauge des IMOCA et des Ocean Fifty</b> : jamais plus de {D.classes.find((c) => c.id === 'IMOCA')?.distance_max_24h ?? 640} milles en 24 h sur une transatlantique, bonus compris (le record de l'IMOCA).</li>
              <li><b>Chaque skipper a sa compétence</b>, liée à ce qu'il est dans la vraie vie : un vrai avantage, et un compromis de la même taille.</li>
              <li><b>Chaque bateau a son architecture</b> : foils, dérives droites, trimaran volant… Allez voir le <b>hangar</b> pour comparer et préparer votre tactique.</li>
            </ul>
          </Bloc>
        </div>

        <Bloc titre="L'arrivée" accroche="Une bouée jaune, le bateau comité : la ligne est entre les deux.">
          <p className="muted">
            La course s'arrête à la fin du tour où le premier bateau coupe la ligne ; les autres sont classés selon la distance qui leur reste.
            Plusieurs bateaux arrivés au même tour ? On les départage au <b>taux de bonnes réponses au quiz</b>, puis au <b>nombre de bonnes
            réponses</b>, puis au <b>moins de milles parcourus</b>. L'animation montre leur passage de la ligne, dans cet ordre.
            Et en multijoueur, on se retrouve au port pour raconter sa course.
          </p>
        </Bloc>

        <div className="barre-actions barre-fixe">
          <button className="btn" onClick={onRetour}>← Accueil</button>
        </div>
      </div>
    </div>
  );
}
