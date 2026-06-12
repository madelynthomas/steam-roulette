import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "../../pages/index";

// ---- Helpers ----------------------------------------------------------------

// Returns a stubbed fetch that resolves with a library response.
// Defined once here so every test that needs a loaded library uses identical data.
function mockFetchLibrary(games = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ games }),
  });
}

// Returns a stubbed fetch that resolves with a game details response.
function mockFetchGameDetails(genres = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ genres }),
  });
}

// Creates a userEvent instance alongside the render. The instance must be
// created before interactions begin — sharing one instance across a test
// preserves pointer/keyboard state (e.g. focus) between actions.
function renderHome() {
  const user = userEvent.setup();
  const view = render(<Home />);
  return { user, ...view };
}

// ---- Setup ------------------------------------------------------------------

beforeEach(() => {
  // Clear localStorage before each test so persisted state from one test can't
  // affect the next. Also restore any globals stubbed with vi.stubGlobal (e.g. fetch).
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  // Belt-and-suspenders clear: if a test throws mid-way, beforeEach of the
  // next test still runs first — this afterEach ensures we don't leave stale
  // localStorage behind even if the next beforeEach somehow doesn't.
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

    // The component reads localStorage inside a useEffect which runs after the
    // initial render — waitFor is required to catch the resulting state update.
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

    // Show the list so we can inspect the installed/not-installed button states
    await user.click(await screen.findByRole("button", { name: /show installed game list/i }));

    await waitFor(() => {
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
    // Hold the fetch promise open manually so we can assert on the loading state
    // before it resolves. We must resolve it at the end to avoid async leaks.
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

    // findByRole (not getByRole) waits for the async fetch to settle and the
    // button label to revert from "Loading..." back to "Show installed game list"
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
    // The first fetch call loads the library; all subsequent calls are game detail
    // lookups during spin. mockResolvedValueOnce handles the library call, and
    // mockResolvedValue (no Once) handles every detail call after that.
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
    // Wait for the button label to revert, confirming the fetch has settled
    await screen.findByRole("button", { name: /load library/i });

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
        // Returning null genres forces every attempt to fail — after MAX_ATTEMPTS
        // (20) the component renders the "not found" sentinel message.
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

    // Extended timeout: spin makes up to 20 sequential fetch calls before giving
    // up, which takes longer than the default 5 s assertion timeout.
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

    // The component clears the suggestion synchronously on genre input change
    // so the query result should be absent immediately — no waitFor needed.
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

    await user.click(screen.getByRole("button", { name: /spin/i }));

    // Only the initial library fetch should have happened — spin short-circuits
    // when genre is an empty string, so no gamedetails calls are made.
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

// ---- Installed game list ----------------------------------------------------

describe("Installed game list toggle", () => {
  const GAMES = [
    { appid: 730, name: "Counter-Strike 2" },
    { appid: 440, name: "Team Fortress 2" },
  ];

  // Shared setup: stub fetch, type a Steam ID, click Load Library, and wait
  // for the loading state to clear before each test in this describe block.
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

    // within() scopes queries to a specific DOM node — without it, getByRole("button")
    // would match every toggle button in the list, not just CS2's.
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
