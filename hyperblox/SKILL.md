---
name: hyperblox
description: >
  Image → modèle 3D Roblox low-poly (style studio). Comme HyperFrames pour la vidéo :
  un model.json (liste de Parts + animations keyframes) est la source de vérité, un
  preview.html 3D interactif sert de maquette à valider avec l'utilisateur (lecture des
  animations incluse), puis un build.lua généré depuis le même JSON construit le modèle
  dans Roblox Studio (barre de commande ou MCP run_code) avec un player d'animations Lua.
  Utiliser pour : créer un objet/prop/modèle 3D Roblox depuis une image, une description
  ou un concept ; animer un modèle (porte, couvercle, rotation…) ; itérer sur un modèle
  HyperBlox existant ; regénérer preview/build.
user-invocable: true
---

# HyperBlox — image → maquette HTML → modèle Roblox

Pipeline en trois artefacts, tous dans le dossier du modèle :

```
hyperblox/<slug>/
  model.json     ← SOURCE DE VÉRITÉ : liste de Parts + animations keyframes
  preview.html   ← généré : viewer 3D autonome (maquette à valider, animations jouables)
  build.lua      ← généré : construit le modèle dans Studio, idempotent ;
                   embarque le ModuleScript HyperBloxAnim si le modèle a des animations
```

**Ne jamais éditer `preview.html` ou `build.lua` à la main** — toujours modifier
`model.json` puis regénérer. Ce que la préview montre est ce que Studio construit
(mêmes conventions géométriques des deux côtés).

## Lectures obligatoires avant d'écrire un model.json

- `references/part-schema.md` — schéma JSON, axes, conventions Wedge/Cylinder,
  matériaux autorisés, pivot au sol.
- `references/style-lowpoly.md` — lecture d'image, budget de parts, palette,
  règles anti z-fighting, échelle en studs.
- `references/animations.md` — **si le modèle doit bouger** : schéma des tracks
  keyframes, pivots, easings, recettes (porte, couvercle, tiroir, rotation),
  API du player Lua.
- `examples/treasure-chest/model.json` — exemple complet et déjà validé
  (dont animations de couvercle).

## Workflow

### 1. Cadrer

Entrées : un **nom**, si possible une **taille cible en studs**, et l'une des
trois sources de référence :

1. **Une image fournie** par l'utilisateur → l'utiliser directement.
2. **Un texte seul** → modéliser depuis la description (silhouette → masses →
   détails, cf. style-lowpoly), en l'annonçant. C'est aussi le repli si la
   génération IA (cas 3) échoue ou n'est pas configurée.
3. **Texte + génération d'image IA** (si `config.json` du skill existe — voir
   § Génération d'image de référence par IA) : générer une image de référence,
   la montrer à l'utilisateur, puis modéliser depuis cette image.

Si la taille manque, la déduire de l'échelle Roblox
(personnage ≈ 5 studs) et l'annoncer. Si l'image contient plusieurs objets,
demander lesquels modéliser — un modèle = un dossier.

**Questions à poser d'emblée** (une seule salve, avant de modéliser — sauter
celles auxquelles la demande répond déjà) :

1. **Livrable** : itérer sur la préview HTML seule d'abord, ou construire dans
   Studio dès la première validation ? (build.lua est généré dans tous les cas,
   mais ne proposer son exécution que si l'utilisateur veut construire —
   beaucoup préfèrent plusieurs allers-retours de préview avant.)
2. **Style** : low-poly studio (défaut, rapide) ou plus détaillé/réaliste
   (budget de parts élevé, plus de passes d'itération) ?
3. **Animations** : si l'utilisateur n'en a pas demandé, lui demander s'il en
   veut une — réponse libre attendue : « non » ou la description de ce qui doit
   bouger. S'il en veut (ou en a déjà demandé) : préciser lesquelles et comment
   elles seront déclenchées en jeu.
4. **Taille cible en studs** si non déductible.

Si le modèle doit s'animer (porte, couvercle, hélice…) : la pose de base est
**l'état au repos** (fermé), et chaque pièce mobile doit être un **groupe**
dédié — l'animation cible des groupes autour d'un pivot (charnière, axe).

### 2. Modéliser

Lire l'image attentivement (silhouette → masses → détails → palette, cf.
style-lowpoly). Créer `hyperblox/<slug>/model.json` à la racine du projet
Roblox, puis générer :

```powershell
node .claude/skills/hyperblox/scripts/build.mjs hyperblox/<slug>
```

Corriger toute erreur de validation et traiter les avertissements
(modèle flottant, dimensions minuscules…).

### 3. Auto-vérifier avant de montrer

Screenshot headless de la préview, à comparer avec l'image source :

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu `
  --no-first-run --disable-background-networking --disable-sync --disable-extensions `
  "--user-data-dir=$env:TEMP\hyperblox-chrome" --window-size=1400,900 `
  --virtual-time-budget=5000 --hide-scrollbars `
  "--screenshot=<chemin-absolu>\shot.png" "file:///<chemin-absolu>/preview.html"
```

Lire le screenshot et s'auto-critiquer (checklist en fin de style-lowpoly) :
silhouette, proportions, palette, parts inutiles. Ajuster le JSON et regénérer
— 2 à 3 passes maximum avant de montrer.

Pour une animation, screenshoter plusieurs temps via les paramètres d'URL
(`preview.html?anim=Nom&t=0.7`) : pose de base à `t=0`, un temps intermédiaire,
pose finale à `t=duration` (détails : `references/animations.md`).

### 4. Valider avec l'utilisateur

Ouvrir la préview dans son navigateur (`Start-Process <chemin>\preview.html`)
et/ou lui montrer le screenshot. La préview est interactive : orbite, zoom,
clic sur une part pour l'inspecter (nom, taille, couleur — l'utilisateur peut
donner ses retours en nommant les parts), et si le modèle a des animations,
un panneau lecture/boucle/scrubber pour les juger image par image. Itérer sur
`model.json` jusqu'au OK.

### 5. Construire dans Roblox

Après validation seulement :

- **MCP Roblox Studio disponible** (`run_code` / `execute_luau`) : proposer
  d'exécuter `build.lua` directement, puis vérifier le résultat en jeu
  (le script `print` un récap `[HyperBlox]`).
- **Sinon** : livrer `build.lua` à coller dans la barre de commande de Studio.

Le script est idempotent (remplace le modèle du même nom dans `workspace`) ;
`CONFIG` en tête permet de changer parent/position/rotation sans regénérer.
Si le modèle a des animations, tester dans Studio juste après le build :
`require(workspace.<Nom>.HyperBloxAnim).play("<Animation>")` (API complète
dans `references/animations.md`).

Premier usage d'un `CornerWedge` : vérifier l'orientation dans Studio vs la
préview (procédure de calibration dans part-schema.md § Calibration).

### 6. Itérer après coup

Toute retouche (« le toit plus foncé », « la serrure plus grosse ») = éditer
`model.json` → regénérer → re-screenshot → re-valider si le changement est
significatif → réexécuter `build.lua` (il remplace l'ancien modèle).

## Génération d'image de référence par IA (optionnel)

Le skill peut générer lui-même l'image de référence depuis un prompt texte, via
une API d'images **compatible OpenAI** (`POST {baseUrl}/images/generations`) :
OpenAI (`gpt-image-1`, `dall-e-3`) ou tout fournisseur compatible (Together,
xAI, fal…) en changeant `baseUrl`.

**Configuration** : copier `config.example.json` vers `config.json` (même
dossier que ce SKILL.md) et renseigner :

```json
{ "imageGen": { "baseUrl": "https://api.openai.com/v1",
                "apiKey": "sk-…", "model": "gpt-image-1", "size": "1024x1024" } }
```

`config.json` contient un secret : ne jamais le committer, ne jamais afficher
la clé en clair dans une réponse.

**Usage** :

```powershell
node .claude/skills/hyperblox/scripts/genimage.mjs hyperblox/<slug> "<prompt>" [--name reference.png] [--size 1024x1024]
```

→ sauvegarde `hyperblox/<slug>/reference.png`, à lire et valider avec
l'utilisateur avant de modéliser (c'est ensuite une image source normale,
à référencer dans `source_image`).

Conseils de prompt pour une référence modélisable : **un seul objet, vue de
trois quarts ou de profil, fond neutre uni**, style simple et lisible.

Logique de décision :
- L'utilisateur demande explicitement la génération IA → l'utiliser (erreur
  claire s'il manque `config.json`).
- Texte seul et `config.json` présent → proposer les deux options (génération
  ou modélisation directe) ; en cas de doute, modélisation directe.
- Échec API (clé invalide, quota, réseau) → le signaler et retomber sur la
  modélisation directe depuis le texte.

## Rappels

- Répondre en français, noms de parts lisibles (français ou anglais, cohérents).
- Le viewer est autonome (Three.js inliné) : aucun serveur, aucun réseau requis.
- Grands ensembles (une zone, une map) : hors périmètre — HyperBlox fait des
  **modèles/props** ; pour le level design, rester sur les scripts de zone
  existants (`generate_zone*.lua`) et le skill `roblox-game`.
