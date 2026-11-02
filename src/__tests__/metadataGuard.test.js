import { ErrorKind } from "../api/errors";

/** tmdb.js and config.js read the environment at import time, so each scenario loads fresh copies. */
function loadWith(env) {
  const saved = { ...process.env };
  Object.assign(process.env, { REACT_APP_API_KEY: "", REACT_APP_TMDB_BASE_URL: "", ...env });
  let api;
  jest.isolateModules(() => {
    api = require("../api/tmdb");
  });
  process.env = saved;
  return api;
}

afterEach(() => {
  delete global.fetch;
});

test("a malformed metadata host is never contacted, so the API key cannot be sent to it", async () => {
  global.fetch = jest.fn();
  const api = loadWith({ REACT_APP_API_KEY: "secret-key", REACT_APP_TMDB_BASE_URL: "http://tracker.example.com/3" });
  await expect(api.getMovie(603)).rejects.toMatchObject({ kind: ErrorKind.CONFIG });
  expect(global.fetch).not.toHaveBeenCalled();
});

test("a same-origin proxy path is accepted and resolved against the page origin", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 603, title: "T", genres: [], videos: { results: [] }, credits: { cast: [], crew: [] }, recommendations: { results: [] }, similar: { results: [] } }) });
  const api = loadWith({ REACT_APP_TMDB_BASE_URL: "/tmdb" });
  await api.getMovie(603);
  const called = String(global.fetch.mock.calls[0][0]);
  expect(called).toMatch(/^http:\/\/localhost(:\d+)?\/tmdb\/movie\/603/);
  expect(called).not.toMatch(/api_key/);
});
