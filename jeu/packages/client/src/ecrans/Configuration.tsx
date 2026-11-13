import type { NiveauIA } from '@cal/engine';
import { D, NIVEAUX_IA, NIVEAUX_QUIZ, Reglages } from '../commun';
import { classesDe, COURSES_PROPOSEES, courseDef, nomClasse, skippersDe } from '../commun';
import { useEffect } from 'react';

interface Props {
  reglages: Reglages;
  onChange: (r: Reglages) => void;
  onRetour: () => void;
  onSuite: () => void;
}

export default function Configuration({ reglages: r, onChange, onRetour, onSuite }: Props) {
  // Une course retirée de la version en ligne (tour du monde en essai) ne peut pas rester choisie.
  const course = COURSES_PROPOSEES.find((c) => c.id === r.courseId) ?? courseDef('route-du-rhum');
  useEffect(() => {
    if (r.courseId && course.id !== r.courseId) onChange({ ...r, courseId: course.id, classe: classesDe(course.id)[0]?.id });
  }, [r, course.id, onChange]);
  const maxBateaux = (classe: string | undefined) => Math.floor(skippersDe(classe).length / (course.double ? 2 : 1));
  const nbHumains = r.humains.length;
  const setNbHumains = (n: number) => {
    const humains = Array.from({ length: n }, (_, i) => r.humains[i] ?? { nom: `Joueur ${i + 1}`, niveauQuiz: 1 as const });
    onChange({ ...r, humains });
  };
  const opt = (k: keyof Reglages['options'], v: boolean) => onChange({ ...r, options: { ...r.options, [k]: v } });

  return (
    <div className="ecran">
      <div className="contenu">
        <h1>Configuration de la partie</h1>
        <div className="grille-2">
          <div className="panneau" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="champ">
              <span className="lbl">Mode</span>
              <div className="segment">
                <button aria-pressed={r.mode === 'solo'} onClick={() => onChange({ ...r, mode: 'solo', humains: r.humains.slice(0, 1) })}>Solo contre IA</button>
                <button aria-pressed={r.mode === 'meme_ecran'} onClick={() => onChange({ ...r, mode: 'meme_ecran', humains: r.humains.length < 2 ? [...r.humains, { nom: 'Joueur 2', niveauQuiz: 1 }] : r.humains })}>
                  Même écran
                </button>
                <button disabled title="Phase 4">Réseau local (plus tard)</button>
              </div>
            </div>
            {r.mode === 'meme_ecran' && (
              <div className="champ">
                <span className="lbl">Nombre de joueurs humains</span>
                <div className="segment">
                  {[2, 3, 4].map((n) => (
                    <button key={n} aria-pressed={nbHumains === n} onClick={() => setNbHumains(n)}>{n}</button>
                  ))}
                </div>
              </div>
            )}
            {r.humains.map((h, i) => (
              <div key={i} className="grille-2" style={{ gap: 8 }}>
                <label className="champ">
                  <span className="lbl">Nom du joueur {i + 1}</span>
                  <input type="text" value={h.nom} maxLength={18} onChange={(e) => onChange({ ...r, humains: r.humains.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)) })} />
                </label>
                <label className="champ">
                  <span className="lbl">Niveau des questions</span>
                  <select value={h.niveauQuiz} onChange={(e) => onChange({ ...r, humains: r.humains.map((x, j) => (j === i ? { ...x, niveauQuiz: Number(e.target.value) as 1 | 2 | 3 } : x)) })}>
                    {[1, 2, 3].map((n) => (
                      <option key={n} value={n}>{NIVEAUX_QUIZ[n]}</option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
            <div className="champ">
              <span className="lbl">Classe de bateaux</span>
              <div className="segment">
                {classesDe(r.courseId).map((c) => (
                  <button key={c.id} aria-pressed={(r.classe ?? 'IMOCA') === c.id} onClick={() => onChange({ ...r, classe: c.id, nbBateaux: Math.min(r.nbBateaux ?? 4, maxBateaux(c.id)) })}>
                    {c.nom}
                  </button>
                ))}
              </div>
            </div>
            <div className="champ">
              <span className="lbl">Nombre de bateaux en course</span>
              <div className="segment">
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].filter((n) => n >= Math.max(2, nbHumains) && n <= maxBateaux(r.classe)).map((n) => (
                  <button key={n} aria-pressed={(r.nbBateaux ?? 4) === n} onClick={() => onChange({ ...r, nbBateaux: n })}>{n}</button>
                ))}
              </div>
            </div>
            <div className="champ">
              <span className="lbl">Niveau des IA ({Math.max(0, (r.nbBateaux ?? 4) - nbHumains)} adversaire{(r.nbBateaux ?? 4) - nbHumains > 1 ? 's' : ''})</span>
              <div className="segment">
                {(['facile', 'moyen'] as NiveauIA[]).map((n) => (
                  <button key={n} aria-pressed={r.niveauIA === n} onClick={() => onChange({ ...r, niveauIA: n })}>{NIVEAUX_IA[n]}</button>
                ))}
                <button disabled title="Phase 2">Difficile (plus tard)</button>
              </div>
            </div>
          </div>

          <div className="panneau" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="lbl">Course</span>
            <div className="segment" style={{ flexWrap: 'wrap' }}>
              {COURSES_PROPOSEES.map((c) => (
                <button key={c.id} aria-pressed={course.id === c.id} onClick={() => {
                  const classes = classesDe(c.id).map((k) => k.id);
                  const classe = classes.includes(r.classe ?? 'IMOCA') ? r.classe : classes[0];
                  const max = Math.floor(skippersDe(classe).length / (c.double ? 2 : 1));
                  onChange({ ...r, courseId: c.id, classe, nbBateaux: Math.min(r.nbBateaux ?? 4, max) });
                }}>{c.nom}</button>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--police-titre)', fontSize: 20, fontWeight: 700 }}>{course.nom}</div>
              <div className="muted">{course.sous_titre} · {nomClasse(r.classe)}</div>
              {r.classe === 'VINTAGE' && <div style={{ marginTop: 6 }}>🏆 <b>Deux classements</b> : monocoques et multicoques courent ensemble, mais chacun a son classement (comme au Rhum Mono et au Rhum Multi). La course se termine quand chaque catégorie a son vainqueur.</div>}
              {course.double && <div style={{ marginTop: 6 }}>👥 <b>Course en double</b> : vous choisissez un skipper (c'est son bateau qui court) et un co-skipper. Leurs bonus s'additionnent, leurs compromis aussi.</div>}
              {course.portes_par_classe?.[r.classe ?? 'IMOCA'] && (
                <div style={{ marginTop: 6 }}>⚑ Marque obligatoire : <b>{course.portes_par_classe[r.classe ?? 'IMOCA'].filter((p) => p.type === 'marque' && !p.cachee).map((p) => p.nom).join(', ')}</b>
                  {course.distances_officielles?.[r.classe ?? 'IMOCA'] ? <> · parcours officiel {course.distances_officielles[r.classe ?? 'IMOCA'].toLocaleString('fr-FR')} milles</> : null}</div>
              )}
            </div>
            <span className="lbl" style={{ marginTop: 6 }}>Options</span>
            <label className="case-cocher"><input type="checkbox" checked={r.options.quiz} onChange={(e) => opt('quiz', e.target.checked)} /> Questions de culture marine (dé du large : 3 ou 4)</label>
            {r.options.quiz && (
              <label className="champ">
                <span className="lbl">Temps pour répondre</span>
                <div className="segment">
                  {[20, 40, 0].map((n) => (
                    <button key={n} aria-pressed={r.delaiQuiz === n} onClick={() => onChange({ ...r, delaiQuiz: n })}>{n ? `${n} s` : 'Sans limite'}</button>
                  ))}
                </div>
              </label>
            )}
            <label className="case-cocher"><input type="checkbox" checked={r.options.evenements !== false} onChange={(e) => opt('evenements', e.target.checked)} /> Cartes du large (dé du large : 5 ou 6)</label>
            <label className="case-cocher"><input type="checkbox" checked={r.options.bulletinMeteo} onChange={(e) => opt('bulletinMeteo', e.target.checked)} /> Bulletin météo (tendance du vent)</label>
            <label className="case-cocher"><input type="checkbox" checked={r.options.nomsReels} onChange={(e) => opt('nomsReels', e.target.checked)} /> Noms réels des skippers et des bateaux</label>
            <label className="case-cocher"><input type="checkbox" checked={r.options.courseComplete} onChange={(e) => opt('courseComplete', e.target.checked)} /> Course complète (les autres continuent après la 1re arrivée)</label>
            <label className="case-cocher"><input type="checkbox" checked={r.vue3d} onChange={(e) => onChange({ ...r, vue3d: e.target.checked })} /> Vue rapprochée 3D pendant la résolution</label>
          </div>
        </div>
        <div className="barre-actions barre-fixe">
          <button className="btn" onClick={onRetour}>← Retour</button>
          <button className="btn btn-principal" onClick={onSuite} disabled={r.humains.some((h) => !h.nom.trim())}>Choisir les skippers →</button>
        </div>
      </div>
    </div>
  );
}
