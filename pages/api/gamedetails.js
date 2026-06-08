export default async function handler(req, res) {
  const { appid } = req.query;

  if (!appid) {
    return res.status(400).json({ error: "appid is required " });
  }

  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
  const response = await fetch(url);
  const data = await response.json();

  // Steam wraps the response as { [appid]: { success, data } } — unwrap to just the game data
  res.status(200).json(data[appid]?.data ?? null);
}
