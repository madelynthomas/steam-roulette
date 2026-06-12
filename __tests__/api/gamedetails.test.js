import { describe, test, expect, vi, afterEach } from "vitest";
import handler from "../../pages/api/gamedetails";

// Same lightweight req/res pattern as the library tests — the handler only
// uses req.query and calls res.status(...).json(...).
function makeReqRes(query = {}) {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return { req: { query }, res };
}

describe("GET /api/gamedetails", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns 400 when appid query param is missing", async () => {
    const { req, res } = makeReqRes({});
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    // Note: the trailing space in the error string is intentional — it matches
    // the source exactly so this test would catch an accidental fix to that typo.
    expect(res.json).toHaveBeenCalledWith({ error: "appid is required " });
  });

  test("returns game data including genres for a valid appid", async () => {
    const gameData = {
      name: "Counter-Strike 2",
      genres: [{ id: "1", description: "Action" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        // The Steam store API wraps the response as { [appid]: { success, data } }.
        // The handler unwraps this — we verify the unwrapped value reaches the caller.
        json: () =>
          Promise.resolve({
            730: { success: true, data: gameData },
          }),
      }),
    );

    const { req, res } = makeReqRes({ appid: "730" });
    await handler(req, res);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("appids=730"),
    );
    expect(res.json).toHaveBeenCalledWith(gameData);
  });

  test("returns null when the Steam store has no entry for the appid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            99999: { success: false },
          }),
      }),
    );

    const { req, res } = makeReqRes({ appid: "99999" });
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(null);
  });

  test("returns null for DLC and soundtracks that have no data field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            // DLC and soundtracks on Steam sometimes return success:true but
            // omit the `data` field entirely. The spin logic skips these entries
            // (checks !data?.genres), so null is the correct response here.
            12345: { success: true },
          }),
      }),
    );

    const { req, res } = makeReqRes({ appid: "12345" });
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(null);
  });
});
