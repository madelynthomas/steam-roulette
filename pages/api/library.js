export default async function handler(req, res) {
  let { steamid } = req.query;

  if (!steamid) {
    return res.status(400).json({ error: "steamid is required" });
  }

  // Steam IDs are always exactly 17 digits; anything else is a vanity URL that needs resolving first
  if (!/^\d{17}$/.test(steamid)) {
    const vanityRes = await fetch(
      `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${process.env.STEAM_API_KEY}&vanityurl=${steamid}`,
    );
    const vanityData = await vanityRes.json();

    // Steam API returns numeric 1 for success, not a boolean
    if (vanityData.response.success !== 1) {
      return res.status(404).json({ error: "Steam user not found" });
    }

    steamid = vanityData.response.steamid;
  }

  // include_appinfo=1 is required — without it Steam only returns appids, not game names
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${process.env.STEAM_API_KEY}&steamid=${steamid}&include_appinfo=1&format=json`;
  const response = await fetch(url);
  const data = await response.json();

  res.status(200).json(data.response);
}
