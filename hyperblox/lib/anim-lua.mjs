/* HyperBloxAnim — generation du ModuleScript player d'animations.
 *
 * Partage entre les deux pipelines, pour qu'il n'existe qu'UN player :
 *   - hyperblox/scripts/build.mjs                  (modele en Parts)
 *   - hyperblox-blender/scripts/assemble.mjs       (modele en MeshParts)
 *
 * Le player ne connait que des noms : une track vise un groupe (sous-Model) ou
 * une part par son nom, et lui ecrit un CFrame absolu. Une MeshPart et une Part
 * lui sont donc parfaitement equivalentes.
 */

const fmt = n => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};
const luaStr = s => '"' + String(s).replace(/[\\"]/g, m => "\\" + m) + '"';

function jsonToLua(v, indent) {
  const pad = "\t".repeat(indent), pad1 = "\t".repeat(indent + 1);
  if (Array.isArray(v)) {
    if (v.every(x => typeof x === "number")) return "{" + v.map(fmt).join(", ") + "}";
    return "{\n" + v.map(x => pad1 + jsonToLua(x, indent + 1)).join(",\n") + ",\n" + pad + "}";
  }
  if (v && typeof v === "object") {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    // les clés libres (noms d'animation dans `windows`) ne sont pas toujours des
    // identifiants Lua valides — les mettre entre crochets au besoin
    const luaKey = k => (/^[A-Za-z_]\w*$/.test(k) ? k : "[" + luaStr(k) + "]");
    return "{\n" + entries.map(([k, x]) => pad1 + luaKey(k) + " = " + jsonToLua(x, indent + 1)).join(",\n") + ",\n" + pad + "}";
  }
  if (typeof v === "string") return luaStr(v);
  if (typeof v === "number") return fmt(v);
  return String(v);
}

/** Source Lua du ModuleScript, ou null si le modele n'a pas d'animation. */
export function sourceAnimLua(model) {
  if (!model.animations || !model.animations.length) return null;
  const animsForLua = model.animations.map(a => ({
    name: a.name, duration: a.duration, loop: !!a.loop,
    tracks: a.tracks.map(tr => ({
      target: tr.target, pivot: tr.pivot || [0, 0, 0],
      keyframes: tr.keyframes.map(kf => ({
        t: kf.t, rotation: kf.rotation, position: kf.position, easing: kf.easing
      }))
    }))
  }));
  const animSrc = `-- HyperBloxAnim — player d'animations généré depuis model.json.
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

local ANIMS = ${jsonToLua(animsForLua, 0)}

-- émetteurs de particules pilotés par les animations : { nom, fenêtres [tOn, tOff] }
local FX = ${jsonToLua((model.emitters || []).filter(e => e.windows && Object.keys(e.windows).length)
  .map(e => ({ name: e.name, windows: e.windows })), 0)}

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
`;
  if (animSrc.includes("]==]")) {
    throw new Error("Le module d'animation contient la séquence de fermeture du long string Lua — impossible de l'embarquer.");
  }
  return animSrc;
}

/** Le bloc Lua qui cree le ModuleScript sous `model`, ou null si pas d'animation. */
export function blocAnimLua(model, parentVar = "model") {
  const animSrc = sourceAnimLua(model);
  if (!animSrc) return null;
  return `
local animModule = Instance.new("ModuleScript")
animModule.Name = "HyperBloxAnim"
animModule.Source = [==[
${animSrc}]==]
animModule.Parent = ${parentVar}`;
}
