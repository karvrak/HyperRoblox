# HyperBlox — schéma `model.json` et conventions géométriques

Le `model.json` est la **source de vérité** d'un modèle. La préview HTML et le
`build.lua` sont générés depuis les mêmes données par `scripts/build.mjs` :
ce que montre la préview est ce que Studio construira.

## Schéma

```json
{
  "name": "NomDuModele",
  "description": "optionnel — une ligne sur ce que c'est",
  "source_image": "optionnel — chemin de l'image de référence",
  "animations": "optionnel — voir references/animations.md",
  "parts": [
    {
      "name": "NomDeLaPart",
      "group": "NomDeGroupe (optionnel — sous-Model dans Studio)",
      "shape": "Block | Wedge | CornerWedge | Cylinder | Ball",
      "size": [4, 2.2, 2.6],
      "position": [0, 1.1, 0],
      "rotation": [0, 90, 0],
      "color": [121, 85, 58],
      "material": "SmoothPlastic",
      "transparency": 0,
      "collide": true,
      "flotte": false
    }
  ]
}
```

Champs optionnels avec défauts : `rotation` `[0,0,0]`, `material` `"SmoothPlastic"`,
`transparency` `0`, `collide` `true`, `group` aucun, `flotte` `false`.

### `flotte` — « cette part lévite EXPRÈS »

Ce champ ne change **rien** à la construction : c'est une déclaration
d'intention, lue par la passe de finition. Sans lui, le contrôle de connexité
signale comme décrochée toute part qui ne tient à rien — ce qui est le
comportement voulu pour une branche, et faux pour un éclat en lévitation ou le
fût d'un obélisque flottant.

Une part `flotte` est un **ancrage** au même titre que le sol : elle ne se
signale pas, et elle PORTE ce qu'on lui accroche (un obélisque qui lévite
entraîne son anneau avec lui).

À réserver aux cas où la lévitation est le sujet. Deviner l'intention au nom de
la part (`EclatLevitant`, `Satellite`…) marche jusqu'au jour où ça ne marche
plus.

## Conventions (identiques préview ↔ Studio)

- **Axes** : main droite, **Y vers le haut**, unité = **stud**. « Avant » = **−Z**
  (direction du LookVector Roblox).
- **Pivot du modèle** : au **sol, au centre** — le modèle doit poser sur `y = 0`
  (le bas de la part la plus basse à `y = 0`). `build.mjs` avertit si le modèle
  flotte ou s'enfonce.
- **`position`** : centre de la part, relatif au pivot du modèle.
- **`rotation`** : `[rx, ry, rz]` en **degrés**, appliqués comme
  `CFrame.fromEulerAnglesXYZ` (ordre X·Y·Z). La préview utilise exactement la
  même composition de quaternions.
- **Échelle** : un personnage Roblox ≈ **5 studs** de haut. Une porte ≈ 7×4,
  une table ≈ 3 de haut, une caisse ≈ 2-4.

## Formes

| Shape | Instance Studio | Convention |
|---|---|---|
| `Block` | `Part` | boîte simple |
| `Wedge` | `WedgePart` | **face verticale à l'arrière (+Z)**, pente qui descend vers l'avant (−Z). Pour une pente qui descend vers +Z : `rotation [0, 180, 0]`. |
| `CornerWedge` | `CornerWedgePart` | **apex au coin arrière-droit (+X, +Z)** ; faces verticales à l'arrière et à droite. |
| `Cylinder` | `Part` + `Shape = Cylinder` | **axe de la hauteur = X local** : `size[0]` = longueur, diamètre = `min(size[1], size[2])`. Cylindre debout → `rotation [0, 0, 90]`. |
| `Ball` | `Part` + `Shape = Ball` | sphère sur la **plus petite** dimension — utiliser une taille uniforme. |

## Matériaux autorisés

`Plastic`, `SmoothPlastic` (défaut, style low-poly studio), `Neon`, `Metal`,
`DiamondPlate`, `Foil`, `Wood`, `WoodPlanks`, `Marble`, `Slate`, `Concrete`,
`Brick`, `Granite`, `Cobblestone`, `Sand`, `Grass`, `Fabric`, `Glass`, `Ice`,
`ForceField`, `CorrodedMetal`, `Pebble`, `Asphalt`, `Basalt`, `Limestone`,
`Sandstone`.

## Groupes

`group` regroupe des parts dans un sous-`Model` (« Caisse », « Couvercle »…).
Indispensable pour tout ce qui doit s'animer (une animation cible un groupe
autour d'un pivot — voir `animations.md`) et utile pour la lisibilité dans
l'Explorer de Studio. La préview les compte et les affiche.

## Calibration CornerWedge (une seule fois)

L'orientation de base du `CornerWedgePart` n'est pas documentée officiellement ;
la convention ci-dessus (apex +X/+Z) est celle du viewer. Au **premier usage
réel d'un CornerWedge** : construire le modèle dans Studio, comparer avec la
préview. Si l'orientation diffère d'un quart de tour, ajuster **une fois** la
constante `CORNER_FIX` en tête du `build.lua` généré (0/90/180/270), noter la
valeur ici, puis reporter ce yaw par défaut dans `scripts/build.mjs`
(`p.shape === "CornerWedge"`).

> Valeur calibrée : _pas encore vérifiée en Studio_ (défaut 0).

## Génération

```powershell
node .claude/skills/hyperblox/scripts/build.mjs <dossier-du-modele>
```

Produit `preview.html` (viewer autonome, zéro réseau) et `build.lua`
(idempotent — remplace le modèle du même nom) dans le dossier du modèle.
Le script valide le schéma et avertit : dimensions < 0.05, modèle
flottant/enfoncé, Ball/Cylinder non uniformes, > 400 parts (rappel du coût
si le modèle est instancié plusieurs fois — un modèle unique peut aller
bien au-delà, cf. style-detaille.md § Budget).
