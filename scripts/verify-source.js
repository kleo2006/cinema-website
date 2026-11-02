#!/usr/bin/env node
/**
 * Verify a candidate full-film source, and (only if every check passes) add it to public/catalog.json.
 *
 *   npm run verify:source -- --url https://host/film.mp4 --type mp4 [--min-duration 540]
 *   npm run verify:source -- --url … --type mp4 --apply --tmdb 10378 \
 *       --license "CC BY 3.0" --holder "Blender Foundation | www.blender.org" \
 *       --license-url https://creativecommons.org/licenses/by/3.0/ --credits-confirmed
 *
 * It writes verify-out/ (a report and the last seconds of the film as a PNG) so a person can confirm the ending credits.
 * Nothing is written to the catalogue unless: no check failed or was skipped, --credits-confirmed was given, and the
 * licence fields are present.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { checkSource, ok, blockers } = require("./lib/verify-source");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(`--${name}`);

function ffprobe(url) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", url], { encoding: "utf8", timeout: 120000 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error((r.stderr || "ffprobe failed").trim().split("\n").pop());
  return JSON.parse(r.stdout);
}
const hasFfprobe = () => !spawnSync("ffprobe", ["-version"], { encoding: "utf8" }).error;

function tailFrame(url, outDir) {
  const file = path.join(outDir, "last-frames.png");
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-sseof", "-4", "-i", url, "-frames:v", "1", "-update", "1", file], { encoding: "utf8", timeout: 180000 });
  return r.status === 0 && fs.existsSync(file) ? file : null;
}

async function main() {
  const url = opt("url");
  const type = opt("type");
  if (!url || !type) {
    console.error("usage: npm run verify:source -- --url <https://…> --type mp4|webm|hls [--min-duration 540] [--apply --tmdb <id> --license … --holder … --license-url … --credits-confirmed]");
    process.exit(64);
  }
  const results = await checkSource({ url, type, minDuration: Number(opt("min-duration") || 540) }, { probe: hasFfprobe() ? ffprobe : null });
  const outDir = path.join(root, "verify-out");
  fs.mkdirSync(outDir, { recursive: true });
  const frame = hasFfprobe() && !blockers(results).length ? tailFrame(url, outDir) : null;
  for (const x of results) console.log(`${x.status.padEnd(4)} ${x.id.padEnd(11)} ${x.detail}`);
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ url, type, checkedAt: new Date().toISOString(), results }, null, 2));
  if (frame) console.log(`\nLook at ${path.relative(root, frame)}: it must show the end-credits roll, not a cut-off scene.`);

  if (!ok(results)) {
    console.log(`\nNOT VERIFIED: ${blockers(results).map((b) => `${b.id} (${b.status})`).join(", ")}. The catalogue was not changed.`);
    process.exit(blockers(results).some((b) => b.status === "FAIL") ? 1 : 2);
  }
  console.log("\nAll automated checks passed. Rights and the ending credits still need a human confirmation (see docs/SOURCES.md).");
  if (!flag("apply")) return;

  const need = { tmdb: opt("tmdb"), license: opt("license"), holder: opt("holder"), "license-url": opt("license-url") };
  const missing = Object.entries(need).filter(([, v]) => !v).map(([k]) => `--${k}`);
  if (missing.length || !flag("credits-confirmed") || !/^\d+$/.test(need.tmdb || "")) {
    console.error(`Refusing to edit the catalogue: need ${[...missing, ...(flag("credits-confirmed") ? [] : ["--credits-confirmed"])].join(" ")} and a numeric --tmdb id.`);
    process.exit(64);
  }
  const file = path.join(root, "public", "catalog.json");
  const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
  const entry = (catalog.titles[need.tmdb] ||= {});
  const sources = (entry.sources || []).filter((s) => s.src !== url);
  entry.status = "available";
  entry.sources = [{ src: url, type }, ...sources];
  entry.license = { name: need.license, holder: need.holder, url: need["license-url"] };
  fs.writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`public/catalog.json updated for TMDB ${need.tmdb}. Re-run the tests, then build.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
