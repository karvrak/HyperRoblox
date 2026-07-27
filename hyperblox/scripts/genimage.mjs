#!/usr/bin/env node
// HyperBlox — génération d'une image de référence par IA.
// Usage : node genimage.mjs <dossier-du-modele> "<prompt>" [--name reference.png] [--size 1024x1024]
//
// Lit la clé API et le modèle dans <skill>/config.json (voir config.example.json).
// API attendue : compatible OpenAI Images — POST {baseUrl}/images/generations
// (OpenAI gpt-image-1 / dall-e-3, ou tout fournisseur compatible via baseUrl).
// Sauvegarde l'image en PNG dans le dossier du modèle et affiche son chemin.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg, code = 1) {
  console.error(`✗ ${msg}`);
  process.exit(code);
}

// ---------- arguments ----------
const args = process.argv.slice(2);
const positional = [];
const opts = { name: "reference.png", size: null };
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--name") opts.name = args[++i];
  else if (args[i] === "--size") opts.size = args[++i];
  else positional.push(args[i]);
}
const [modelDir, prompt] = positional;
if (!modelDir || !prompt) {
  fail(
    'usage : node genimage.mjs <dossier-du-modele> "<prompt>" [--name reference.png] [--size 1024x1024]',
    2
  );
}

// ---------- config ----------
const configPath = join(skillDir, "config.json");
if (!existsSync(configPath)) {
  fail(
    `config.json absent (${configPath}).\n` +
      "  Copier config.example.json vers config.json et renseigner apiKey + model.",
    2
  );
}
let cfg;
try {
  cfg = JSON.parse(readFileSync(configPath, "utf8"));
} catch (e) {
  fail(`config.json illisible : ${e.message}`, 2);
}
const gen = cfg.imageGen ?? {};
const baseUrl = (gen.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
const apiKey = gen.apiKey;
const model = gen.model;
const size = opts.size || gen.size || "1024x1024";
if (!apiKey || /VOTRE-CLE/i.test(apiKey)) fail("imageGen.apiKey manquante dans config.json", 2);
if (!model) fail("imageGen.model manquant dans config.json", 2);

// ---------- appel API ----------
// Dialecte OpenAI-compatible : POST {baseUrl}/images/generations → data[0].b64_json|url
// (OpenAI, OpenRouter, Together, fal… — vérifié sur OpenRouter le 27/07/2026.)
async function post(url, body) {
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    fail(`requête impossible : ${e.message}`);
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    fail(`HTTP ${resp.status} — ${text.slice(0, 500)}`);
  }
  return resp.json();
}

async function toBuffer(ref) {
  const dataUrl = /^data:image\/\w+;base64,(.+)$/s.exec(ref);
  if (dataUrl) return Buffer.from(dataUrl[1], "base64");
  const imgResp = await fetch(ref);
  if (!imgResp.ok) fail(`téléchargement de l'image : HTTP ${imgResp.status}`);
  return Buffer.from(await imgResp.arrayBuffer());
}

const url = `${baseUrl}/images/generations`;
console.log(`→ ${url} (model=${model}, size=${size})`);
const json = await post(url, { model, prompt, n: 1, size });
const item = json?.data?.[0];
if (!item) fail(`réponse inattendue : ${JSON.stringify(json).slice(0, 300)}`);
let buf;
if (item.b64_json) buf = Buffer.from(item.b64_json, "base64");
else if (item.url) buf = await toBuffer(item.url);
else fail(`réponse sans b64_json ni url : ${JSON.stringify(item).slice(0, 300)}`);

// ---------- sauvegarde ----------
mkdirSync(modelDir, { recursive: true });
const outPath = resolve(join(modelDir, opts.name));
writeFileSync(outPath, buf);
console.log(`✓ image de référence sauvegardée : ${outPath} (${(buf.length / 1024).toFixed(0)} Ko)`);
