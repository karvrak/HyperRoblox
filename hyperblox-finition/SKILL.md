---
name: hyperblox-finition
description: >
  Passe de finition sur un modèle HyperBlox déjà modélisé : rattraper tout ce
  qui reste « presque fini » une fois la silhouette validée. Corrige les faces
  confondues qui clignotent en jeu (z-fighting), coupe les bouts de barre qui
  ressortent dans le vide après avoir traversé une masse, pose les contremarches
  manquantes d'un escalier, supprime les parts invisibles noyées dans une autre,
  signale les pièces flottantes et les creux ouverts. Utiliser quand un modèle
  est bon mais pas net, avant de le construire dans Studio, ou après une grosse
  retouche. Ne PAS utiliser pour changer des proportions ou ajouter du détail —
  c'est le skill `hyperblox`.
user-invocable: true
---

# HyperBlox — passe de finition

Le modèle est bon, mais il n'est pas **net**. C'est cette passe.

Elle se fait **après** validation de la silhouette et des proportions, jamais
avant : soigner des détails sur des masses qui vont bouger, c'est le travail
fait deux fois.

Lecture obligatoire avant de commencer :
`.claude/skills/hyperblox/references/finition.md` — le catalogue des défauts,
ce que chacun coûte en jeu, et pourquoi chaque correction est ce qu'elle est.

## Cadrage

L'utilisateur donne un slug (`ra-fleau-solaire`), un chemin, ou rien. Si rien :
demander lequel, en proposant les modèles récemment touchés (`git status`,
dates de `model.json`).

**Une seule question à poser d'emblée**, et seulement si le modèle est
volumineux ou ancien : *corriger et montrer le résultat, ou d'abord le rapport
seul ?* Par défaut, faire les corrections sûres et montrer avant/après — c'est
ce qu'on attend d'une passe de finition.

## 1. Relever

```powershell
node .claude/skills/hyperblox/scripts/finition.mjs hyperblox/<famille>/<slug>
```

Lire le rapport en entier. Les contrôles `joint`, `grille` et `symetrie` ne sont
pas actifs par défaut : les allumer si le modèle s'y prête —

- `--tout` si le modèle est **architectural** et écrit à la main ;
- `--symetrie X` sur une **créature** censée être symétrique ;
- `--only joint` sur une pièce **animée**, où le joint sec s'ouvre en mouvement.

## 2. Décider, puis corriger

Ne pas appliquer `--fix` en aveugle. Le script propose une correction par
constat ; c'est à l'agent de trancher, parce que certains « défauts » sont des
intentions :

- une part **flottante** peut être un cristal en lévitation ;
- un bout qui **dépasse** peut être une corne ou un mât — relever `--bout` plutôt
  que de le couper ;
- une part **noyée** peut attendre une animation qui l'expose.

Écarter ce qui est voulu avec `--sauf`, puis appliquer :

```powershell
node .claude/skills/hyperblox/scripts/finition.mjs hyperblox/<famille>/<slug> --fix
```

**Si le modèle est généré**, `--fix` refuse d'écrire, et il a raison : la
correction serait perdue à la prochaine régénération. Corriger alors **dans le
générateur**, et chercher la règle plutôt que le cas — quinze constats `zfight`
sur des écailles se corrigent en une ligne dans la fonction qui les pose, pas en
quinze retouches. Puis relancer le générateur.

## 3. Reboucler — en surveillant que le compte DESCEND

Boucher un trou crée des parts, donc des faces, donc de nouveaux contacts.
Relancer la passe : deux tours suffisent en pratique.

**Ne jamais reboucler à l'aveugle.** Comparer le nombre de constats d'une passe à
l'autre. S'il ne descend plus, ce qui reste ne se corrige pas par décalage et
demande une décision de modélisation — typiquement deux panneaux d'une même
coque, à ras sur plusieurs axes, qu'il faut restructurer (voir `finition.md`).
Le script refuse alors d'écrire, plutôt que de reformater un fichier qu'il n'a
pas corrigé : le rapporter à l'utilisateur, ne pas insister.

Puis regénérer :

```powershell
node .claude/skills/hyperblox/scripts/build.mjs hyperblox/<famille>/<slug>
```

## 4. Contrôler à l'œil ce que le script ne mesure pas

Le script juge la géométrie, pas le dessin. Trois captures headless
(procédure et paramètres de caméra dans le SKILL.md de `hyperblox`) :

| Vue | Paramètres | Ce qu'on y cherche |
|---|---|---|
| joueur | `?theta=18&phi=87&dist=<1.2×largeur>&ty=5` | ce que le joueur verra vraiment |
| dessous | `?theta=0&phi=8&dist=<1.5×largeur>` | les creux ouverts : dessous d'auvent, arrière de trône, intérieur de gueule |
| dos | `?theta=180&phi=60` | la face qu'on ne regarde jamais en modélisant |

Un vide qu'on n'a jamais rempli ne déclenche aucun constat : rien ne distingue
« pas de part ici » de « pas de part ici exprès ». C'est le seul défaut qui se
trouve uniquement à l'œil, et c'est celui qu'on voit le plus en jeu.

## 5. Rendre compte

Dire ce qui a été corrigé **et ce qui a été écarté volontairement**, en une
ligne chacun. Un rapport de finition qui ne liste que des succès cache les
décisions, et ce sont elles qui comptent :

> 12 faces confondues décalées, 3 contremarches posées, 1 bout de hauban coupé.
> Écarté : les 4 pointes de couronne signalées comme « dépassement » (voulu),
> et le snap de grille (aurait défait les décalages anti-z-fighting).

Si le modèle a des animations, les rejouer après coup : une part décalée de 0.03
peut sortir d'un logement dont on ne voit le jeu qu'en mouvement.
`preview.html?anim=<Nom>&t=<secondes>`.
