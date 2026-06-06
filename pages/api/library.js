export default async function handler(req, res) {
  const { steamid } = req.query;

  if (!steamid) {
    return res.status(400).json({ error: "steamid is required" });
  }

  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${process.env.STEAM_API_KEY}&steamid=${steamid}&include_appinfo=1&format=json`;

  const response = await fetch(url);
  const data = await response.json();

  res.status(200).json(data.response);
}
