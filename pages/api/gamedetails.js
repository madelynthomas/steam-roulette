export default async function handler(req, res) {
  const { appid } = req.query;

  if (!appid) {
    return res.status(400).json({ error: "appid is required " });
  }

  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
  const response = await fetch(url);
  const data = await response.json();

  res.status(200).json(data[appid]?.data ?? null);
}
