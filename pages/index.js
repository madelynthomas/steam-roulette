import { useState } from "react";

export default function Home() {
  const [steamid, setSteamid] = useState("");
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);

  async function fetchLibrary() {
    setLoading(true);
    const res = await fetch(`/api/library?steamid=${steamid}`);
    const data = await res.json();
    setGames(data.games || []);
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
          className="bg-blue-600 px-4 py-2 rounded"
        />
        {loading ? "Loading..." : "Load Library"}
      </div>

      <ul>
        {games.map((game) => (
          <li key={game.appId}>{game.name}</li>
        ))}
      </ul>
    </main>
  );
}
