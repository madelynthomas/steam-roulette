import { describe, test, expect, vi, afterEach } from "vitest";
import handler from "../../pages/api/gamedetails";

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
            // Some appids return success:true but no data (e.g. DLC)
            12345: { success: true },
          }),
      }),
    );

    const { req, res } = makeReqRes({ appid: "12345" });
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(null);
  });
});
