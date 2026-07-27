--------------------------------------------------------------------
-- CoffreAuTresor — généré par HyperBlox depuis model.json
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

local MODEL_NAME = "CoffreAuTresor"

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
root.CFrame = origin

local group1 = Instance.new("Model")
group1.Name = "Caisse"
group1.Parent = model

local group2 = Instance.new("Model")
group2.Name = "Couvercle"
group2.Parent = model

do
	local p = Instance.new("Part")
	p.Name = "Caisse"
	p.Size = Vector3.new(4, 2.2, 2.6)
	p.CFrame = origin * CFrame.new(0, 1.1, 0)
	p.Color = Color3.fromRGB(121, 85, 58)
	p.Material = Enum.Material.SmoothPlastic
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group1
end
do
	local p = Instance.new("Part")
	p.Name = "BandeGauche"
	p.Size = Vector3.new(0.5, 2.3, 2.7)
	p.CFrame = origin * CFrame.new(-1.2, 1.15, 0)
	p.Color = Color3.fromRGB(72, 74, 80)
	p.Material = Enum.Material.Metal
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group1
end
do
	local p = Instance.new("Part")
	p.Name = "BandeDroite"
	p.Size = Vector3.new(0.5, 2.3, 2.7)
	p.CFrame = origin * CFrame.new(1.2, 1.15, 0)
	p.Color = Color3.fromRGB(72, 74, 80)
	p.Material = Enum.Material.Metal
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group1
end
do
	local p = Instance.new("Part")
	p.Name = "PoigneeGauche"
	p.Shape = Enum.PartType.Cylinder
	p.Size = Vector3.new(0.8, 0.3, 0.3)
	p.CFrame = origin * CFrame.new(-2.15, 1.5, 0) * CFrame.fromEulerAnglesXYZ(math.rad(0), math.rad(90), math.rad(0))
	p.Color = Color3.fromRGB(212, 175, 55)
	p.Material = Enum.Material.Metal
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group1
end
do
	local p = Instance.new("Part")
	p.Name = "PoigneeDroite"
	p.Shape = Enum.PartType.Cylinder
	p.Size = Vector3.new(0.8, 0.3, 0.3)
	p.CFrame = origin * CFrame.new(2.15, 1.5, 0) * CFrame.fromEulerAnglesXYZ(math.rad(0), math.rad(90), math.rad(0))
	p.Color = Color3.fromRGB(212, 175, 55)
	p.Material = Enum.Material.Metal
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group1
end
do
	local p = Instance.new("Part")
	p.Name = "Couvercle"
	p.Size = Vector3.new(4.2, 0.5, 2.8)
	p.CFrame = origin * CFrame.new(0, 2.45, 0)
	p.Color = Color3.fromRGB(98, 66, 44)
	p.Material = Enum.Material.SmoothPlastic
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group2
end
do
	local p = Instance.new("Part")
	p.Name = "CouvercleHaut"
	p.Size = Vector3.new(4.2, 0.5, 1.6)
	p.CFrame = origin * CFrame.new(0, 2.95, 0)
	p.Color = Color3.fromRGB(98, 66, 44)
	p.Material = Enum.Material.SmoothPlastic
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group2
end
do
	local p = Instance.new("WedgePart")
	p.Name = "PenteAvant"
	p.Size = Vector3.new(4.2, 0.5, 0.6)
	p.CFrame = origin * CFrame.new(0, 2.95, -1.1)
	p.Color = Color3.fromRGB(98, 66, 44)
	p.Material = Enum.Material.SmoothPlastic
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group2
end
do
	local p = Instance.new("WedgePart")
	p.Name = "PenteArriere"
	p.Size = Vector3.new(4.2, 0.5, 0.6)
	p.CFrame = origin * CFrame.new(0, 2.95, 1.1) * CFrame.fromEulerAnglesXYZ(math.rad(0), math.rad(180), math.rad(0))
	p.Color = Color3.fromRGB(98, 66, 44)
	p.Material = Enum.Material.SmoothPlastic
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group2
end
do
	local p = Instance.new("Part")
	p.Name = "BandeCouvercleGauche"
	p.Size = Vector3.new(0.5, 0.55, 2.85)
	p.CFrame = origin * CFrame.new(-1.2, 2.45, 0)
	p.Color = Color3.fromRGB(72, 74, 80)
	p.Material = Enum.Material.Metal
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group2
end
do
	local p = Instance.new("Part")
	p.Name = "BandeCouvercleDroite"
	p.Size = Vector3.new(0.5, 0.55, 2.85)
	p.CFrame = origin * CFrame.new(1.2, 2.45, 0)
	p.Color = Color3.fromRGB(72, 74, 80)
	p.Material = Enum.Material.Metal
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group2
end
do
	local p = Instance.new("Part")
	p.Name = "Serrure"
	p.Size = Vector3.new(0.8, 0.7, 0.25)
	p.CFrame = origin * CFrame.new(0, 2.35, -1.5)
	p.Color = Color3.fromRGB(212, 175, 55)
	p.Material = Enum.Material.Metal
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group2
end
do
	local p = Instance.new("Part")
	p.Name = "TrouSerrure"
	p.Size = Vector3.new(0.3, 0.3, 0.1)
	p.CFrame = origin * CFrame.new(0, 2.3, -1.62)
	p.Color = Color3.fromRGB(40, 32, 20)
	p.Material = Enum.Material.SmoothPlastic
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = group2
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

local RunService = game:GetService("RunService")

local ANIMS = {
	{
		name = "Ouvrir",
		duration = 1,
		loop = false,
		tracks = {
			{
				target = "Couvercle",
				pivot = {0, 2.2, 1.3},
				keyframes = {
					{
						t = 0,
						rotation = {0, 0, 0},
						easing = "easeOutBack",
					},
					{
						t = 1,
						rotation = {75, 0, 0},
					},
				},
			},
		},
	},
	{
		name = "Fermer",
		duration = 0.7,
		loop = false,
		tracks = {
			{
				target = "Couvercle",
				pivot = {0, 2.2, 1.3},
				keyframes = {
					{
						t = 0,
						rotation = {75, 0, 0},
						easing = "easeIn",
					},
					{
						t = 0.5,
						rotation = {0, 0, 0},
						easing = "easeOut",
					},
					{
						t = 0.6,
						rotation = {6, 0, 0},
						easing = "easeInOut",
					},
					{
						t = 0.7,
						rotation = {0, 0, 0},
					},
				},
			},
		},
	},
}

local model = script.Parent
local M = {}
local conn = nil
local bases = nil
local originCF = nil

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
	bases = {}
	for _, a in ipairs(ANIMS) do
		for _, tr in ipairs(a.tracks) do
			if not bases[tr] then
				local parts = targetParts(tr.target)
				local cfs = {}
				for i, p in ipairs(parts) do cfs[i] = p.CFrame end
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

-- transform d'une track à t : T(pivot+pos) * R * T(-pivot), conjugué par
-- l'origine du modèle — identique au wrapper de pivot de preview.html
local function trackTransform(tr, t)
	local rot, pos = sampleTrack(tr, t)
	local pv = tr.pivot
	local T = CFrame.new(pv[1] + pos[1], pv[2] + pos[2], pv[3] + pos[3])
		* CFrame.fromEulerAnglesXYZ(math.rad(rot[1]), math.rad(rot[2]), math.rad(rot[3]))
		* CFrame.new(-pv[1], -pv[2], -pv[3])
	return originCF * T * originCF:Inverse()
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
	for p, T in pairs(perPart) do
		p.CFrame = T * baseOf[p]
	end
end

function M.list()
	local names = {}
	for _, a in ipairs(ANIMS) do table.insert(names, a.name) end
	return names
end

function M.stop()
	if conn then conn:Disconnect() conn = nil end
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
	for _, b in pairs(bases) do
		for i, p in ipairs(b.parts) do p.CFrame = b.cframes[i] end
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
print(("[HyperBlox] %s construit : %d parts, %s studs, 2 animation(s) — require(model.HyperBloxAnim).play(\"Ouvrir\")"):format(
	MODEL_NAME, 13, "4.6 x 3.2 x 3.095"))
