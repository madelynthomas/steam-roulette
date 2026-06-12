import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "../../pages/index";

// ---- Helpers ----------------------------------------------------------------

function mockFetchLibrary(games = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ games }),
  });
}

function mockFetchGameDetails(genres = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ genres }),
  });
}

function renderHome() {
  const user = userEvent.setup();
  const view = render(<Home />);
  return { user, ...view };
}

// ---- Setup ------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

// ---- Static rendering -------------------------------------------------------

describe("initial render", () => {
  test("shows the Steam Roulette heading", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { name: /steam roulette/i }),
    ).toBeInTheDocument();
  });

  test("renders the Steam ID input with correct placeholder", () => {
    renderHome();
    expect(
      screen.getByPlaceholderText(/enter your steam username or steam id/i),
    ).toBeInTheDocument();
  });

  test("renders the Load Library button", () => {
    renderHome();
    expect(
      screen.getByRole("button", { name: /load library/i }),
    ).toBeInTheDocument();
  });

  test("renders the genre input with correct placeholder", () => {
    renderHome();
    expect(
      screen.getByPlaceholderText(/enter a genre/i),
    ).toBeInTheDocument();
  });

  test("renders the Spin button", () => {
    renderHome();
    expect(screen.getByRole("button", { name: /spin/i })).toBeInTheDocument();
  });

  test("renders the installed-games-only checkbox unchecked by default", () => {
    renderHome();
    const checkbox = screen.getByRole("checkbox", {
      name: /installed games only/i,
    });
    expect(checkbox).not.toBeChecked();
  });

  test("renders the toggle button for the installed game list", () => {
    renderHome();
    expect(
      screen.getByRole("button", { name: /show installed game list/i }),
    ).toBeInTheDocument();
  });

  test("does not show the game list on initial render", () => {
    renderHome();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  test("does not show a suggestion on initial render", () => {
    renderHome();
    // The suggestion block only appears after a spin
    expect(screen.queryByText(/no games found/i)).not.toBeInTheDocument();
  });
});

// ---- localStorage persistence -----------------------------------------------

describe("localStorage", () => {
  test("pre-fills the Steam ID input from localStorage on mount", async () => {
    localStorage.setItem("steamid", "gaben");
    renderHome();

    // The useEffect runs after initial render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/steam username/i)).toHaveValue(
        "gaben",
      );
    });
  });

  test("writes steamid to localStorage as the user types", async () => {
    const { user } = renderHome();
    const input = screen.getByPlaceholderText(/steam username/i);

    await user.type(input, "valve");

    expect(localStorage.getItem("steamid")).toBe("valve");
  });

  test("restores the installed set from localStorage on mount", async () => {
    const games = [
      { appid: 730, name: "Counter-Strike 2" },
      { appid: 440, name: "Team Fortress 2" },
    ];
    localStorage.setItem("games", JSON.stringify(games));
    localStorage.setItem("installed", JSON.stringify([730]));

    const { user } = renderHome();

    // Show the list so we can inspect button states
    await user.click(await screen.findByRole("button", { name: /show installed game list/i }));

    await waitFor(() => {
      // The game marked installed should show "Installed"
      expect(screen.getByText("Counter-Strike 2").closest("li")).toHaveTextContent(
        "Installed",
      );
      expect(screen.getByText("Team Fortress 2").closest("li")).toHaveTextContent(
        "Not Installed",
      );
    });
  });
});

// ---- Load Library -----------------------------------------------------------

describe("Load Library", () => {
  const GAMES = [
    { appid: 730, name: "Counter-Strike 2" },
    { appid: 440, name: "Team Fortress 2" },
  ];

  test("shows 'Loading...' while the request is in flight", async () => {
    let resolve;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      ),
    );

    const { user } = renderHome();
    await user.type(screen.getByPlaceholderText(/steam username/i), "gaben");
    await user.click(screen.getByRole("button", { name: /load library/i }));

    expect(
      screen.getByRole("button", { name: /loading/i }),
    ).toBeInTheDocument();

    resolve({ ok: true, json: () => Promise.resolve({ games: [] }) });
  });

  test("populates the installed list after a successful library fetch", async () => {
    vi.stubGlobal("fetch", mockFetchLibrary(GAMES));

    const { user } = renderHome();
    await user.type(screen.getByPlaceholderText(/steam username/i), "gaben");
    await user.click(screen.getByRole("button", { name: /load library/i }));

    // Open the list
    await user.click(
      await screen.findByRole("button", { name: /show installed game list/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Counter-Strike 2")).toBeInTheDocument();
      expect(screen.getByText("Team Fortress 2")).toBeInTheDocument();
    });
  });

  test("sorts games alphabetically after loading", async () => {
    const unsorted = [
      { appid: 730, name: "Zork" },
      { appid: 440, name: "Alchemy" },
    ];
    vi.stubGlobal("fetch", mockFetchLibrary(unsorted));

    const { user } = renderHome();
    await user.type(screen.getByPlaceholderText(/steam username/i), "gaben");
    await user.click(screen.getByRole("button", { name: /load library/i }));

    await user.click(
      await screen.findByRole("button", { name: /show installed game list/i }),
    );

    await waitFor(() => {
      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveTextContent("Alchemy");
      expect(items[1]).toHaveTextContent("Zork");
    });
  });
});

// ---- Spin -------------------------------------------------------------------

describe("Spin", () => {
  const GAMES = [{ appid: 730, name: "Counter-Strike 2" }];

  test("shows a matching game suggestion when genres align", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ games: GAMES }),
        })
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              genres: [{ id: "1", description: "Action" }],
            }),
        }),
    );

    const { user } = renderHome();
    await user.type(screen.getByPlaceholderText(/steam username/i), "gaben");
    await user.click(screen.getByRole("button", { name: /load library/i }));
    await screen.findByRole("button", { name: /load library/i }); // wait for loading to finish

    await user.type(screen.getByPlaceholderText(/enter a genre/i), "Action");
    await user.click(screen.getByRole("button", { name: /spin/i }));

    await waitFor(() => {
      expect(screen.getByText(/counter-strike 2/i)).toBeInTheDocument();
    });
  });

  test("shows the not-found message after exhausting all attempts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ games: GAMES }),
        })
        // All subsequent calls (game details) return no genres — nothing will match
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ genres: null }),
        }),
    );

    const { user } = renderHome();
    await user.type(screen.getByPlaceholderText(/steam username/i), "gaben");
    await user.click(screen.getByRole("button", { name: /load library/i }));
    await screen.findByRole("button", { name: /load library/i });

    await user.type(screen.getByPlaceholderText(/enter a genre/i), "RPG");
    await user.click(screen.getByRole("button", { name: /spin/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/no games found/i)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });

  test("clears a previous suggestion when the genre input changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ games: GAMES }),
        })
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              genres: [{ id: "1", description: "Action" }],
            }),
        }),
    );

    const { user } = renderHome();
    await user.type(screen.getByPlaceholderText(/steam username/i), "gaben");
    await user.click(screen.getByRole("button", { name: /load library/i }));
    await screen.findByRole("button", { name: /load library/i });

    await user.type(screen.getByPlaceholderText(/enter a genre/i), "Action");
    await user.click(screen.getByRole("button", { name: /spin/i }));
    await screen.findByText(/counter-strike 2/i);

    // Changing the genre input should clear the suggestion immediately
    await user.clear(screen.getByPlaceholderText(/enter a genre/i));
    await user.type(screen.getByPlaceholderText(/enter a genre/i), "RPG");

    expect(screen.queryByText(/counter-strike 2/i)).not.toBeInTheDocument();
  });

  test("does nothing when no genre is entered", async () => {
    vi.stubGlobal("fetch", mockFetchLibrary(GAMES));

    const { user } = renderHome();
    await user.type(screen.getByPlaceholderText(/steam username/i), "gaben");
    await user.click(screen.getByRole("button", { name: /load library/i }));
    await screen.findByRole("button", { name: /load library/i });

    // Click Spin with no genre — fetch should not be called again
    await user.click(screen.getByRole("button", { name: /spin/i }));

    // Only the initial library fetch should have happened
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

// ---- Installed game list ----------------------------------------------------

describe("Installed game list toggle", () => {
  const GAMES = [
    { appid: 730, name: "Counter-Strike 2" },
    { appid: 440, name: "Team Fortress 2" },
  ];

  async function loadGames(user) {
    vi.stubGlobal("fetch", mockFetchLibrary(GAMES));
    await user.type(screen.getByPlaceholderText(/steam username/i), "gaben");
    await user.click(screen.getByRole("button", { name: /load library/i }));
    await screen.findByRole("button", { name: /load library/i });
  }

  test("shows the game list when the toggle is clicked", async () => {
    const { user } = renderHome();
    await loadGames(user);

    await user.click(screen.getByRole("button", { name: /show installed game list/i }));

    await waitFor(() => {
      expect(screen.getByRole("list")).toBeInTheDocument();
    });
  });

  test("hides the game list when the toggle is clicked a second time", async () => {
    const { user } = renderHome();
    await loadGames(user);

    const toggle = screen.getByRole("button", { name: /show installed game list/i });
    await user.click(toggle);
    await screen.findByRole("list");

    await user.click(screen.getByRole("button", { name: /collapse/i }));

    await waitFor(() => {
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });
  });

  test("marks a game as installed when its button is clicked", async () => {
    const { user } = renderHome();
    await loadGames(user);

    await user.click(screen.getByRole("button", { name: /show installed game list/i }));
    await screen.findByRole("list");

    const cs2Row = screen.getByText("Counter-Strike 2").closest("li");
    await user.click(within(cs2Row).getByRole("button"));

    expect(within(cs2Row).getByRole("button")).toHaveTextContent("Installed");
  });

  test("persists the installed set to localStorage when a game is toggled", async () => {
    const { user } = renderHome();
    await loadGames(user);

    await user.click(screen.getByRole("button", { name: /show installed game list/i }));
    await screen.findByRole("list");

    const cs2Row = screen.getByText("Counter-Strike 2").closest("li");
    await user.click(within(cs2Row).getByRole("button"));

    const saved = JSON.parse(localStorage.getItem("installed"));
    expect(saved).toContain(730);
  });

  test("un-marks a game when its Installed button is clicked again", async () => {
    const { user } = renderHome();
    await loadGames(user);

    await user.click(screen.getByRole("button", { name: /show installed game list/i }));
    await screen.findByRole("list");

    const cs2Row = screen.getByText("Counter-Strike 2").closest("li");
    await user.click(within(cs2Row).getByRole("button")); // mark installed
    await user.click(within(cs2Row).getByRole("button")); // un-mark

    expect(within(cs2Row).getByRole("button")).toHaveTextContent("Not Installed");
  });
});

