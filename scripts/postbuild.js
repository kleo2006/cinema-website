/**
 * Runs after `react-scripts build`.
 *  - 404.html: GitHub Pages has no SPA fallback, so unknown paths (e.g. a refreshed /movie/603) are served this copy
 *    of the app, and the router then renders the right page. Other hosts use public/_redirects instead.
 *  - sitemap.xml + robots.txt: list the stable, crawlable routes. Individual film pages are discovered through links.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
// react-scripts honours BUILD_PATH (the e2e build uses build-e2e/), so the post-processing must follow it.
const build = path.resolve(root, process.env.BUILD_PATH || "build");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const site = (process.env.REACT_APP_SITE_URL || pkg.homepage || "").replace(/\/$/, "");

fs.copyFileSync(path.join(build, "index.html"), path.join(build, "404.html"));

if (site) {
  const routes = ["/", "/discover", "/genres", "/library", "/browse/trending", "/browse/popular", "/browse/top-rated", "/browse/upcoming", "/browse/now-playing"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
    .map((r) => `  <url><loc>${site}${r === "/" ? "/" : r}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(build, "sitemap.xml"), xml);
  const robotsPath = path.join(build, "robots.txt");
  const robots = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, "utf8").trimEnd() : "User-agent: *\nAllow: /";
  fs.writeFileSync(robotsPath, `${robots}\n\nSitemap: ${site}/sitemap.xml\n`);
  console.log(`postbuild: 404.html, sitemap.xml and robots.txt written for ${site}`);
} else {
  console.log("postbuild: 404.html written (set REACT_APP_SITE_URL or package.json homepage to generate sitemap.xml)");
}
