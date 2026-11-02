// @ts-check
/**
 * Opt-in: plays ONE real, already-verified full-film source in a real browser through the real UI.
 *
 *   E2E_REAL_SOURCE_URL=https://download.blender.org/.../film.mp4 E2E_REAL_MIN_DURATION=540 \
 *     npm run test:e2e -- e2e/real-source.spec.js --project="chrome (H.264/AAC)"
 *
 * Only catalog.json is replaced (so that e2e test film 9001 points at your URL); the film page, Watch button, player,
 * seeking, progress store and end-of-film state are the production code. TMDB metadata is the usual stub.
 * It needs a browser that can decode the source (use the H.264 project for MP4) and internet access to the media host.
 * It cannot prove rights, or that the end credits are complete: look at test-results/real-source-tail.png for that.
 */
const { test, expect } = require("@playwright/test");

const URL_UNDER_TEST = process.env.E2E_REAL_SOURCE_URL;
const TYPE = process.env.E2E_REAL_TYPE || "mp4";
const MIN_DURATION = Number(process.env.E2E_REAL_MIN_DURATION || 540);
const ID = 9001;
const slug = `/movie-app/movie/${ID}-cinema-test-film-${ID}`;

const video = (page) => page.locator("video.player-video");
const snap = (page) => video(page).evaluate((v) => ({ t: v.currentTime, d: v.duration, paused: v.paused, ended: v.ended, ready: v.readyState, err: v.error ? v.error.code : null, src: v.currentSrc, vol: v.volume, muted: v.muted }));
const saved = (page) => page.evaluate((id) => { try { return JSON.parse(localStorage.getItem("cinema:progress:v1"))?.[id]; } catch { return "unparseable"; } }, ID);
const playing = async (page, after = 1.5) => expect.poll(async () => { const s = await snap(page); return !s.paused && s.t > after && s.ready >= 3 && s.err === null; }, { timeout: 45_000 }).toBe(true);

test.skip(!URL_UNDER_TEST, "set E2E_REAL_SOURCE_URL to the verified source (see docs/SOURCES.md)");

test("a real full-length source plays from the film page to its end", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/youtube|404.*movie-app\/[^.]*$/.test(m.text() + (m.location().url || ""))) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.route(/youtube/, (r) => r.abort());
  await page.route("**/catalog.json", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ version: 1, titles: { [ID]: { status: "available", sources: [{ src: URL_UNDER_TEST, type: TYPE }], license: { name: "CC BY 3.0", holder: "Blender Foundation | www.blender.org", url: "https://creativecommons.org/licenses/by/3.0/" } } } }) }));

  // 1-3. film page says full film is available; Watch movie opens the in-site player on the real file
  await page.goto(slug);
  await expect(page.getByText(/Watch in full/).first()).toBeVisible();
  await page.getByRole("link", { name: /Watch movie|Resume from/ }).click();
  await expect(video(page)).toBeVisible();
  await expect(page.getByText(/CC BY 3.0/).first()).toBeVisible(); // licence is shown
  await playing(page, 3);

  // 4. the duration is that of a complete film, and it is the URL we configured
  const s0 = await snap(page);
  expect(s0.src).toBe(URL_UNDER_TEST);
  expect(s0.d).toBeGreaterThanOrEqual(MIN_DURATION);

  // 5. pause / resume: time stops, then advances again
  await video(page).evaluate((v) => v.pause());
  const p1 = (await snap(page)).t;
  await page.waitForTimeout(1500);
  const p2 = await snap(page);
  expect(p2.paused).toBe(true);
  expect(Math.abs(p2.t - p1)).toBeLessThan(0.3);
  await video(page).evaluate((v) => v.play());
  await expect.poll(async () => (await snap(page)).t, { timeout: 15_000 }).toBeGreaterThan(p2.t + 1);

  // 6. volume and mute are honoured by the element
  await video(page).evaluate((v) => { v.volume = 0.3; v.muted = true; });
  expect(await snap(page)).toMatchObject({ vol: expect.closeTo(0.3, 1), muted: true });
  await video(page).evaluate((v) => { v.muted = false; });

  // 7. seeking forward into the middle and back needs real byte ranges from the host
  const mid = Math.floor(s0.d / 2);
  await video(page).evaluate((v, t) => { v.currentTime = t; }, mid);
  await expect.poll(async () => { const s = await snap(page); return s.t >= mid && !s.paused && s.ready >= 3; }, { timeout: 45_000 }).toBe(true);
  await video(page).evaluate((v) => { v.currentTime = 20; });
  await expect.poll(async () => { const s = await snap(page); return s.t >= 20 && s.t < 40 && s.ready >= 3; }, { timeout: 45_000 }).toBe(true);

  // 8. progress is saved, survives navigating away, and is offered on return
  await expect.poll(async () => (await saved(page))?.position ?? 0, { timeout: 20_000 }).toBeGreaterThan(15);
  const savedAt = (await saved(page)).position;
  await page.goto(slug);
  await expect(page.getByRole("link", { name: /Resume from/ })).toBeVisible();
  await page.getByRole("link", { name: /Resume from/ }).click();
  await expect(page.getByText("Pick up where you left off?")).toBeVisible(); // a direct visit asks first
  await page.getByRole("button", { name: /^Resume at/ }).click();
  await expect.poll(async () => { const s = await snap(page); return !s.paused && s.ready >= 3 && Math.abs(s.t - savedAt) < 8; }, { timeout: 45_000 }).toBe(true);

  // 9. the real end: jump to the last seconds, capture the frame for credit review, and wait for `ended`
  await video(page).evaluate((v) => { v.currentTime = v.duration - 6; });
  await expect.poll(async () => { const s = await snap(page); return s.t >= s0.d - 6 && s.ready >= 3; }, { timeout: 45_000 }).toBe(true);
  await page.waitForTimeout(2000);
  await video(page).screenshot({ path: "test-results/real-source-tail.png" });
  await expect.poll(async () => (await snap(page)).ended, { timeout: 30_000 }).toBe(true);
  const end = await snap(page);
  expect(end.t).toBeGreaterThan(end.d - 0.5);
  expect(await saved(page)).toBeUndefined(); // finished films are not offered for resume
  expect(end.err).toBeNull();
  expect(errors).toEqual([]);
});
