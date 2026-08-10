#!/usr/bin/env node
/**
 * HyperBlox finition — passe de contrôle GÉOMÉTRIQUE sur un model.json.
 *
 * `build.mjs` ne valide que le schéma : un modèle peut être parfaitement valide
 * et laid. Ce script regarde ce que le schéma ne voit pas — ce qui se passe
 * ENTRE les parts :
 *
 *   zfight       deux faces confondues qui clignotent en jeu
 *   noyee        une part entièrement à l'intérieur d'une autre : invisible
 *   depassement  un bout de barre qui ressort dans le vide après avoir traversé
 *                une autre part — le défaut de la diagonale trop longue
 *   escalier     une volée de marches sans contremarche : on voit sous les marches
 *   orpheline    une part qui ne touche rien (flotte)
 *   micro        une dimension sous le minimum Roblox (0.05)
 *   joint        (option) deux parts pile bord à bord : le joint s'ouvre en mouvement
 *   grille       (option) tailles/positions non snappées, parts non tournées
 *   symetrie     (option) une part sans jumelle en miroir
 *
 * Usage :
 *   node finition.mjs <dossier-du-modele | model.json> [options]
 *
 *   --fix              applique les corrections sûres et réécrit model.json
 *   --tout             active aussi joint / grille / symetrie
 *   --only  a,b,c      ne lance que ces contrôles
 *   --sauf  a,b,c      désactive ces contrôles
 *   --symetrie X|Y|Z   axe du contrôle de symétrie (l'active)
 *   --grille <pas>     pas de grille (défaut 0.05 ; 0 désactive)
 *   --bout <studs>     dépassement toléré au bout d'une barre (défaut 1.5)
 *   --bout-ratio <r>   …et en fraction de sa longueur (défaut 0.25)
 *   --max <n>          constats détaillés affichés par contrôle (défaut 10)
 *   --json             sortie JSON (rapport machine)
 *   --force            autorise --fix sur un model.json généré (déconseillé)
 *
 * ⚠ `--fix` REFUSE d'écrire si le model.json est produit par un générateur
 *   (champ `generator`, ou un gen-*.mjs qui cite le slug) : la correction
 *   serait perdue à la régénération suivante. Dans ce cas, lire le rapport et
 *   corriger DANS le générateur.
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";

/* ============================================================== arguments == */
const argv = process.argv.slice(2);
const AVEC_VALEUR = new Set(["only", "sauf", "symetrie", "grille", "max", "bout", "bout-ratio"]);
const opts = new Map();
const libres = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) { libres.push(a); continue; }
  const nom = a.slice(2);
  if (AVEC_VALEUR.has(nom)) opts.set(nom, argv[++i]);
  else opts.set(nom, true);
}
const flag = (n) => opts.get(n) === true;
const val = (n, d) => (opts.has(n) ? opts.get(n) : d);
const cible = libres[0];

if (!cible) {
  console.error("Usage : node finition.mjs <dossier-du-modele | model.json> [--fix] [--tout] [--json]");
  process.exit(1);
}

let jsonPath = resolve(cible);
if (existsSync(jsonPath) && statSync(jsonPath).isDirectory()) jsonPath = join(jsonPath, "model.json");
if (!existsSync(jsonPath)) { console.error("Introuvable : " + jsonPath); process.exit(1); }

const model = JSON.parse(readFileSync(jsonPath, "utf8"));
if (!Array.isArray(model.parts) || !model.parts.length) {
  console.error("model.json sans parts."); process.exit(1);
}

// Contrôles actifs par défaut : ceux dont un constat est presque toujours un
// vrai défaut. Les trois autres sont trop bruyants sur un modèle organique posé
// par calcul — ils ne s'allument qu'à la demande (`--tout` ou `--only`).
const DEFAUT = ["micro", "noyee", "zfight", "depassement", "escalier", "orpheline"];
const OPTION = ["joint", "grille", "symetrie"];
const TOUS = [...DEFAUT, ...OPTION];

const only = String(val("only", "")).split(",").filter(Boolean);
const sauf = String(val("sauf", "")).split(",").filter(Boolean);
const axeSym = String(val("symetrie", "")).toUpperCase();
const PAS = Number(val("grille", "0.05"));
const MAX = Number(val("max", "10"));
const BOUT_MAX = Number(val("bout", "1.5"));           // studs libres tolérés au bout d'une barre
const BOUT_RATIO = Number(val("bout-ratio", "0.25"));  // …et en fraction de sa longueur
const SORTIE_JSON = flag("json");
const FIX = flag("fix");

const actif = (id) => {
  if (id === "symetrie" && !axeSym) return false;
  if (id === "grille" && !(PAS > 0)) return false;
  if (only.length) return only.includes(id);
  if (sauf.includes(id)) return false;
  return DEFAUT.includes(id) || flag("tout");
};

/* ====================================================== garde générateur == */
// Un model.json généré ne doit jamais être corrigé ici : la prochaine exécution
// du générateur écraserait la correction en silence.
function generateurDe() {
  if (model.generator) return String(model.generator);
  const slug = basename(dirname(jsonPath));
  let d = dirname(jsonPath);
  for (let i = 0; i < 5; i++) {
    for (const sous of [d, join(d, "_outils"), join(d, "..", "_outils")]) {
      if (!existsSync(sous) || !statSync(sous).isDirectory()) continue;
      for (const f of readdirSync(sous)) {
        if (!f.endsWith(".mjs")) continue;
        try {
          if (readFileSync(join(sous, f), "utf8").includes(slug)) return join(sous, f);
        } catch { /* illisible : on ignore */ }
      }
    }
    d = dirname(d);
  }
  return null;
}

/* ================================================================ géométrie */
const r3 = (n) => { const r = Math.round(n * 1000) / 1000; return Object.is(r, -0) ? 0 : r; };

function quatFromEuler(deg = [0, 0, 0]) {
  const [x, y, z] = deg.map((d) => (d * Math.PI) / 180);
  const mul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  const qx = [Math.sin(x / 2), 0, 0, Math.cos(x / 2)];
  const qy = [0, Math.sin(y / 2), 0, Math.cos(y / 2)];
  const qz = [0, 0, Math.sin(z / 2), Math.cos(z / 2)];
  return mul(mul(qx, qy), qz);
}
function rot(q, v) {
  const [qx, qy, qz, qw] = q, [vx, vy, vz] = v;
  const ux = qy * vz - qz * vy, uy = qz * vx - qx * vz, uz = qx * vy - qy * vx;
  const wx = qy * uz - qz * uy, wy = qz * ux - qx * uz, wz = qx * uy - qy * ux;
  return [vx + 2 * (qw * ux + wx), vy + 2 * (qw * uy + wy), vz + 2 * (qw * uz + wz)];
}
const inv = (q) => [-q[0], -q[1], -q[2], q[3]];
const addV = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subV = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/* Boîtes orientées : un descripteur par part, calculé une fois. */
const B = model.parts.map((p, i) => {
  const q = quatFromEuler(p.rotation);
  const half = p.size.map((s) => s / 2);
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const c = addV(rot(q, [half[0] * sx, half[1] * sy, half[2] * sz]), p.position);
    for (let a = 0; a < 3; a++) { if (c[a] < min[a]) min[a] = c[a]; if (c[a] > max[a]) max[a] = c[a]; }
  }
  return {
    i, p, q, qi: inv(q), half, min, max, c: p.position,
    axes: [rot(q, [1, 0, 0]), rot(q, [0, 1, 0]), rot(q, [0, 0, 1])],
    transparent: (p.transparency || 0) > 0.05
      || ["Glass", "Ice", "ForceField"].includes(p.material || ""),
  };
});

const versLocal = (b, w) => rot(b.qi, subV(w, b.c));
const versMonde = (b, l) => addV(rot(b.q, l), b.c);

/* Appartenance au SOLIDE, pas seulement à la boîte englobante : c'est ce qui
   fait qu'un vide sous la pente d'un Wedge est bien vu comme un vide. */
function dansLocal(b, l, eps = 0) {
  const s = b.p.size, [hx, hy, hz] = b.half, [x, y, z] = l;
  switch (b.p.shape) {
    case "Ball": {
      const r = Math.min(s[0], s[1], s[2]) / 2;
      return Math.hypot(x, y, z) <= r + eps;
    }
    case "Cylinder": {
      const r = Math.min(s[1], s[2]) / 2;
      return Math.abs(x) <= hx + eps && Math.hypot(y, z) <= r + eps;
    }
    case "Wedge":
      return Math.abs(x) <= hx + eps && Math.abs(z) <= hz + eps
        && y >= -hy - eps && y <= -hy + (s[1] * (z + hz)) / s[2] + eps;
    case "CornerWedge":
      return Math.abs(x) <= hx + eps && Math.abs(z) <= hz + eps && y >= -hy - eps
        && y <= -hy + (s[1] * (z + hz)) / s[2] + eps
        && y <= -hy + (s[1] * (x + hx)) / s[0] + eps;
    default:
      return Math.abs(x) <= hx + eps && Math.abs(y) <= hy + eps && Math.abs(z) <= hz + eps;
  }
}
const dans = (b, w, eps = 0) => dansLocal(b, versLocal(b, w), eps);

const aabbSeCroisent = (a, b, m = 0) =>
  a.min[0] - m <= b.max[0] && a.max[0] + m >= b.min[0] &&
  a.min[1] - m <= b.max[1] && a.max[1] + m >= b.min[1] &&
  a.min[2] - m <= b.max[2] && a.max[2] + m >= b.min[2];

/* Voisinage : seules les paires dont les boîtes se frôlent sont sondées face
   par face. Sans ce filtre, 600 parts = 180 000 paires. */
const voisins = B.map(() => []);
for (let i = 0; i < B.length; i++) {
  for (let j = i + 1; j < B.length; j++) {
    if (aabbSeCroisent(B[i], B[j], 0.03)) { voisins[i].push(j); voisins[j].push(i); }
  }
}

function couvert(w, exclus, candidats) {
  for (const j of candidats) {
    if (exclus.has(j)) continue;
    if (dans(B[j], w, 0)) return j;
  }
  return -1;
}

/* ============================================================== constats == */
const constats = [];   // { id, gravite, texte, parts, fix? }
const NOTE = { grave: 3, moyen: 2, info: 1 };
const ajout = (id, gravite, texte, parts, fix) => constats.push({ id, gravite, texte, parts, fix });

/* ---------------------------------------------------------------- micro -- */
if (actif("micro")) {
  for (const b of B) {
    const mauvaises = b.p.size.map((v, a) => [a, v]).filter(([, v]) => v < 0.05);
    if (!mauvaises.length) continue;
    ajout("micro", "grave",
      `${b.p.name} : dimension ${mauvaises.map(([a, v]) => "XYZ"[a] + "=" + v).join(", ")} sous le minimum Roblox (0.05) — Studio la remontera et la part ne sera pas où la préview la montre`,
      [b.p.name],
      () => { b.p.size = b.p.size.map((v) => (v < 0.05 ? 0.05 : v)); });
  }
}

/* ---------------------------------------------------------------- noyee -- */
if (actif("noyee")) {
  // Une part noyée reste noyée SAUF si une animation peut l'écarter de son
  // contenant. Être dans un groupe animé ne suffit pas : le groupe emmène les
  // deux. Il faut une track qui bouge l'une sans bouger l'autre.
  const bougePar = (p) => {
    const s = new Set();
    for (const a of model.animations || []) {
      for (const t of a.tracks || []) {
        if (t.target === p.name || (p.group && t.target === p.group)) s.add(a.name + "|" + t.target);
      }
    }
    return s;
  };
  const vol = (x) => x.p.size[0] * x.p.size[1] * x.p.size[2];
  for (const b of B) {
    if (b.transparent) continue;
    const coins = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      coins.push(versMonde(b, [b.half[0] * sx, b.half[1] * sy, b.half[2] * sz]));
    }
    for (const j of voisins[b.i]) {
      const o = B[j];
      if (o.transparent || vol(o) < vol(b)) continue;
      if (!coins.every((c) => dans(o, c, 1e-4))) continue;
      const ma = bougePar(b.p), sa = bougePar(o.p);
      const separables = [...ma].some((t) => !sa.has(t)) || [...sa].some((t) => !ma.has(t));
      ajout("noyee", separables ? "info" : "grave",
        `${b.p.name} est entièrement à l'intérieur de ${o.p.name}${separables
          ? " (une animation les sépare : invisible au repos seulement)"
          : " — invisible en toute circonstance, à supprimer"}`,
        [b.p.name, o.p.name],
        separables ? null : () => { b.p.__supprimer = true; });
      break;
    }
  }
}

/* ------------------------------------------------- faces planes des parts -- */
// Les 6 faces de la boîte, échantillonnées puis filtrées par appartenance au
// solide : sur un Wedge la face -Z n'a aucun point valide et disparaît d'elle
// même, la face ±X ne garde que sa moitié triangulaire.
const N_ECH = 5;
function facesDe(b) {
  if (b.p.shape === "Ball") return [];
  const out = [];
  for (let axe = 0; axe < 3; axe++) {
    const u = (axe + 1) % 3, v = (axe + 2) % 3;
    for (const signe of [-1, 1]) {
      const ech = [];
      for (let a = 0; a < N_ECH; a++) for (let c = 0; c < N_ECH; c++) {
        const l = [0, 0, 0];
        l[axe] = signe * b.half[axe];
        l[u] = -b.half[u] + ((a + 0.5) / N_ECH) * b.p.size[u];
        l[v] = -b.half[v] + ((c + 0.5) / N_ECH) * b.p.size[v];
        const dedans = [...l];
        dedans[axe] -= signe * Math.min(0.01, b.half[axe] * 0.5);
        if (dansLocal(b, dedans, 1e-6)) ech.push(versMonde(b, l));
      }
      if (ech.length < 3) continue;
      const centre = [0, 0, 0];
      centre[axe] = signe * b.half[axe];
      out.push({
        b, axe, signe, ech, pt: versMonde(b, centre),
        n: [b.axes[axe][0] * signe, b.axes[axe][1] * signe, b.axes[axe][2] * signe],
      });
    }
  }
  return out;
}
const FACES = (actif("zfight") || actif("joint")) ? B.map(facesDe) : [];

/* ------------------------------------------------------- zfight / joint -- */
// Les déplacements sont ACCUMULÉS puis appliqués une fois, pas écrits au fil de
// l'eau. Deux raisons, toutes deux apprises sur un caisson à panneaux :
//   — deux parts peuvent partager PLUSIEURS faces confondues (le panneau de
//     fond et le mur latéral d'un coffre en partagent deux ou trois). N'en
//     corriger qu'une par passe ne converge jamais ;
//   — une même part est souvent en cause dans plusieurs paires. Sans
//     déduplication par direction, elle se ferait pousser de 0.03 autant de
//     fois qu'elle a de voisines, et dériverait.
// Clé d'AXE (et non de direction) : deux faces opposées d'une même part peuvent
// être fautives ensemble — le panneau de fond et le mur latéral d'un caisson
// partagent leur dessus ET leur dessous. Un seul déplacement le long de cet axe
// dégage les deux ; un dans chaque sens s'annulerait.
const cleAxe = (n) => {
  const premier = n.findIndex((v) => Math.abs(v) > 1e-6);
  const sens = premier >= 0 && n[premier] < 0 ? -1 : 1;
  return n.map((v) => Math.round(v * sens * 1000)).join(",");
};

const deplacements = new Map();   // part → Map(clé d'AXE → vecteur de déplacement)
function noterDeplacement(part, n, k = 0.03) {
  const v = [n[0] * k, n[1] * k, n[2] * k];
  if (!deplacements.has(part)) deplacements.set(part, new Map());
  const dejaLa = deplacements.get(part).get(cleAxe(n));
  // Sur un même axe on garde le plus grand écart demandé — on ne CUMULE pas,
  // sinon une part entourée de voisines dérive de plusieurs dixièmes.
  if (!dejaLa || Math.hypot(...dejaLa) < Math.abs(k)) deplacements.get(part).set(cleAxe(n), v);
}
function appliquerDeplacements() {
  for (const [part, axes] of deplacements) {
    for (const v of axes.values()) part.position = part.position.map((x, i) => r3(x + v[i]));
  }
}

/* ------------------------------------------- regroupement des faces en PLANS
   Corriger le z-fighting paire par paire ne converge pas : dans un caisson à
   panneaux, cinq parts partagent le même plan. On en décale une, elle devient
   coplanaire avec la suivante ; la passe d'après défait la précédente et le
   compte OSCILLE au lieu de descendre.
   Le bon objet n'est pas la paire mais le PLAN : toutes les faces confondues,
   d'un seul tenant. On y range les parts par volume décroissant, on laisse la
   plus grosse en place — c'est elle qui définit la surface — et on écarte les
   autres en escalier de 0.03, 0.06, 0.09. Après quoi plus aucune ne coïncide,
   et une seule passe suffit. */
const unionParent = new Map();
const trouver = (x) => {
  while (unionParent.get(x) !== x) { unionParent.set(x, unionParent.get(unionParent.get(x))); x = unionParent.get(x); }
  return x;
};
const unir = (a, b) => {
  for (const x of [a, b]) if (!unionParent.has(x)) unionParent.set(x, x);
  const [ra, rb] = [trouver(a), trouver(b)];
  if (ra !== rb) unionParent.set(ra, rb);
};
const faceCle = (f) => f.b.i + ":" + f.axe + ":" + f.signe;
const faceInfo = new Map();       // clé de face → { part, n, volume }

if (actif("zfight") || actif("joint")) {
  for (let i = 0; i < B.length; i++) {
    for (const j of voisins[i]) {
      if (j < i) continue;
      const fautes = [];
      for (const fa of FACES[i]) for (const fb of FACES[j]) {
        const d = dot(fa.n, fb.n);
        if (Math.abs(d) < 0.9995) continue;                  // faces non parallèles
        const ecart = Math.abs(dot(fa.n, subV(fb.pt, fa.pt)));
        if (ecart >= 0.015) continue;   // 0.02 est le décalage recommandé : déjà traité
        // recouvrement : combien d'échantillons de A tombent sur le solide de B
        let touche = 0;
        for (const e of fa.ech) {
          const l = versLocal(fb.b, e);
          l[fb.axe] = fb.signe * (fb.b.half[fb.axe] - 0.005);
          if (dansLocal(fb.b, l, 1e-4)) { if (++touche >= 2) break; }
        }
        if (touche < 2) continue;
        fautes.push({ type: d > 0 ? "zfight" : "joint", fa, fb, ecart });
      }
      if (!fautes.length) continue;
      // Une paire de parts donne un seul constat — lisible — mais sa correction
      // traite TOUTES ses faces fautives.
      const zf = fautes.filter((f) => f.type === "zfight");
      const retenues = zf.length ? zf : fautes;
      const type = zf.length ? "zfight" : "joint";
      if (!actif(type)) continue;
      const [a, b2] = [B[i], B[j]];
      const petite = a.p.size.reduce((x, y) => x * y) <= b2.p.size.reduce((x, y) => x * y) ? a : b2;
      // La normale sort de la petite part par la face fautive. Dans les DEUX
      // cas la correction est la même — avancer la petite part de 0.03 le long
      // de cette normale :
      //   z-fighting (normales de même sens, corps du même côté) → elle ressort
      //     franchement au lieu d'être à ras ;
      //   joint sec (normales opposées, corps de part et d'autre) → elle mord
      //     de 0.03 dans sa voisine, et le joint ne peut plus s'ouvrir.
      const combien = retenues.length > 1 ? ` (${retenues.length} faces)` : "";
      const ecartMin = Math.min(...retenues.map((f) => f.ecart));
      // Sur combien d'AXES les deux parts sont-elles à ras ?
      // Un seul axe : une pièce est posée à ras sur une autre — une plaque sur
      // un mur, une patte sous une croupe. La décaler est exactement la bonne
      // correction, et elle ne se voit pas.
      // Deux axes ou plus : les deux parts sont deux panneaux d'une même COQUE,
      // à ras sur le dessus ET sur le côté ET sur le fond. Les pousser
      // reviendrait à les faire dériver en diagonale — essayé sur ce cas précis,
      // le modèle perdait sa symétrie et le compte de constats oscillait sans
      // jamais tomber à zéro. Un coin de caisson se règle en RESTRUCTURANT (que
      // la surface du coin soit portée par une seule part), pas en poussant :
      // on le signale, on n'y touche pas.
      const axes = new Set(retenues.map((f) => cleAxe(f.fa.n)));
      if (type === "zfight") {
        if (axes.size >= 2) {
          ajout("zfight", "grave",
            `${a.p.name} et ${b2.p.name} sont à ras sur ${axes.size} axes (${retenues.length} faces confondues) — deux panneaux d'une même coque. `
            + `Pas corrigeable par décalage : refaire le coin pour qu'une seule des deux porte la surface (l'autre en retrait de 0.05), `
            + `ou couvrir l'arête d'une baguette`,
            [a.p.name, b2.p.name]);
          continue;
        }
        // Le z-fighting se règle par PLAN, pas par paire : on enregistre ici les
        // faces fautives, le décalage en escalier est calculé ensuite, une fois
        // tous les plans connus.
        for (const f of retenues) {
          for (const face of [f.fa, f.fb]) {
            faceInfo.set(faceCle(face), { part: face.b.p, n: face.n, vol: face.b.p.size.reduce((x, y) => x * y) });
          }
          unir(faceCle(f.fa), faceCle(f.fb));
        }
        ajout("zfight", "grave",
          `${a.p.name} et ${b2.p.name} ont une face confondue${combien} (écart ${ecartMin.toFixed(3)} stud) — z-fighting garanti en jeu`,
          [a.p.name, b2.p.name], () => {});
      } else {
        // Un joint sec est un cas local (deux corps de part et d'autre) : le
        // décalage d'une des deux suffit, pas besoin de raisonner par plan.
        ajout("joint", "moyen",
          `${a.p.name} et ${b2.p.name} sont bord à bord sans recouvrement${combien} — fissure visible dès que l'un des deux bouge`,
          [a.p.name, b2.p.name],
          () => { for (const f of retenues) noterDeplacement(petite.p, petite === a ? f.fa.n : f.fb.n); });
      }
    }
  }
}

/* ---------------------------------------------------------- depassement -- */
// Le défaut de la diagonale trop longue : la barre traverse une masse et
// ressort de quelques dixièmes dans le vide. On sonde sa ligne médiane.
if (actif("depassement")) {
  for (const b of B) {
    if (b.p.shape === "Ball") continue;
    const s = b.p.size;
    const axe = s.indexOf(Math.max(...s));
    const L = s[axe];
    if (L < 1 || L < 3 * Math.max(...s.filter((_, k) => k !== axe))) continue;   // pas une barre
    const cand = voisins[b.i];
    if (!cand.length) continue;
    const dir = b.axes[axe], h = L / 2;
    const n = Math.max(8, Math.ceil(L / Math.min(0.1, L / 60)));
    const moi = new Set([b.i]);
    const couv = [];
    for (let k = 0; k < n; k++) {
      const t = -h + ((k + 0.5) / n) * L;
      couv.push(couvert([b.c[0] + dir[0] * t, b.c[1] + dir[1] * t, b.c[2] + dir[2] * t], moi, cand) >= 0);
    }
    if (couv.filter(Boolean).length < 2) continue;           // ne traverse rien
    for (const bout of [1, -1]) {
      let libre = 0;
      for (let k = 0; k < n; k++) {
        const idx = bout > 0 ? n - 1 - k : k;
        if (couv[idx]) break;
        libre += L / n;
      }
      if (libre <= 0.05) continue;
      // Au-delà de ces seuils ce n'est plus une bavure mais une intention : une
      // corne, un mât, un hauban qui sort volontairement d'une masse. On se
      // tait — quitte à relever `--bout` sur un modèle à grande échelle.
      if (libre > BOUT_MAX || libre > BOUT_RATIO * L) continue;
      const tipY = b.c[1] + dir[1] * h * bout;
      if (tipY < 0.15) continue;                             // pointe plantée au sol
      const coupe = r3(libre);
      ajout("depassement", "moyen",
        `${b.p.name} ressort de ${coupe} stud dans le vide au bout ${bout > 0 ? "+" : "−"}${"XYZ"[axe]} après avoir traversé une autre part — bout à couper`,
        [b.p.name],
        () => {
          const nl = b.p.size[axe] - coupe;
          if (nl < 0.05) return;
          b.p.size = b.p.size.map((v, k) => (k === axe ? r3(nl) : v));
          b.p.position = b.p.position.map((v, k) => r3(v - dir[k] * (coupe / 2) * bout));
        });
    }
  }
}

/* -------------------------------------------------------------- escalier -- */
// Une volée de marches identiques, non tournées, régulièrement décalées : on
// vérifie que le nez de chaque marche est fermé par une contremarche.
const nouvellesParts = [];
if (actif("escalier")) {
  const plats = B.filter((b) => b.p.shape === "Block" && !(b.p.rotation || []).some((v) => v));
  const familles = new Map();
  for (const b of plats) {
    const cle = (b.p.group || "-") + "|" + b.p.size.map((v) => v.toFixed(3)).join("x");
    if (!familles.has(cle)) familles.set(cle, []);
    familles.get(cle).push(b);
  }
  for (const marches of familles.values()) {
    if (marches.length < 3) continue;
    marches.sort((a, b) => a.c[1] - b.c[1]);
    const dy = marches[1].c[1] - marches[0].c[1];
    if (dy < 0.1) continue;
    if (!marches.every((m, k) => k === 0 || Math.abs((m.c[1] - marches[k - 1].c[1]) - dy) < 1e-3)) continue;
    // axe de montée : le seul horizontal qui progresse régulièrement
    const ax = [0, 2].find((a) => {
      const d = marches[1].c[a] - marches[0].c[a];
      return Math.abs(d) > 0.1 && marches.every((m, k) => k === 0
        || Math.abs((m.c[a] - marches[k - 1].c[a]) - d) < 1e-3);
    });
    if (ax === undefined) continue;
    const sgn = Math.sign(marches[1].c[ax] - marches[0].c[ax]);
    const larg = ax === 0 ? 2 : 0;
    for (let k = 0; k < marches.length - 1; k++) {
      const A = marches[k], C = marches[k + 1];
      const hautA = A.c[1] + A.half[1];
      const jour = (C.c[1] - C.half[1]) - hautA;
      if (jour <= 0.05) continue;                            // marches jointives
      const plan = A.c[ax] + sgn * A.half[ax];               // frontière entre A et C
      const moi = new Set([A.i, C.i]);
      const cand = [...new Set([...voisins[A.i], ...voisins[C.i]])];
      let vide = 0;
      for (const f of [-0.3, 0, 0.3]) {
        const w = [0, 0, 0];
        w[ax] = plan + sgn * 0.06;
        w[1] = hautA + jour / 2;
        w[larg] = A.c[larg] + f * A.half[larg];
        if (couvert(w, moi, cand) < 0) vide++;
      }
      if (vide < 2) continue;                                // déjà fermé
      // La contremarche est RENTRÉE de 0.03 sur ses trois faces visibles (le nez
      // de la marche du dessus et les deux flancs) : posée à ras, elle serait
      // coplanaire avec la marche et clignoterait — on aurait remplacé un trou
      // par un z-fighting. En hauteur au contraire elle MORD de 0.05 sur les
      // deux marches, ce qui ferme le joint pour de bon.
      const RENTREE = 0.03, PROF = 0.4;
      const taille = [0, 0, 0], pos = [0, 0, 0];
      taille[ax] = PROF;
      taille[1] = r3(jour + 0.1);
      taille[larg] = r3(Math.max(0.05, A.p.size[larg] - 2 * RENTREE));
      pos[ax] = r3(plan + sgn * (RENTREE + PROF / 2));
      pos[1] = r3(hautA + jour / 2);
      pos[larg] = A.c[larg];
      const nom = A.p.name.replace(/\d+$/, "") + "Contremarche" + (k + 1);
      ajout("escalier", "moyen",
        `marche ouverte entre ${A.p.name} et ${C.p.name} : ${r3(jour)} stud de jour, on voit sous l'escalier — contremarche à poser`,
        [A.p.name, C.p.name],
        () => {
          nouvellesParts.push({
            name: nom, ...(A.p.group ? { group: A.p.group } : {}),
            shape: "Block", size: taille, position: pos,
            color: (A.p.color || [160, 160, 160]).map((v) => Math.max(0, Math.round(v * 0.88))),
            material: A.p.material || "SmoothPlastic",
          });
        });
    }
  }
}

/* ------------------------------------------------------------- orpheline -- */
if (actif("orpheline")) {
  for (const b of B) {
    if (b.min[1] <= 0.05 || voisins[b.i].length) continue;
    ajout("orpheline", "info",
      `${b.p.name} ne touche aucune autre part (flotte à ${r3(b.min[1])} stud du sol) — volontaire ?`,
      [b.p.name]);
  }
}

/* ---------------------------------------------------------------- grille -- */
// Uniquement sur les parts non tournées : sur une pièce placée par calcul (une
// diagonale, un segment tendu entre deux points), snapper CASSE la pose.
if (actif("grille")) {
  const horsGrille = B.filter((b) => !(b.p.rotation || []).some((v) => v)
    && [...b.p.size, ...b.p.position].some((v) => Math.abs(v / PAS - Math.round(v / PAS)) > 1e-6));
  if (horsGrille.length) {
    // Snapper APRÈS une correction de z-fighting la défait : 0.03 de décalage ne
    // survit pas à un arrondi sur 0.05. On ne propose donc le snap que si rien
    // d'autre n'a bougé de part.
    const conflit = constats.some((c) => (c.id === "zfight" || c.id === "joint") && c.fix);
    ajout("grille", "info",
      `${horsGrille.length} part(s) non tournée(s) hors de la grille de ${PAS} : ${horsGrille.slice(0, 6).map((b) => b.p.name).join(", ")}${horsGrille.length > 6 ? "…" : ""}`
      + (conflit ? " — snap non proposé tant qu'il reste du z-fighting à corriger (l'arrondi le ferait revenir)" : ""),
      horsGrille.map((b) => b.p.name),
      conflit ? null : () => {
        for (const b of horsGrille) {
          b.p.size = b.p.size.map((v) => r3(Math.max(PAS, Math.round(v / PAS) * PAS)));
          b.p.position = b.p.position.map((v) => r3(Math.round(v / PAS) * PAS));
        }
      });
  }
}

/* -------------------------------------------------------------- symetrie -- */
if (actif("symetrie")) {
  const a = { X: 0, Y: 1, Z: 2 }[axeSym];
  if (a === undefined) { console.error("--symetrie attend X, Y ou Z."); process.exit(1); }
  // En miroir, les deux rotations qui ne sont PAS autour de l'axe changent de signe.
  const cle = (p, signe) => {
    const pos = p.position.map((v, k) => (k === a ? -v * signe : v));
    const r = (p.rotation || [0, 0, 0]).map((v, k) => (k === a ? v : -v));
    return [p.shape, p.size.map(r3).join(","), pos.map(r3).join(","), r.map(r3).join(",")].join("|");
  };
  const index = new Map();
  for (const p of model.parts) {
    const k = cle(p, -1);
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(p);
  }
  const seules = B
    .filter((b) => Math.abs(b.c[a]) > b.half[a] + 1e-6)       // ignore ce qui est à cheval sur l'axe
    .filter((b) => !(index.get(cle(b.p, 1)) || []).some((x) => x !== b.p))
    .map((b) => b.p.name);
  if (seules.length) {
    ajout("symetrie", "info",
      `${seules.length} part(s) sans jumelle en miroir ${axeSym} : ${seules.slice(0, 8).join(", ")}${seules.length > 8 ? "…" : ""}`,
      seules);
  }
}

/* ============================================================== rapport == */
const parId = new Map();
for (const c of constats) {
  if (!parId.has(c.id)) parId.set(c.id, []);
  parId.get(c.id).push(c);
}
const LIB = {
  micro: "dimensions sous le minimum Roblox",
  noyee: "parts invisibles (noyées dans une autre)",
  zfight: "faces confondues (z-fighting)",
  joint: "joints secs (bord à bord sans recouvrement)",
  depassement: "bouts qui ressortent dans le vide",
  escalier: "marches ouvertes (contremarche manquante)",
  orpheline: "parts flottantes",
  grille: "hors grille",
  symetrie: "symétrie incomplète",
};
const PICTO = { grave: "✗", moyen: "▲", info: "·" };

if (SORTIE_JSON) {
  console.log(JSON.stringify({
    model: model.name, parts: model.parts.length,
    controles: TOUS.filter(actif),
    constats: constats.map(({ id, gravite, texte, parts, fix }) => ({ id, gravite, texte, parts, corrigeable: !!fix })),
  }, null, 2));
} else {
  console.log(`Finition — ${model.name} (${model.parts.length} parts)`);
  if (!constats.length) {
    console.log("✓ rien à reprendre sur les contrôles actifs : " + TOUS.filter(actif).join(", "));
  }
  const ordre = TOUS.filter((id) => parId.has(id))
    .sort((x, y) => NOTE[parId.get(y)[0].gravite] - NOTE[parId.get(x)[0].gravite]);
  for (const id of ordre) {
    const l = parId.get(id);
    console.log(`\n${PICTO[l[0].gravite]} ${id} — ${LIB[id]} (${l.length})`);
    for (const c of l.slice(0, MAX)) console.log("    " + c.texte);
    if (l.length > MAX) console.log(`    … et ${l.length - MAX} autres (--max ${l.length} pour tout voir)`);
  }
  if (constats.length) {
    console.log(`\n${constats.length} constat(s), dont ${constats.filter((c) => c.fix).length} corrigeable(s) automatiquement.`);
    if (!FIX) console.log("→ relancer avec --fix pour appliquer, ou corriger à la main / dans le générateur.");
  }
}

/* ============================================================ application == */
if (FIX) {
  const gen = generateurDe();
  if (gen && !flag("force")) {
    console.error(`\n✗ --fix refusé : ce model.json est produit par un générateur (${gen}).`);
    console.error("  Le corriger ici serait perdu à la prochaine régénération.");
    console.error("  Corriger DANS le générateur, puis le relancer. (--force pour passer outre.)");
    process.exit(2);
  }
  let n = 0;
  for (const c of constats) if (c.fix) { c.fix(); n++; }
  // Les plans de z-fighting, une fois tous connus : dans chaque plan, la part la
  // plus GROSSE définit la surface et ne bouge pas ; les autres s'écartent en
  // escalier. C'est ce qui fait converger en une passe là où le décalage paire
  // par paire oscillait indéfiniment.
  const plans = new Map();
  for (const cle of faceInfo.keys()) {
    const racine = trouver(cle);
    if (!plans.has(racine)) plans.set(racine, []);
    plans.get(racine).push(faceInfo.get(cle));
  }
  for (const faces of plans.values()) {
    const parParts = new Map();
    for (const f of faces) if (!parParts.has(f.part)) parParts.set(f.part, f);
    const rangees = [...parParts.values()].sort((x, y) => y.vol - x.vol);
    // Écart plafonné : au-delà de trois marches, l'escalier se verrait.
    rangees.forEach((f, rang) => { if (rang > 0) noterDeplacement(f.part, f.n, 0.03 * Math.min(rang, 3)); });
  }
  appliquerDeplacements();
  const supprimees = model.parts.filter((p) => p.__supprimer).length;
  model.parts = model.parts.filter((p) => !p.__supprimer);
  model.parts.push(...nouvellesParts);
  // Ne rien réécrire quand rien n'a changé : la réécriture reformate le fichier,
  // et un diff de mise en forme sur un model.json qu'on n'a pas corrigé est un
  // bruit qu'on paie à chaque relecture.
  if (!n && !supprimees && !nouvellesParts.length && !deplacements.size) {
    console.log("\n· rien à appliquer : les constats restants demandent une décision de modélisation, pas un décalage.");
  } else {
    writeFileSync(jsonPath, ecrire(model));
    console.log(`\n✓ ${n} correction(s) appliquée(s)${nouvellesParts.length ? `, ${nouvellesParts.length} part(s) ajoutée(s)` : ""} → ${jsonPath}`);
    console.log("  Relancer build.mjs, puis relancer finition.mjs — une correction peut en révéler une autre.");
    console.log("  Si le compte ne descend plus d'une passe à l'autre, le reste demande une décision de modélisation.");
  }
}

/* Écriture lisible : un objet par ligne, les triplets numériques en ligne —
   c'est ce qui garde les diff de model.json relisibles. */
function ecrire(m) {
  const enLigne = (v) => "[" + v.map((x) => (typeof x === "number" ? r3(x) : JSON.stringify(x))).join(", ") + "]";
  const objet = (o, ind) => {
    const p = " ".repeat(ind), p1 = " ".repeat(ind + 2);
    const champs = Object.entries(o)
      .filter(([k, v]) => v !== undefined && !k.startsWith("__"))
      .map(([k, v]) => {
        if (Array.isArray(v) && v.every((x) => typeof x === "number")) return p1 + JSON.stringify(k) + ": " + enLigne(v);
        if (Array.isArray(v)) return p1 + JSON.stringify(k) + ": [\n" + v.map((x) => objet(x, ind + 4)).join(",\n") + "\n" + p1 + "]";
        if (v && typeof v === "object") return p1 + JSON.stringify(k) + ": " + objet(v, ind + 2).trimStart();
        return p1 + JSON.stringify(k) + ": " + JSON.stringify(v);
      });
    return p + "{\n" + champs.join(",\n") + "\n" + p + "}";
  };
  return objet(m, 0) + "\n";
}
