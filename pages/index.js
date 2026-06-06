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
    </main>
  );
}
