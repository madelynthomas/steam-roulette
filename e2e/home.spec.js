import { test, expect } from "@playwright/test";

// ---- Fixtures / mock data ---------------------------------------------------

const MOCK_GAMES = [
  { appid: 730, name: "Counter-Strike 2" },
  { appid: 440, name: "Team Fortress 2" },
  { appid: 570, name: "Dota 2" },
];

const ACTION_GENRES = [{ id: "1", description: "Action" }];

// ---- Route interception helpers ---------------------------------------------

// page.route() intercepts matching network requests before they leave the
// browser — no real Steam API key is needed and responses are deterministic.
// Routes registered here apply for the lifetime of the page (or until replaced).
async function mockLibraryAPI(page, games = MOCK_GAMES) {
  await page.route("**/api/library**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ games }),
    }),
  );
}

async function mockGameDetailsAPI(page, genres = ACTION_GENRES) {
  await page.route("**/api/gamedetails**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ genres }),
    }),
  );
}

// ---- Page structure ---------------------------------------------------------

test.describe("Page structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the Steam Roulette heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Steam Roulette" })).toBeVisible();
  });

  test("shows the Steam ID input field", async ({ page }) => {
    await expect(
      page.getByPlaceholder("Enter your Steam username or Steam ID"),
    ).toBeVisible();
  });

  test("shows the Load Library button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Load Library" })).toBeVisible();
  });

  test("shows the genre input field", async ({ page }) => {
    await expect(
      page.getByPlaceholder(/enter a genre/i),
    ).toBeVisible();
  });

  test("shows the Spin button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Spin" })).toBeVisible();
  });

  test("shows the installed-games-only checkbox", async ({ page }) => {
    await expect(
      page.getByRole("checkbox", { name: /installed games only/i }),
    ).toBeVisible();
  });

  test("shows the installed game list toggle button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /show installed game list/i }),
    ).toBeVisible();
  });
});

// ---- Load Library flow ------------------------------------------------------

test.describe("Load Library", () => {
  test("fetches and displays games after entering a Steam ID", async ({ page }) => {
    await mockLibraryAPI(page);
    await page.goto("/");

    await page.getByPlaceholder(/steam username/i).fill("gaben");
    await page.getByRole("button", { name: "Load Library" }).click();

    // After load, open the game list
    await page.getByRole("button", { name: /show installed game list/i }).click();

    await expect(page.getByText("Counter-Strike 2")).toBeVisible();
    await expect(page.getByText("Team Fortress 2")).toBeVisible();
    await expect(page.getByText("Dota 2")).toBeVisible();
  });

  test("games appear in alphabetical order", async ({ page }) => {
    await mockLibraryAPI(page, [
      { appid: 1, name: "Zork" },
      { appid: 2, name: "Alchemy" },
    ]);
    await page.goto("/");

    await page.getByPlaceholder(/steam username/i).fill("gaben");
    await page.getByRole("button", { name: "Load Library" }).click();
    await page.getByRole("button", { name: /show installed game list/i }).click();

    const items = page.getByRole("listitem");
    await expect(items.first()).toContainText("Alchemy");
    await expect(items.nth(1)).toContainText("Zork");
  });
});

// ---- Spin flow --------------------------------------------------------------

test.describe("Spin", () => {
  // Load the library once before each spin test so individual tests only need
  // to set the genre and click Spin.
  test.beforeEach(async ({ page }) => {
    await mockLibraryAPI(page);
    await mockGameDetailsAPI(page, ACTION_GENRES);
    await page.goto("/");

    await page.getByPlaceholder(/steam username/i).fill("gaben");
    await page.getByRole("button", { name: "Load Library" }).click();
    // waitFor on the "Load Library" button: the component changes its label to
    // "Loading..." during the fetch and back when done — this line waits until
    // the original label reappears, confirming the library is ready.
    await page.getByRole("button", { name: "Load Library" }).waitFor();
  });

  test("displays a game suggestion when the genre matches", async ({ page }) => {
    await page.getByPlaceholder(/enter a genre/i).fill("Action");
    await page.getByRole("button", { name: "Spin" }).click();

    // Any of the three mock games could be picked — match any name in the result block
    const names = MOCK_GAMES.map((g) => g.name);
    await expect(page.locator(".mt-8")).toContainText(
      new RegExp(names.join("|")),
    );
  });

  test("shows a Steam header image in the suggestion block", async ({ page }) => {
    await page.getByPlaceholder(/enter a genre/i).fill("Action");
    await page.getByRole("button", { name: "Spin" }).click();

    const img = page.locator(".mt-8 img").first();
    await expect(img).toBeVisible();
    // Verify the image URL points to Steam's CDN, confirming the appid was
    // correctly embedded in the header image URL.
    await expect(img).toHaveAttribute("src", /steamstatic\.com/);
  });

  test("shows 'no games found' when no genre matches are found", async ({ page }) => {
    // Override the default gamedetails mock with one that returns null genres,
    // forcing every spin attempt to fail and triggering the not-found message.
    await page.route("**/api/gamedetails**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ genres: null }),
      }),
    );

    await page.getByPlaceholder(/enter a genre/i).fill("RPG");
    await page.getByRole("button", { name: "Spin" }).click();

    // Extended timeout: spin makes up to MAX_ATTEMPTS (20) sequential API calls
    // before giving up — 15 s accommodates the worst case.
    await expect(page.getByText(/no games found/i)).toBeVisible({ timeout: 15000 });
  });

  test("clears the suggestion when the genre input is changed", async ({ page }) => {
    await page.getByPlaceholder(/enter a genre/i).fill("Action");
    await page.getByRole("button", { name: "Spin" }).click();

    const names = MOCK_GAMES.map((g) => g.name);
    await page.locator(".mt-8").waitFor();

    // Changing genre clears the suggestion immediately
    await page.getByPlaceholder(/enter a genre/i).fill("RPG");
    for (const name of names) {
      await expect(page.getByText(name)).not.toBeVisible();
    }
  });
});

// ---- Installed game list ----------------------------------------------------

test.describe("Installed game list", () => {
  test.beforeEach(async ({ page }) => {
    await mockLibraryAPI(page);
    await page.goto("/");

    await page.getByPlaceholder(/steam username/i).fill("gaben");
    await page.getByRole("button", { name: "Load Library" }).click();
    await page.getByRole("button", { name: "Load Library" }).waitFor();
  });

  test("expands the game list when the Show button is clicked", async ({ page }) => {
    await page.getByRole("button", { name: /show installed game list/i }).click();
    await expect(page.getByRole("list")).toBeVisible();
  });

  test("collapses the game list when Collapse is clicked", async ({ page }) => {
    await page.getByRole("button", { name: /show installed game list/i }).click();
    await page.getByRole("list").waitFor();

    await page.getByRole("button", { name: /collapse/i }).click();
    await expect(page.getByRole("list")).not.toBeVisible();
  });

  test("marks a game as installed and persists it across reload", async ({ page }) => {
    await page.getByRole("button", { name: /show installed game list/i }).click();
    await page.getByRole("list").waitFor();

    // filter({ hasText }) scopes the locator to the exact list item — avoids
    // the strict-mode error that occurs when locator("..") climbs to a parent
    // shared by multiple items.
    const cs2Row = page.getByRole("listitem").filter({ hasText: "Counter-Strike 2" });
    await cs2Row.getByRole("button").click();
    await expect(cs2Row.getByRole("button")).toHaveText("Installed");

    // Re-register the mock before reload — Playwright clears route handlers on
    // navigation, so without this the reload would hit the real API.
    await mockLibraryAPI(page);
    await page.reload();
    await page.getByRole("button", { name: /show installed game list/i }).click();
    await page.getByRole("list").waitFor();

    const cs2RowAfter = page.getByRole("listitem").filter({ hasText: "Counter-Strike 2" });
    await expect(cs2RowAfter.getByRole("button")).toHaveText("Installed");
  });

  test("un-marks a game when the Installed button is clicked again", async ({ page }) => {
    await page.getByRole("button", { name: /show installed game list/i }).click();
    await page.getByRole("list").waitFor();

    const cs2Row = page.getByRole("listitem").filter({ hasText: "Counter-Strike 2" });
    await cs2Row.getByRole("button").click(); // mark installed
    await cs2Row.getByRole("button").click(); // un-mark

    await expect(cs2Row.getByRole("button")).toHaveText("Not Installed");
  });
});

// ---- Installed-only filter --------------------------------------------------

test.describe("Installed-only filter", () => {
  test("spin only picks from installed games when the filter is on", async ({ page }) => {
    // Track which appids the spin logic queries — captured from the intercepted
    // gamedetails URL so we can assert the filter is actually narrowing the pool.
    const spunAppIds = [];

    await page.route("**/api/library**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          games: [
            { appid: 730, name: "Counter-Strike 2" },
            { appid: 440, name: "Team Fortress 2" },
          ],
        }),
      }),
    );

    await page.route("**/api/gamedetails**", (route) => {
      const url = new URL(route.request().url());
      spunAppIds.push(Number(url.searchParams.get("appid")));
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ genres: ACTION_GENRES }),
      });
    });

    await page.goto("/");
    await page.getByPlaceholder(/steam username/i).fill("gaben");
    await page.getByRole("button", { name: "Load Library" }).click();
    await page.getByRole("button", { name: "Load Library" }).waitFor();

    // Mark only CS2 as installed, leaving TF2 as not installed
    await page.getByRole("button", { name: /show installed game list/i }).click();
    await page.getByRole("list").waitFor();
    const cs2Row = page.getByRole("listitem").filter({ hasText: "Counter-Strike 2" });
    await cs2Row.getByRole("button").click();

    await page.getByRole("checkbox", { name: /installed games only/i }).check();

    // Spin five times and confirm the filter held — only appid 730 (CS2) should
    // ever be queried, never 440 (TF2).
    for (let i = 0; i < 5; i++) {
      spunAppIds.length = 0;
      await page.getByPlaceholder(/enter a genre/i).fill("Action");
      await page.getByRole("button", { name: "Spin" }).click();
      await page.locator(".mt-8").waitFor();
      expect(spunAppIds.every((id) => id === 730)).toBe(true);

      // Clearing the genre field resets the suggestion so the next iteration
      // starts from a clean state. Two fills are used: the first triggers the
      // onChange clear, the second sets up the value for the next spin.
      await page.getByPlaceholder(/enter a genre/i).fill("");
      await page.getByPlaceholder(/enter a genre/i).fill("Action");
    }
  });
});

// ---- localStorage persistence across reload ---------------------------------

test.describe("localStorage persistence", () => {
  test("Steam ID input survives a page reload", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/steam username/i).fill("gaben");
    await page.reload();

    await expect(page.getByPlaceholder(/steam username/i)).toHaveValue("gaben");
  });

  test("game library survives a page reload (no re-fetch needed)", async ({ page }) => {
    await mockLibraryAPI(page);
    await page.goto("/");

    await page.getByPlaceholder(/steam username/i).fill("gaben");
    await page.getByRole("button", { name: "Load Library" }).click();
    await page.getByRole("button", { name: "Load Library" }).waitFor();

    await page.reload();

    // The component restores the game list from localStorage on mount — the user
    // should not have to click Load Library again after a reload.
    await page.getByRole("button", { name: /show installed game list/i }).click();
    await expect(page.getByText("Counter-Strike 2")).toBeVisible();
  });
});
