/* eslint-disable @next/next/no-img-element -- Next.js <Image> requires known dimensions or domain config; neither works cleanly for Steam's CDN */
import { useState, useEffect } from "react";

const MAX_ATTEMPTS = 20;

export default function Home() {
  const [steamid, setSteamid] = useState("");
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [genre, setGenre] = useState("");
  const [suggestion, setSuggestion] = useState(null);
  const [installed, setInstalled] = useState(new Set());
  const [installedOnly, setInstalledOnly] = useState(false);
  const [showInstalledList, setShowInstalledList] = useState(false);

  // localStorage is unavailable during SSR — useEffect ensures this runs on the client only
  useEffect(() => {
    const previousId = localStorage.getItem("steamid");
    const saved = localStorage.getItem("installed");
    const savedGames = localStorage.getItem("games");
    // eslint-disable-next-line
    setSteamid(previousId);
    if (saved) setInstalled(new Set(JSON.parse(saved)));
    if (savedGames) setGames(JSON.parse(savedGames));
  }, []);

  async function fetchLibrary() {
    setLoading(true);
    const res = await fetch(`/api/library?steamid=${steamid}`);
    const data = await res.json();
    // Steam returns an empty object (no `games` key) for private profiles or accounts with no games
    const sorted = (data.games || []).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    setGames(sorted);
    localStorage.setItem("games", JSON.stringify(sorted));
    setLoading(false);
  }

  async function spin() {
    if (!genre || games.length === 0) return;

    setLoading(true);
    setSuggestion(null);

    const pool = installedOnly
      ? games.filter((g) => installed.has(g.appid))
      : games;
    // Genre data requires a separate API call per game, so we can't pre-filter.
    // Pick a random game, check its genres, and retry up to MAX_ATTEMPTS times if no match.
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const randomGame = pool[Math.floor(Math.random() * pool.length)];
      const res = await fetch(`/api/gamedetails?appid=${randomGame.appid}`);
      const data = await res.json();

      // DLC, soundtracks, and software tools on Steam often have no genre data
      if (!data?.genres) continue;
      // Partial, case-insensitive match — "RPG" will match "Action RPG", "Tactical RPG", etc.
      const matches = data.genres.some((g) =>
        g.description.toLowerCase().includes(genre.toLowerCase()),
      );

      if (matches) {
        setSuggestion(randomGame);
        setLoading(false);
        return;
      }
    }

    // Sentinel object — distinguishes "spin ran but found nothing" from null ("spin hasn't run yet")
    setSuggestion({ notFound: true });
    setLoading(false);
  }

  function toggleInstalled(appid) {
    setInstalled((prev) => {
      const next = new Set(prev); // React state must be immutable; copy before modifying
      if (next.has(appid)) {
        next.delete(appid);
      } else {
        next.add(appid);
      }
      // localStorage sync happens inside the updater so it always reflects the final state value
      localStorage.setItem("installed", JSON.stringify([...next]));
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Steam Roulette</h1>

      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={steamid}
          onChange={(e) => {
            setSteamid(e.target.value);
            localStorage.setItem("steamid", e.target.value);
          }}
          placeholder="Enter your Steam username or Steam ID"
          className="bg-gray-700 px-4 py-2 rounded w-82"
        />
        <button
          onClick={fetchLibrary}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
        >
          {loading ? "Loading..." : "Load Library"}
        </button>
      </div>

      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={genre}
          onChange={(e) => {
            setGenre(e.target.value);
            setSuggestion(null); // clear stale result so a previous spin doesn't show for a new genre
          }}
          placeholder="Enter a genre (e.g. Action, RPG)"
          className="bg-gray-700 px-4 py-2 rounded w-66"
        />
        <button
          onClick={spin}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
        >
          Spin
        </button>
      </div>
      <div className="flex gap-2 mb-8">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={installedOnly}
            onChange={(e) => setInstalledOnly(e.target.checked)}
          />
          Installed games only
        </label>
      </div>

      {suggestion && (
        <div className="mt-8 p-6 bg-gray-800 rounded-lg mb-8">
          {suggestion.notFound ? (
            <p>
              ❌ No games found for &quot;<b>{genre}</b>&quot; after{" "}
              {MAX_ATTEMPTS} attempts. Try a different genre.
            </p>
          ) : (
            <div>
              <img
                src={`https://cdn.akamai.steamstatic.com/steam/apps/${suggestion.appid}/header.jpg`}
                alt={suggestion.name}
                className="rounded mb-4"
              />
              <p className="text-xl font-bold">🎮 {suggestion.name}</p>
            </div>
          )}
        </div>
      )}

      <button
        className={`${showInstalledList ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"} px-4 py-2 mb-4 rounded`}
        onClick={() => setShowInstalledList(!showInstalledList)}
      >
        {showInstalledList ? "Collapse" : "Show"} installed game list
      </button>
      {showInstalledList && (
        <ul className="space-y-1">
          {games.map((game) => (
            <li key={game.appid} className="flex items-center gap-3">
              <button
                onClick={() => toggleInstalled(game.appid)}
                className={`px-2 py-1 rounded text-sm ${installed.has(game.appid) ? "bg-green-600" : "bg-gray-600"}`}
              >
                {installed.has(game.appid) ? "Installed" : "Not Installed"}
              </button>
              {game.name}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
