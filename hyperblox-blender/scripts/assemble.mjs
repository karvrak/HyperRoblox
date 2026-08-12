#!/usr/bin/env node
/**
 * HyperBlox Blender — manifest.json → assemble.lua
 *
 * Le FBX exporté depuis Blender ne dit à Roblox que la géométrie. Tout le
 * reste — la taille exacte en studs, la position, la couleur, le matériau, la
 * collision, les groupes, les animations — vit dans le `manifest.json` écrit
 * par `lib/hyperblox.py`, et c'est ce script qui le transforme en Lua.
 *
 * Pourquoi réécrire Size et CFrame alors que le FBX les porte déjà : parce que
 * le 3D Importer de Studio réinterprète l'échelle du FBX (le FBX se compte en
 * centimètres, Roblox en studs, et le résultat dépend de la version et des
 * options cochées). On ne cherche pas à deviner ce qu'il va faire : on lui
 * laisse importer ce qu'il veut, puis on impose les nombres mesurés dans
 * Blender. Le pipeline devient insensible à la question.
 *
 * Usage :
 *   node assemble.mjs <dossier-du-modele | chemin/manifest.json>
 */
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

/* le player d'animations est celui de HyperBlox : un seul player, deux pipelines.
   Les deux skills sont installés côte à côte (.claude/skills/hyperblox et
   .claude/skills/hyperblox-blender), comme dans le dépôt. */
let blocAnimLua;
try {
  ({ blocAnimLua } = await import("../../hyperblox/lib/anim-lua.mjs"));
} catch {
  console.error("✗ Le skill `hyperblox` est introuvable à côté de `hyperblox-blender`.\n" +
    "  assemble.mjs lui emprunte le player d'animations (lib/anim-lua.mjs).\n" +
    "  Installer les deux dossiers dans le même .claude/skills/.");
  process.exit(1);
}

/* ------------------------------------------------------------------ entrée */
const argv = process.argv.slice(2);
const arg = argv.find(a => !a.startsWith("--"));
if (!arg) {
  console.error("Usage : node assemble.mjs <dossier-du-modele | chemin/manifest.json>");
  process.exit(1);
}
const cible = resolve(arg);
const manPath = existsSync(cible) && statSync(cible).isDirectory()
  ? join(cible, "manifest.json") : cible;
if (!existsSync(manPath)) {
  console.error("✗ manifest.json introuvable : " + manPath +
    "\n  Il est écrit par hb.export() dans Blender.");
  process.exit(1);
}
const outDir = dirname(manPath);
const man = JSON.parse(readFileSync(manPath, "utf8"));

/* ---------------------------------------------------------------- contrôle */
const MATERIALS = new Set([
  "Plastic", "SmoothPlastic", "Neon", "Metal", "DiamondPlate", "Foil", "Wood",
  "WoodPlanks", "Marble", "Slate", "Concrete", "Brick", "Granite", "Cobblestone",
  "Sand", "Grass", "Fabric", "Glass", "Ice", "ForceField", "CorrodedMetal",
  "Pebble", "Asphalt", "Basalt", "Limestone", "Sandstone",
]);
const FIDELITY = new Set(["Default", "Hull", "Box", "PreciseConvexDecomposition"]);
const RENDER = new Set(["Automatic", "Precise", "Performance"]);
const EASINGS = new Set([
  "linear", "easeIn", "easeOut", "easeInOut", "easeInCubic", "easeOutCubic",
  "easeOutBack", "easeOutBounce", "easeOutElastic",
]);
const TRIS_MAX = 20000;

const errors = [], warnings = [];
if (!man.name) errors.push("`name` manquant dans le manifest.");
const pieces = man.pieces || [];
if (!pieces.length) errors.push("`pieces` vide — rien à assembler.");

const vus = new Set();
for (const [i, p] of pieces.entries()) {
  const ou = "pieces[" + i + "]" + (p.name ? " (" + p.name + ")" : "");
  if (!p.name) { errors.push(ou + " : `name` manquant."); continue; }
  if (!/^[A-Za-z_]\w*$/.test(p.name)) {
    errors.push(ou + " : nom inutilisable. Le 3D Importer réécrit les noms à espace, "
      + "point ou accent, et l'assemblage retrouve les MeshParts PAR LEUR NOM.");
  }
  if (vus.has(p.name)) {
    errors.push(ou + " : nom en double — Studio renommerait la seconde en « " + p.name + "1 ».");
  }
  vus.add(p.name);
  for (const champ of ["size", "position"]) {
    if (!Array.isArray(p[champ]) || p[champ].length !== 3 || p[champ].some(v => typeof v !== "number")) {
      errors.push(ou + " : `" + champ + "` doit être trois nombres.");
    }
  }
  if (!Array.isArray(p.color) || p.color.length !== 3) errors.push(ou + " : `color` doit être [r, g, b].");
  if (p.material && !MATERIALS.has(p.material)) errors.push(ou + " : matériau inconnu « " + p.material + " ».");
  if (p.fidelity && !FIDELITY.has(p.fidelity)) errors.push(ou + " : CollisionFidelity inconnue « " + p.fidelity + " ».");
  if (p.render && !RENDER.has(p.render)) errors.push(ou + " : RenderFidelity inconnue « " + p.render + " ».");
  if (Array.isArray(p.size)) {
    const mini = Math.min(...p.size);
    if (mini < 0.05) warnings.push(p.name + " : une dimension fait " + mini.toFixed(3)
      + " stud — sous le minimum Roblox de 0,05, Studio la remontera et la pièce sera fausse.");
  }
  if (p.tris > TRIS_MAX) errors.push(ou + " : " + p.tris + " triangles, au-dessus du plafond "
    + "Roblox de " + TRIS_MAX + " — le 3D Importer refusera la pièce.");
}

const groupes = [...new Set(pieces.map(p => p.group).filter(Boolean))];
const cibles = new Set([...vus, ...groupes]);
for (const a of man.animations || []) {
  if (!a.name || typeof a.duration !== "number") { errors.push("animation sans `name` ou `duration`."); continue; }
  for (const tr of a.tracks || []) {
    if (!cibles.has(tr.target)) {
      errors.push("animation « " + a.name + " » : cible « " + tr.target
        + " » inconnue (ni pièce, ni groupe).");
    }
    for (const kf of tr.keyframes || []) {
      if (kf.easing && !EASINGS.has(kf.easing)) {
        errors.push("animation « " + a.name + " » : easing inconnu « " + kf.easing + " ».");
      }
    }
  }
}

if (errors.length) {
  console.error("✗ manifest.json invalide :\n  - " + errors.join("\n  - "));
  process.exit(1);
}

/* Un modèle qui ne pose pas au sol se plante à moitié dans la baseplate au
   moment où on le pose dans le monde. hb.export() recale le pivot ; si le
   manifest a été retouché à la main, autant le dire ici. */
const bas = Math.min(...pieces.map(p => p.position[1] - p.size[1] / 2));
if (Math.abs(bas) > 0.05) {
  warnings.push("le modèle " + (bas > 0 ? "flotte à " + bas.toFixed(2) + " stud du sol"
    : "s'enfonce de " + (-bas).toFixed(2) + " stud") + " — le pivot devrait poser sur y = 0.");
}

/* ------------------------------------------------------------ assemble.lua */
const fmt = n => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};
const luaStr = s => '"' + String(s).replace(/[\\"]/g, m => "\\" + m) + '"';

const slug = basename(outDir);
const fbx = man.fbx || slug + ".fbx";
const total = pieces.reduce((s, p) => s + (p.tris || 0), 0);
const groupVar = new Map(groupes.map((g, i) => [g, "groupe" + (i + 1)]));

const L = [];
L.push(`--------------------------------------------------------------------
-- ${man.name} — assemblage HyperBlox/Blender, généré depuis manifest.json
-- NE PAS ÉDITER À LA MAIN : modifier le générateur Blender, réexporter,
-- relancer assemble.mjs.
--
-- AVANT de lancer ce script : importer ${fbx} dans Studio
--   Onglet Avatar (ou Modèle) > Importateur 3D > choisir le fichier
--   → décocher « Merge Meshes » (une MeshPart par pièce, retrouvée par son nom)
--   → cocher « Anchored »
--   L'import pose un Model dans workspace : c'est la SOURCE.
--
-- Ce script clone la source, impose à chaque MeshPart la taille et la position
-- mesurées dans Blender, l'habille, et range la source dans ServerStorage.
-- Réexécutable sans risque : il remplace le modèle existant du même nom.
--------------------------------------------------------------------

local ServerStorage = game:GetService("ServerStorage")

local CONFIG = {
	SOURCE = "",                      -- nom du Model importé ; "" = recherche automatique
	PARENT = workspace,               -- où poser le modèle assemblé
	POSITION = Vector3.new(0, 0, 0),  -- position du pivot (au sol, centre du modèle)
	ROTATION_Y = 0,                   -- rotation d'ensemble en degrés
	REPLACE_EXISTING = true,
	RANGER_SOURCE = true,             -- déplacer l'import dans ServerStorage après coup
}

local MODEL_NAME = ${luaStr(man.name)}

-- nom, taille (studs), position (studs, pivot au sol), couleur, matériau,
-- transparence, collision, CollisionFidelity, RenderFidelity, groupe
local PIECES = {`);

for (const p of pieces) {
  L.push("\t{" + [
    luaStr(p.name),
    "Vector3.new(" + p.size.map(fmt).join(", ") + ")",
    "Vector3.new(" + p.position.map(fmt).join(", ") + ")",
    "Color3.fromRGB(" + p.color.map(c => Math.round(c)).join(", ") + ")",
    "Enum.Material." + (p.material || "SmoothPlastic"),
    fmt(p.transparency || 0),
    p.collide === false ? "false" : "true",
    "Enum.CollisionFidelity." + (p.fidelity || "Box"),
    "Enum.RenderFidelity." + (p.render || "Automatic"),
    p.group ? luaStr(p.group) : "nil",
  ].join(", ") + "},");
}

L.push(`}

--------------------------------------------------------------- la source
-- Un import peut arriver suffixé : « Braseros.001 », « Braseros_1 ». Ça se
-- produit dès que deux objets se disputent un nom quelque part en amont — dans
-- Blender comme dans Studio. Le nom est le SEUL lien entre le mesh importé et
-- ses cotes, alors on tolère le suffixe plutôt que d'échouer sur trois
-- caractères. Le nom exact garde toujours la priorité.
local function nomNu(nom)
	return nom:match("^(.-)[%.%_]%d+$") or nom
end

-- Retrouver l'import ne peut pas reposer sur son nom : le 3D Importer nomme le
-- Model d'après le fichier, l'utilisateur le renomme, le déplace. On cherche
-- donc le Model qui CONTIENT la première pièce attendue.
local function trouverSource()
	local racines = { workspace, ServerStorage, game:GetService("ReplicatedStorage") }
	if CONFIG.SOURCE ~= "" then
		for _, r in ipairs(racines) do
			local m = r:FindFirstChild(CONFIG.SOURCE, true)
			if m then return m end
		end
		error("[HyperBlox] Model « " .. CONFIG.SOURCE .. " » introuvable.")
	end
	local repere = PIECES[1][1]
	for _, r in ipairs(racines) do
		for _, d in ipairs(r:GetDescendants()) do
			if d:IsA("MeshPart") and nomNu(d.Name) == repere then
				local m = d.Parent
				if m and m:IsA("Model") then return m end
				error("[HyperBlox] La MeshPart « " .. repere .. " » a été trouvée, mais elle " ..
					"n'est pas dans un Model (parent : " .. m.ClassName .. ").\\n" ..
					"  → sélectionner les pièces importées dans l'Explorer et les grouper " ..
					"(Ctrl+G), ou renseigner CONFIG.SOURCE.")
			end
		end
	end
	error("[HyperBlox] Aucune MeshPart nommée « " .. repere .. " » dans workspace, " ..
		"ServerStorage ni ReplicatedStorage.\\n" ..
		"  → le FBX n'a pas encore été importé, ou « Merge Meshes » était coché " ..
		"à l'import (une seule MeshPart pour tout le modèle au lieu d'une par pièce).")
end

local source = trouverSource()
if source:IsDescendantOf(workspace) and source.Name == MODEL_NAME then
	-- l'import s'appelle déjà comme le modèle final : on le range d'abord,
	-- sinon REPLACE_EXISTING détruirait la source dont on a besoin.
	source.Name = MODEL_NAME .. "_import"
end

-- On indexe deux fois : sous le nom exact (qui l'emporte, l'affectation étant
-- inconditionnelle) et sous le nom débarrassé de son suffixe numérique.
local dispo = {}
local function indexer(d)
	local nu = nomNu(d.Name)
	if nu ~= d.Name and dispo[nu] == nil then dispo[nu] = d end
	dispo[d.Name] = d
end
for _, d in ipairs(source:GetDescendants()) do
	if d:IsA("MeshPart") then indexer(d) end
end
if source:IsA("MeshPart") then indexer(source) end

local manquantes = {}
for _, p in ipairs(PIECES) do
	if not dispo[p[1]] then table.insert(manquantes, p[1]) end
end
if #manquantes > 0 then
	error("[HyperBlox] " .. #manquantes .. " pièce(s) absentes de l'import : " ..
		table.concat(manquantes, ", ") .. "\\n" ..
		"  → soit l'import a fusionné les meshes, soit Studio a renommé des doublons " ..
		"(Piece, Piece1…). Vérifier les noms dans l'Explorer et réimporter.")
end

--------------------------------------------------------------- l'assemblage
if CONFIG.REPLACE_EXISTING then
	local old = CONFIG.PARENT:FindFirstChild(MODEL_NAME)
	if old and old ~= source then old:Destroy() end
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

for (const g of groupes) {
  L.push(`
local ${groupVar.get(g)} = Instance.new("Model")
${groupVar.get(g)}.Name = ${luaStr(g)}
${groupVar.get(g)}.Parent = model`);
}

L.push(`
local GROUPES = {${groupes.map(g => "[" + luaStr(g) + "] = " + groupVar.get(g)).join(", ")}}

-- Contrôle de proportions : si le mesh importé n'a pas le même rapport de
-- dimensions que ce que Blender a mesuré, c'est que la conversion d'axes a
-- tourné le modèle. Forcer Size l'écraserait alors sans rien dire — autant
-- l'apprendre par un message que par un modèle bizarrement aplati.
local suspectes = {}
local function proportions(v)
	local m = math.max(v.X, v.Y, v.Z)
	if m <= 0 then return Vector3.zero end
	return Vector3.new(v.X / m, v.Y / m, v.Z / m)
end

for _, p in ipairs(PIECES) do
	-- bornes explicites : la dernière colonne (le groupe) vaut nil pour les pièces
	-- posées à la racine, et #p s'arrêterait juste avant.
	local nom, taille, pos, couleur, materiau, transp, collide, fid, rend, groupe = table.unpack(p, 1, 10)
	local src = dispo[nom]
	local mesh = src:Clone()
	mesh.Name = nom

	local avant, apres = proportions(mesh.Size), proportions(taille)
	if (avant - apres).Magnitude > 0.04 then table.insert(suspectes, nom) end

	-- l'ordre compte : CollisionFidelity avant Size évite un recalcul de collision
	-- sur la taille intermédiaire.
	mesh.CollisionFidelity = fid
	mesh.RenderFidelity = rend
	mesh.Size = taille
	mesh.CFrame = origin * CFrame.new(pos)
	mesh.PivotOffset = CFrame.new()
	mesh.Anchored = true
	mesh.CanCollide = collide
	mesh.CanTouch = collide
	mesh.DoubleSided = false
	-- une MeshPart importée peut arriver avec une texture ou un SurfaceAppearance
	-- qui court-circuite Color : sans ça, tout le modèle reste gris.
	pcall(function() mesh.TextureID = "" end)
	local sa = mesh:FindFirstChildOfClass("SurfaceAppearance")
	if sa then sa:Destroy() end
	mesh.Color = couleur
	mesh.Material = materiau
	mesh.Transparency = transp

	mesh.Parent = (groupe and GROUPES[groupe]) or model
end`);

const bloc = blocAnimLua(man);
if (bloc) L.push(bloc);

const animCount = (man.animations || []).length;
L.push(`
model.Parent = CONFIG.PARENT

if CONFIG.RANGER_SOURCE and not source:IsDescendantOf(ServerStorage) then
	source.Parent = ServerStorage
end

if #suspectes > 0 then
	warn("[HyperBlox] proportions inattendues sur : " .. table.concat(suspectes, ", ") ..
		"\\n  Le mesh importé n'a pas la forme mesurée dans Blender — conversion " ..
		"d'axes ou export partiel. Voir references/pipeline-mesh.md § Calibration.")
end

print(("[HyperBlox] %s assemblé : %d MeshParts, %s studs${animCount ? ", " + animCount + " animation(s) — require(model.HyperBloxAnim).play(\\\"" + man.animations[0].name + "\\\")" : ""}"):format(
	MODEL_NAME, #PIECES, "${(man.size || [0, 0, 0]).map(d => fmt(d)).join(" x ")}"))

return true`);

const lua = L.join("\n") + "\n";
const outPath = join(outDir, "assemble.lua");
writeFileSync(outPath, lua);

const PLAFOND = 200000;
if (lua.length > PLAFOND) {
  warnings.push("assemble.lua fait " + lua.length.toLocaleString("fr-FR") + " caractères, "
    + "au-dessus du plafond de " + PLAFOND.toLocaleString("fr-FR") + " d'une source de script "
    + "Roblox — passer par un StringValue (voir hyperblox/SKILL.md § Construire dans Roblox).");
}

/* ----------------------------------------------------------------- rapport */
console.log("✓ " + man.name + " — " + pieces.length + " pièces, " + total.toLocaleString("fr-FR")
  + " triangles, " + (man.size || []).map(d => Number(d).toFixed(1)).join(" × ") + " studs"
  + (groupes.length ? ", " + groupes.length + " groupe(s)" : "")
  + (animCount ? ", " + animCount + " animation(s) : " + man.animations.map(a => a.name).join(", ") : ""));
console.log("  → " + outPath + "  (" + lua.length.toLocaleString("fr-FR") + " caractères)");
console.log("  à importer d'abord dans Studio : " + join(outDir, fbx));
const alertes = [...(man.warnings || []), ...warnings];
if (alertes.length) console.log("⚠ Avertissements :\n  - " + alertes.join("\n  - "));
