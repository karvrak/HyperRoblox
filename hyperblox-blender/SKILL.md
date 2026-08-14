---
name: hyperblox-blender
description: >
  Image ou description → modèle 3D Roblox en MeshParts, modelé dans Blender via le MCP Blender.
  Un générateur Python `gen-<slug>.py` est la source de vérité, le viewport Blender sert de
  maquette à valider avec l'utilisateur, un export FBX + `manifest.json` traverse vers Studio,
  et un `assemble.lua` généré redonne à chaque MeshPart sa taille, sa position, sa couleur et
  ses animations exactes. Utiliser quand le modèle demande des VRAIES surfaces courbes,
  organiques ou lisses (créature, casque, véhicule, sculpture, terrain d'objet), quand la
  version en Parts assemblées ne suffit plus, ou quand l'utilisateur demande explicitement
  Blender. Pour un prop géométrique, un objet animé simple ou un mob instancié en masse,
  rester sur le skill `hyperblox` (Parts natives).
user-invocable: true
---

# HyperBlox Blender — Blender → MeshParts Roblox

Le grand frère du skill `hyperblox`. Même philosophie — **un générateur est la
source de vérité, une maquette se valide avant de construire, la sortie Studio
est générée depuis les mêmes données** — mais le volume est fait par un vrai
moteur de mesh au lieu d'un assemblage de primitives.

```
hyperblox/<slug>/
  gen-<slug>.py      ← SOURCE DE VÉRITÉ : le script Blender (bpy + lib/hyperblox.py)
  <slug>.blend       ← état Blender, sauvegardé par le générateur
  <slug>.fbx         ← généré : un objet par pièce, à importer dans Studio
  manifest.json      ← généré : ce que Blender a MESURÉ (studs, repère Roblox)
  assemble.lua       ← généré depuis le manifest : habille et pose les MeshParts
```

**Ne jamais éditer `manifest.json`, `<slug>.fbx` ou `assemble.lua` à la main** —
modifier `gen-<slug>.py`, réexécuter dans Blender, relancer `assemble.mjs`.

## Ce que ce skill résout, et ce qu'il coûte

| | `hyperblox` (Parts) | `hyperblox-blender` (MeshParts) |
|---|---|---|
| Volume | assemblé à partir de Block/Wedge/Cylinder/Ball | maillage libre : courbe continue, congé, galbe, surface lisse |
| Retouche | changer une couleur = éditer une ligne du JSON | changer une couleur = réexporter le FBX ? **non** : couleur, matériau et position se retouchent dans le manifest sans retoucher au mesh |
| Boucle | secondes (`build.mjs` → préview HTML) | minutes (Blender → FBX → import manuel dans Studio) |
| Poids en jeu | N parts | N MeshParts, chacune avec son mesh à streamer |
| Import dans Studio | copier-coller un script | **passage manuel obligatoire** par l'Importateur 3D |
| Animations | player `HyperBloxAnim` | **le même player**, mêmes keyframes, mêmes easings |

Le point qui décide, presque toujours : **est-ce qu'une arête vive est un
défaut ?** Une caisse, une borne, un lampadaire, un coffre : non — `hyperblox`
est plus rapide et plus modifiable. Un casque, un poisson, une aile de voiture,
une racine, un heaume : oui — et là aucun empilement de cubes ne rattrapera un
congé de 2 cm.

Quand l'utilisateur hésite, poser la question franchement plutôt que de deviner :
le coût du choix se paie sur la boucle d'itération, pas sur le rendu final.

## Prérequis — à vérifier AVANT de promettre quoi que ce soit

Le MCP Blender ne suffit pas : il faut que **Blender tourne**, que l'addon
BlenderMCP y soit installé, et que « Connect to Claude » ait été cliqué dans le
panneau latéral de la vue 3D. Tant que ce n'est pas fait, tous les appels
échouent sur une erreur de connexion.

Premier appel de toute session, comme diagnostic :

```
mcp__blender__get_scene_info(user_prompt: "vérification de la connexion")
```

Si ça échoue, ne pas insister : dérouler `references/setup-mcp.md` avec
l'utilisateur, puis reprendre. **Ne jamais** relancer trois fois le même appel
en espérant qu'il passe.

## Lectures obligatoires

- `references/setup-mcp.md` — installer et connecter le MCP, l'inventaire des
  outils, et les pièges qui font perdre une demi-heure (le `user_prompt`
  obligatoire, les 180 s de timeout, les dialogues modaux qui figent Blender).
- `references/pipeline-mesh.md` — **le cœur** : découpage en pièces, limites
  Roblox, schéma du `manifest.json`, procédure d'import dans Studio, et la
  calibration à faire une fois.
- `references/blender-python.md` — le vocabulaire de `lib/hyperblox.py` et les
  recettes de modélisation propres (biseau, miroir, révolution, booléen…),
  plus les erreurs classiques de `bpy` en contexte MCP.
- `references/organique.md` — **obligatoire pour toute créature, monstre ou
  animal** : la méthode squelette → fusion voxel → sculpture → facettes.
  L'assemblage de primitives (sphère + cylindres) y est proscrit — il produit
  un bonhomme de neige, jamais une créature.
- `../hyperblox/references/animations.md` — **si le modèle doit bouger** : le
  player est le même, le schéma des tracks est le même.
- `../hyperblox/references/style-detaille.md` § Lire l'image en formes — la
  méthode de lecture d'image vaut exactement pareil ici ; seule la primitive
  de sortie change.

## Workflow

### 1. Cadrer

Entrées : un **nom**, une **taille cible en studs** (personnage ≈ 5 studs), et
une référence — image fournie, description, ou image générée par IA (le script
`../hyperblox/scripts/genimage.mjs` marche tel quel, avec la `config.json` du
skill `hyperblox`).

Questions à poser en une seule salve, en sautant celles auxquelles la demande
répond déjà :

1. **Blender ou Parts ?** — si la demande n'a pas tranché, et que l'objet est
   géométrique, proposer `hyperblox` : c'est cinq fois plus rapide à itérer.
2. **Découpage en pièces** : rappeler qu'une MeshPart porte **une seule
   couleur** (pas de texture dans ce pipeline v1). Un modèle à six teintes est
   un modèle à six pièces minimum. Si l'utilisateur veut une vraie texture
   peinte, le dire tout de suite : ce n'est pas couvert (cf. § Limites).
3. **Animations** : lesquelles, et déclenchées comment en jeu. Chaque pièce
   mobile devient un `groupe`.
4. **Destination** : combien d'exemplaires à l'écran ? Un boss unique autorise
   50 000 triangles ; un mob de meute posé à trente exemplaires, non.

### 2. Écrire le générateur

Écrire `hyperblox/<slug>/gen-<slug>.py` **sur le disque** (avec Write), pas dans
le corps d'un appel MCP : c'est la source de vérité, elle se relit et se diffe.

Squelette :

```python
import hyperblox as hb

DOSSIER = r"D:/mon-jeu/hyperblox/casque-garde"
hb.scene("CasqueGarde", DOSSIER)          # 1 unité Blender = 1 stud

# --- le crâne : une révolution, biseautée, lissée
crane = hb.revolution("Crane", [(0.0, 1.30), (0.55, 1.15), (0.72, 0.55), (0.70, 0.0)])
hb.biseau(crane, 0.02)
hb.piece(crane, couleur=(96, 102, 112), materiau="Metal", groupe="Casque")

# --- la visière : une nappe épaissie, en miroir
...

hb.rapport()
hb.export()
hb.sauver()
```

Puis l'exécuter dans Blender, en le lisant **depuis le disque** — le générateur
reste la référence, et on évite de renvoyer 300 lignes par le socket à chaque
itération :

```python
# via mcp__blender__execute_blender_code
import sys, importlib
LIB = r"<chemin absolu>/.claude/skills/hyperblox-blender/lib"
if LIB not in sys.path: sys.path.insert(0, LIB)
import hyperblox as hb; importlib.reload(hb)
GEN = r"D:/mon-jeu/hyperblox/casque-garde/gen-casque-garde.py"
exec(compile(open(GEN, encoding="utf-8").read(), GEN, "exec"))
```

`importlib.reload(hb)` n'est pas décoratif : sans lui, Blender garde en mémoire
la version du module chargée au premier appel, et les corrections apportées à
`lib/hyperblox.py` n'ont aucun effet — on débogue alors du code qui ne tourne pas.

### 3. Auto-vérifier avant de montrer

`hb.rapport()` donne les triangles et les dimensions ; le viewport donne la
forme :

```
hb.vue("face")    → mcp__blender__get_viewport_screenshot(max_size: 1000, user_prompt: "…")
hb.vue("profil")  → …
hb.vue("3q")      → …
```

⚠ **Une silhouette se juge de FACE et de PROFIL, à plat.** Régler une forme en
ne regardant qu'un trois-quarts est le meilleur moyen de tourner en rond : on y
voit le détail, jamais la ligne d'ensemble. Sortir face et profil à chaque
itération, et ne juger le détail qu'une fois la ligne bonne.

Lire les captures et s'auto-critiquer **contre l'image source** : silhouette,
rapports de proportions, palette, surfaces qui devraient être continues et qui
facettent (monter les segments), pièces invisibles. Corriger le générateur,
relancer — 2 à 3 passes avant de montrer.

### 4. Valider avec l'utilisateur

Blender est ouvert devant lui : c'est la maquette, en mieux que n'importe quel
viewer HTML. Lui montrer les captures, lui demander de tourner autour, itérer
sur le générateur jusqu'au OK.

**Valider la forme AVANT d'exporter.** Un aller-retour Blender coûte quelques
secondes ; un aller-retour qui passe par un import Studio coûte plusieurs
minutes et une manipulation manuelle de l'utilisateur.

### 5. Exporter

`hb.export()` écrit le FBX et le `manifest.json`. Puis, côté machine :

```powershell
node .claude/skills/hyperblox-blender/scripts/assemble.mjs hyperblox/<slug>
```

Il valide le manifest (noms utilisables par le 3D Importer, matériaux, budget
de triangles, cibles d'animations, pose au sol) et écrit `assemble.lua`.
Corriger toute erreur **dans le générateur**, pas dans le manifest.

### 6. Importer dans Studio, puis assembler

L'import du FBX **ne peut pas être automatisé** : l'Importateur 3D est une
fenêtre de Studio, aucun outil MCP ne la pilote. C'est le seul geste manuel du
pipeline. Donner à l'utilisateur les instructions exactes :

> 1. Studio → onglet **Avatar** (ou **Modèle**) → **Importateur 3D**
> 2. choisir `<chemin>/<slug>.fbx`
> 3. dans le panneau de droite : **décocher « Merge Meshes »**, **cocher « Anchored »**
> 4. **Importer** — un Model apparaît dans `workspace`

Puis exécuter `assemble.lua` (MCP Roblox Studio `run_code`/`execute_luau`, ou
collé dans la barre de commande). Il retrouve les MeshParts **par leur nom**,
leur impose la taille et la position mesurées dans Blender, les habille, monte
les groupes, embarque le player d'animations, et range l'import dans
`ServerStorage`. Réexécutable sans risque.

Détail de ce qui peut mal se passer à l'import, et comment le lire :
`references/pipeline-mesh.md` § Import et § Calibration.

### 7. Itérer après coup

| Ce qui change | Ce qu'il faut refaire |
|---|---|
| couleur, matériau, transparence, collision | éditer le générateur → réexporter → `assemble.mjs` → relancer `assemble.lua`. **Pas de réimport du FBX** : le mesh n'a pas bougé. |
| position, taille d'une pièce | idem — le manifest suffit, tant que la géométrie est la même |
| la forme elle-même | générateur → export → **réimport du FBX** → `assemble.lua` |
| une animation | générateur (ou le manifest) → `assemble.mjs` → relancer `assemble.lua` |

Cette asymétrie est la principale économie du pipeline : **l'habillage ne passe
pas par Studio**. Une session de réglage de couleurs ne demande pas un seul
import.

## Limites connues

- **Pas de textures ni de PBR.** Une pièce = une couleur unie + un matériau
  Roblox. Peindre une texture demanderait de téléverser des images comme assets
  (impossible depuis un script), puis de poser une `SurfaceAppearance`. Si
  l'utilisateur veut une texture peinte, le dire d'emblée plutôt que de le
  découvrir à l'import.
- **L'import FBX est manuel.** Voir § 6. L'automatiser demanderait une clé
  Open Cloud et un compte configuré : hors périmètre pour l'instant, piste
  décrite dans `references/pipeline-mesh.md` § Automatiser l'import.
- **20 000 triangles par MeshPart**, plafond dur côté Roblox. `hb.rapport()`
  prévient bien avant.
- **Pas de rig Motor6D ni d'armature.** Comme dans `hyperblox`, les animations
  déplacent des pièces ancrées par CFrame : parfait pour une porte, un capot,
  une aile, un membre articulé ; pas pour un personnage à animer dans l'éditeur
  d'animation Roblox.
- **Un modèle, pas une map.** Pour le level design, rester sur les scripts de
  zone et le skill `roblox-game`.

## Rappels

- Répondre en français ; noms de pièces en ASCII sans espace
  (`[A-Za-z][A-Za-z0-9_]*`) — le 3D Importer réécrit tout le reste, et
  l'assemblage retrouve les MeshParts par leur nom.
- Blender : Z en haut. Roblox : Y en haut. La conversion `(x, y, z) → (x, z, -y)`
  est faite une seule fois, par `lib/hyperblox.py`, à l'export. Ne jamais la
  refaire à la main dans un générateur.
- Modéliser l'objet **tourné vers +Y dans Blender** pour qu'il regarde vers
  l'avant (-Z) dans Roblox.
- Sauvegarder le `.blend` (`hb.sauver()`) : le générateur reste la source de
  vérité, mais l'utilisateur veut pouvoir ouvrir le fichier et regarder.
