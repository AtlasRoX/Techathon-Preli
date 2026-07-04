import { Client, GatewayIntentBits, TextChannel, Partials } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import http from 'http';

// Interfaces matching backend entities
interface Device {
  id: string;
  room_id: string;
  name: string;
  type: 'fan' | 'light';
  status: boolean;
  wattage: number;
  last_changed_at: string;
}

interface Alert {
  id: string;
  room_id: string;
  type: 'after_hours' | 'continuous_usage';
  message: string;
  active: boolean;
  triggered_at: string;
  resolved_at: string | null;
}

// Load Environment Variables
const token = process.env.DISCORD_TOKEN;
const alertChannelId = process.env.DISCORD_CHANNEL_ID;
const geminiApiKey = process.env.GEMINI_API_KEY;
const nvidiaNimApiKey = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || process.env['setx NVIDIA_NIM_API_KEY'];
const backendApiUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';

// Supabase config (for Realtime WebSocket Alerts subscription only)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasSupabase = supabaseUrl && supabaseKey;
const supabase = hasSupabase ? createClient(supabaseUrl, supabaseKey) : null;

if (!token) {
  console.warn('[DISCORD BOT] WARNING: DISCORD_TOKEN is not set. Bot will not login.');
}

if (nvidiaNimApiKey) {
  console.log('[DISCORD BOT] NVIDIA NIM integration active (nvidia/nemotron-3-super-120b-a12b).');
} else if (geminiApiKey) {
  console.log('[DISCORD BOT] Gemini integration active as fallback.');
}

/**
 * Uses NVIDIA NIM (Nemotron-3 Super 120B) or Gemini API to turn a robotic message into a friendly, conversational response for the Boss.
 */
async function conversationalize(roboticText: string): Promise<string> {
  // Direct formatting to guarantee instant responses (<10ms) and clear, factual bullet points
  return roboticText
    .split('. ')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `• ${line}`)
    .join('\n');
}

// Map room commands to database room IDs
function resolveRoomId(input: string): string | null {
  const clean = input.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.includes('drawing')) return 'drawing-room';
  if (clean.includes('work1') || clean.includes('workroom1')) return 'work-room-1';
  if (clean.includes('work2') || clean.includes('workroom2')) return 'work-room-2';
  return null;
}

function formatRoomName(id: string): string {
  if (id === 'drawing-room') return 'Drawing Room';
  if (id === 'work-room-1') return 'Work Room 1';
  if (id === 'work-room-2') return 'Work Room 2';
  return id;
}

function formatSimulatedTime(isoStr: string): string {
  try {
    const date = new Date(isoStr);
    return date.toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch (err) {
    return 'unknown';
  }
}

if (token) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once('ready', () => {
    console.log('===================================================');
    console.log(`   Discord Bot is logged in as: ${client.user?.tag}   `);
    console.log(`   Communicating with Backend at: ${backendApiUrl} `);
    console.log('===================================================');

    if (supabase) {
      console.log('[DISCORD BOT] Subscribing to Supabase Realtime Alerts...');
      supabase
        .channel('discord-alerts')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'alerts' },
          async (payload) => {
            const alert = payload.new as Alert;
            if (alert.active) {
              console.log(`[DISCORD BOT] Realtime Alert received: ${alert.message}`);
              if (alertChannelId) {
                try {
                  const channel = await client.channels.fetch(alertChannelId);
                  if (channel?.isTextBased()) {
                    const conversationalAlert = await conversationalize(`⚠️ ALERT: ${alert.message}`);
                    await (channel as TextChannel).send(conversationalAlert);
                  }
                } catch (err) {
                  console.error('[DISCORD BOT] Failed to send proactive alert to Discord channel:', err);
                }
              } else {
                console.warn('[DISCORD BOT] Realtime Alert triggered, but DISCORD_CHANNEL_ID is not configured.');
              }
            }
          }
        )
        .subscribe((status) => {
          console.log(`[DISCORD BOT] Supabase Realtime alerts subscription status: ${status}`);
        });
    }
  });

  // Helper for generic LLM questions
  async function handleGenericLLMChat(message: any, userQuestion: string) {
    let officeContextStr = '';
    try {
      const [resDevices, resPower, resConsumption, resAlerts] = await Promise.all([
        fetch(`${backendApiUrl}/api/devices`).then((r) => r.json()),
        fetch(`${backendApiUrl}/api/power`).then((r) => r.json()),
        fetch(`${backendApiUrl}/api/consumption`).then((r) => r.json()),
        fetch(`${backendApiUrl}/api/alerts`).then((r) => r.json()),
      ]) as [any, any, any, any];

      const activeAlerts = Array.isArray(resAlerts) ? resAlerts : [];
      const devicesList = Array.isArray(resDevices) ? resDevices : [];
      
      const currentSimTime = resPower.simulatedTime ? formatSimulatedTime(resPower.simulatedTime) : 'unknown';
      officeContextStr = `Current Simulated Time: ${currentSimTime}\n` +
        `Current Voltage: ${resPower.voltage}V\n` +
        `Current Total Power Draw: ${resPower.currentPower}W\n` +
        `Today's Total Energy Used: ${resConsumption.dailyKWh} kWh (Cost: ${resConsumption.totalCostBDT} BDT)\n` +
        `Room Power Draw:\n` +
        Object.entries(resPower.roomBreakdown || {}).map(([r, w]) => `  - ${r}: ${w}W`).join('\n') + `\n` +
        `Active Alerts:\n` +
        (activeAlerts.length === 0 ? '  - None' : activeAlerts.map(a => `  - ${a.message}`).join('\n')) + `\n` +
        `Device Statuses:\n` +
        devicesList.map(d => `  - [${d.room_id}] ${d.name} (${d.type}): ${d.status ? 'ON' : 'OFF'} (Wattage: ${d.wattage}W, Last changed: ${formatSimulatedTime(d.last_changed_at)})`).join('\n');
    } catch (err) {
      officeContextStr = 'Failed to fetch active context from backend API.';
    }

    const systemPrompt = 
      `You are a professional, direct, and factual office assistant for "Chrono Office". ` +
      `The office has three rooms: Drawing Room, Work Room 1, and Work Room 2. ` +
      `Two employees work here: Nafisa Rahman (nafisa.rahman@yahoo.com) and Tanvir Hossain (tanvir.hossain@yahoo.com). ` +
      `Office hours are 9 AM to 5 PM. ` +
      `Here is the live office status data:\n` +
      `========================================\n` +
      `${officeContextStr}\n` +
      `========================================\n\n` +
      `Answer the user's question directly and professionally based only on the facts above. ` +
      `Rules:\n` +
      `- Answer the question directly in 1-3 sentences or clean Markdown bullet points.\n` +
      `- Focus strictly on exact data facts. Do not write speculative fluff, guess employee actions, or make assumptions (do not say "perhaps Nafisa popped out" or "maybe they forgot").\n` +
      `- Keep all numbers and details exact. Do not invent any numbers.\n` +
      `- If the question cannot be answered using the data (e.g. general questions), answer politely but directly.`;

    let responseText = '';

    if (nvidiaNimApiKey) {
      try {
        const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${nvidiaNimApiKey}`
          },
          body: JSON.stringify({
            model: 'nvidia/nemotron-3-super-120b-a12b',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userQuestion }
            ],
            temperature: 0.1,
            max_tokens: 512
          })
        });

        if (response.ok) {
          const data = await response.json() as any;
          responseText = data?.choices?.[0]?.message?.content?.trim() || '';
        }
      } catch (err) {
        console.error('[DISCORD BOT] LLM Chat error (NVIDIA):', err);
      }
    }

    if (!responseText && geminiApiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nUser Question: ${userQuestion}` }]
              }
            ],
            generationConfig: {
              temperature: 0.1
            }
          })
        });

        if (response.ok) {
          const data = await response.json() as any;
          responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        }
      } catch (err) {
        console.error('[DISCORD BOT] LLM Chat error (Gemini):', err);
      }
    }

    if (!responseText) {
      responseText = `• Sorry Boss, I couldn't reach the AI model right now. Please use !status or !usage to check the stats.`;
    }

    await message.reply(responseText);
  }

  // Handle commands by querying Backend API
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    let content = message.content.trim();
    const botMention = `<@${client.user?.id}>`;
    const botMentionNick = `<@!${client.user?.id}>`;
    
    let isMentioned = false;
    if (content.startsWith(botMention)) {
      content = content.slice(botMention.length).trim();
      isMentioned = true;
    } else if (content.startsWith(botMentionNick)) {
      content = content.slice(botMentionNick.length).trim();
      isMentioned = true;
    } else if (message.mentions.has(client.user!)) {
      isMentioned = true;
    }

    const isCommand = content.startsWith('!');
    if (!isCommand && !isMentioned) return;

    // Extract raw input
    let rawInput = content;
    if (isCommand) {
      rawInput = content.slice(1);
    }

    const args = rawInput.split(/ +/);
    const firstWord = args.shift()?.toLowerCase() || '';

    // Map command keywords
    let command = '';
    if (['help', 'commands'].includes(firstWord)) command = 'help';
    else if (['status', 'devices', 'all'].includes(firstWord)) command = 'status';
    else if (['room', 'inspect'].includes(firstWord)) command = 'room';
    else if (['usage', 'power', 'load', 'consumption'].includes(firstWord)) command = 'usage';
    else if (['alerts', 'alert', 'anomalies'].includes(firstWord)) command = 'alerts';
    else if (['logs', 'history', 'log'].includes(firstWord)) command = 'logs';
    else if (['records', 'consumptionlogs', 'consumptionhistory', 'record'].includes(firstWord)) command = 'records';

    try {
      if (command === 'help') {
        const helpMsg = `**Chrono Office Bot Commands:**
• \`!help\` - Show this help menu.
• \`!status\` - Device status summary for each room.
• \`!room <name>\` - Detailed room status, power draw, and cost.
• \`!usage\` - Total power, daily consumption (kWh), cost, and room breakdown.
• \`!alerts\` - Check active office alerts.
• \`!logs\` - Check recent device on/off transition events.
• \`!records\` - Check recent hourly consumption records.`;
        await message.reply(helpMsg);
      }

      else if (command === 'status') {
        const res = await fetch(`${backendApiUrl}/api/devices`);
        if (!res.ok) throw new Error(`Backend API returned status ${res.status}`);
        const devices = (await res.json()) as Device[];

        // Group by room
        const roomGroups: Record<string, { fansOn: number; lightsOn: number; totalFans: number; totalLights: number }> = {
          'drawing-room': { fansOn: 0, lightsOn: 0, totalFans: 0, totalLights: 0 },
          'work-room-1': { fansOn: 0, lightsOn: 0, totalFans: 0, totalLights: 0 },
          'work-room-2': { fansOn: 0, lightsOn: 0, totalFans: 0, totalLights: 0 },
        };

        devices.forEach((device) => {
          const group = roomGroups[device.room_id];
          if (group) {
            if (device.type === 'fan') {
              group.totalFans++;
              if (device.status) group.fansOn++;
            } else {
              group.totalLights++;
              if (device.status) group.lightsOn++;
            }
          }
        });

        const statusLines = Object.entries(roomGroups).map(([roomId, data]) => {
          const roomName = formatRoomName(roomId);
          if (data.fansOn === 0 && data.lightsOn === 0) {
            return `${roomName}: all off.`;
          }
          
          const fanStr = `${data.fansOn} fan${data.fansOn !== 1 ? 's' : ''} ON`;
          const lightStr = `${data.lightsOn} light${data.lightsOn !== 1 ? 's' : ''} ON`;
          return `${roomName}: ${fanStr}, ${lightStr}.`;
        });

        const roboticResponse = statusLines.join(' ');
        const finalResponse = await conversationalize(roboticResponse);
        await message.reply(finalResponse);
      }

      else if (command === 'room') {
        const queryRoom = args.join(' ');
        if (!queryRoom) {
          await message.reply('Which room would you like to check, Boss? Try `!room Drawing Room` or `!room Work Room 1`.');
          return;
        }

        const roomId = resolveRoomId(queryRoom);
        if (!roomId) {
          await message.reply(`Hmm, I couldn't find a room matching "${queryRoom}". We have: Drawing Room, Work Room 1, and Work Room 2.`);
          return;
        }

        // Fetch devices list
        const resDevices = await fetch(`${backendApiUrl}/api/devices`);
        if (!resDevices.ok) throw new Error(`Devices API returned status ${resDevices.status}`);
        const allDevices = (await resDevices.json()) as Device[];
        
        // Fetch current power breakdown
        const resPower = await fetch(`${backendApiUrl}/api/power`);
        let roomPower = 0;
        if (resPower.ok) {
          const powerData = (await resPower.json()) as { roomBreakdown?: Record<string, number> };
          roomPower = powerData.roomBreakdown?.[roomId] ?? 0;
        }

        // Fetch consumption breakdown
        const resConsumption = await fetch(`${backendApiUrl}/api/consumption`);
        let roomKWh = 0;
        let roomCost = 0;
        if (resConsumption.ok) {
          const consumptionData = (await resConsumption.json()) as { rooms?: Array<{ roomId: string; kwh: number; costBDT: number }> };
          const targetRoom = consumptionData.rooms?.find((r) => r.roomId === roomId);
          if (targetRoom) {
            roomKWh = targetRoom.kwh;
            roomCost = targetRoom.costBDT;
          }
        }

        const devices = allDevices.filter((d) => d.room_id === roomId);
        const fans = devices.filter((d) => d.type === 'fan');
        const lights = devices.filter((d) => d.type === 'light');
        const fansOn = fans.filter((d) => d.status).length;
        const lightsOn = lights.filter((d) => d.status).length;

        const roomName = formatRoomName(roomId);
        const roboticResponse = `${roomName} currently has ${fansOn} of ${fans.length} fans ON, and ${lightsOn} of ${lights.length} lights ON. ` +
          `The room is drawing ${roomPower}W right now. Today's usage for this room is ${roomKWh} kWh, costing estimated ${roomCost} BDT.`;
        const finalResponse = await conversationalize(roboticResponse);
        await message.reply(finalResponse);
      }

      else if (command === 'usage') {
        const resPower = await fetch(`${backendApiUrl}/api/power`);
        if (!resPower.ok) throw new Error(`Power API returned status ${resPower.status}`);
        const powerData = (await resPower.json()) as { currentPower: number; voltage: number; simulatedTime: string; roomBreakdown?: Record<string, number> };

        const resConsumption = await fetch(`${backendApiUrl}/api/consumption`);
        if (!resConsumption.ok) throw new Error(`Consumption API returned status ${resConsumption.status}`);
        const consumptionData = (await resConsumption.json()) as { dailyKWh: number; totalCostBDT: number; rooms?: Array<{ roomId: string; kwh: number; costBDT: number }> };

        // Format simulated time nicely
        const simTimeStr = formatSimulatedTime(powerData.simulatedTime);

        // Room breakdowns
        const roomBreakdowns = powerData.roomBreakdown || {};
        const roomLines = Object.entries(roomBreakdowns).map(([rId, power]) => {
          const roomName = formatRoomName(rId);
          const cons = consumptionData.rooms?.find((r) => r.roomId === rId);
          const kwh = cons ? cons.kwh : 0;
          const cost = cons ? cons.costBDT : 0;
          return `${roomName}: drawing ${power}W, today's total is ${kwh} kWh (${cost} BDT).`;
        });

        const roboticResponse = `Office electricity status at simulated time ${simTimeStr} (Voltage: ${powerData.voltage}V): ` +
          `Total power load is ${powerData.currentPower}W. ` +
          `Today's total usage is ${consumptionData.dailyKWh} kWh, costing estimated ${consumptionData.totalCostBDT} BDT. ` +
          `Breakdown: ${roomLines.join(' ')}`;

        const finalResponse = await conversationalize(roboticResponse);
        await message.reply(finalResponse);
      }

      else if (command === 'alerts') {
        const res = await fetch(`${backendApiUrl}/api/alerts`);
        if (!res.ok) throw new Error(`Alerts API returned status ${res.status}`);
        const activeAlerts = (await res.json()) as Alert[];

        let roboticResponse = '';
        if (activeAlerts.length === 0) {
          roboticResponse = 'All clear! There are no active alerts or anomalies in the office right now.';
        } else {
          const alertLines = activeAlerts.map((alert) => {
            const timeStr = formatSimulatedTime(alert.triggered_at);
            return `[${timeStr}] ${alert.message}`;
          });
          roboticResponse = `Alerts currently active: ${alertLines.join('; ')}`;
        }

        const finalResponse = await conversationalize(roboticResponse);
        await message.reply(finalResponse);
      }
      else if (command === 'logs') {
        const res = await fetch(`${backendApiUrl}/api/devices/history`);
        if (!res.ok) throw new Error(`History API returned status ${res.status}`);
        const history = (await res.json()) as any[];

        let roboticResponse = '';
        if (history.length === 0) {
          roboticResponse = 'No device event logs found in the database.';
        } else {
          const logLines = history.slice(0, 5).map((log) => {
            const timeStr = formatSimulatedTime(log.changed_at);
            const devName = log.devices?.name || 'Device';
            const roomName = formatRoomName(log.devices?.room_id || '');
            const action = log.new_status ? 'turned ON' : 'turned OFF';
            return `[${timeStr}] ${devName} in ${roomName} was ${action}.`;
          });
          roboticResponse = `Recent device events: ${logLines.join(' ')}`;
        }

        const finalResponse = await conversationalize(roboticResponse);
        await message.reply(finalResponse);
      }

      else if (command === 'records') {
        const res = await fetch(`${backendApiUrl}/api/consumption/logs`);
        if (!res.ok) throw new Error(`Consumption logs API returned status ${res.status}`);
        const logs = (await res.json()) as any[];

        let roboticResponse = '';
        if (logs.length === 0) {
          roboticResponse = 'No consumption records found in the database.';
        } else {
          const recordLines = logs.slice(0, 5).map((log) => {
            const timeStr = formatSimulatedTime(log.sim_time);
            const roomName = formatRoomName(log.room_id);
            return `[${timeStr}] ${roomName} consumed ${log.kwh.toFixed(4)} kWh (estimated cost: ৳${log.cost_bdt.toFixed(2)}).`;
          });
          roboticResponse = `Recent consumption records: ${recordLines.join(' ')}`;
        }

        const finalResponse = await conversationalize(roboticResponse);
        await message.reply(finalResponse);
      }

      else if (isMentioned) {
        // Fallback: If bot was mentioned but no specific command keyword was matched, 
        // treat it as a conversational question using the live office database context!
        await handleGenericLLMChat(message, rawInput);
      }
    } catch (err) {
      console.error(err);
      await message.reply('Sorry Boss, I ran into an error while fetching the data from the office!');
    }
  });

  client.login(token).catch((err) => {
    console.error('[DISCORD BOT] Failed to login to Discord:', err);
  });

  // Create a keep-alive HTTP server for Render hosting
  const PORT = process.env.PORT || 3001;
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(PORT, () => {
    console.log(`[DISCORD BOT] Keep-alive HTTP server listening on port ${PORT}`);
  });
}
