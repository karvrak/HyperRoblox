# HyperBlox — la passe de finition

Un modèle peut être **valide et laid**. `build.mjs` ne contrôle que le schéma :
des nombres bien formés, des keyframes ordonnées, un modèle qui pose au sol. Il
ne regarde jamais ce qui se passe **entre** les parts — et c'est là que vit tout
ce qui fait qu'un modèle a l'air « presque fini » : le clignotement de deux
faces à ras, le bout de barre qui ressort dans le vide, le jour sous les
marches d'un escalier.

Cette passe se fait **après** que la silhouette est validée, jamais avant :
corriger des détails sur des proportions qui vont changer, c'est du travail
perdu deux fois.

```powershell
node .claude/skills/hyperblox/scripts/finition.mjs hyperblox/<famille>/<slug>
node .claude/skills/hyperblox/scripts/finition.mjs hyperblox/<famille>/<slug> --fix
```

## Le catalogue

### `zfight` — deux faces confondues · **grave**

Deux parts dont une face tombe exactement dans le même plan, tournée du même
côté. Roblox n'a aucune règle pour départager les deux surfaces : elles
clignotent l'une par-dessus l'autre, différemment à chaque image et à chaque
position de caméra. **C'est le défaut le plus visible en jeu et le plus
invisible sur une capture** — un rendu figé ne le montre pas.

*Correction, quand les deux parts sont à ras sur **un seul axe*** — une plaque
posée sur un mur, une patte sous une croupe : la correction se calcule **par
plan**, pas par paire. Toutes les faces confondues d'un même plan sont traitées
ensemble : la part la plus grosse définit la surface et ne bouge pas, les autres
s'écartent en escalier de 0.03, 0.06, 0.09. Corriger paire par paire ne
converge pas — on décale une part, elle devient coplanaire avec la suivante, et
le compte de constats **oscille** au lieu de descendre.

*Pas de correction quand elles sont à ras sur **deux axes ou plus***. Ce ne sont
plus deux pièces posées l'une sur l'autre mais **deux panneaux d'une même
coque** : le fond et le mur latéral d'un caisson sont à ras sur le dessus, sur
le dessous et sur le côté. Les pousser les fait dériver en diagonale — mesuré
sur l'exemple `coffre-fort` : le coffre y perdait sa symétrie, et le compte
oscillait entre 2 et 4 sans jamais tomber à zéro.

Un coin de caisson se règle en **restructurant**, ce qu'aucun script ne peut
décider à votre place :

- que la surface du coin soit portée par **une seule** part — le panneau de fond
  va d'un bord à l'autre, les murs se logent contre sa face intérieure, en
  retrait de 0.05 ;
- ou couvrir l'arête d'une **baguette** — une pièce d'angle qui recouvre les deux
  panneaux, ce qui règle le z-fighting et donne du relief au passage.

Le seuil du contrôle est 0.015 : un décalage de 0.02 déjà en place est considéré
comme traité.

*Une exception, le **plan de pose***. La convention HyperBlox veut que le modèle
pose au sol : toutes les parts qui touchent le sol ont donc leur dessous
exactement à `y = 0`, tournées vers le bas, contre le terrain. Ces faces-là sont
confondues et personne ne les verra jamais. Le contrôle les ignore — sans quoi
un modèle posant sur `k` parts produirait `k(k−1)/2` constats inutiles. Relevé
sur une bibliothèque de 36 props : **45 % des constats**, et les vrais défauts
noyés dedans.

### `noyee` — une part enfermée dans une autre · **grave**

Les huit coins d'une part sont à l'intérieur d'une autre part opaque : elle ne
se verra jamais. C'est du coût de rendu pur.

*Nuance importante* : elle est conservée (et rétrogradée en information) si une
**animation peut les séparer**. Appartenir à un groupe animé ne suffit pas — le
groupe emmène les deux ensemble. Il faut une track qui bouge l'une sans bouger
l'autre : c'est le cas d'une langue dans une gueule qui s'ouvre.

### `depassement` — un bout qui ressort dans le vide · **moyen**

Le défaut de la diagonale trop longue. Une barre traverse une masse et ressort
de quelques dixièmes de stud de l'autre côté, dans le vide. On sonde sa ligne
médiane : si elle est couverte par d'autres parts puis se termine par une
portion libre **courte**, c'est une bavure.

*Seuils* : on se tait au-delà de 1.5 stud libre, ou d'un quart de la longueur de
la barre — au-delà, ce n'est plus une bavure mais une intention (une corne, un
mât, un hauban). Réglables par `--bout` et `--bout-ratio` sur un modèle à grande
échelle. On se tait aussi si la pointe est sous `y = 0.15` : c'est une jambe
plantée dans le sol.

*Correction* : raccourcir la part de la longueur libre et recentrer — le bout
est coupé au ras de la surface qu'il traversait.

### `escalier` — marche ouverte · **moyen**

Une volée d'au moins trois marches identiques, non tournées, régulièrement
décalées en hauteur et en profondeur. Entre deux marches consécutives, on sonde
le jour vertical au nez de la marche basse : s'il est vide, on voit sous
l'escalier.

*Correction* : poser une contremarche. Elle est **rentrée de 0.03** sur ses
trois faces visibles — le nez de la marche du dessus et les deux flancs. Posée
à ras, elle serait coplanaire avec la marche : on aurait remplacé un trou par
un z-fighting. En hauteur au contraire elle **mord de 0.05** sur les deux
marches, ce qui ferme le joint pour de bon.

### `orpheline` — une part qui vole · **grave**

Une branche qui vole ne passe jamais pour une intention, et son **ombre portée**
la dénonce avant le modèle lui-même.

Le critère n'est pas « touche-t-elle quelque chose ? » — une mousse accrochée à
une branche qui flotte touche bien quelque chose, et vole quand même. C'est la
**connexité** : cette part tient-elle, de proche en proche, au corps posé au
sol ? On construit le graphe des contacts, on part des parts qui touchent le
sol (et de celles déclarées `flotte`), et tout ce que le parcours n'atteint pas
s'envole — signalé **en amas**, parce qu'une pièce décrochée l'est en bloc.

Deux pièges qui ont coûté cher, et que le contrôle évite maintenant :

- **comparer les solides, pas les boîtes englobantes.** La boîte d'un tronc
  incliné est énorme : une mousse flottant à 2.5 studs de lui passait pour « en
  contact ». On échantillonne les deux parts, dans les deux sens — les points
  d'A dans B *et* ceux de B dans A, sans quoi une petite part collée au flanc
  d'une grosse passerait pour détachée ;
- **viser le point le plus proche, pas le centre.** Pour recoller un amas, on
  cherche le couple de points les plus proches puis le déplacement minimal qui
  rétablit le contact, par dichotomie. Viser le centre d'une pièce longue et
  fine la rate, et le déplacement calculé n'a alors aucun sens.

*Correction* : translater l'amas entier du jeu mesuré. Si ce déplacement est
quasi nul alors que la connexité dit « décroché », les deux mesures se
contredisent — le script le dit et renvoie la décision au modeleur plutôt que
de proposer une correction qui ne ferait rien, et de faire boucler la passe.

⚠ La correction **répare, elle n'embellit pas** : elle colle la branche au
tronc. Rien ne vole plus, mais une pièce recollée au plus court peut être
tassée. Le vrai geste, ensuite, est de la reposer.

### `micro` — dimension sous 0.05 · **grave**

Studio remonte silencieusement toute dimension sous 0.05. La part ne sera donc
pas où la préview la montre. *Correction* : forcer à 0.05.

### Les trois contrôles sur demande

Ils ne s'allument qu'avec `--tout` ou `--only` : sur un modèle organique posé
par calcul, ils crient sans arrêt pour des choses qui vont bien.

| Contrôle | Ce qu'il dit | Quand l'allumer |
|---|---|---|
| `joint` | deux parts pile bord à bord, sans recouvrement | sur une pièce **qui bouge** : le joint s'ouvre en mouvement |
| `grille` | tailles/positions non snappées (parts non tournées seulement) | sur un modèle **architectural** écrit à la main |
| `symetrie` | une part sans jumelle en miroir (`--symetrie X`) | sur une **créature** censée être symétrique |

⚠ `grille` refuse de snapper tant qu'il reste du z-fighting à corriger :
l'arrondi sur 0.05 effacerait le décalage de 0.03 et ramènerait le défaut.

## `--fix` et les modèles générés

`--fix` **refuse d'écrire** si le `model.json` est produit par un générateur
(champ `generator`, ou un `gen-*.mjs` voisin qui cite le slug). Ce n'est pas une
précaution excessive : la correction serait écrasée sans bruit à la
régénération suivante, et le défaut reviendrait sans que personne comprenne
pourquoi.

Sur un modèle généré, la marche à suivre est : **lire le rapport, corriger dans
le générateur, relancer le générateur, relancer la finition.** Le plus souvent
le rapport pointe une règle du générateur, pas une part : quinze constats
`zfight` sur des écailles se corrigent en une ligne dans la fonction qui les
pose.

## Une correction peut en révéler une autre — mais le compte doit DESCENDRE

Boucher un trou crée une nouvelle part, donc de nouvelles faces, donc
possiblement un nouveau contact. Relancer la passe : en pratique deux tours
suffisent.

**Ne pas relancer en boucle aveuglément.** Surveiller le compte de constats
d'une passe à l'autre : s'il ne descend plus, ce qui reste n'est pas corrigeable
par décalage et demande une décision de modélisation (le cas de la coque
ci-dessus). `--fix` le dit — il n'écrit alors rien du tout, plutôt que de
reformater un fichier qu'il n'a pas corrigé.

## Ce que le script ne voit pas

Il mesure la géométrie ; il ne juge pas le dessin. Restent à l'œil, sur des
captures :

- **Les creux ouverts** — le dessous d'un auvent, l'arrière d'un trône, l'intérieur
  d'une gueule : rien ne signale un vide qu'on n'a jamais rempli. Regarder le
  modèle **de dessous** et **de derrière**, pas seulement en trois quarts.
- **Les arêtes vives** — une masse qui reste une boîte n'est pas un défaut
  détectable, c'est un choix de modélisation. Voir `style-detaille.md`.
- **La lecture à distance de jeu** — cadrer à hauteur d'yeux (`phi=87`, `ty=5`) et
  reculer : le détail qui disparaît à 30 studs ne méritait pas ses parts.
