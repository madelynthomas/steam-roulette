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
    const saved = localStorage.getItem("installed");
    // eslint-disable-next-line
    if (saved) setInstalled(new Set(JSON.parse(saved)));
  }, []);

  async function fetchLibrary() {
    setLoading(true);
    const res = await fetch(`/api/library?steamid=${steamid}`);
    const data = await res.json();
    setGames((data.games || []).sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  }

  async function spin() {
    if (!genre || games.length === 0) return;

    setLoading(true);
    setSuggestion(null);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const randomGame = games[Math.floor(Math.random() * games.length)];
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

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Steam Roulette</h1>

      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={steamid}
          onChange={(e) => setSteamid(e.target.value)}
          placeholder="Enter your Steam ID"
          className="bg-gray-700 px-4 py-2 rounded w-64"
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
          className="bg-gray-700 px-4 py-2 rounded w-64"
        />
        <button
          onClick={spin}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
        >
          Spin
        </button>
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

      <ul>
        {games.map((game) => (
          <li key={game.appid}>{game.name}</li>
        ))}
      </ul>
    </main>
  );
}
