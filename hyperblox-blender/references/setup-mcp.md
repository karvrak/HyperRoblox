# Le MCP Blender — installer, connecter, diagnostiquer

Le serveur utilisé est [`blender-mcp`](https://github.com/ahujasid/blender-mcp).
Il a **deux moitiés**, et c'est la source de la moitié des ennuis :

```
Claude Code  ──stdio──▶  serveur MCP (uvx blender-mcp)  ──socket 9876──▶  addon dans Blender
```

Le serveur MCP se lance tout seul avec la session. **L'addon, non** : il faut
que Blender soit ouvert et que la connexion ait été activée à la main dans son
interface. Un MCP « présent » dans la liste des outils ne dit rien de l'état de
Blender.

## Installation

### 1. Le serveur (côté Claude Code)

Déjà en place si `claude mcp list` montre une entrée `blender`. Sinon :

```powershell
claude mcp add blender -s user -- uvx blender-mcp
```

`uvx` vient de [uv](https://docs.astral.sh/uv/). Si `uvx` n'est pas sur le PATH,
mettre son chemin absolu dans la commande — c'est ce qui est fait dans la
configuration actuelle (`…/Python310/Scripts/uvx.exe`).

### 2. L'addon (côté Blender)

1. Télécharger `addon.py` depuis le dépôt `ahujasid/blender-mcp`.
2. Blender → **Édition ▸ Préférences ▸ Add-ons ▸ Installer…** → choisir `addon.py`.
3. Cocher **Interface: Blender MCP**.

### 3. La connexion, à chaque démarrage de Blender

1. Dans la vue 3D, ouvrir le panneau latéral : touche **N**.
2. Onglet **BlenderMCP**.
3. **Connect to Claude**.

Les intégrations Poly Haven / Hyper3D / Sketchfab de ce panneau ne servent pas à
HyperBlox : les laisser décochées. Elles ajoutent de la latence et des modes
d'échec pour rien.

## Diagnostic

Premier appel de toute session :

```
mcp__blender__get_scene_info(user_prompt: "vérification de la connexion")
```

| Symptôme | Cause quasi certaine |
|---|---|
| erreur de connexion / socket refusé | Blender fermé, ou « Connect to Claude » pas cliqué |
| le serveur MCP n'apparaît pas du tout | `uvx` introuvable, ou session à redémarrer |
| tout marchait, et plus rien | Blender attend sur une **fenêtre modale** (voir plus bas) |
| réponse tronquée ou vide | l'exécution a dépassé les **180 s** de timeout du socket |

Ne jamais réessayer le même appel plus de deux fois : reprendre l'installation
avec l'utilisateur, ou lui demander de regarder l'état de Blender.

## Les outils

Tous prennent un paramètre **`user_prompt`** — obligatoire sur `get_scene_info`,
optionnel ailleurs. Y écrire ce qu'on cherche à faire, en une phrase.

| Outil | Usage dans HyperBlox |
|---|---|
| `get_scene_info` | diagnostic de connexion, inventaire des objets |
| `get_object_info(object_name)` | vérifier une transformation, un nom, un matériau |
| `execute_blender_code(code)` | **l'outil de travail** : charge le module, exécute le générateur, exporte |
| `get_viewport_screenshot(max_size)` | les captures de contrôle (face, profil, 3/4) |

Les autres (`*_polyhaven_*`, `*_hyper3d_*`, `*_sketchfab_*`, `*_hunyuan3d_*`)
sortent du périmètre : ils importent des assets tiers ou générés par IA, dont la
topologie et le budget de triangles ne sont pas maîtrisés, et dont la licence
n'est pas la nôtre. Ne les proposer que si l'utilisateur le demande
explicitement, et alors vérifier le budget avec `hb.rapport()` avant tout export.

## Les pièges qui coûtent une demi-heure

**Les fenêtres modales figent tout.** Un `bpy.ops` qui ouvre un sélecteur de
fichiers, une boîte de confirmation, un rendu bloquant : Blender attend un clic,
le socket ne répond plus, et tous les appels suivants expirent. `lib/hyperblox.py`
est écrit pour éviter les opérateurs à contexte — c'est la raison d'être de son
usage de `bmesh` plutôt que de `bpy.ops.mesh.primitive_*`. Si un appel reste
sans réponse, demander à l'utilisateur de regarder l'écran de Blender.

**180 secondes de timeout.** Un booléen exact sur deux maillages subdivisés, un
remesh fin, un `subdiv(niveaux=5)` : ça passe la barre sans prévenir. Découper le
travail, et garder les niveaux de subdivision bas jusqu'à la validation de la
forme.

**`importlib.reload(hb)` à chaque exécution.** Sans lui, Blender garde la
première version chargée du module et les corrections de `lib/hyperblox.py`
n'ont aucun effet.

**Le module n'est pas dans le `sys.path` de Blender.** Il faut l'y insérer à
chaque session — c'est le rôle des deux premières lignes du bootstrap.

**`execute_blender_code` rend ce qui est imprimé.** Écrire des `print()`, ne pas
compter sur la valeur de retour de la dernière expression.

**Sauver avant d'expérimenter.** Le code exécuté est arbitraire et `hb.scene()`
vide la scène par défaut. Sur un `.blend` auquel l'utilisateur tient :
`hb.scene(..., effacer=False)`, ou une nouvelle scène.

## Bootstrap type

À coller dans `execute_blender_code`, en adaptant les deux chemins :

```python
import sys, importlib
LIB = r"C:/Users/<moi>/.claude/skills/hyperblox-blender/lib"
if LIB not in sys.path:
    sys.path.insert(0, LIB)
import hyperblox as hb
importlib.reload(hb)

GEN = r"D:/mon-jeu/hyperblox/casque-garde/gen-casque-garde.py"
exec(compile(open(GEN, encoding="utf-8").read(), GEN, "exec"))
```
