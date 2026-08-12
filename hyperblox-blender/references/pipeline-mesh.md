# Du mesh Blender à la MeshPart Roblox

Ce fichier décrit ce qui traverse la frontière entre les deux logiciels : le
découpage en pièces, ce que Roblox accepte, le format du `manifest.json`, la
procédure d'import, et la calibration à faire une fois.

## Le principe : on ne subit pas l'import, on l'écrase

Le FBX ne transporte que de la **géométrie**. Tout le reste — la taille en
studs, la position, la couleur, le matériau, la collision, les groupes, les
animations — vit dans le `manifest.json` et est **réappliqué par
`assemble.lua`** après l'import.

C'est un choix, et il règle un problème réel : le 3D Importer de Studio
réinterprète l'échelle du FBX (le format se compte en centimètres, Roblox en
studs, et le résultat dépend de la version de Blender, de la version de Studio
et des cases cochées). Chercher le bon réglage d'export, c'est courir après une
cible mouvante. On laisse donc l'importateur faire ce qu'il veut, puis on
impose les nombres que Blender a mesurés :

```lua
mesh.Size  = Vector3.new(2.6, 3.2, 1.7)   -- studs, mesurés dans Blender
mesh.CFrame = origin * CFrame.new(0, 2.0, 0)
```

`MeshPart.Size` redimensionne le maillage. Comme la taille imposée est
exactement la boîte englobante mesurée, le rapport de dimensions est conservé :
la mise à l'échelle est uniforme, il n'y a aucune déformation.

## Découper le modèle en pièces

Une **pièce** = un objet Blender déclaré par `hb.piece()` = une **MeshPart**
dans Roblox. Trois critères, dans cet ordre :

1. **Couleur et matériau.** Une MeshPart n'a qu'une couleur (pas de texture
   dans ce pipeline). Deux teintes, deux pièces. C'est le critère qui découpe
   le plus, et celui qu'il faut annoncer à l'utilisateur au cadrage.
2. **Mouvement.** Tout ce qui s'anime est une pièce, ou un `groupe` de pièces.
   Une animation cible un nom de pièce ou de groupe.
3. **Budget.** 20 000 triangles maximum par MeshPart. Au-delà, découper.

Un quatrième critère, plus discret : **la collision**. Une pièce décorative
fine (une antenne, une frange, un néon) se déclare `collision=False`, ce qui
évite à Roblox de calculer une géométrie de collision pour rien.

Ce qui n'est **pas** un critère : la commodité de modélisation. Trois objets
Blender de la même couleur qui ne bougent pas ensemble gagnent à être fusionnés
en une pièce (`join`), une MeshPart coûtant plus cher que quelques milliers de
triangles supplémentaires.

## Ce que Roblox accepte

| Limite | Valeur | Ce qui se passe au-delà |
|---|---|---|
| triangles par mesh | **20 000** | l'Importateur 3D refuse la pièce |
| boîte englobante | 2048 studs par axe | refus |
| dimension minimale d'une Part | 0,05 stud | Studio remonte la valeur en silence, la pièce est fausse |
| influences par sommet (rigs) | 4 os | sans objet ici : pas d'armature dans ce pipeline |

`hb.rapport()` contrôle tout cela avant l'export, et `assemble.mjs` une seconde
fois sur le manifest. Les deux le font parce qu'on ne veut pas l'apprendre dans
la fenêtre d'import, après trois minutes de manipulation.

Source : `create.roblox.com/docs/art/modeling/specifications`.

## Le `manifest.json`

Écrit par `hb.export()`. Toutes les mesures sont en **studs**, dans le **repère
Roblox** (Y en haut, -Z vers l'avant), et les positions sont relatives au pivot
du modèle — **au sol, au centre**, comme dans `model.json`.

```json
{
  "name": "CasqueGarde",
  "unit": "stud",
  "fbx": "casque-garde.fbx",
  "size": [3.0, 4.4, 2.0],
  "pieces": [
    {
      "name": "Crane",           // [A-Za-z][A-Za-z0-9_]* — retrouvé PAR CE NOM
      "group": "Casque",         // sous-Model ; cible possible d'une animation
      "size": [2.6, 3.2, 1.7],   // boîte englobante, studs
      "position": [0, 2.0, 0],   // centre de la boîte, pivot du modèle au sol
      "color": [96, 102, 112],
      "material": "Metal",
      "transparency": 0,
      "collide": true,
      "fidelity": "Box",         // CollisionFidelity
      "render": "Automatic",     // RenderFidelity
      "tris": 4180, "verts": 2210
    }
  ],
  "animations": [ /* même schéma que model.json — voir ../hyperblox/references/animations.md */ ],
  "warnings": []
}
```

### `fidelity` — la géométrie de collision

| Valeur | Pour quoi |
|---|---|
| `Box` | **le défaut**, et le bon dans 90 % des cas : décor, meuble, mur |
| `Hull` | forme convexe où la boîte serait trop grossière (casque, rocher) |
| `Default` | décomposition automatique — plus fidèle, plus chère |
| `PreciseConvexDecomposition` | quand la forme creuse doit vraiment se traverser (arche, tunnel) — la plus chère, à réserver |

### `render` — la finesse d'affichage

`Automatic` (le défaut : Roblox baisse la finesse avec la distance), `Precise`
(jamais dégradé — pour une petite pièce très regardée, une enseigne néon),
`Performance`.

## Import dans Studio

Le seul geste manuel du pipeline. Aucun outil MCP ne pilote l'Importateur 3D.

1. Studio → onglet **Avatar** (ou **Modèle**) → **Importateur 3D**
2. choisir `<slug>.fbx`
3. dans le panneau de réglages :
   - **« Merge Meshes » décoché** — sinon tout le modèle arrive en UNE MeshPart
     et l'assemblage ne retrouve rien. C'est l'erreur numéro un.
   - **« Anchored » coché**
   - laisser le reste par défaut : l'échelle, la position et le pivot seront
     écrasés par `assemble.lua`.
4. **Importer** → un `Model` apparaît dans `workspace`.

Puis exécuter `assemble.lua`. Il retrouve la source tout seul (il cherche le
`Model` qui contient la première pièce attendue), clone les MeshParts, les
habille, et range l'import dans `ServerStorage`.

### Les trois erreurs qu'il sait diagnostiquer

| Message | Ce qui s'est passé |
|---|---|
| « Aucune MeshPart nommée … » | le FBX n'a pas été importé, ou « Merge Meshes » était coché |
| « N pièce(s) absentes de l'import » | Studio a renommé des doublons (`Piece`, `Piece1`), ou l'export était partiel |
| « proportions inattendues sur … » | le mesh importé n'a pas la forme mesurée — voir Calibration |

## Calibration — une seule fois, au premier vrai modèle

Deux conventions ne sont vérifiables qu'en regardant le résultat dans Studio.
Les contrôler au premier import, noter le résultat ici, ne plus y revenir.

**1. Les axes.** Blender est Z-en-haut, Roblox Y-en-haut ; l'export applique
`axis_up='Y', axis_forward='-Z'`, et `lib/hyperblox.py` mesure avec la même
conversion `(x, y, z) → (x, z, -y)`. Si les deux étaient en désaccord, les
pièces se disperseraient ou le modèle serait couché. Le contrôle de proportions
d'`assemble.lua` attrape ce cas et le nomme.

> Vérifié en Studio : _pas encore_.

**2. L'orientation avant/arrière.** Un objet modelé tourné vers **+Y** dans
Blender regarde vers **-Z** dans Roblox, soit l'avant (le `LookVector`). S'il
arrive dos à la caméra, c'est un demi-tour : mettre `CONFIG.ROTATION_Y = 180`
dans `assemble.lua` pour le vérifier, puis corriger la convention dans le
générateur pour de bon.

> Vérifié en Studio : _pas encore_.

**3. Le centrage de la géométrie.** `hb.export()` recale l'origine de chaque
pièce au centre de sa boîte englobante, et `assemble.lua` pose ce centre. Si
une pièce arrive décalée d'une demi-longueur, c'est que Roblox conserve un
offset interne au mesh : le corriger alors dans `assemble.mjs`, en une fois,
pour toutes les pièces.

> Vérifié en Studio : _pas encore_.

## Automatiser l'import (piste, non implémentée)

L'API Open Cloud « Create Asset » accepte un FBX et rend un identifiant
d'asset, ce qui supprimerait le passage par l'Importateur 3D. Il faut pour cela
une clé API avec la portée `asset:write`, un identifiant de créateur (compte ou
groupe), et accepter que chaque itération de forme publie un asset modéré.

Ce n'est pas implémenté ici, volontairement : le gain est d'un clic sur trois,
et le coût est une configuration à secret de plus dans un skill qui n'en a
qu'une. Si le besoin devient réel (une bibliothèque de dizaines de modèles à
publier d'un coup), c'est là qu'il faudra le construire.
