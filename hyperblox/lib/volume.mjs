// volume.mjs — primitives de VOLUME pour HyperBlox.
//
// POURQUOI CE FICHIER. Le vocabulaire de base d'un model.json (un bloc, une
// position, trois angles) suffit à poser une caisse, pas à donner du galbe à
// une créature. Écrite part par part, une aile de 60 pièces est ingérable : on
// n'ose plus rien bouger, et on retombe sur des rectangles.
//
// Ces primitives montent d'un cran : on décrit une INTENTION — « une encolure
// fuselée qui suit cette courbe », « une membrane tendue entre ces doigts »,
// « un éventail de douze plumes » — et elles rendent les parts. Un paramètre
// changé, et les soixante pièces se replacent ensemble.
//
// Toutes rendent la liste des parts créées, et toutes passent par le même
// `add` que le générateur : rien ici ne contourne le model.json, il n'y a pas
// de forme nouvelle côté Studio. Ce qui change, c'est ce qu'on peut se
// permettre de décrire.
//
// USAGE
//   import { fabriqueVolume } from "../../.claude/skills/hyperblox/lib/volume.mjs";
//   const V = fabriqueVolume(add, { color: [120, 90, 70] });
//   V.chaine("Cou", "Buste", V.arc(nuque, crane, { creux: 1.2 }), { section: [1.6, 0.9] });
//
// `add` est la fonction du générateur appelant, de signature
//   add(name, group, shape, size, position, opts)
// où `opts` peut porter `rotation` (ou `rot`), `color`, `material` (ou `mat`),
// `transparency`, `collide`. Les primitives remplissent les deux orthographes,
// pour être compatibles avec les fabriques déjà en place dans le projet.

/* ------------------------------------------------------------- vecteurs -- */
export const r2 = (n) => { const r = Math.round(n * 100) / 100; return Object.is(r, -0) ? 0 : r; };
export const r3 = (n) => { const r = Math.round(n * 1000) / 1000; return Object.is(r, -0) ? 0 : r; };
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const len3 = (v) => Math.hypot(v[0], v[1], v[2]);
export const unit = (v) => { const l = len3(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
export const mid3 = (a, b) => mul3(add3(a, b), 0.5);
export const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
];
export const lerp = (a, b, t) => a + (b - a) * t;

/* --------------------------------------------------------- orientations --
   Angles d'Euler XYZ (= Rx·Ry·Rz, ce que `CFrame.fromEulerAnglesXYZ` applique
   et ce que la préview reproduit) d'une matrice dont les COLONNES sont les
   axes locaux. Ne jamais régler une orientation « à vue » : une pièce tournée
   sur deux axes se disloque entre la maquette et Studio. */
export const eulerXYZ = (M) => {
  const b = Math.asin(Math.max(-1, Math.min(1, M[0][2])));
  // Verrouillage de cardan : à ±90° sur Y, lacet et roulis se confondent. On
  // met tout le reste dans le roulis plutôt que de rendre des NaN.
  if (Math.abs(M[0][2]) > 0.999999) {
    return [r3(deg(Math.atan2(M[2][1], M[1][1]))), r3(deg(b)), 0];
  }
  const g = Math.atan2(-M[0][1], M[0][0]);
  const a = Math.atan2(-M[1][2], M[2][2]);
  return [r3(deg(a)), r3(deg(b)), r3(deg(g))];
};

// L'inverse d'`eulerXYZ` : la matrice Rx·Ry·Rz, colonnes = axes locaux. Sert au
// miroir, qui doit passer par la matrice — on ne peut pas refléter trois angles
// d'Euler en changeant des signes dès que la pièce tourne sur les trois axes.
export const matEulerXYZ = ([rx, ry, rz]) => {
  const [ca, sa] = [Math.cos(rad(rx)), Math.sin(rad(rx))];
  const [cb, sb] = [Math.cos(rad(ry)), Math.sin(rad(ry))];
  const [cg, sg] = [Math.cos(rad(rz)), Math.sin(rad(rz))];
  return [
    [cb * cg, -cb * sg, sb],
    [ca * sg + sa * sb * cg, ca * cg - sa * sb * sg, -sa * cb],
    [sa * sg - ca * sb * cg, sa * cg + ca * sb * sg, ca * cb],
  ];
};

// Orientation de la jumelle en miroir à travers le plan X = 0.
// Un reflet inverse la chiralité : on ne peut pas refléter une part, seulement
// la TOURNER. On reflète donc les trois axes locaux, puis on renverse l'axe X
// local pour retrouver un repère direct — invisible sur un solide symétrique
// selon son X (Block, Cylinder, Ball, et Wedge, extrudé le long de X).
export const eulerMiroirX = (rot = [0, 0, 0]) => {
  const M = matEulerXYZ(rot);
  return eulerXYZ([
    [M[0][0], -M[0][1], -M[0][2]],
    [-M[1][0], M[1][1], M[1][2]],
    [-M[2][0], M[2][1], M[2][2]],
  ]);
};

// Orientation d'une part dont l'axe Y LOCAL suit `yA`, en gardant l'axe X aussi
// proche que possible de `xHint` (c'est lui qui décide du roulis). Rend aussi
// les trois axes, pour poser des détails dans le repère de la pièce.
export const orientFromYX = (yA, xHint = [1, 0, 0]) => {
  const Y = unit(yA);
  let X = sub3(xHint, mul3(Y, dot3(xHint, Y)));
  if (len3(X) < 1e-6) {
    const alt = Math.abs(Y[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
    X = sub3(alt, mul3(Y, dot3(alt, Y)));
  }
  X = unit(X);
  const Z = cross3(X, Y);
  return {
    rot: eulerXYZ([[X[0], Y[0], Z[0]], [X[1], Y[1], Z[1]], [X[2], Y[2], Z[2]]]),
    X, Y, Z,
  };
};

// Orientation d'une part dont l'axe X LOCAL suit `xA`. Indispensable au
// `Cylinder` de Roblox, dont la hauteur court le long de X local et non de Y :
// sans ça, la bibliothèque ne savait poser un cylindre que debout ou couché sur
// un axe du monde, et tout raccord courbe devait se faire en blocs facettés.
export const orientFromXY = (xA, yHint = [0, 1, 0]) => {
  const X = unit(xA);
  let Y = sub3(yHint, mul3(X, dot3(yHint, X)));
  if (len3(Y) < 1e-6) {
    const alt = Math.abs(X[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
    Y = sub3(alt, mul3(X, dot3(alt, X)));
  }
  Y = unit(Y);
  const Z = cross3(X, Y);
  return {
    rot: eulerXYZ([[X[0], Y[0], Z[0]], [X[1], Y[1], Z[1]], [X[2], Y[2], Z[2]]]),
    X, Y, Z,
  };
};

/* ------------------------------------------------------------- chemins -- */

// Arc quadratique de `a` à `b`, bombé de `creux` studs vers `vers`
// (défaut : vers le haut). Rend `n + 1` points — la matière première de
// `chaine`, `ecailles` et `pointe`.
export function arc(a, b, { creux = 1, vers = [0, 1, 0], n = 6 } = {}) {
  const m = add3(mid3(a, b), mul3(unit(vers), creux));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(lerp3(lerp3(a, m, t), lerp3(m, b, t), t));   // Bézier quadratique
  }
  return pts;
}

// Bézier cubique : deux poignées, pour une courbe en S (une queue qui fouette,
// un cou de cygne) que l'arc quadratique ne sait pas décrire.
export function courbe(a, p1, p2, b, n = 8) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([0, 1, 2].map((k) =>
      u * u * u * a[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * b[k]));
  }
  return pts;
}

/* ------------------------------------------------------------- fabrique -- */
export function fabriqueVolume(add, defauts = {}) {
  const COL = defauts.color || [160, 160, 160];
  const MAT = defauts.material || defauts.mat || "SmoothPlastic";

  // Normalise les options : les fabriques du projet lisent `rot`/`mat`, le
  // schéma model.json écrit `rotation`/`material`. On remplit les deux.
  const O = (o = {}) => {
    const rot = o.rotation || o.rot;
    const out = {
      ...o,
      color: o.color || COL,
      mat: o.material || o.mat || MAT,
      material: o.material || o.mat || MAT,
    };
    if (rot) { out.rot = rot.map(r3); out.rotation = rot.map(r3); }
    return out;
  };
  const poser = (nom, groupe, shape, taille, pos, o) =>
    add(nom, groupe, shape, taille.map(r3), pos.map(r3), O(o));

  /* ------------------------------------------------------------ couleur -- */
  // Éclaircit (k > 0) ou assombrit (k < 0) une teinte. La variation de HyperBlox
  // vient de parts voisines à ±10-15 %, jamais d'un dégradé.
  const teinte = (c, k) => c.map((v) =>
    Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))));

  /* --------------------------------------------------------------- barre --
     Un bloc TENDU entre deux points. C'est la brique de tout le reste :
     décrire une structure par ses sommets, jamais par des angles devinés. */
  const barre = (nom, groupe, a, b, section, o = {}) => {
    const u = sub3(b, a);
    const { rot } = orientFromYX(u, o.xHint || [1, 0, 0]);
    const [w, e] = Array.isArray(section) ? section : [section, section];
    // `rab` : le recouvrement qui empêche le joint de s'ouvrir entre deux
    // tronçons consécutifs. Sans lui, une chaîne montre ses articulations.
    return poser(nom, groupe, o.shape || "Block",
      [w, len3(u) + (o.rab ?? 0.15), e], mid3(a, b), { ...o, rotation: rot });
  };

  /* ---------------------------------------------------------------- tube --
     Un CYLINDRE tendu entre deux points. Le pendant rond de `barre`. */
  const tube = (nom, groupe, a, b, diam, o = {}) => {
    const u = sub3(b, a);
    const { rot } = orientFromXY(u, o.yHint || [0, 1, 0]);
    return poser(nom, groupe, "Cylinder",
      [len3(u) + (o.rab ?? 0), diam, diam], mid3(a, b), { ...o, rotation: rot });
  };

  /* --------------------------------------------------------------- boyau --
     Un membre ROND qui suit une courbe : une suite de tubes, et une BILLE à
     chaque articulation.
     La bille n'est pas décorative, c'est tout l'intérêt : deux cylindres qui se
     rencontrent en biais laissent un angle vide au coude — le défaut qui fait
     « amateur » au premier coup d'œil, et qu'aucun contrôle géométrique ne
     signale puisque rien ne s'y croise mal. La bille au diamètre du tube
     comble le creux et rend le raccord continu.
     `section` : nombre, [début, fin], ou (t) => diamètre. */
  const boyau = (nom, groupe, points, o = {}) => {
    const faites = [];
    const prof = typeof o.section === "function"
      ? o.section
      : Array.isArray(o.section)
        ? (t) => lerp(o.section[0], o.section[1], t)
        : () => (o.section ?? 1);
    const n = points.length - 1;
    for (let i = 0; i < n; i++) {
      const d0 = prof(i / n), d1 = prof((i + 1) / n);
      faites.push(tube(nom + (i + 1), groupe, points[i], points[i + 1], (d0 + d1) / 2,
        { ...o, rab: o.rab ?? 0.05 }));
      // Bille aux articulations INTERNES, et à l'extrémité si on veut un bout
      // arrondi (`cime`) — un cactus, un tentacule, un doigt finissent rond.
      // La bille est un peu PLUS GROSSE que le tube (×1.07) : à diamètre égal,
      // le bord du tube affleure exactement l'équateur de la bille et dessine
      // un pli à chaque articulation — la couture qui fait « tuyau coudé ».
      if (i < n - 1 || o.cime) {
        const db = d1 * (o.noeud ?? 1.07);
        faites.push(poser(nom + "Noeud" + (i + 1), groupe, "Ball",
          [db, db, db], points[i + 1], { ...o }));
      }
    }
    return faites;
  };

  /* -------------------------------------------------------------- chaine --
     Une suite de tronçons fuselés le long d'un chemin : cou, queue, membre,
     tentacule, racine. `section` accepte :
       [début, fin]                  fuseau linéaire
       (t) => largeur                profil libre (t de 0 à 1)
       (t) => [largeur, épaisseur]   profil à section aplatie
     `cannele: true` double chaque tronçon d'un jumeau tourné de 45° : la section
     carrée devient ÉTOILÉE — quatre arêtes saillantes, une lecture de colonne
     cannelée ou de muscle nervuré. Deux parts par tronçon, et la pièce cesse de
     lire comme une poutre. Ce n'est PAS un octogone (l'union de deux carrés
     croisés est une étoile, jamais un octogone) : pour une vraie section
     octogonale, c'est `biseau`, à six parts. */
  const chaine = (nom, groupe, points, o = {}) => {
    const faites = [];
    const prof = typeof o.section === "function"
      ? o.section
      : (() => { const [d, f] = o.section || [1, 1]; return (t) => lerp(d, f, t); })();
    for (let i = 0; i < points.length - 1; i++) {
      const t = points.length > 2 ? i / (points.length - 2) : 0;
      const v = prof(Math.min(1, t));
      const [w, e] = Array.isArray(v) ? v : [v, v * (o.aplati ?? 1)];
      const nomI = nom + (i + 1);
      faites.push(barre(nomI, groupe, points[i], points[i + 1], [w, e], o));
      if (o.cannele) {
        // Jumeau tourné de 45° autour de l'axe du tronçon. Il est rentré (0.82,
        // et 0.04 plus court) pour qu'aucune de ses faces ne soit coplanaire
        // avec celles du premier — deux faces confondues, c'est du z-fighting.
        const u = sub3(points[i + 1], points[i]);
        const { X, Y } = orientFromYX(u, o.xHint || [1, 0, 0]);
        const c = Math.cos(rad(45)), s = Math.sin(rad(45));
        const Z2 = cross3(X, Y);
        const X2 = add3(mul3(X, c), mul3(Z2, s));
        const rot2 = orientFromYX(u, X2).rot;
        faites.push(poser(nomI + "Cannelure", groupe, "Block",
          [w * 0.82, len3(u) + (o.rab ?? 0.15) - 0.04, e * 0.82], mid3(points[i], points[i + 1]),
          { ...o, rotation: rot2, color: o.colorOcto || o.color || COL }));
      }
    }
    return faites;
  };

  /* -------------------------------------------------------------- croise --
     Une masse à section ÉTOILÉE : deux blocs croisés à 45°. Deux parts pour
     casser la lecture « boîte » d'un torse, d'une cuisse, d'un tronc, d'une
     colonne — le jumeau fait saillir quatre arêtes qui accrochent la lumière.
     Pour une vraie section octogonale (arêtes rabattues au lieu de saillantes),
     voir `biseau`. */
  const croise = (nom, groupe, centre, taille, o = {}) => {
    const [w, h, d] = taille;
    const axe = o.axe || "Y";                        // axe de la hauteur
    const yaw = axe === "Y" ? [0, 45, 0] : axe === "X" ? [45, 0, 0] : [0, 0, 45];
    const base = o.rotation || o.rot || [0, 0, 0];
    if (base.some((v) => v) && !o.rotationCroix) {
      throw new Error(`croise(${nom}) : sur une masse déjà tournée, passer \`rotationCroix\` — `
        + "composer deux rotations d'Euler à la main donne une pose fausse.");
    }
    return [
      poser(nom, groupe, "Block", [w, h, d], centre, o),
      poser(nom + "Croix", groupe, "Block", [w * 0.82, h - 0.04, d * 0.82], centre,
        { ...o, rotation: o.rotationCroix || yaw, color: o.colorCroix || o.color || COL }),
    ];
  };

  /* -------------------------------------------------------------- biseau --
     Un bloc dont les quatre arêtes VERTICALES sont chanfreinées : un noyau en
     croix (deux blocs) plus quatre coins en Wedge. Six parts pour un volume qui
     accroche la lumière au lieu de renvoyer un aplat.
     `arete` = profondeur du chanfrein (0.15 à 0.4 selon la taille). */
  const biseau = (nom, groupe, centre, taille, o = {}) => {
    const [w, h, d] = taille;
    const a = Math.min(o.arete ?? 0.25, w / 2 - 0.05, d / 2 - 0.05);
    if (a <= 0.02) return [poser(nom, groupe, "Block", taille, centre, o)];
    // Les six pièces partagent le même dessus et le même dessous. À hauteur
    // égale, ces faces seraient CONFONDUES — c'est-à-dire en z-fighting. On les
    // étage donc de 0.04 : invisible à distance de jeu, décisif en jeu.
    const faites = [
      poser(nom, groupe, "Block", [w - 2 * a, h, d], centre, o),
      poser(nom + "Croix", groupe, "Block", [w, h - 0.04, d - 2 * a], centre,
        { ...o, color: o.color || COL }),
    ];
    // Les quatre coins. Un Wedge est un prisme triangulaire extrudé le long de
    // son X local, le triangle vivant dans son plan YZ. Couché par rz = −90,
    // l'extrusion se met à suivre la hauteur du bloc : on tient le coin. Ses
    // deux faces plates pointent alors vers −Z et −X ; le lacet `ry`, appliqué
    // APRÈS (l'ordre Rx·Ry·Rz de CFrame.fromEulerAnglesXYZ le garantit), les
    // envoie vers les deux faces du bloc que le coin doit rejoindre.
    // Les quatre lacets ci-dessous se lisent : « pour ce coin, quelles normales
    // doivent avoir les faces plates » — et non « un quart de tour de plus ».
    const coins = [[1, 1, -90], [1, -1, 0], [-1, -1, 90], [-1, 1, 180]];
    for (const [sx, sz, yaw] of coins) {
      faites.push(poser(`${nom}Coin${sx > 0 ? "D" : "G"}${sz > 0 ? "Ar" : "Av"}`, groupe, "Wedge",
        [h - 0.08, a, a],
        [centre[0] + sx * (w / 2 - a / 2), centre[1], centre[2] + sz * (d / 2 - a / 2)],
        { ...o, rotation: [0, yaw, -90], color: o.colorCoin || o.color || COL }));
    }
    return faites;
  };

  /* ------------------------------------------------------------ membrane --
     La toile d'une aile de chauve-souris (ou d'un manteau, d'une nageoire,
     d'une voile) : les panneaux tendus entre l'épaule et les pointes de doigts.
     Chaque panneau est découpé en `bandes` lattes tendues d'un doigt à l'autre,
     ce qui donne un bord de fuite festonné au lieu d'un rectangle. */
  const membrane = (nom, groupe, epaule, doigts, o = {}) => {
    const faites = [];
    const bandes = o.bandes ?? 5;
    const ep = o.epaisseur ?? 0.16;
    const creux = o.creux ?? 0;                 // affaissement de la toile, en studs
    // Les panneaux CONVERGENT tous vers l'épaule : au ras de celle-ci, leurs
    // premières lattes se superposent presque exactement — deux faces
    // confondues, donc du z-fighting. On démarre donc la toile un peu plus
    // loin ; l'attache d'épaule est de toute façon une masse à part.
    const depart = o.depart ?? 0.12;
    for (let p = 0; p < doigts.length - 1; p++) {
      const A = doigts[p], Bp = doigts[p + 1];
      // …et on décale les panneaux successifs d'un cheveu selon la normale de la
      // toile : deux panneaux voisins sont coplanaires PAR CONSTRUCTION (c'est
      // une même surface), les alterner est la seule façon de les départager.
      const n = unit(cross3(sub3(A, epaule), sub3(Bp, epaule)));
      for (let k = 1; k <= bandes; k++) {
        // Deux décalages, tous deux selon la normale de la toile : un par
        // panneau, un par latte. Le second départage les lattes d'un MÊME
        // panneau, coplanaires elles aussi — et il fait lire la membrane comme
        // une peau nervurée plutôt que comme une plaque. Le pas par latte est
        // MONOTONE (en tuiles, centré sur la toile) et non alterné : sur une
        // toile affaissée, l'inclinaison relative de deux lattes peut annuler
        // un pas alterné dans la zone de recouvrement — pas une progression.
        const biais = mul3(n, (p % 2 ? 1 : -1) * ep * 0.3 + (k - bandes / 2) * ep * 0.5);
        const t0 = lerp(depart, 1, (k - 1) / bandes), t1 = lerp(depart, 1, k / bandes);
        const tm = (t0 + t1) / 2;
        let p1 = add3(lerp3(epaule, A, tm), biais), p2 = add3(lerp3(epaule, Bp, tm), biais);
        if (creux) {
          const bas = [0, -creux * Math.sin(Math.PI * tm), 0];
          p1 = add3(p1, bas); p2 = add3(p2, bas);
        }
        // largeur de la latte = ce qu'elle couvre le long du rayon, fois
        // `recouvre` : bord à bord (1.0), les lattes s'écartent dès que la
        // toile s'affaisse (`creux` fort) — chaque latte est une CORDE, et
        // les cordes d'un arc ne se touchent pas. Le décalage alterné rend le
        // recouvrement gratuit (plans parallèles, jamais confondus). La
        // couture d'un panneau à l'autre reste masquée par le DOIGT.
        // …et le recouvrement VARIE avec la parité de la latte : à recouvrement
        // constant, les CHANTS de deux lattes voisines tombent dans les mêmes
        // plans de coupe (z-fighting de chants, le même piège que `nappe`).
        const larg = ((len3(sub3(A, epaule)) + len3(sub3(Bp, epaule))) / 2) * (t1 - t0)
          * (o.recouvre ?? (creux ? 1.18 : 1.0)) * (k % 2 ? 1.05 : 0.97);
        const u = sub3(p2, p1);
        // Contre le z-fighting entre lattes voisines, les décalages de
        // POSITION ne suffisent pas : l'affaissement de la toile dérive du
        // même ordre qu'un étagement fixe (grandes faces), et les chants
        // d'extrémité passent tous par le même rayon de doigt, quasi parallèle
        // à leur plan. On sépare donc par l'ANGLE — deux plans qui se croisent
        // à 3-5° ne sont confondus nulle part, et c'est invisible à l'œil :
        //   · VRILLE ±2.5° autour de l'axe de la latte (grandes faces, chants
        //     radiaux),
        //   · LACET ±1.8° dans le plan de la toile (chants d'extrémité).
        const base = orientFromYX(u, o.xHint || sub3(A, epaule));
        const ya = rad((k % 2 ? 1 : -1) * (o.lacet ?? 1.8));
        const u2 = add3(mul3(unit(u), Math.cos(ya)), mul3(base.X, Math.sin(ya)));
        const va = rad((k % 2 ? 1 : -1) * (o.vrille ?? 2.5));
        const { rot } = orientFromYX(u2,
          add3(mul3(base.X, Math.cos(va)), mul3(base.Z, Math.sin(va))));
        faites.push(poser(`${nom}P${p + 1}B${k}`, groupe, "Block",
          [larg, len3(u) * (k % 2 ? 1.0 : 0.97), ep], mid3(p1, p2),
          { ...o, rotation: rot, color: o.color || COL }));
      }
    }
    return faites;
  };

  /* -------------------------------------------------------------- plumes --
     Un éventail de rémiges. `base` = l'attache, `vers` = la direction de la
     plume du milieu, `normale` = la perpendiculaire au plan de l'aile.
     Les plumes s'ouvrent de `etalement` degrés de part et d'autre, se
     raccourcissent vers l'extérieur (`profil`) et se chevauchent : c'est le
     chevauchement qui fait lire une aile, pas le nombre de plumes. */
  const plumes = (nom, groupe, base, vers, o = {}) => {
    const faites = [];
    const n = o.n ?? 9;
    const L = o.longueur ?? 6;
    const larg = o.largeur ?? 0.8;
    const etal = o.etalement ?? 55;
    const normale = unit(o.normale || [0, 1, 0]);
    const dir = unit(vers);
    const profil = o.profil || ((t) => 1 - 0.35 * Math.abs(t));   // t de −1 à +1
    const cote = unit(cross3(normale, dir));
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;              // −1 … +1
      const ang = rad(t * etal);
      const d = unit(add3(mul3(dir, Math.cos(ang)), mul3(cote, Math.sin(ang))));
      const l = L * profil(t);
      const bout = add3(base, mul3(d, l));
      // la plume s'incurve : on la fait en deux tronçons, le second retombant
      const coude = add3(base, mul3(d, l * 0.55));
      const tombe = add3(coude, mul3(add3(mul3(d, l * 0.45), mul3(normale, -(o.courbure ?? 0.25) * l)), 1));
      const c = o.color || COL;
      const c2 = o.colorBout ? o.colorBout : teinte(c, -0.12);
      faites.push(barre(`${nom}${i + 1}a`, groupe, base, coude, [larg, o.epaisseur ?? 0.18],
        { ...o, color: c, xHint: normale }));
      faites.push(barre(`${nom}${i + 1}b`, groupe, coude, o.courbure === 0 ? bout : tombe,
        [larg * 0.75, (o.epaisseur ?? 0.18) * 0.85], { ...o, color: c2, xHint: normale }));
    }
    return faites;
  };

  /* ------------------------------------------------------------ ecailles --
     Des plaques posées le long d'un chemin, chacune inclinée et chevauchant la
     précédente : dos de dragon, ventre de serpent, lamelles d'armure. Le
     chevauchement (`recouvre`) est ce qui empêche le trou entre deux plaques
     quand la pièce s'anime. */
  const ecailles = (nom, groupe, points, o = {}) => {
    const faites = [];
    const larg = o.largeur ?? 1.2;
    const ep = o.epaisseur ?? 0.22;
    const recouvre = o.recouvre ?? 1.35;
    const normale = unit(o.normale || [0, 1, 0]);
    for (let i = 0; i < points.length - 1; i++) {
      const t = i / Math.max(1, points.length - 2);
      const ech = o.profil ? o.profil(t) : 1;
      const u = sub3(points[i + 1], points[i]);
      const { rot } = orientFromYX(u, cross3(normale, u));
      const c = mid3(points[i], points[i + 1]);
      faites.push(poser(`${nom}${i + 1}`, groupe, o.shape || "Block",
        [larg * ech, len3(u) * recouvre, ep],
        add3(c, mul3(normale, (o.hauteur ?? 0) * ech)),
        { ...o, rotation: rot, color: o.color || COL }));
    }
    return faites;
  };

  /* -------------------------------------------------------------- pointe --
     Corne, croc, griffe, épine, stalactite : une suite de tronçons de plus en
     plus fins le long d'un chemin. `points` vient de `arc` ou `courbe` — c'est
     la courbure qui distingue une corne d'un cône. */
  const pointe = (nom, groupe, points, o = {}) => {
    const base = o.base ?? 0.7;
    const fin = o.fin ?? 0.06;
    const puissance = o.puissance ?? 1.6;   // > 1 : s'affine vite près de la pointe
    return chaine(nom, groupe, points, {
      ...o,
      section: (t) => lerp(base, fin, Math.pow(t, puissance)),
      rab: o.rab ?? 0.1,
    });
  };

  /* ---------------------------------------------------------------- tour --
     Une SURFACE DE RÉVOLUTION : un empilement de tranches de cylindre le long
     d'un axe, dont le rayon suit un profil — vase, cloche, dôme, poire, pion
     d'échecs, colonne tournée, chapeau de champignon, jarre. C'est la primitive
     qui remplace à la fois la Ball écrasée (impossible : Roblox rend la sphère
     sur la PLUS PETITE dimension, une Ball est toujours ronde) et le tas de
     blocs, pour tout volume rond plein qui n'est pas une sphère.
     `profil` : (t de 0 à 1, 0 = base) => rayon en studs, ou un tableau de
     rayons interpolés linéairement — [0.2, 1.4, 1.1, 0.5] suffit à décrire un
     vase. Dôme : (t) => R * Math.cos(t * Math.PI / 2). `n` tranches (défaut
     10 ; monter à 16-24 si la pièce est vue de près). */
  const tour = (nom, groupe, base, hauteur, profil, o = {}) => {
    const faites = [];
    const n = o.n ?? 10;
    const axe = unit(o.axe || [0, 1, 0]);
    const prof = typeof profil === "function"
      ? profil
      : (t) => {
          const x = t * (profil.length - 1), i = Math.min(profil.length - 2, Math.floor(x));
          return lerp(profil[i], profil[i + 1], x - i);
        };
    const { rot } = orientFromXY(axe, o.yHint || (Math.abs(axe[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0]));
    const dh = hauteur / n;
    for (let i = 0; i < n; i++) {
      const r = Math.max(0.03, prof((i + 0.5) / n));
      // `rab` : chaque tranche déborde sur ses voisines, pour que ses faces
      // circulaires vivent À L'INTÉRIEUR de la tranche d'à côté au lieu d'être
      // confondues avec les siennes. Le +0.012 alterné départage les surfaces
      // LATÉRALES de deux tranches consécutives de même rayon (profil plat),
      // coïncidentes sinon sur toute la bande de recouvrement.
      const d = 2 * r + (i % 2 ? 0.012 : 0);
      faites.push(poser(nom + (i + 1), groupe, "Cylinder",
        [dh + (o.rab ?? 0.06), d, d],
        add3(base, mul3(axe, (i + 0.5) * dh)),
        { ...o, rotation: rot }));
    }
    return faites;
  };

  /* -------------------------------------------------------------- anneau --
     Un TORE : une couronne de tubes, une bille à chaque joint pour lisser les
     coudes — bague, cerclage de tonneau, pneu, auréole, anse, hublot. `rayon`
     est celui de la couronne (au centre du boudin), `tube` le diamètre du
     boudin, `normale` l'axe de l'anneau. `arcDeg` < 360 ouvre l'anneau (anse
     de panier, fer à cheval), `debut` le fait démarrer ailleurs qu'à 0°. */
  const anneau = (nom, groupe, centre, rayon, o = {}) => {
    const n = o.n ?? 16;
    const tubeD = o.tube ?? 0.4;
    const normale = unit(o.normale || [0, 1, 0]);
    const arcDeg = o.arcDeg ?? 360;
    const ferme = arcDeg >= 360;
    const { X, Z } = orientFromYX(normale);
    const pts = [];
    for (let i = 0; i <= (ferme ? n : n); i++) {
      const a = rad((o.debut ?? 0) + (i / n) * arcDeg);
      pts.push(add3(centre, add3(mul3(X, rayon * Math.cos(a)), mul3(Z, rayon * Math.sin(a)))));
    }
    const faites = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = ferme ? pts[(i + 1) % n] : pts[i + 1];
      faites.push(tube(nom + (i + 1), groupe, a, b, tubeD, { ...o, rab: o.rab ?? 0.04 }));
      // La bille au joint n'est pas décorative (cf. `boyau`) : elle comble
      // l'angle vide entre deux tubes qui se rencontrent en biais.
      if (o.noeuds !== false && (ferme || i < n - 1)) {
        faites.push(poser(nom + "Noeud" + (i + 1), groupe, "Ball",
          [tubeD, tubeD, tubeD], b, { ...o }));
      }
    }
    return faites;
  };

  /* --------------------------------------------------------------- nappe --
     Une SURFACE COURBE tendue entre deux rails (deux courbes de même nombre de
     points, sorties d'`arc` ou de `courbe`) : carapace, coque de bateau, toit
     bombé, capot, dossier de trône, tuile canal. La surface est pavée de
     lattes orientées CELLULE PAR CELLULE — c'est ce qui la fait suivre la
     courbure au lieu de la facetter en trois plans.
     `bandes` : subdivisions en travers (défaut 3). `bombe` : bombement du
     milieu selon la normale, en studs — les rails ne courbent que dans leur
     plan, c'est `bombe` qui donne la DOUBLE courbure d'une carapace ou d'une
     coque. Le bombement déforme la GRILLE de points avant de poser les lattes :
     elles s'inclinent pour suivre la bosse au lieu d'être translatées en
     marches d'escalier. */
  const nappe = (nom, groupe, railA, railB, o = {}) => {
    if (railA.length !== railB.length) {
      throw new Error(`nappe(${nom}) : les deux rails doivent avoir le même nombre de points `
        + `(${railA.length} vs ${railB.length}) — sortir les deux du même arc/courbe avec le même n.`);
    }
    const faites = [];
    const bandes = o.bandes ?? 3;
    const ep = o.epaisseur ?? 0.18;
    const bombe = o.bombe ?? 0;
    const nc = railA.length;
    // grille plane interpolée entre les rails…
    const plat = [];
    for (let k = 0; k <= bandes; k++) plat.push(railA.map((p, i) => lerp3(p, railB[i], k / bandes)));
    // …puis bombée : chaque point est poussé selon la normale LOCALE de la
    // grille plane. C'est le bombement des points, pas des lattes, qui fait
    // que les lattes s'inclinent et se raccordent au lieu de s'étager.
    // `vers` (défaut : vers le haut) lève l'ambiguïté du produit vectoriel :
    // selon le sens des rails, la normale brute peut pointer vers le bas, et
    // le « bombé » creuserait la nappe au lieu de la gonfler.
    const vers = unit(o.vers || [0, 1, 0]);
    const sous = plat.map((rang, k) => rang.map((p, i) => {
      const f = bombe * Math.sin(Math.PI * (k / bandes));
      if (!f) return p;
      const along = sub3(plat[k][Math.min(nc - 1, i + 1)], plat[k][Math.max(0, i - 1)]);
      let nrm = unit(cross3(along, sub3(railB[i], railA[i])));
      if (dot3(nrm, vers) < 0) nrm = mul3(nrm, -1);
      return add3(p, mul3(nrm, f));
    }));
    for (let k = 0; k < bandes; k++) {
      for (let i = 0; i < nc - 1; i++) {
        const a0 = sous[k][i], a1 = sous[k][i + 1], b0 = sous[k + 1][i], b1 = sous[k + 1][i + 1];
        const long = sub3(mid3(a1, b1), mid3(a0, b0));      // le long des rails
        const trav = sub3(mid3(b0, b1), mid3(a0, a1));      // en travers
        let nrm = unit(cross3(long, trav));
        if (dot3(nrm, vers) < 0) nrm = mul3(nrm, -1);
        // Étagement anti-coplanaire : les cellules voisines vivent dans la
        // même surface PAR CONSTRUCTION. Un damier symétrique (±d) ne suffit
        // pas : sur une surface courbe, l'inclinaison relative de deux lattes
        // peut ANNULER l'écart dans la zone de recouvrement. On empile donc en
        // TUILES — chaque bande monte d'un demi-ep sur la précédente, chaque
        // colonne impaire d'un quart — des pas monotones que l'inclinaison ne
        // peut pas annuler des deux côtés à la fois.
        const c = add3(mul3(add3(add3(a0, a1), add3(b0, b1)), 0.25),
          mul3(nrm, k * ep * 0.5 + (i % 2 ? ep * 0.25 : 0)));
        const { rot } = orientFromYX(long, trav);
        // Recouvrement généreux dans les deux sens : sur une surface courbe,
        // les lattes sont des CORDES qui s'inclinent l'une par rapport à
        // l'autre et ouvrent des fentes en V. L'étagement en tuiles rend ce
        // recouvrement gratuit — deux voisines qui se chevauchent sont des
        // plans parallèles séparés, jamais confondus.
        // Le recouvrement VARIE avec la parité de ligne et de colonne : la
        // grille aligne sinon les CHANTS des lattes (mêmes plans de coupe
        // entre cellules voisines), et des chants coplanaires qui se
        // chevauchent clignotent autant que des grandes faces.
        const rec = o.recouvre ?? 1.25;
        faites.push(poser(`${nom}L${k + 1}C${i + 1}`, groupe, "Block",
          [len3(trav) * rec * (i % 2 ? 1.05 : 0.98), len3(long) * rec * (k % 2 ? 1.05 : 0.98), ep], c,
          { ...o, rotation: rot }));
      }
    }
    return faites;
  };

  /* ------------------------------------------------------------- miroirX --
     Duplique un lot de parts DÉJÀ POSÉES de l'autre côté du plan X = 0. On
     modélise un seul côté de la créature, on appelle ceci, et les deux côtés ne
     peuvent plus diverger.
     Le miroir passe par la MATRICE de rotation, pas par un changement de signe
     sur les angles : dès qu'une pièce tourne sur ses trois axes — le cas de
     toute aile, de tout membre orienté par `orientFromYX` — refléter les Euler
     à la main donne une jumelle fausse, et l'erreur ne se voit que de dos.

     ⚠ Un reflet inverse la chiralité. Le tour de passe-passe (renverser l'axe X
     local) n'est invisible que sur un solide symétrique selon son X : Block,
     Cylinder, Ball, et Wedge — qui est extrudé le long de X. Le CornerWedge, lui,
     n'a aucun plan de symétrie : la fonction refuse plutôt que de poser un coin
     retourné qu'on ne remarquerait qu'en jeu. */
  const miroirX = (parts, o = {}) => {
    const suf = o.suffixe || ["G", "D"];
    const faites = [];
    for (const p of parts) {
      if (p.shape === "CornerWedge") {
        throw new Error(`miroirX : ${p.name} est un CornerWedge — pas de plan de symétrie, `
          + "poser la jumelle à la main (ou la remplacer par deux Wedge).");
      }
      const nom = p.name.endsWith(suf[0]) ? p.name.slice(0, -suf[0].length) + suf[1] : p.name + suf[1];
      const groupe = p.group && o.groupe !== false && p.group.endsWith(suf[0])
        ? p.group.slice(0, -suf[0].length) + suf[1] : p.group;
      faites.push(poser(nom, groupe, p.shape,
        [...p.size], [-p.position[0], p.position[1], p.position[2]],
        { ...p, rotation: eulerMiroirX(p.rotation), color: p.color, material: p.material }));
    }
    return faites;
  };

  return {
    teinte, barre, tube, boyau, chaine, croise, biseau, membrane, plumes, ecailles, pointe,
    tour, anneau, nappe, miroirX,
    arc, courbe, orientFromYX, orientFromXY, lerp, lerp3, add3, sub3, mul3, unit, len3, cross3, mid3,
  };
}
