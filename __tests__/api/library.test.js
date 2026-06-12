import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../../pages/api/library";

// Minimal stand-ins for Next.js req/res — the handler only touches req.query
// and calls res.status(...).json(...). mockReturnThis() makes the chain work:
// res.status(400) returns res itself so .json() can be called on the same object.
function makeReqRes(query = {}) {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { req: { query }, res };
}

describe("GET /api/library", () => {
  beforeEach(() => {
    // The handler reads STEAM_API_KEY from process.env. Even though fetch is
    // mocked, the key must be present or the URL interpolation produces "undefined".
    process.env.STEAM_API_KEY = "test-key";
  });

  afterEach(() => {
    // vi.restoreAllMocks restores vi.stubGlobal(fetch) so tests don't bleed into
    // each other. Placed in afterEach rather than beforeEach so a failing test
    // still cleans up after itself.
    vi.restoreAllMocks();
  });

  test("returns 400 when steamid query param is missing", async () => {
    const { req, res } = makeReqRes({});
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "steamid is required" });
  });

  test("passes a 17-digit steamid directly without vanity resolution", async () => {
    const games = [{ appid: 730, name: "Counter-Strike 2" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ response: { games } }),
      }),
    );

    const { req, res } = makeReqRes({ steamid: "76561198000000000" });
    await handler(req, res);

    // A 17-digit numeric ID skips vanity resolution entirely — only one fetch
    // should happen (GetOwnedGames), not two.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain("GetOwnedGames");
    expect(res.json).toHaveBeenCalledWith({ games });
  });

  test("resolves a vanity URL before fetching the game library", async () => {
    const resolvedId = "76561198012345678";
    const games = [{ appid: 440, name: "Team Fortress 2" }];

    // mockResolvedValueOnce chains two distinct responses: the first fetch is
    // the vanity resolution call, the second is the owned games fetch that uses
    // the resolved numeric Steam ID.
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
              // Steam API returns numeric 1 for success — not a boolean
              response: { success: 1, steamid: resolvedId },
            }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ response: { games } }),
        }),
    );

    const { req, res } = makeReqRes({ steamid: "gaben" });
    await handler(req, res);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toContain("ResolveVanityURL");
    // The second call must use the resolved numeric ID, not the original vanity string
    expect(fetch.mock.calls[1][0]).toContain(resolvedId);
    expect(res.json).toHaveBeenCalledWith({ games });
  });

  test("returns 404 when the vanity URL does not map to a Steam account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          // Any success value other than 1 means the vanity URL didn't resolve
          Promise.resolve({ response: { success: 42, message: "No match" } }),
      }),
    );

    const { req, res } = makeReqRes({ steamid: "nobody" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Steam user not found" });
  });

  test("returns empty games array for a private or game-less profile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        // Steam returns an object with no `games` key for private profiles or
        // accounts with zero games — the handler passes the response through as-is.
        json: () => Promise.resolve({ response: {} }),
      }),
    );

    const { req, res } = makeReqRes({ steamid: "76561198000000000" });
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({});
  });
});
