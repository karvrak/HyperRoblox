#!/usr/bin/env node
/**
 * HyperBlox build — transforme un model.json en :
 *   1. preview.html  — viewer 3D autonome (Three.js inliné, aucune dépendance réseau)
 *   2. build.lua     — script Studio (barre de commande ou MCP run_code) qui
 *                      construit le modèle avec de vraies Parts Roblox
 *
 * Usage :
 *   node build.mjs <dossier-du-modele | chemin/model.json>
 *
 * Le JSON est la source de vérité : la préview HTML et le Lua sont générés
 * depuis les mêmes données avec les mêmes conventions (voir references/part-schema.md).
 */
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { blocAnimLua } from "../lib/anim-lua.mjs";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

/* ------------------------------------------------------------------ entrée */
const argv = process.argv.slice(2);
const arg = argv.find((a) => !a.startsWith("--"));
// Deux formes de build.lua pour les mêmes données :
//   lisible  — un bloc `do … end` par part, facile à lire et à retoucher ;
//   compact  — une table de données + une boucle, ~5× plus court.
// Une source de script Roblox est plafonnée à 200 000 caractères : au-delà de
// ~120 parts la forme lisible ne PASSE PLUS en ModuleScript. Le choix est donc
// automatique, et forçable dans les deux sens.
const COMPACT = argv.includes("--compact") ? true : argv.includes("--lisible") ? false : null;
const PLAFOND_SOURCE = 200000;
if (!arg) {
  console.error("Usage : node build.mjs <dossier-du-modele | model.json> [--compact | --lisible]");
  process.exit(1);
}
let jsonPath = resolve(arg);
if (existsSync(jsonPath) && statSync(jsonPath).isDirectory()) jsonPath = join(jsonPath, "model.json");
if (!existsSync(jsonPath)) {
  console.error("Introuvable : " + jsonPath);
  process.exit(1);
}
const outDir = dirname(jsonPath);
const model = JSON.parse(readFileSync(jsonPath, "utf8"));

/* -------------------------------------------------------------- validation */
const SHAPES = new Set(["Block", "Wedge", "CornerWedge", "Cylinder", "Ball"]);
const MATERIALS = new Set([
  "Plastic", "SmoothPlastic", "Neon", "Metal", "DiamondPlate", "Foil",
  "Wood", "WoodPlanks", "Marble", "Slate", "Concrete", "Brick", "Granite",
  "Cobblestone", "Sand", "Grass", "Fabric", "Glass", "Ice", "ForceField",
  "CorrodedMetal", "Pebble", "Asphalt", "Basalt", "Limestone", "Sandstone"
]);

const errors = [], warnings = [];
if (!model.name || typeof model.name !== "string") errors.push("`name` (string) est requis à la racine.");
if (!Array.isArray(model.parts) || model.parts.length === 0) errors.push("`parts` doit être un tableau non vide.");

const seenNames = new Map();
for (const [i, p] of (model.parts || []).entries()) {
  const id = p.name || "parts[" + i + "]";
  if (!p.name) errors.push(id + " : `name` requis.");
  else seenNames.set(p.name, (seenNames.get(p.name) || 0) + 1);
  if (!SHAPES.has(p.shape)) errors.push(id + " : shape invalide `" + p.shape + "` (Block|Wedge|CornerWedge|Cylinder|Ball).");
  for (const [key, len] of [["size", 3], ["position", 3]]) {
    if (!Array.isArray(p[key]) || p[key].length !== len || p[key].some(v => typeof v !== "number" || !isFinite(v)))
      errors.push(id + " : `" + key + "` doit être [x, y, z] numérique.");
  }
  if (p.size && p.size.some(v => v <= 0)) errors.push(id + " : toutes les dimensions de `size` doivent être > 0.");
  if (p.size && p.size.some(v => v < 0.05)) warnings.push(id + " : dimension < 0.05 stud (minimum Roblox), sera forcée à 0.05 par Studio.");
  if (p.rotation !== undefined && (!Array.isArray(p.rotation) || p.rotation.length !== 3 || p.rotation.some(v => typeof v !== "number")))
    errors.push(id + " : `rotation` doit être [rx, ry, rz] en degrés.");
  if (!Array.isArray(p.color) || p.color.length !== 3 || p.color.some(v => !Number.isInteger(v) || v < 0 || v > 255))
    errors.push(id + " : `color` doit être [r, g, b] entiers 0-255.");
  if (p.material !== undefined && !MATERIALS.has(p.material))
    errors.push(id + " : material inconnu `" + p.material + "`.");
  if (p.transparency !== undefined && (typeof p.transparency !== "number" || p.transparency < 0 || p.transparency > 1))
    errors.push(id + " : `transparency` doit être entre 0 et 1.");
  // `flotte` ne change RIEN à la construction : c'est une déclaration
  // d'intention, lue par la passe de finition pour ne pas signaler comme
  // « décrochée » une part qui lévite exprès.
  if (p.flotte !== undefined && typeof p.flotte !== "boolean")
    errors.push(id + " : `flotte` doit être un booléen (part qui lévite volontairement).");
  if (p.shape === "Ball" && p.size && (p.size[0] !== p.size[1] || p.size[1] !== p.size[2]))
    warnings.push(id + " : Ball non uniforme — Roblox rend une sphère sur la plus petite dimension.");
  if (p.shape === "Cylinder" && p.size && p.size[1] !== p.size[2])
    warnings.push(id + " : Cylinder avec size[1] != size[2] — le diamètre rendu est min(Y, Z).");
}
for (const [name, count] of seenNames) if (count > 1) warnings.push("Nom de part dupliqué : `" + name + "` (×" + count + ") — autorisé mais gêne l'itération.");
// Le nombre de parts n'est pas un défaut en soi — une créature détaillée en
// demande des centaines. Ce qui coûte, c'est le rendu en jeu : on n'avertit
// qu'au seuil où la question se pose vraiment, et sans réclamer de simplifier.
if ((model.parts || []).length > 400) {
  warnings.push(model.parts.length + " parts — au-delà de ~400, vérifier le coût en jeu si le modèle est instancié "
    + "plusieurs fois à l'écran (un boss unique le supporte, un mob de meute non).");
}

/* ------------------------------------------------- validation animations */
const EASINGS = new Set([
  "linear", "easeIn", "easeOut", "easeInOut", "easeInCubic", "easeOutCubic",
  "easeOutBack", "easeOutBounce", "easeOutElastic"
]);
const groupSet = new Set((model.parts || []).filter(p => p.group).map(p => p.group));
const partSet = new Set((model.parts || []).map(p => p.name));
const animNames = new Set();
for (const [ai, a] of (model.animations || []).entries()) {
  const aid = a.name || "animations[" + ai + "]";
  if (!a.name) errors.push(aid + " : `name` requis.");
  else if (animNames.has(a.name)) errors.push(aid + " : nom d'animation dupliqué.");
  else animNames.add(a.name);
  if (typeof a.duration !== "number" || a.duration <= 0) errors.push(aid + " : `duration` (secondes > 0) requis.");
  if (!Array.isArray(a.tracks) || a.tracks.length === 0) { errors.push(aid + " : `tracks` doit être un tableau non vide."); continue; }
  for (const [ti, tr] of a.tracks.entries()) {
    const tid = aid + ".tracks[" + ti + "]";
    if (!tr.target || (!groupSet.has(tr.target) && !partSet.has(tr.target)))
      errors.push(tid + " : `target` doit être un nom de groupe ou de part existant (reçu `" + tr.target + "`).");
    if (tr.pivot !== undefined && (!Array.isArray(tr.pivot) || tr.pivot.length !== 3 || tr.pivot.some(v => typeof v !== "number")))
      errors.push(tid + " : `pivot` doit être [x, y, z].");
    if (!Array.isArray(tr.keyframes) || tr.keyframes.length < 2) { errors.push(tid + " : au moins 2 `keyframes` requis."); continue; }
    let lastT = -Infinity;
    for (const [ki, kf] of tr.keyframes.entries()) {
      const kid = tid + ".keyframes[" + ki + "]";
      if (typeof kf.t !== "number" || kf.t < 0 || (a.duration && kf.t > a.duration))
        errors.push(kid + " : `t` doit être entre 0 et duration.");
      if (kf.t <= lastT) errors.push(kid + " : les keyframes doivent être triées par `t` strictement croissant.");
      lastT = kf.t;
      for (const key of ["rotation", "position"]) {
        if (kf[key] !== undefined && (!Array.isArray(kf[key]) || kf[key].length !== 3 || kf[key].some(v => typeof v !== "number")))
          errors.push(kid + " : `" + key + "` doit être [x, y, z].");
      }
      if (kf.easing !== undefined && !EASINGS.has(kf.easing))
        errors.push(kid + " : easing inconnu `" + kf.easing + "` (" + [...EASINGS].join("|") + ").");
    }
    if (tr.keyframes[0].t !== 0) warnings.push(tid + " : la première keyframe n'est pas à t=0 — la pose de base sera tenue jusqu'à t=" + tr.keyframes[0].t + ".");
  }
}

/* ------------------------------------------ émetteurs de particules (optionnel) */
const EMITTER_SHAPES = new Set(["Box", "Sphere", "Cylinder", "Disc"]);
const EMITTER_INOUT = new Set(["Outward", "Inward", "InAndOut"]);
const EMITTER_ORIENT = new Set(["FacingCamera", "FacingCameraWorldUp", "VelocityParallel", "VelocityPerpendicular"]);
const EMITTER_DIR = new Set(["Top", "Bottom", "Front", "Back", "Left", "Right"]);
const emitterNames = new Set();
for (const [i, e] of (model.emitters || []).entries()) {
  const id = "emitters[" + i + "]" + (e.name ? " (" + e.name + ")" : "");
  if (!e.name) errors.push(id + " : `name` requis.");
  else if (emitterNames.has(e.name)) errors.push(id + " : nom d'émetteur dupliqué.");
  else emitterNames.add(e.name);
  if (partSet.has(e.name)) errors.push(id + " : le nom collisionne avec une part.");
  if (!e.parent || !partSet.has(e.parent))
    errors.push(id + " : `parent` doit être le nom d'une part existante (reçu `" + e.parent + "`).");
  for (const key of ["offset", "acceleration"])
    if (e[key] !== undefined && (!Array.isArray(e[key]) || e[key].length !== 3))
      errors.push(id + " : `" + key + "` doit être [x, y, z].");
  for (const key of ["color", "colorEnd"])
    if (e[key] !== undefined && (!Array.isArray(e[key]) || e[key].length !== 3 || e[key].some(v => !Number.isInteger(v) || v < 0 || v > 255)))
      errors.push(id + " : `" + key + "` doit être [r, g, b] entiers 0-255.");
  for (const key of ["size", "transparency", "lifetime", "speed", "rotation", "rotSpeed"])
    if (e[key] !== undefined && (!Array.isArray(e[key]) || e[key].length !== 2 || e[key].some(v => typeof v !== "number")))
      errors.push(id + " : `" + key + "` doit être [début, fin] (2 nombres).");
  if (e.shape !== undefined && !EMITTER_SHAPES.has(e.shape))
    errors.push(id + " : `shape` inconnu `" + e.shape + "` (" + [...EMITTER_SHAPES].join("|") + ").");
  if (e.shapeInOut !== undefined && !EMITTER_INOUT.has(e.shapeInOut))
    errors.push(id + " : `shapeInOut` inconnu `" + e.shapeInOut + "` (" + [...EMITTER_INOUT].join("|") + ").");
  if (e.orientation !== undefined && !EMITTER_ORIENT.has(e.orientation))
    errors.push(id + " : `orientation` inconnu `" + e.orientation + "` (" + [...EMITTER_ORIENT].join("|") + ").");
  if (e.emissionDirection !== undefined && !EMITTER_DIR.has(e.emissionDirection))
    errors.push(id + " : `emissionDirection` inconnu `" + e.emissionDirection + "` (" + [...EMITTER_DIR].join("|") + ").");
  for (const [anim, wins] of Object.entries(e.windows || {})) {
    if (!animNames.has(anim)) { errors.push(id + " : `windows` cible l'animation inconnue `" + anim + "`."); continue; }
    if (!Array.isArray(wins) || !wins.length) { errors.push(id + " : `windows." + anim + "` doit être une liste de [tOn, tOff]."); continue; }
    const dur = model.animations.find(a => a.name === anim).duration;
    for (const w of wins) {
      if (!Array.isArray(w) || w.length !== 2 || w.some(v => typeof v !== "number") || w[1] <= w[0])
        errors.push(id + " : fenêtre invalide dans `windows." + anim + "` — attendu [tOn, tOff] avec tOff > tOn.");
      else if (w[0] < 0 || w[1] > dur)
        warnings.push(id + " : fenêtre [" + w[0] + ", " + w[1] + "] hors de la durée de `" + anim + "` (" + dur + "s).");
    }
  }
}

if (errors.length) {
  console.error("✗ model.json invalide :\n  - " + errors.join("\n  - "));
  process.exit(1);
}

/* bbox précise (coins tournés) pour les avertissements sol/dimensions */
function quatFromEuler(deg = [0, 0, 0]) {
  const [x, y, z] = deg.map(d => d * Math.PI / 180);
  const mul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
  const qx = [Math.sin(x / 2), 0, 0, Math.cos(x / 2)];
  const qy = [0, Math.sin(y / 2), 0, Math.cos(y / 2)];
  const qz = [0, 0, Math.sin(z / 2), Math.cos(z / 2)];
  return mul(mul(qx, qy), qz);
}
function rotate(q, v) {
  const [qx, qy, qz, qw] = q, [vx, vy, vz] = v;
  const uvx = qy * vz - qz * vy, uvy = qz * vx - qx * vz, uvz = qx * vy - qy * vx;
  const uuvx = qy * uvz - qz * uvy, uuvy = qz * uvx - qx * uvz, uuvz = qx * uvy - qy * uvx;
  return [vx + 2 * (qw * uvx + uuvx), vy + 2 * (qw * uvy + uuvy), vz + 2 * (qw * uvz + uuvz)];
}
let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (const p of model.parts) {
  const q = quatFromEuler(p.rotation);
  const [hx, hy, hz] = p.size.map(s => s / 2);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const c = rotate(q, [hx * sx, hy * sy, hz * sz]);
    for (let a = 0; a < 3; a++) {
      const v = c[a] + p.position[a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
}
const dims = max.map((v, a) => v - min[a]);
if (min[1] > 0.05) warnings.push("Le modèle flotte à " + min[1].toFixed(2) + " studs au-dessus du sol (y=0).");
if (min[1] < -0.05) warnings.push("Le modèle s'enfonce de " + (-min[1]).toFixed(2) + " studs sous le sol (y=0).");

/* ---------------------------------------------------------- preview.html */
const template = readFileSync(join(SKILL_DIR, "templates", "viewer.html"), "utf8");
const threeJs = readFileSync(join(SKILL_DIR, "templates", "vendor", "three.min.js"), "utf8");
const inject = (haystack, token, value) => haystack.split(token).join(value);

let html = template;
html = inject(html, "/*__THREE_JS__*/", threeJs);
html = inject(html, "__MODEL_JSON__", JSON.stringify(model));
html = inject(html, "__MODEL_NAME__", model.name);
writeFileSync(join(outDir, "preview.html"), html);

/* -------------------------------------------------------------- build.lua */
const fmt = n => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};
const luaStr = s => '"' + String(s).replace(/[\\"]/g, m => "\\" + m) + '"';

const CLASS_FOR = { Block: "Part", Cylinder: "Part", Ball: "Part", Wedge: "WedgePart", CornerWedge: "CornerWedgePart" };

function luaPart(p, parentVar) {
  const rot = p.rotation && p.rotation.some(v => v) ? p.rotation : null;
  let cf = "CFrame.new(" + p.position.map(fmt).join(", ") + ")";
  if (rot) cf += " * CFrame.fromEulerAnglesXYZ(" + rot.map(d => "math.rad(" + fmt(d) + ")").join(", ") + ")";
  if (p.shape === "CornerWedge") cf += " * CORNER_FIX";
  const lines = [
    "\tlocal p = Instance.new(" + luaStr(CLASS_FOR[p.shape]) + ")",
    "\tp.Name = " + luaStr(p.name),
  ];
  if (p.shape === "Cylinder") lines.push('\tp.Shape = Enum.PartType.Cylinder');
  if (p.shape === "Ball") lines.push('\tp.Shape = Enum.PartType.Ball');
  lines.push(
    "\tp.Size = Vector3.new(" + p.size.map(fmt).join(", ") + ")",
    "\tp.CFrame = origin * " + cf,
    "\tp.Color = Color3.fromRGB(" + p.color.join(", ") + ")",
    "\tp.Material = Enum.Material." + (p.material || "SmoothPlastic")
  );
  if (p.transparency) lines.push("\tp.Transparency = " + fmt(p.transparency));
  lines.push(
    "\tp.Anchored = true",
    "\tp.CanCollide = " + (p.collide === false ? "false" : "true"),
    "\tp.TopSurface = Enum.SurfaceType.Smooth",
    "\tp.BottomSurface = Enum.SurfaceType.Smooth",
    "\tp.Parent = " + parentVar
  );
  return "do\n" + lines.join("\n") + "\nend";
}

const groupNames = [...new Set(model.parts.filter(p => p.group).map(p => p.group))];
const groupVar = new Map(groupNames.map((g, i) => [g, "group" + (i + 1)]));

const luaBody = [];
luaBody.push(`--------------------------------------------------------------------
-- ${model.name} — généré par HyperBlox depuis model.json
-- NE PAS ÉDITER À LA MAIN : modifier model.json puis relancer build.mjs.
-- À exécuter dans la barre de commande de Roblox Studio, ou via run_code (MCP).
-- Réexécutable sans risque : remplace le modèle existant du même nom.
--------------------------------------------------------------------

local CONFIG = {
	PARENT = workspace,               -- où poser le modèle
	POSITION = Vector3.new(0, 0, 0),  -- position du pivot (au sol, centre du modèle)
	ROTATION_Y = 0,                   -- rotation d'ensemble en degrés
	REPLACE_EXISTING = true,
}

-- Calibration CornerWedge : si l'orientation des CornerWedgeParts dans Studio
-- diffère de la préview HTML, ajuster ce yaw une seule fois (0, 90, 180 ou 270).
-- Voir references/part-schema.md § Calibration.
local CORNER_FIX = CFrame.Angles(0, math.rad(0), 0)

local MODEL_NAME = ${luaStr(model.name)}

if CONFIG.REPLACE_EXISTING then
	local old = CONFIG.PARENT:FindFirstChild(MODEL_NAME)
	if old then old:Destroy() end
end

local model = Instance.new("Model")
model.Name = MODEL_NAME

local root = Instance.new("Part")
root.Name = "Root"
root.Size = Vector3.new(0.4, 0.4, 0.4)
root.Transparency = 1
root.Anchored = true
root.CanCollide = false
root.CanQuery = false
root.CanTouch = false
root.Parent = model
model.PrimaryPart = root

local origin = CFrame.new(CONFIG.POSITION) * CFrame.Angles(0, math.rad(CONFIG.ROTATION_Y), 0)
root.CFrame = origin`);

for (const g of groupNames) {
  luaBody.push(`
local ${groupVar.get(g)} = Instance.new("Model")
${groupVar.get(g)}.Name = ${luaStr(g)}
${groupVar.get(g)}.Parent = model`);
}

/* ------------------------------------------------------ émission des parts --
   Deux écritures pour exactement la même géométrie. `compact` sort une table de
   données parcourue par une boucle : c'est ce qui fait tenir un modèle de 600
   parts sous le plafond de 200 000 caractères d'une source de script Roblox. */
const SHAPE_IDX = { Block: 1, Cylinder: 2, Ball: 3, Wedge: 4, CornerWedge: 5 };
const compact = COMPACT === null ? model.parts.length > 120 : COMPACT;

function luaCompact() {
  const mats = [...new Set(model.parts.map((p) => p.material || "SmoothPlastic"))];
  const idxMat = new Map(mats.map((m, i) => [m, i + 1]));
  const idxGrp = new Map(groupNames.map((g, i) => [g, i + 1]));
  const lignes = model.parts.map((p) => {
    const extra = [];
    if (p.rotation && p.rotation.some((v) => v)) extra.push("r={" + p.rotation.map(fmt).join(",") + "}");
    if (p.transparency) extra.push("t=" + fmt(p.transparency));
    if (p.collide === false) extra.push("c=false");
    return "{" + [
      luaStr(p.name), SHAPE_IDX[p.shape], p.group ? idxGrp.get(p.group) : 0,
      ...p.size.map(fmt), ...p.position.map(fmt), ...p.color,
      idxMat.get(p.material || "SmoothPlastic"),
      ...(extra.length ? ["{" + extra.join(",") + "}"] : []),
    ].join(",") + "}";
  });
  return `
-- Parts en table plutôt qu'en code : une source de script Roblox est plafonnée
-- à 200 000 caractères, et un modèle de plusieurs centaines de parts écrit
-- bloc par bloc ne passe pas. Colonnes :
--   1 nom · 2 forme · 3 groupe (0 = racine) · 4-6 taille · 7-9 position
--   10-12 couleur RGB · 13 matériau · 14 (facultatif) {r=rotation, t=transparence, c=collision}
local CLASSE = {"Part", "Part", "Part", "WedgePart", "CornerWedgePart"}
local FORME = {[2] = Enum.PartType.Cylinder, [3] = Enum.PartType.Ball}
local MAT = {${mats.map((m) => "Enum.Material." + m).join(", ")}}
local GROUPES = {${groupNames.map((g) => groupVar.get(g)).join(", ")}}
local P = {
${lignes.join(",\n")},
}

for _, d in ipairs(P) do
	local p = Instance.new(CLASSE[d[2]])
	p.Name = d[1]
	local forme = FORME[d[2]]
	if forme then p.Shape = forme end
	p.Size = Vector3.new(d[4], d[5], d[6])
	local o = d[14]
	local cf = CFrame.new(d[7], d[8], d[9])
	if o and o.r then
		cf = cf * CFrame.fromEulerAnglesXYZ(math.rad(o.r[1]), math.rad(o.r[2]), math.rad(o.r[3]))
	end
	if d[2] == 5 then cf = cf * CORNER_FIX end
	p.CFrame = origin * cf
	p.Color = Color3.fromRGB(d[10], d[11], d[12])
	p.Material = MAT[d[13]]
	p.Transparency = (o and o.t) or 0
	p.Anchored = true
	p.CanCollide = not (o and o.c == false)
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = d[3] == 0 and model or GROUPES[d[3]]
end`;
}

luaBody.push("");
if (compact) {
  luaBody.push(luaCompact());
} else {
  for (const p of model.parts) {
    luaBody.push(luaPart(p, p.group ? groupVar.get(p.group) : "model"));
  }
}

/* ------------------------------------ émetteurs de particules (si présents) */
function luaEmitter(e) {
  const c = e.color || [255, 255, 255];
  const c2 = e.colorEnd || c;
  const col = v => `Color3.fromRGB(${v[0]}, ${v[1]}, ${v[2]})`;
  const seq = (v, d0, d1) => {
    const a = v ? v[0] : d0, b = v ? v[1] : d1;
    return `NumberSequence.new(${fmt(a)}, ${fmt(b)})`;
  };
  const rng = (v, d0, d1) => `NumberRange.new(${fmt(v ? v[0] : d0)}, ${fmt(v ? v[1] : d1)})`;
  const L = [
    "do",
    `\tlocal host = model:FindFirstChild(${luaStr(e.parent)}, true)`,
    `\tassert(host, "[HyperBlox] emitter ${e.name} : part ${e.parent} introuvable")`,
  ];
  if (e.offset) {
    L.push(
      `\tlocal att = Instance.new("Attachment")`,
      `\tatt.Name = ${luaStr(e.name + "_At")}`,
      `\tatt.Position = Vector3.new(${e.offset.map(fmt).join(", ")})`,
      `\tatt.Parent = host`,
      `\thost = att`,
    );
  }
  L.push(
    `\tlocal fx = Instance.new("ParticleEmitter")`,
    `\tfx.Name = ${luaStr(e.name)}`,
    `\tfx.Color = ColorSequence.new(${col(c)}, ${col(c2)})`,
    `\tfx.Size = ${seq(e.size, 1, 1)}`,
    `\tfx.Transparency = ${seq(e.transparency, 0, 1)}`,
    `\tfx.Lifetime = ${rng(e.lifetime, 1, 1)}`,
    `\tfx.Speed = ${rng(e.speed, 5, 5)}`,
    `\tfx.Rotation = ${rng(e.rotation, 0, 0)}`,
    `\tfx.RotSpeed = ${rng(e.rotSpeed, 0, 0)}`,
    `\tfx.Rate = ${fmt(e.rate ?? 20)}`,
    `\tfx.SpreadAngle = Vector2.new(${fmt(e.spread ?? 0)}, ${fmt(e.spread ?? 0)})`,
    `\tfx.Acceleration = Vector3.new(${(e.acceleration || [0, 0, 0]).map(fmt).join(", ")})`,
    `\tfx.Drag = ${fmt(e.drag ?? 0)}`,
    `\tfx.LightEmission = ${fmt(e.lightEmission ?? 0)}`,
    `\tfx.LightInfluence = ${fmt(e.lightInfluence ?? 0)}`,
    `\tfx.ZOffset = ${fmt(e.zoffset ?? 0)}`,
  );
  if (e.texture) L.push(`\tfx.Texture = ${luaStr(e.texture)}`);
  if (e.shape) L.push(`\tfx.Shape = Enum.ParticleEmitterShape.${e.shape}`);
  if (e.shapeInOut) L.push(`\tfx.ShapeInOut = Enum.ParticleEmitterShapeInOut.${e.shapeInOut}`);
  if (e.orientation) L.push(`\tfx.Orientation = Enum.ParticleOrientation.${e.orientation}`);
  if (e.emissionDirection) L.push(`	fx.EmissionDirection = Enum.NormalId.${e.emissionDirection}`);
  L.push(
    `\tfx.Enabled = ${e.enabled === true}`,
    `\tfx.Parent = host`,
    "end",
  );
  return L.join("\n");
}
if ((model.emitters || []).length) {
  luaBody.push("\n-- émetteurs de particules");
  for (const e of model.emitters) luaBody.push(luaEmitter(e));
}

/* ------------------------------------ module d'animations (si présent) */
// Le player est généré par lib/anim-lua.mjs, partagé avec le pipeline Blender
// (hyperblox-blender/scripts/assemble.mjs) : un seul player, deux pipelines.
{
  const bloc = blocAnimLua(model);
  if (bloc) luaBody.push(bloc);
}

const animCount = (model.animations || []).length;
const fxCount = (model.emitters || []).length;
luaBody.push(`
model.Parent = CONFIG.PARENT
print(("[HyperBlox] %s construit : %d parts, %s studs${fxCount ? ", " + fxCount + " emetteur(s) de particules" : ""}${animCount ? ", " + animCount + " animation(s) — require(model.HyperBloxAnim).play(\\\"" + model.animations[0].name + "\\\")" : ""}"):format(
	MODEL_NAME, ${model.parts.length}, "${dims.map(d => fmt(d)).join(" x ")}"))`);

// `return true` : rend le script utilisable tel quel comme ModuleScript
// (`require(...)`) — indispensable au-delà de ~50 Ko, la barre de commande de
// Studio n'encaissant pas un collage de plusieurs milliers de lignes.
luaBody.push("\nreturn true");

const luaSrc = luaBody.join("\n") + "\n";
writeFileSync(join(outDir, "build.lua"), luaSrc);

// Le plafond de 200 000 caractères d'une source de script Roblox n'est pas une
// recommandation : au-delà, le ModuleScript refuse la source. Mieux vaut
// l'apprendre ici qu'en collant le script dans Studio.
if (luaSrc.length > PLAFOND_SOURCE) {
  warnings.push("build.lua fait " + luaSrc.length.toLocaleString("fr-FR") + " caractères, au-dessus du plafond "
    + "de " + PLAFOND_SOURCE.toLocaleString("fr-FR") + " d'une source de script Roblox : il ne peut pas être poussé "
    + "en ModuleScript" + (compact ? " même en compact — passer par serve.mjs + install-json.lua, qui transportent le model.json en données."
      : ". Relancer avec --compact (environ 5× plus court)."));
} else if (luaSrc.length > PLAFOND_SOURCE * 0.85) {
  warnings.push("build.lua fait " + luaSrc.length.toLocaleString("fr-FR") + " caractères — proche du plafond de "
    + PLAFOND_SOURCE.toLocaleString("fr-FR") + " ; quelques parts de plus et il ne passera plus en ModuleScript.");
}

/* ----------------------------------------------------------------- rapport */
console.log("✓ " + model.name + " — " + model.parts.length + " parts, " +
  dims.map(d => d.toFixed(1)).join(" × ") + " studs" +
  (animCount ? ", " + animCount + " animation(s) : " + model.animations.map(a => a.name).join(", ") : ""));
console.log("  → " + join(outDir, "preview.html"));
console.log("  → " + join(outDir, "build.lua") + "  (" + (compact ? "compact" : "lisible") + ", "
  + luaSrc.length.toLocaleString("fr-FR") + " caractères)");
if (warnings.length) console.log("⚠ Avertissements :\n  - " + warnings.join("\n  - "));
