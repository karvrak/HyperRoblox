# HyperBlox — guide de style low-poly « studio Roblox »

> ⚠ **Mode sur demande, pas le défaut.** Le défaut du skill est le mode
> détaillé (`style-detaille.md`) : reproduire l'image, courbes comprises.
> Ce guide ne s'applique que si l'utilisateur demande explicitement un rendu
> stylisé/minimaliste, ou pour un mob instancié en masse.

Objectif : traduire une image (photo, concept art, image IA) en un objet
**low-poly assumé**, lisible de loin, dans la texture Roblox de base — pas une
réplique fidèle. Le charme vient de la simplification.

## Lecture de l'image (avant d'écrire le JSON)

1. **Silhouette d'abord** : plisser les yeux. Identifier 2 à 6 **masses
   principales** (corps, toit, socle…). Chaque masse = 1 à 3 parts.
2. **Détails ensuite**, uniquement ceux qui portent l'identité de l'objet
   (la serrure d'un coffre, la cheminée d'une maison, le canon d'une tourelle).
   Un détail qui ne se voit pas à 30 studs de distance ne mérite pas de part.
3. **Palette** : extraire 3 à 6 couleurs dominantes de l'image, les aplatir en
   teintes franches. Pas de dégradés — la variation vient de parts voisines
   légèrement plus claires/foncées (±10-15 % par canal, cf. le `shade()` des
   scripts d'assets existants).

## Budget de parts

| Type d'objet | Budget |
|---|---|
| Prop simple (caisse, minerai, lampadaire) | 5-20 |
| Prop riche (coffre, feu de camp, étal de marché) | 15-35 |
| Personnage / créature | 20-50 |
| Bâtiment / véhicule | 30-80 |

Au-delà de 80 : simplifier ou découper en plusieurs modèles.

## Règles de construction

- **Formes carrées assumées** : Block partout où possible ; Wedge pour pentes,
  toits et chanfreins ; Cylinder/Ball seulement quand le rond est l'identité de
  la forme (roue, poignée, dôme).
- **Proportions chunky** : exagérer les traits caractéristiques ×1.2-1.5
  (grosse serrure, gros toit). Éviter toute dimension < 0.15 stud.
- **Grille** : snapper tailles et positions sur 0.05 (idéalement 0.1).
  Angles préférés : 0, 15, 30, 45, 90.
- **Jamais de faces coplanaires** (z-fighting) : une part posée sur une autre
  doit soit s'enfoncer dedans, soit dépasser d'au moins 0.02 stud. Les
  chevauchements internes sont invisibles et gratuits — s'en servir.
- **Détail par blocs de couleur, pas par géométrie** : un trou de serrure est
  un petit bloc sombre plaqué, pas une vraie cavité.
- **Le modèle pose au sol** : bas à `y = 0`, pivot au centre.

## Matériaux

- **`SmoothPlastic` par défaut** — c'est le look « studio » de base.
- Accents seulement : `Metal` (ferrures, or), `Neon` (cristaux, lave, magie),
  `Wood` (si le grain compte vraiment), `Glass`/`Ice` (transparence).
- 1 à 3 matériaux par objet maximum.

## Échelle Roblox

Personnage ≈ 5 studs de haut. Repères : porte 7×4, étage 10-12, table 3,
caisse 2-4, arbre 15-25, lampadaire 8-10. Toujours demander ou déduire la
taille cible de l'objet **en studs** avant d'écrire le JSON ; à défaut,
dimensionner par rapport au personnage.

## Auto-critique avant de montrer la préview

Screenshot de la préview, puis comparer à l'image source :

- La silhouette est-elle reconnaissable au premier regard ?
- Les proportions relatives des masses sont-elles respectées ?
- La palette raconte-t-elle la même chose que l'image ?
- Y a-t-il une part inutile (invisible ou redondante) à supprimer ?
