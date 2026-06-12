# Steam Roulette

A Next.js app that picks a random game from your Steam library that matches a genre you choose. Load your library once, mark which games are installed, then spin to get a suggestion.

## Features

- **Library loader** — enter your Steam username or 64-bit Steam ID to fetch your full game library
- **Genre spin** — type any genre (e.g. "Action", "RPG", "Puzzle") and hit Spin to get a random matching game
- **Installed filter** — toggle "Installed games only" to limit spins to games you've marked as installed
- **Installed game list** — expand a checklist of your library to mark which titles are installed
- **Persistence** — your Steam ID, game library, and installed selections are saved in `localStorage` so they survive page reloads

## Getting Started

### Prerequisites

You need a [Steam Web API key](https://steamcommunity.com/dev/apikey). Your Steam profile must also be set to **public** for the library fetch to work.

### Setup

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` file in the project root with your Steam API key:

   ```
   STEAM_API_KEY=your_key_here
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

1. Enter your **Steam username** (vanity URL) or **17-digit Steam ID** and click **Load Library**
2. Type a **genre** in the genre field (partial matches work — "RPG" will match "Action RPG", "Tactical RPG", etc.)
3. Click **Spin** — the app picks a random game from your library, checks its genres via the Steam store API, and keeps trying until it finds a match (up to 20 attempts)
4. Optionally click **Show installed game list** to mark which games you have installed, then check **Installed games only** to restrict spins to that subset

## Project Structure

```
pages/
  index.js          # Main UI — library loader, genre input, spin logic, installed list
  api/
    library.js      # Fetches owned games from Steam; resolves vanity URLs to Steam IDs
    gamedetails.js  # Fetches genre data for a single game from the Steam store API
styles/
  globals.css       # Tailwind base styles
```

## Tech Stack

- [Next.js 16](https://nextjs.org) (Pages Router)
- [React 19](https://react.dev)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Steam Web API](https://developer.valvesoftware.com/wiki/Steam_Web_API)
