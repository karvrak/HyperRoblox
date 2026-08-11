---
name: hyperblox
description: >
  Image → modèle 3D Roblox détaillé, fidèle à l'image source. Comme HyperFrames pour la vidéo :
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

## Deux modes, deux méthodes

| | **Détaillé** (défaut) | **Low-poly** (sur demande) |
|---|---|---|
| Pour | tout — l'objectif est de **reproduire l'image source**, courbes et galbes compris | rendu stylisé demandé explicitement, ou mob instancié en masse |
| Budget | 40 à 3000 parts selon le sujet (aucun plafond Roblox — voir `style-detaille.md` § Budget) | 5 à 35 parts |
| Source de vérité | un **générateur** `gen-<slug>.mjs` qui produit le `model.json` | `model.json` écrit à la main |
| Guide | `references/style-detaille.md` | `references/style-lowpoly.md` |

**Le détaillé est le défaut** : on ne livre plus de « tas de cubes ». Le
low-poly ne se choisit que si l'utilisateur demande un rendu minimaliste, ou
pour une créature de meute affichée par dizaines.

En détaillé, on n'écrit pas le `model.json` à la main (au-delà de ~80 parts,
plus rien n'est **modifiable** — changer l'angle d'une aile demanderait de
recalculer trente positions, donc on ne le fait pas, donc le modèle se fige
sur sa première version). Le générateur rend la proportion modifiable, c'est
là son intérêt, pas la vitesse d'écriture.

## Lectures obligatoires avant d'écrire un model.json

- `references/part-schema.md` — schéma JSON, axes, conventions Wedge/Cylinder,
  matériaux autorisés, pivot au sol.
- `references/style-detaille.md` — **le guide du mode par défaut** : lecture de
  l'image en familles de formes (le Block en dernier), inventaire de formes,
  primitives de `lib/volume.mjs` (révolution, tore, nappe, chanfrein, fuseau,
  membrane, plumes, écailles, miroir), pièges du miroir d'Euler et des surfaces
  coplanaires, budget par nombre d'exemplaires à l'écran.
- `references/style-lowpoly.md` — **seulement si le low-poly est demandé** :
  lecture d'image simplifiée, budget 5-35 parts, palette, échelle en studs.
- `references/animations.md` — **si le modèle doit bouger** : schéma des tracks
  keyframes, pivots, easings, recettes (porte, couvercle, tiroir, rotation),
  API du player Lua, et le schéma des `emitters` (particules Roblox).
- `references/finition.md` — **avant de construire dans Studio** : le catalogue
  des défauts géométriques et la passe qui les rattrape.
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
2. **Style** : le détaillé/fidèle à l'image est le défaut — ne PAS poser la
   question, sauf si le modèle est destiné à être instancié en masse (mob de
   meute) ou si la demande évoque un rendu minimaliste : dans ces deux cas
   seulement, proposer le low-poly.
3. **Animations** : si l'utilisateur n'en a pas demandé, lui demander s'il en
   veut une — réponse libre attendue : « non » ou la description de ce qui doit
   bouger. S'il en veut (ou en a déjà demandé) : préciser lesquelles et comment
   elles seront déclenchées en jeu.
4. **Taille cible en studs** si non déductible.

Si le modèle doit s'animer (porte, couvercle, hélice…) : la pose de base est
**l'état au repos** (fermé), et chaque pièce mobile doit être un **groupe**
dédié — l'animation cible des groupes autour d'un pivot (charnière, axe).

### 2. Modéliser

Lire l'image en **familles de formes**, pas en boîtes : silhouette → masses →
pour chaque masse, sa primitive (`style-detaille.md` § Lire l'image en formes ;
le Block nu est le dernier recours). Écrire l'**inventaire de formes** (masse →
primitive → budget), mesurer 4-5 rapports de proportions sur l'image, puis
écrire le générateur `gen-<slug>.mjs` dans `hyperblox/<slug>/` et générer le
`model.json`. (En low-poly demandé explicitement : lecture simplifiée cf.
style-lowpoly, `model.json` à la main.) Puis :

```powershell
node .claude/skills/hyperblox/scripts/build.mjs hyperblox/<slug>
```

Corriger toute erreur de validation et traiter les avertissements
(modèle flottant, dimensions minuscules…).

### 3. Auto-vérifier avant de montrer

Captures de contrôle de la préview, à comparer avec l'image source :

```powershell
node .claude/skills/hyperblox/scripts/shots.mjs hyperblox/<famille>/<slug>
node .claude/skills/hyperblox/scripts/shots.mjs hyperblox/<famille>/<slug> --vue face
node .claude/skills/hyperblox/scripts/shots.mjs hyperblox/<famille>            # tout un lot
```

Le script pose le PNG à côté du `model.json` (`shot-3q.png`, `shot-face.png`…).
**Passer par lui plutôt que par Chrome à la main** : il règle trois pièges qui
se paient comptant — l'encodage des espaces du chemin (sans quoi Chrome sort en
code 13, sans message et sans fichier), le **cache disque** (Chrome resert un
`file://` déjà vu, et la capture montre l'ancien modèle en affichant fièrement
son ancien nombre de parts), et la vérification que le PNG a bien été
**réécrit** — sinon on relit tranquillement la capture d'avant.

Lire le screenshot et s'auto-critiquer **contre l'image source** : silhouette,
rapports de proportions mesurés à l'inventaire, palette, courbes restées
anguleuses (un rond qui lit comme un polygone = monter les segments), parts
inutiles. Ajuster le générateur et regénérer — 2 à 3 passes maximum avant de
montrer.

⚠ **Une silhouette se juge de FACE et de PROFIL, à plat.** Régler une pose en
ne regardant qu'une vue de trois quarts est le meilleur moyen de tourner en
rond : on y voit le détail, jamais la ligne d'ensemble. Sur une créature ou un
boss, sortir `--vue face` et `--vue profil` à chaque itération, et ne juger le
détail qu'une fois la ligne bonne.

Pour une animation, screenshoter plusieurs temps via les paramètres d'URL
(`--params "?anim=Nom&t=0.7"`) : pose de base à `t=0`, un temps intermédiaire,
pose finale à `t=duration` (détails : `references/animations.md`).

La caméra se pilote aussi par l'URL — indispensable pour juger un modèle **tel
que le joueur le verra** (yeux à ~4 studs), la vue 3/4 par défaut mentant sur
les occlusions (un auvent qui « cache la porte » vue d'en haut est parfait vu
d'en bas) :

| Param | Effet |
|---|---|
| `theta=<deg>` | azimut : `0` = pile devant (−Z), `90` = côté droit |
| `phi=<deg>` | élévation : `90` = à hauteur de la cible, `50` = 3/4, `15` = de dessus |
| `dist=<studs>` | distance à la cible |
| `tx` `ty` `tz` | point visé en studs (défaut : centre du modèle) — pour cadrer un détail |

Vue « joueur » type : `?theta=18&phi=87&dist=<1.2×largeur>&ty=6`.

Ces paramètres se passent au script via `--params`. (Détail interne, mais qui
explique le script : Chrome headless **se bloque avec `--virtual-time-budget`**
sur cette préview — boucle `requestAnimationFrame` + temps virtuel = boucle
infinie. Le script ne l'utilise pas ; la scène est déterministe, `spin` étant
désactivé par défaut.)

### 4. Valider avec l'utilisateur

Ouvrir la préview dans son navigateur (`Start-Process <chemin>\preview.html`)
et/ou lui montrer le screenshot. La préview est interactive : orbite, zoom,
clic sur une part pour l'inspecter (nom, taille, couleur — l'utilisateur peut
donner ses retours en nommant les parts), et si le modèle a des animations,
un panneau lecture/boucle/scrubber pour les juger image par image. Itérer sur
`model.json` jusqu'au OK.

### 4 bis. Finition, avant de construire

Une fois la silhouette validée — et **seulement** à ce moment, soigner des
détails sur des masses qui vont encore bouger étant du travail fait deux fois :

```powershell
node .claude/skills/hyperblox/scripts/finition.mjs hyperblox/<famille>/<slug>
```

La passe attrape ce que ni le schéma ni une capture ne montrent : deux faces
confondues qui **clignoteront en jeu sans jamais apparaître sur un rendu figé**,
un bout de barre qui ressort dans le vide après avoir traversé une masse, une
volée de marches sans contremarche, une part invisible noyée dans une autre.
`--fix` applique les corrections sûres — et refuse d'écrire sur un `model.json`
généré, où la correction serait perdue à la régénération suivante.

Détail des contrôles et des arbitrages : `references/finition.md`.
Passe guidée de bout en bout : la commande `/hyperblox-finition`.

### 5. Construire dans Roblox

Après validation seulement :

- **MCP Roblox Studio disponible** (`run_code` / `execute_luau`) : proposer
  d'exécuter `build.lua` directement, puis vérifier le résultat en jeu
  (le script `print` un récap `[HyperBlox]`).
- **Sinon** : livrer `build.lua` à coller dans la barre de commande de Studio.
  ⚠ Au-delà de ~50 Ko, la barre de commande n'encaisse pas le collage : passer
  par un ModuleScript (`build.lua` finit par `return true`, il est require-able
  tel quel) et le relancer via un clone, pour contourner le cache de `require` :
  ```lua
  local m = game.ServerStorage.BuildXxx:Clone()
  m.Parent = game.ServerStorage ; require(m) ; m:Destroy()
  ```
- **Le plafond des 200 000 caractères.** Une source de script Roblox est
  plafonnée : au-delà, le ModuleScript refuse la source. `build.mjs` bascule
  donc tout seul en écriture **compacte** au-delà de 120 parts — une table de
  données parcourue par une boucle, environ 5× plus court que la forme lisible,
  pour exactement la même géométrie (forçable par `--compact` / `--lisible`).
  Il annonce la taille produite à chaque build et avertit dès qu'elle approche
  du plafond. Si même le compact ne passe pas — c'est le cas des modèles à
  animations lourdes, où c'est le module `HyperBloxAnim` embarqué qui pèse — il
  faut transporter le `model.json` en **données** et non en code : un
  `StringValue` n'a pas de plafond, lui. En pratique, deux pièces à poser une
  fois dans le projet : un petit serveur HTTP local qui sert le `model.json`
  (`_outils/serve.mjs`) et un installeur Luau qui le lit et construit depuis les
  données (`_outils/install-json.lua`).

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
