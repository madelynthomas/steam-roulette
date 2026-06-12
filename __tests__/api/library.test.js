import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import handler from "../../pages/api/library";

// Build lightweight req/res stand-ins — the handler only uses req.query and res.status/json
function makeReqRes(query = {}) {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { req: { query }, res };
}

describe("GET /api/library", () => {
  beforeEach(() => {
    process.env.STEAM_API_KEY = "test-key";
  });

  afterEach(() => {
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

    // Should only call fetch once — no vanity resolution needed
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain("GetOwnedGames");
    expect(res.json).toHaveBeenCalledWith({ games });
  });

  test("resolves a vanity URL before fetching the game library", async () => {
    const resolvedId = "76561198012345678";
    const games = [{ appid: 440, name: "Team Fortress 2" }];

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
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
    expect(fetch.mock.calls[1][0]).toContain(resolvedId);
    expect(res.json).toHaveBeenCalledWith({ games });
  });

  test("returns 404 when the vanity URL does not map to a Steam account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({ response: { success: 42, message: "No match" } }),
      }),
    );

    const { req, res } = makeReqRes({ steamid: "nobody" });
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Steam user not found" });
  });

  test("returns empty games array for a private or game-less profile", async () => {
    // Steam returns an object with no `games` key for private profiles
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ response: {} }),
      }),
    );

    const { req, res } = makeReqRes({ steamid: "76561198000000000" });
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({});
  });
});
