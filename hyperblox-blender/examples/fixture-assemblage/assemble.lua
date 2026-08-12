--------------------------------------------------------------------
-- FixtureAssemblage — assemblage HyperBlox/Blender, généré depuis manifest.json
-- NE PAS ÉDITER À LA MAIN : modifier le générateur Blender, réexporter,
-- relancer assemble.mjs.
--
-- AVANT de lancer ce script : importer fixture-assemblage.fbx dans Studio
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

local MODEL_NAME = "FixtureAssemblage"

-- nom, taille (studs), position (studs, pivot au sol), couleur, matériau,
-- transparence, collision, CollisionFidelity, RenderFidelity, groupe
local PIECES = {
	{"Socle", Vector3.new(3, 0.4, 2), Vector3.new(0, 0.2, 0), Color3.fromRGB(46, 46, 54), Enum.Material.Metal, 0, true, Enum.CollisionFidelity.Box, Enum.RenderFidelity.Automatic, nil},
	{"Caisson", Vector3.new(2.6, 3.2, 1.7), Vector3.new(0, 2, 0), Color3.fromRGB(180, 62, 54), Enum.Material.SmoothPlastic, 0, true, Enum.CollisionFidelity.Box, Enum.RenderFidelity.Automatic, nil},
	{"Vitre", Vector3.new(1.9, 1.4, 0.08), Vector3.new(0, 2.9, -0.86), Color3.fromRGB(200, 226, 240), Enum.Material.Glass, 0.6, false, Enum.CollisionFidelity.Box, Enum.RenderFidelity.Precise, nil},
	{"Capot", Vector3.new(2.6, 0.5, 1.7), Vector3.new(0, 3.9, 0), Color3.fromRGB(232, 196, 88), Enum.Material.SmoothPlastic, 0, true, Enum.CollisionFidelity.Hull, Enum.RenderFidelity.Automatic, "Capot"},
	{"Enseigne", Vector3.new(1.6, 0.34, 0.1), Vector3.new(0, 4.05, -0.8), Color3.fromRGB(255, 240, 160), Enum.Material.Neon, 0, false, Enum.CollisionFidelity.Box, Enum.RenderFidelity.Precise, "Capot"},
}

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
					"n'est pas dans un Model (parent : " .. m.ClassName .. ").\n" ..
					"  → sélectionner les pièces importées dans l'Explorer et les grouper " ..
					"(Ctrl+G), ou renseigner CONFIG.SOURCE.")
			end
		end
	end
	error("[HyperBlox] Aucune MeshPart nommée « " .. repere .. " » dans workspace, " ..
		"ServerStorage ni ReplicatedStorage.\n" ..
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
		table.concat(manquantes, ", ") .. "\n" ..
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
root.CFrame = origin

local groupe1 = Instance.new("Model")
groupe1.Name = "Capot"
groupe1.Parent = model

local GROUPES = {["Capot"] = groupe1}

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
end

local animModule = Instance.new("ModuleScript")
animModule.Name = "HyperBloxAnim"
animModule.Source = [==[
-- HyperBloxAnim — player d'animations généré depuis model.json.
-- Mêmes keyframes et mêmes easings que preview.html : ce que la préview
-- montre est ce que ce module joue.
-- Usage (barre de commande, Script serveur ou LocalScript) :
--   local anim = require(<modele>.HyperBloxAnim)
--   anim.play("NomAnimation")                  -- lecture
--   anim.play("NomAnimation", {speed = 1.5, loop = true, onComplete = fn})
--   anim.sample("NomAnimation", 0.5)           -- pose figée à t secondes
--   anim.stop()                                -- fige la pose courante
--   anim.reset()                               -- retour à la pose de base
--   anim.list()                                -- noms disponibles
--   anim.fx("NomEmetteur", true)               -- forcer un émetteur de particules
--   anim.fxOff()                               -- couper tous les émetteurs pilotés
--   anim.parts("NomAnimation")                 -- les parts que l'anim fait bouger
--
-- Le modèle PEUT se déplacer pendant la lecture : tout est exprimé dans le
-- repère du PrimaryPart (le « Root »), relu à chaque image. Déplacer, tourner
-- ou incliner le Root emmène l'animation avec lui. Deux conditions : que le
-- Root ne soit lui-même la cible d'aucune track, et que les parts animées
-- soient ANCRÉES — le player leur écrit un CFrame absolu à chaque image, une
-- soudure se battrait avec lui (cf. parts(), qui dit lesquelles).

local RunService = game:GetService("RunService")

local ANIMS = {
	{
		name = "Ouvrir",
		duration = 1.1,
		loop = false,
		tracks = {
			{
				target = "Capot",
				pivot = {0, 3.9, 0.85},
				keyframes = {
					{
						t = 0,
						rotation = {0, 0, 0},
						easing = "easeOutBack",
					},
					{
						t = 1.1,
						rotation = {-72, 0, 0},
					},
				},
			},
		},
	},
}

-- émetteurs de particules pilotés par les animations : { nom, fenêtres [tOn, tOff] }
local FX = {}

local model = script.Parent
local M = {}
local conn = nil
local bases = nil
local originCF = nil
-- Les pivots des tracks sont en unités du model.json. Si le modèle a été
-- redimensionné (ScaleTo — mutations, mise à l'échelle d'une scène), il faut
-- les mettre à la même échelle, sinon les rotations tournent autour d'un point
-- trop lointain et les parts se dispersent.
local echelle = 1

local fxCache = nil
local function fxInstances()
	if fxCache then return fxCache end
	fxCache = {}
	for _, f in ipairs(FX) do
		local inst = model:FindFirstChild(f.name, true)
		if inst then table.insert(fxCache, { inst = inst, windows = f.windows }) end
	end
	return fxCache
end

-- allume/éteint les émetteurs selon les fenêtres de l'animation en cours.
-- Un émetteur sans fenêtre pour cette animation n'est jamais touché (ex. le feu
-- permanent d'un brasero reste allumé pendant la fusion).
local function applyFx(animName, t)
	for _, f in ipairs(fxInstances()) do
		local wins = f.windows[animName]
		if wins then
			local on = false
			for _, w in ipairs(wins) do
				if t >= w[1] and t <= w[2] then on = true; break end
			end
			if f.inst.Enabled ~= on then f.inst.Enabled = on end
		end
	end
end

function M.fx(name, on)
	for _, f in ipairs(fxInstances()) do
		if f.inst.Name == name then f.inst.Enabled = on ~= false return true end
	end
	local inst = model:FindFirstChild(name, true)
	if inst and inst:IsA("ParticleEmitter") then inst.Enabled = on ~= false return true end
	return false
end

function M.fxOff()
	for _, f in ipairs(fxInstances()) do
		if f.inst.Enabled then f.inst.Enabled = false end
	end
end

local EASING = {
	linear = function(u) return u end,
	easeIn = function(u) return u * u end,
	easeOut = function(u) return 1 - (1 - u) * (1 - u) end,
	easeInOut = function(u)
		if u < 0.5 then return 2 * u * u end
		return 1 - ((-2 * u + 2) ^ 2) / 2
	end,
	easeInCubic = function(u) return u * u * u end,
	easeOutCubic = function(u) return 1 - (1 - u) ^ 3 end,
	easeOutBack = function(u)
		local c1, c3 = 1.70158, 2.70158
		return 1 + c3 * (u - 1) ^ 3 + c1 * (u - 1) ^ 2
	end,
	easeOutBounce = function(u)
		local n1, d1 = 7.5625, 2.75
		if u < 1 / d1 then return n1 * u * u
		elseif u < 2 / d1 then u = u - 1.5 / d1 return n1 * u * u + 0.75
		elseif u < 2.5 / d1 then u = u - 2.25 / d1 return n1 * u * u + 0.9375
		else u = u - 2.625 / d1 return n1 * u * u + 0.984375 end
	end,
	easeOutElastic = function(u)
		if u == 0 or u == 1 then return u end
		local c4 = (2 * math.pi) / 3
		return 2 ^ (-10 * u) * math.sin((u * 10 - 0.75) * c4) + 1
	end,
}

local function findAnim(name)
	for _, a in ipairs(ANIMS) do
		if a.name == name then return a end
	end
	error("[HyperBloxAnim] animation inconnue : " .. tostring(name))
end

local function targetParts(targetName)
	local inst = model:FindFirstChild(targetName, true)
	local parts = {}
	if inst then
		if inst:IsA("BasePart") then
			table.insert(parts, inst)
		else
			for _, d in ipairs(inst:GetDescendants()) do
				if d:IsA("BasePart") then table.insert(parts, d) end
			end
		end
	end
	return parts
end

-- Capture la pose de base UNE FOIS, pour toutes les tracks — à faire
-- pendant que le modèle est dans sa pose construite.
local function ensureCapture()
	if bases then return end
	originCF = model.PrimaryPart.CFrame
	local ok, s = pcall(function() return model:GetScale() end)
	echelle = (ok and type(s) == "number" and s > 0) and s or 1
	bases = {}
	for _, a in ipairs(ANIMS) do
		for _, tr in ipairs(a.tracks) do
			if not bases[tr] then
				local parts = targetParts(tr.target)
				local cfs = {}
				-- Poses de base RELATIVES au Root, et non absolues : c'est ce qui
				-- laisse le modèle bouger pendant la lecture.
				for i, p in ipairs(parts) do cfs[i] = originCF:Inverse() * p.CFrame end
				bases[tr] = { parts = parts, cframes = cfs }
			end
		end
	end
end

local function sampleTrack(tr, t)
	local kfs = tr.keyframes
	local function val(kf)
		return kf.rotation or { 0, 0, 0 }, kf.position or { 0, 0, 0 }
	end
	if t <= kfs[1].t then return val(kfs[1]) end
	if t >= kfs[#kfs].t then return val(kfs[#kfs]) end
	local i = 1
	while i < #kfs - 1 and t >= kfs[i + 1].t do i = i + 1 end
	local ar, ap = val(kfs[i])
	local br, bp = val(kfs[i + 1])
	local u = (t - kfs[i].t) / (kfs[i + 1].t - kfs[i].t)
	local e = (EASING[kfs[i].easing or "easeInOut"] or EASING.easeInOut)(u)
	local rot, pos = {}, {}
	for k = 1, 3 do
		rot[k] = ar[k] + (br[k] - ar[k]) * e
		pos[k] = ap[k] + (bp[k] - ap[k]) * e
	end
	return rot, pos
end

-- transform d'une track à t : T(pivot+pos) * R * T(-pivot), exprimé dans le
-- repère du Root — identique au wrapper de pivot de preview.html
local function trackTransform(tr, t)
	local rot, pos = sampleTrack(tr, t)
	local pv = tr.pivot
	local e = echelle
	local T = CFrame.new((pv[1] + pos[1]) * e, (pv[2] + pos[2]) * e, (pv[3] + pos[3]) * e)
		* CFrame.fromEulerAnglesXYZ(math.rad(rot[1]), math.rad(rot[2]), math.rad(rot[3]))
		* CFrame.new(-pv[1] * e, -pv[2] * e, -pv[3] * e)
	return T
end

local function apply(anim, t)
	-- une part touchée par plusieurs tracks reçoit le produit des transforms
	-- dans l'ordre du JSON (track de groupe avant track de part imbriquée)
	local perPart, baseOf = {}, {}
	for _, tr in ipairs(anim.tracks) do
		local T = trackTransform(tr, t)
		local b = bases[tr]
		for i, p in ipairs(b.parts) do
			if perPart[p] then
				perPart[p] = perPart[p] * T
			else
				perPart[p] = T
				baseOf[p] = b.cframes[i]
			end
		end
	end
	-- Le repère est relu À CHAQUE IMAGE sur le Root : déplacer le modèle suffit
	-- à emmener l'animation avec lui, sans rien recapturer.
	local racine = model.PrimaryPart.CFrame
	for p, T in pairs(perPart) do
		p.CFrame = racine * T * baseOf[p]
	end
	applyFx(anim.name, t)
end

-- Les parts qu'une animation fait bouger. Utile à qui déplace un modèle en
-- cours de lecture : celles-là doivent être ANCRÉES (le player leur écrit un
-- CFrame absolu à chaque image), les autres se soudent au support qui porte le
-- modèle. Souder une part animée, c'est la faire trembler entre deux maîtres.
function M.parts(name)
	local out, vus = {}, {}
	for _, tr in ipairs(findAnim(name).tracks) do
		for _, p in ipairs(targetParts(tr.target)) do
			if not vus[p] then
				vus[p] = true
				table.insert(out, p)
			end
		end
	end
	return out
end

function M.list()
	local names = {}
	for _, a in ipairs(ANIMS) do table.insert(names, a.name) end
	return names
end

function M.stop()
	if conn then conn:Disconnect() conn = nil end
	M.fxOff()
end

function M.sample(name, t)
	ensureCapture()
	M.stop()
	local anim = findAnim(name)
	apply(anim, math.clamp(t, 0, anim.duration))
end

function M.reset()
	M.stop()
	if not bases then return end
	local racine = model.PrimaryPart.CFrame
	for _, b in pairs(bases) do
		for i, p in ipairs(b.parts) do p.CFrame = racine * b.cframes[i] end
	end
end

function M.play(name, opts)
	opts = opts or {}
	ensureCapture()
	M.stop()
	local anim = findAnim(name)
	local speed = opts.speed or 1
	local loop = opts.loop
	if loop == nil then loop = anim.loop end
	local t = 0
	apply(anim, 0)
	conn = RunService.Heartbeat:Connect(function(dt)
		t = t + dt * speed
		if t >= anim.duration then
			if loop then
				t = t % anim.duration
			else
				apply(anim, anim.duration)
				M.stop()
				if opts.onComplete then opts.onComplete() end
				return
			end
		end
		apply(anim, t)
	end)
end

return M
]==]
animModule.Parent = model

model.Parent = CONFIG.PARENT

if CONFIG.RANGER_SOURCE and not source:IsDescendantOf(ServerStorage) then
	source.Parent = ServerStorage
end

if #suspectes > 0 then
	warn("[HyperBlox] proportions inattendues sur : " .. table.concat(suspectes, ", ") ..
		"\n  Le mesh importé n'a pas la forme mesurée dans Blender — conversion " ..
		"d'axes ou export partiel. Voir references/pipeline-mesh.md § Calibration.")
end

print(("[HyperBlox] %s assemblé : %d MeshParts, %s studs, 1 animation(s) — require(model.HyperBloxAnim).play(\"Ouvrir\")"):format(
	MODEL_NAME, #PIECES, "3 x 4.4 x 2"))

return true
