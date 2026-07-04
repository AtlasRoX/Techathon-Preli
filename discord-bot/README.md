# Chrono Office Discord Bot

This Discord bot monitors electricity usage, device statuses, and alerts at the Chrono Office directly from Discord. It uses NVIDIA NIM and Gemini API to turn robotic database statistics into friendly, conversational reports.

## Prerequisites
- Node.js (v18+)
- A running instance of the backend server (typically at `http://localhost:3000`)

## Configuration
Create a `.env.local` file in this directory (`discord-bot/.env.local`) and configure the following environment variables:

```env
# Discord Token and Channel ID
DISCORD_TOKEN=your-discord-bot-token
DISCORD_CHANNEL_ID=your-designated-alerts-channel-id

# LLM integration (NVIDIA NIM or Gemini API key)
NVIDIA_NIM_API_KEY=your-nvidia-nim-api-key
# GEMINI_API_KEY=your-gemini-api-key # Optional fallback

# Backend URL (default is http://localhost:3000)
BACKEND_API_URL=http://localhost:3000

# Supabase Configurations (for real-time alert pushes)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

## Running the Bot

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the bot in development mode:
   ```bash
   npm run dev
   ```

3. Start the bot in production mode:
   ```bash
   npm start
   ```

## Usage & Commands

All commands are prefixed with `!`.

- **`!help`**: Displays the bot's command guide.
- **`!status`**: Shows a quick overview of which devices (fans, lights) are currently running in each room.
- **`!room <room name>`**: Get detailed status of a specific room (Drawing Room, Work Room 1, Work Room 2) with active devices, live power draw (Watts), and today's energy cost (BDT).
  - Example: `!room drawing room`, `!room work room 1`, `!room work 2`
- **`!usage`**: Shows total office power load (W), current voltage (V), simulated time, daily energy consumption (kWh), cost (BDT), and per-room breakdowns.
- **`!alerts`**: Shows active alerts (After Hours / Continuous Usage) in the office.

*Note: The bot also proactively posts to the configured `DISCORD_CHANNEL_ID` in real-time when new alerts are triggered.*

## Cloud Deployment (Render)

This bot includes a built-in keep-alive HTTP server on `process.env.PORT || 3001` so it can be hosted on **Render** (Free Web Service tier) without crashing during the port-binding health check.

### Steps to Deploy on Render:
1. Connect your GitHub account to Render and create a new **Web Service** using this repository.
2. Configure settings:
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
3. Add the following **Environment Variables** in the Render settings:
   * `DISCORD_TOKEN` = *(Your Discord Bot Token)*
   * `DISCORD_CHANNEL_ID` = *(Your channel ID for proactive alerts)*
   * `BACKEND_API_URL` = `https://project-iut-alert-backend.vercel.app`
   * `NEXT_PUBLIC_SUPABASE_URL` = `https://atsadnuohuvlxjoqyjwh.supabase.co`
   * `SUPABASE_SERVICE_ROLE_KEY` = *(Your Supabase Service Role Key)*
   * `NVIDIA_NIM_API_KEY` = *(Your NVIDIA NIM API key)*
4. Deploy the service.

### Keeping the Bot Awake:
Render's free tier services spin down after 15 minutes of inactivity. To keep the bot running 24/7:
1. Copy your Render service URL (e.g., `https://your-bot.onrender.com`).
2. Set up a free account at **[UptimeRobot](https://uptimerobot.com/)** or **[Cron-Job.org](https://cron-job.org/)**.
3. Create a new HTTP monitor pointing to:
   `https://your-bot.onrender.com/health`
4. Set the check interval to every **10 minutes**. This will ping the built-in HTTP server, preventing the bot from sleeping.
