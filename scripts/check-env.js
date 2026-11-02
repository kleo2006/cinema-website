/**
 * Runs before `npm run build` (npm "prebuild"). Everything named REACT_APP_* is copied into the public JavaScript bundle,
 * so this refuses to build when a variable looks like it holds a private credential, or when a URL embeds credentials.
 * It prints variable NAMES only, never values.
 *
 * Allowed on purpose: REACT_APP_API_KEY (a TMDB v3 key is read-only and rate-limited, and is documented as public;
 * use a proxy via REACT_APP_TMDB_BASE_URL if you need it private).
 */
const SECRET_NAME = /(SECRET|PRIVATE|PASSWORD|PASSWD|TOKEN|SIGNING|CREDENTIAL|BEARER|ACCESS_KEY|AUTH_KEY)/i;
const ALLOWED = new Set(["REACT_APP_API_KEY"]);

function check(env) {
  const problems = [];
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith("REACT_APP_") || !value) continue;
    if (!ALLOWED.has(name) && SECRET_NAME.test(name)) problems.push(`${name}: the name suggests a secret, but REACT_APP_* values are published in the bundle. Keep secrets on a server (see docs/STREAMING.md).`);
    if (/^https?:\/\//i.test(value)) {
      try {
        const u = new URL(value);
        if (u.username || u.password) problems.push(`${name}: the URL contains a username/password, which would be published in the bundle.`);
        if (/[?&](x-amz-signature|signature|sig|token|access_token|api[_-]?key)=/i.test(u.search)) problems.push(`${name}: the URL carries a signature/token in its query string, which would be published in the bundle.`);
      } catch {
        /* malformed URLs are reported by the app's own config validation */
      }
    }
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)) problems.push(`${name}: the value looks like a private key.`);
  }
  return problems;
}

module.exports = { check };

if (require.main === module) {
  const problems = check(process.env);
  if (problems.length) {
    console.error("check-env: refusing to build.\n" + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }
  console.log("check-env: no secret-looking REACT_APP_* variables.");
  if (process.env.REACT_APP_API_KEY) console.log("check-env: note - REACT_APP_API_KEY will be readable by every visitor. Use REACT_APP_TMDB_BASE_URL with a proxy to keep it private.");
}
