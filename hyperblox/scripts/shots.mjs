#!/usr/bin/env node
// shots.mjs — captures de contrôle d'un modèle HyperBlox, ou de tout un lot.
//
//   node .claude/skills/hyperblox/scripts/shots.mjs hyperblox/creature/fenrir
//   node .claude/skills/hyperblox/scripts/shots.mjs hyperblox/vegetation
//   node .claude/skills/hyperblox/scripts/shots.mjs hyperblox/boss --vue face
//
// Le chemin désigne soit un dossier de modèle (contenant `model.json`), soit un
// dossier qui en contient plusieurs — auquel cas tous sont capturés.
//
// POURQUOI UN SCRIPT PLUTÔT QUE LA LIGNE DE COMMANDE CHROME. Parce que trois
// pièges se paient comptant, et que je les ai tous les trois payés :
//
//   1. LES ESPACES DU CHEMIN. Une URL `file://` non encodée fait sortir Chrome
//      en code 13 — sans message, sans fichier. `pathToFileURL` règle ça.
//   2. LE CACHE DISQUE. Chrome sert un `file://` depuis son cache : après une
//      régénération, la capture montrait encore l'ANCIEN modèle, en affichant
//      fièrement son ancien nombre de parts. Une capture de contrôle qui ment
//      est pire que pas de capture. L'horodatage du `model.json` en paramètre
//      d'URL suffit à casser le cache.
//   3. LE FICHIER QUI N'A PAS ÉTÉ ÉCRIT. Si Chrome échoue, le PNG précédent
//      reste en place et on relit tranquillement la version d'avant. On vérifie
//      donc l'horodatage du fichier produit, et pas seulement son existence.
//
// Et surtout PAS de `--virtual-time-budget` : la préview tourne en
// requestAnimationFrame, le temps virtuel n'avance jamais, Chrome se fige.
import { existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const cible = argv.find((a) => !a.startsWith("--"));
const val = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : d; };
if (!cible) {
  console.error("Usage : node shots.mjs <dossier-modele | dossier-de-modeles> "
    + "[--vue 3q|face|profil|dessous] [--large 760] [--haut 900] [--params '?theta=…']");
  process.exit(1);
}

// Les vues qui servent vraiment : le volume, la silhouette, ce que le joueur
// voit, et les creux qu'on a oublié de fermer.
//   ⚠ Une SILHOUETTE se juge de FACE et de PROFIL, à plat — pas de trois quarts.
//     Régler une pose en ne regardant qu'un 3/4 est le meilleur moyen de tourner
//     en rond : on y voit le détail, jamais la ligne d'ensemble.
const VUES = {
  "3q": { nom: "shot-3q", params: "" },
  face: { nom: "shot-face", params: "?theta=0&phi=88" },
  profil: { nom: "shot-profil", params: "?theta=90&phi=88" },
  dessous: { nom: "shot-dessous", params: "?theta=0&phi=12" },
};
const vue = VUES[val("vue", "3q")];
if (!vue) { console.error("--vue attend : " + Object.keys(VUES).join(", ")); process.exit(1); }
const params = val("params", vue.params);

const LARGE = val("large", "760"), HAUT = val("haut", "900");
const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find(existsSync);
if (!CHROME) { console.error("Chrome introuvable."); process.exit(1); }

const racine = resolve(cible);
if (!existsSync(racine)) { console.error("Introuvable : " + racine); process.exit(1); }
const dossiers = existsSync(join(racine, "model.json"))
  ? [racine]
  : readdirSync(racine)
      .map((d) => join(racine, d))
      .filter((d) => statSync(d).isDirectory() && existsSync(join(d, "model.json")))
      .sort();
if (!dossiers.length) { console.error("Aucun model.json sous " + racine); process.exit(1); }

let ok = 0;
const rates = [];
for (const d of dossiers) {
  const preview = join(d, "preview.html");
  if (!existsSync(preview)) { rates.push(basename(d) + " : pas de preview.html — lancer build.mjs"); continue; }
  const sortie = join(d, vue.nom + ".png");
  // On EFFACE la cible d'abord : Chrome laisse parfois le PNG précédent en
  // place (fichier verrouillé par un lecteur, écriture refusée) et on relit
  // alors tranquillement la capture d'avant, en croyant voir la nouvelle.
  if (existsSync(sortie)) { try { rmSync(sortie); } catch { /* verrouillé : la garde ci-dessous rattrapera */ } }
  const avant = existsSync(sortie) ? statSync(sortie).mtimeMs : 0;
  const stamp = Math.round(statSync(join(d, "model.json")).mtimeMs);
  const url = pathToFileURL(preview).href + (params ? params + "&" : "?") + "cache=" + stamp;
  try {
    execFileSync(CHROME, [
      "--headless=new", "--disable-gpu", "--no-first-run",
      "--disable-background-networking", "--disable-sync", "--disable-extensions",
      "--user-data-dir=" + join(process.env.TEMP || "/tmp", "hyperblox-shots"),
      "--window-size=" + LARGE + "," + HAUT, "--hide-scrollbars",
      "--screenshot=" + sortie, url,
    ], { stdio: "ignore" });
    if (!existsSync(sortie)) throw new Error("Chrome n'a rien écrit");
    if (statSync(sortie).mtimeMs <= avant) throw new Error("le PNG n'a pas été réécrit (ancienne capture conservée)");
    ok++;
    process.stdout.write(".");
  } catch (e) {
    rates.push(basename(d) + " : " + e.message);
  }
}
console.log("\n✓ " + ok + "/" + dossiers.length + " " + vue.nom + ".png (" + LARGE + "×" + HAUT + ")");
if (rates.length) {
  console.log("✗ ratés :\n  - " + rates.join("\n  - "));
  process.exit(1);
}
