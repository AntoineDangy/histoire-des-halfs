import { useEffect, useRef, useState } from 'react';
import { coursesReseau, maxBateauxSalon, NIVEAU_QUIZ_DEFAUT, niveauQuizValide, reglagesSalonValides } from '@cal/engine';
import type { EtatPartie, NiveauIA, NiveauQuiz, ReglagesSalon } from '@cal/engine';
import { bateauDef, classesDe, competenceDef, courseDef, D, DE_LARGE, faces, familleDef, NIVEAUX_IA, NIVEAUX_QUIZ, nomClasse, REGLAGES_DEFAUT, skippersDe } from '../commun';
import { Connexion, creerSalon, dejaRejoint, EtatConnexion } from '../reseau';
import Jeu from './Jeu';

interface Props {
  codeInitial: string | null;
  onRetour: () => void;
  onFin: (e: EtatPartie) => void;
}

/** Jeu en réseau : créer une partie et inviter, ou rejoindre avec un code ; salon d'attente ; course. */
export default function Reseau({ codeInitial, onRetour, onFin }: Props) {
  const [nom, setNom] = useState(() => {
    try {
      return localStorage.getItem('cal-nom') ?? '';
    } catch {
      return '';
    }
  });
  // Niveau des questions : choisi par chaque joueur dans le salon, mémorisé sur l'appareil (12/11/2026).
  const [niveauQuiz, setNiveauQuiz] = useState<NiveauQuiz>(() => {
    try {
      return niveauQuizValide(Number(localStorage.getItem('cal-niveau-quiz'))) ?? NIVEAU_QUIZ_DEFAUT;
    } catch {
      return NIVEAU_QUIZ_DEFAUT;
    }
  });
  const [mode, setMode] = useState<'choix' | 'creer' | 'rejoindre'>(codeInitial ? 'rejoindre' : 'choix');
  const [code, setCode] = useState(codeInitial ?? '');
  const [reglages, setReglages] = useState<ReglagesSalon>({ nbBateaux: 6, courseId: 'route-du-rhum', classe: 'IMOCA', niveauIA: 'moyen', options: { ...REGLAGES_DEFAUT.options }, delaiQuiz: 30 });
  // Course, classe et nombre de bateaux toujours compatibles, avec la même règle que le serveur (13/11/2026).
  const regler = (p: Partial<ReglagesSalon>) => setReglages(reglagesSalonValides(D, { ...reglages, ...p }));
  const course = courseDef(reglages.courseId);
  const [cx, setCx] = useState<EtatConnexion | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const conn = useRef<Connexion | null>(null);

  useEffect(() => () => conn.current?.fermer(), []);
  // Page rechargée dans un salon déjà rejoint : reconnexion automatique, sans repasser par le formulaire (13/11/2026, audit C6).
  useEffect(() => {
    if (codeInitial && dejaRejoint(codeInitial)) seConnecter(codeInitial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seConnecter = (c: string) => {
    try {
      localStorage.setItem('cal-nom', nom);
    } catch {
      /* sans conséquence */
    }
    conn.current?.fermer();
    conn.current = new Connexion(c, nom.trim() || 'Skipper', (e) => setCx({ ...e }), niveauQuiz);
    const url = new URL(window.location.href);
    url.searchParams.set('salon', c);
    window.history.replaceState(null, '', url.toString());
  };

  const choisirNiveau = (n: NiveauQuiz) => {
    setNiveauQuiz(n);
    try {
      localStorage.setItem('cal-niveau-quiz', String(n));
    } catch {
      /* sans conséquence */
    }
    conn.current?.envoyer({ t: 'niveauQuiz', niveau: n });
  };

  const creer = async () => {
    setErreur(null);
    try {
      const c = await creerSalon(reglages);
      setCode(c);
      seConnecter(c);
    } catch (e) {
      setErreur((e as Error).message);
    }
  };

  // ---------- En course
  if (cx?.salon?.statut === 'course' && cx.etat) {
    const salon = cx.salon;
    return (
      <Jeu
        key={salon.code}
        lancement={{ reglages: { ...REGLAGES_DEFAUT, classe: salon.reglages.classe ?? 'IMOCA', courseId: salon.reglages.courseId, options: salon.reglages.options, delaiQuiz: salon.reglages.delaiQuiz, nbBateaux: salon.reglages.nbBateaux }, participants: [], graine: 0 }}
        reseau={{
          etat: cx.etat,
          moi: cx.moi,
          ontChoisi: cx.ontChoisi,
          joueurs: salon.joueurs,
          hote: salon.joueurs[cx.moiIndex]?.hote ?? false,
          connecte: cx.connecte,
          envoyer: (a) => conn.current?.action(a),
          confierIA: (id) => conn.current?.envoyer({ t: 'confierIA', bateauId: id }),
          erreur: cx.erreur,
          effacerErreur: () => conn.current?.effacerErreur(),
          echeance: cx.echeance,
        }}
        onQuitter={() => {
          conn.current?.fermer();
          onRetour();
        }}
        onFin={onFin}
      />
    );
  }

  // ---------- Salon d'attente
  if (cx?.salon) {
    const s = cx.salon;
    const moi = s.joueurs[cx.moiIndex];
    const lien = `${window.location.origin}${window.location.pathname}?salon=${s.code}`;
    const pris = new Map(s.joueurs.filter((j) => j.skipperId).map((j) => [j.skipperId!, j.nom]));
    const tousPrets = s.joueurs.length > 0 && s.joueurs.every((j) => j.skipperId);
    return (
      <div className="ecran">
        <div className="contenu">
          <div className="lbl">Partie en réseau · salon</div>
          <div className="salon-tete">
            <div>
              <h1>Code : <span className="code-salon">{s.code}</span></h1>
              <p className="muted">
                {courseDef(s.reglages.courseId).nom}{courseDef(s.reglages.courseId).double ? ' (en double)' : ''} · {nomClasse(s.reglages.classe)} · {s.reglages.nbBateaux} bateaux en course · {s.joueurs.length}/{s.maxHumains} joueurs humains · IA {NIVEAUX_IA[s.reglages.niveauIA].toLowerCase()}
                {!cx.connecte && ' · reconnexion…'}
              </p>
            </div>
            <div className="panneau" style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
              <span className="lbl">Inviter des participants</span>
              <code className="lien-invitation">{lien}</code>
              <button
                className="btn btn-principal btn-petit"
                onClick={() => {
                  navigator.clipboard?.writeText(lien).then(() => setCopie(true), () => setCopie(false));
                }}
              >
                {copie ? 'Lien copié ✓' : 'Copier le lien d\'invitation'}
              </button>
            </div>
          </div>

          <div className="panneau">
            <span className="lbl">Équipages</span>
            <ul className="liste-joueurs">
              {s.joueurs.map((j, i) => (
                <li key={i}>
                  <span className={`point ${j.connecte ? 'en-ligne' : ''}`} />
                  <b>{j.nom}</b>
                  {j.hote && <span className="tag-joueur">hôte</span>}
                  {i === cx.moiIndex && <span className="muted">(vous)</span>}
                  <span className="muted" style={{ marginLeft: 'auto' }}>
                    {j.skipperId ? D.skippers.find((k) => k.id === j.skipperId)?.nom_affiche : 'choisit son skipper…'}
                    {s.reglages.options.quiz && ` · questions ${NIVEAUX_QUIZ[j.niveauQuiz ?? NIVEAU_QUIZ_DEFAUT]}`}
                  </span>
                </li>
              ))}
              {Array.from({ length: Math.max(0, s.reglages.nbBateaux - s.joueurs.length) }, (_, i) => (
                <li key={`ia${i}`} className="muted"><span className="point" /> IA ({NIVEAUX_IA[s.reglages.niveauIA].toLowerCase()})</li>
              ))}
            </ul>
          </div>

          {s.reglages.options.quiz && moi && (
            <div className="panneau" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="lbl">Vos questions de culture marine</span>
              <div className="segment">
                {([1, 2, 3] as NiveauQuiz[]).map((n) => (
                  <button key={n} aria-pressed={(moi.niveauQuiz ?? NIVEAU_QUIZ_DEFAUT) === n} onClick={() => choisirNiveau(n)}>{NIVEAUX_QUIZ[n]}</button>
                ))}
              </div>
              <span className="muted" style={{ fontSize: 13 }}>Chacun choisit le niveau de ses propres questions, jusqu'au départ.</span>
            </div>
          )}

          <h2 style={{ fontSize: 20 }}>{moi?.skipperId ? 'Votre skipper' : 'Choisissez votre skipper'}</h2>
          <div className="cartes">
            {skippersDe(s.reglages.classe).map((k) => {
              const b = bateauDef(k.bateau_id);
              const c = competenceDef(k.competence);
              const par = pris.get(k.id);
              const aMoi = moi?.skipperId === k.id;
              return (
                <button key={k.id} className="carte-choix" aria-pressed={aMoi} disabled={!!par && !aMoi} onClick={() => conn.current?.envoyer({ t: 'skipper', skipperId: k.id })}>
                  <div className="nom"><span className="pastille-couleur" style={{ background: k.couleurs.pion }} />{k.nom_affiche}</div>
                  {par && <span className="tag-joueur">{par}</span>}
                  <div className="competence"><span className="icone-comp">{c.icone}</span> {c.nom}</div>
                  <div className="bonus" style={{ fontSize: 12.5 }}>▲ {c.bonus}</div>
                  <div className="compromis" style={{ fontSize: 12.5 }}>◇ {c.malus}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{b.nom} · {familleDef(b.famille).nom}</div>
                </button>
              );
            })}
          </div>

          {cx.erreur && <div className="alerte-front front">{cx.erreur}</div>}
          <div className="barre-actions barre-fixe">
            <button className="btn" onClick={() => { conn.current?.fermer(); onRetour(); }}>← Quitter le salon</button>
            {moi?.hote ? (
              <button className="btn btn-principal" disabled={!tousPrets} onClick={() => conn.current?.envoyer({ t: 'lancer' })}>
                {tousPrets ? 'Lancer la course ⛵' : 'En attente des choix de skippers…'}
              </button>
            ) : (
              <span className="muted">L'hôte lancera la course quand tout le monde sera prêt.</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Créer ou rejoindre
  return (
    <div className="ecran">
      <div className="contenu">
        <h1>Jouer en réseau</h1>
        <p className="muted">De 2 à 4 joueurs, chacun sur son appareil ; l'IA complète la flotte.</p>
        <label className="champ" style={{ maxWidth: 360 }}>
          <span className="lbl">Votre nom</span>
          <input type="text" value={nom} maxLength={18} onChange={(e) => setNom(e.target.value)} placeholder="Votre nom de skipper" />
        </label>
        {mode === 'choix' && (
          <div className="menu">
            <button className="btn btn-principal" onClick={() => setMode('creer')}>➕ Créer une partie et inviter</button>
            <button className="btn" onClick={() => setMode('rejoindre')}>🔑 Rejoindre avec un code</button>
          </div>
        )}
        {mode === 'creer' && (
          <div className="panneau" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="champ">
              <span className="lbl">Course</span>
              <div className="segment" style={{ flexWrap: 'wrap' }}>
                {coursesReseau(D).map((c) => (
                  <button key={c.id} aria-pressed={course.id === c.id} onClick={() => regler({ courseId: c.id })}>{c.nom}</button>
                ))}
              </div>
              <span className="muted" style={{ fontSize: 13 }}>
                {course.sous_titre}
                {course.double && ' · Course en double : chaque équipage reçoit un co-skipper tiré au hasard, d\'une autre compétence que son skipper.'}
              </span>
            </div>
            <div className="champ">
              <span className="lbl">Classe de bateaux</span>
              <div className="segment" style={{ flexWrap: 'wrap' }}>
                {classesDe(course.id).map((c) => (
                  <button key={c.id} aria-pressed={reglages.classe === c.id} onClick={() => regler({ classe: c.id })}>{c.nom}</button>
                ))}
              </div>
              {reglages.classe === 'VINTAGE' && <span className="muted" style={{ fontSize: 13 }}>Deux classements : monocoques et multicoques courent ensemble, chacun a son vainqueur.</span>}
            </div>
            <div className="champ">
              <span className="lbl">Nombre de bateaux en course (humains + IA)</span>
              <div className="segment" style={{ flexWrap: 'wrap' }}>
                {Array.from({ length: maxBateauxSalon(D, course.id, reglages.classe) - 1 }, (_, i) => i + 2).map((n) => (
                  <button key={n} aria-pressed={reglages.nbBateaux === n} onClick={() => regler({ nbBateaux: n })}>{n}</button>
                ))}
              </div>
            </div>
            <div className="champ">
              <span className="lbl">Niveau des IA</span>
              <div className="segment">
                {(['facile', 'moyen'] as NiveauIA[]).map((n) => (
                  <button key={n} aria-pressed={reglages.niveauIA === n} onClick={() => setReglages({ ...reglages, niveauIA: n })}>{NIVEAUX_IA[n]}</button>
                ))}
              </div>
            </div>
            <label className="case-cocher"><input type="checkbox" checked={reglages.options.quiz} onChange={(e) => setReglages({ ...reglages, options: { ...reglages.options, quiz: e.target.checked } })} /> Questions de culture marine (dé du large : {faces(DE_LARGE.question)} ; chaque joueur choisit son niveau dans le salon)</label>
            <label className="case-cocher"><input type="checkbox" checked={reglages.options.evenements !== false} onChange={(e) => setReglages({ ...reglages, options: { ...reglages.options, evenements: e.target.checked } })} /> Cartes du large (dé du large : {faces(DE_LARGE.carte)})</label>
            <div className="barre-actions">
              <button className="btn" onClick={() => setMode('choix')}>← Retour</button>
              <button className="btn btn-principal" disabled={!nom.trim()} onClick={creer}>Créer le salon</button>
            </div>
          </div>
        )}
        {mode === 'rejoindre' && (
          <div className="panneau" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
            <label className="champ">
              <span className="lbl">Code du salon (4 lettres)</span>
              <input type="text" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} style={{ fontSize: 22, letterSpacing: '0.3em', textTransform: 'uppercase' }} />
            </label>
            <div className="barre-actions">
              <button className="btn" onClick={() => setMode('choix')}>← Retour</button>
              <button className="btn btn-principal" disabled={!nom.trim() || code.length !== 4} onClick={() => seConnecter(code)}>Rejoindre</button>
            </div>
          </div>
        )}
        {(erreur || cx?.erreur) && <div className="alerte-front front">{erreur ?? cx?.erreur}</div>}
        {cx && !cx.salon && <p className="muted">Connexion au salon {code}…</p>}
        <div className="barre-actions">
          <button className="btn" onClick={onRetour}>← Accueil</button>
        </div>
      </div>
    </div>
  );
}
