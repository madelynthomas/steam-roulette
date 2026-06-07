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

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const randomGame = pool[Math.floor(Math.random() * pool.length)];
      const res = await fetch(`/api/gamedetails?appid=${randomGame.appid}`);
      const data = await res.json();

      if (!data?.genres) continue;
      const matches = data.genres.some((g) =>
        g.description.toLowerCase().includes(genre.toLowerCase()),
      );

      if (matches) {
        setSuggestion(randomGame);
        setLoading(false);
        return;
      }
    }

    setSuggestion({ notFound: true });
    setLoading(false);
  }

  function toggleInstalled(appid) {
    setInstalled((prev) => {
      const next = new Set(prev);
      if (next.has(appid)) {
        next.delete(appid);
      } else {
        next.add(appid);
      }
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
          placeholder="Enter your Steam Username or Steam ID"
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
            setSuggestion(null);
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
        <div className="mt-8 p-6 bg-gray-800 rounded-lg">
          {suggestion.notFound ? (
            <p>
              ❌ No games found for &quot;<b>{genre}</b>&quot; after{" "}
              {MAX_ATTEMPTS} attempts. Try a different genre.
            </p>
          ) : (
            <p className="text-xl font-bold">🎮 {suggestion.name}</p>
          )}
        </div>
      )}

      <ul className="space-y-1">
        {games.map((game) => (
          <li key={game.appid} className="flex items-center gap-3">
            <button
              onClick={() => toggleInstalled(game.appid)}
              className={`px-2 py-1 rounded text-sm ${
                installed.has(game.appid) ? "bg-green-600" : "bg-gray-600"
              }`}
            >
              {installed.has(game.appid) ? "Installed" : "Not Installed"}
            </button>
            {game.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
