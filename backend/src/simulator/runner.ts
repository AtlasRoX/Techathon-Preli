import path from 'path';
import fs from 'fs/promises';

const stateFilePath = path.resolve(process.cwd(), '../simulation_state.json');

/** 1 kWh = 13.01 BDT */
const BDT_PER_KWH = 13.01;

/** Sleep helper */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Clamp a number between min and max */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Gaussian-ish noise via Box-Muller (returns a value near 0) */
function gaussianNoise(sigma: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─────────────────────────────────────────────────────────────────
// Backend URL config
// ─────────────────────────────────────────────────────────────────
const backendApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
interface DeviceRow {
  id: string;
  name: string;
  type: 'fan' | 'light';
  room_id: string;
  status: boolean;
  wattage: number;
}

// ─────────────────────────────────────────────────────────────────
// Device helpers
// ─────────────────────────────────────────────────────────────────
async function getAllDevices(): Promise<DeviceRow[]> {
  try {
    const res = await fetch(`${backendApiUrl}/api/devices`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data as DeviceRow[];
  } catch (err) {
    console.error('[SIMULATOR] Failed to fetch devices from backend:', err);
    throw err;
  }
}

/** Send a state change for a single device to the backend */
async function reportDeviceState(
  deviceId: string,
  roomId: string,
  status: boolean,
  simulatedTimeISO: string
) {
  try {
    await fetch(`${backendApiUrl}/api/hardware/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        devices: [{ id: deviceId, status }],
        simulatedTime: simulatedTimeISO,
      }),
    });
  } catch {
    // non-fatal — we'll retry next tick
  }
}

// ─────────────────────────────────────────────────────────────────
// Consumption snapshot logger
// ─────────────────────────────────────────────────────────────────
async function logHourlyConsumption(
  simulatedNow: Date,
  devices: DeviceRow[],
  tickSeconds: number // real seconds since last snapshot
) {
  // Simulated hours elapsed (accelerated by 120x)
  const simHoursElapsed = (tickSeconds * 120) / 3600;

  const roomIds = ['drawing-room', 'work-room-1', 'work-room-2'];
  const rows = roomIds.map((roomId) => {
    const onDevices = devices.filter((d) => d.room_id === roomId && d.status);
    const totalWatts = onDevices.reduce((s, d) => s + d.wattage, 0);
    const kwh = Math.round((totalWatts * simHoursElapsed) / 1000 * 10_000) / 10_000;
    return {
      sim_time: simulatedNow.toISOString(),
      room_id: roomId,
      kwh,
      cost_bdt: Math.round(kwh * BDT_PER_KWH * 100) / 100,
    };
  });

  try {
    const res = await fetch(`${backendApiUrl}/api/consumption/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: rows }),
    });
    if (!res.ok) {
      console.warn('[SIMULATOR] Failed to log consumption:', res.statusText);
    } else {
      console.log('[SIMULATOR] Consumption snapshot logged to backend.');
    }
  } catch (err: any) {
    console.warn('[SIMULATOR] Failed to log consumption:', err.message);
  }
}

const BASE_REAL_TIME = new Date('2026-07-04T10:38:47.297Z');
const BASE_SIM_TIME = new Date('2026-07-04T02:00:00.000Z');
const SPEED_MULTIPLIER = 120; // 1 real minute = 2 sim hours

function getSimulatedTimeNow(): Date {
  const elapsedRealMs = Date.now() - BASE_REAL_TIME.getTime();
  return new Date(BASE_SIM_TIME.getTime() + elapsedRealMs * SPEED_MULTIPLIER);
}

// ─────────────────────────────────────────────────────────────────
// Main simulator
// ─────────────────────────────────────────────────────────────────
async function startSimulator() {
  console.log('=======================================================');
  console.log('   Chrono Office — Real-World Device Simulator         ');
  console.log('=======================================================');
  console.log('Time Mode          : Separate clock (1 minute = 2 hours)');
  console.log('Office Hours       : 9 AM – 5 PM');
  console.log('After Hours        : WR2 devices remain ON (anomaly)');
  console.log('Voltage            : Brownian walk 215 – 225 V AC');
  console.log('Features           : warm-up ramp, staggered starts, flicker');
  console.log('Logging            : hourly snapshots → consumption_logs');
  console.log('=======================================================');

  const now = getSimulatedTimeNow();
  console.log(`Start time (Dhaka) : ${now.toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })}`);

  // Voltage — Brownian random walk so it feels continuous, not jumpy
  let voltage = 220.0;

  // Track last hour to detect hour-boundary crossings
  const startDhaka = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  let lastSimHour = startDhaka.getUTCHours();

  // Stagger offsets (in real ms) per room so devices don't all toggle simultaneously
  const roomLag: Record<string, number> = {
    'drawing-room': 0,
    'work-room-1': 400,
    'work-room-2': 800,
  };

  // Warm-up tracker: deviceId → remaining warm-up ticks
  const warmingUp = new Map<string, number>();

  // Flicker cooldown: deviceId → real-ms timestamp of last flicker
  const flickerCooldown = new Map<string, number>();

  // Real-time tick tracking for consumption logging
  let lastTickRealMs = Date.now();

  const TICK_MS = 5_000; // 5 real seconds per tick

  while (true) {
    try {
      const tickStartReal = Date.now();
      const simulatedTime = getSimulatedTimeNow();
      const simDhaka = new Date(simulatedTime.getTime() + 6 * 60 * 60 * 1000);
      const simHour = simDhaka.getUTCHours();
      const isWorkingHours = simHour >= 9 && simHour < 17;

      // ── 2. Voltage — Brownian walk with mean-reversion toward 220V ─
      const meanReversion = (220 - voltage) * 0.08;
      voltage += meanReversion + gaussianNoise(0.3);
      voltage = clamp(voltage, 215, 225);
      const roundedVoltage = Math.round(voltage * 10) / 10;

      console.log(
        `[SIM] ${simulatedTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', second: '2-digit' })} ` +
        `${isWorkingHours ? '(WORKING)' : '(AFTER-HRS)'}  ` +
        `Voltage: ${roundedVoltage}V`
      );

      // ── 3. Fetch devices ───────────────────────────────────────
      const devices = await getAllDevices();
      if (devices.length === 0) {
        console.warn('[SIM] No devices in DB. Seed the database first.');
      } else {
        const roomIds = ['drawing-room', 'work-room-1', 'work-room-2'];

        for (const roomId of roomIds) {
          // Apply stagger lag — only rooms whose real offset has elapsed act this tick
          if ((Date.now() - tickStartReal) < roomLag[roomId]) continue;

          const roomDevices = devices.filter((d) => d.room_id === roomId);

          for (const device of roomDevices) {
            let targetStatus = device.status;

            // ── Office starts (9:00 AM) ─────────────────────────────
            if (isWorkingHours) {
              if (roomId === 'drawing-room') {
                // Visitor room — moderate toggle activity
                if (Math.random() < 0.08) targetStatus = !device.status;
              } else {
                // Work rooms — employees present; keep ON with occasional brief breaks
                if (!device.status && Math.random() < 0.25) targetStatus = true;
                else if (device.status && Math.random() < 0.04) targetStatus = false;
              }

              // Random power-flicker: briefly toggle OFF then back ON next tick
              if (device.status && !warmingUp.has(device.id)) {
                const cooldownUntil = flickerCooldown.get(device.id) ?? 0;
                if (Date.now() > cooldownUntil && Math.random() < 0.003) {
                  targetStatus = false;
                  // Schedule re-enable after one tick
                  flickerCooldown.set(device.id, Date.now() + TICK_MS * 1.5);
                  console.log(`[SIM] ⚡ Flicker event on ${device.name} (${roomId})`);
                }
              }

              // Restore after flicker cooldown elapses
              if (!device.status) {
                const cooldownUntil = flickerCooldown.get(device.id) ?? 0;
                if (Date.now() < cooldownUntil) {
                  targetStatus = false; // Keep OFF during the flicker tick
                } else if (flickerCooldown.has(device.id)) {
                  targetStatus = true; // Turn back ON
                  flickerCooldown.delete(device.id);
                  console.log(`[SIM] ⚡ Flicker resolved for ${device.name} (${roomId})`);
                }
              }
            } 
            
            // ── After hours ────────────────────────────────────────
            else {
              if (roomId === 'drawing-room' || roomId === 'work-room-1') {
                // Employees leave → all off
                targetStatus = false;
              }
              // work-room-2: anomaly — devices stay ON as left by employees
              // No change to WR2 status (forgotten to turn off)
            }

            // Decrease warm-up counter
            if (warmingUp.has(device.id)) {
              const remaining = warmingUp.get(device.id)! - 1;
              if (remaining <= 0) warmingUp.delete(device.id);
              else warmingUp.set(device.id, remaining);
            }

            // Only send report if status actually changes (or every 6th tick to stay in sync)
            if (targetStatus !== device.status || Math.random() < 0.17) {
              await reportDeviceState(device.id, roomId, targetStatus, simulatedTime.toISOString());
            }
          }
        }
      }

      // ── 4. Hourly consumption snapshot every tick ──────────────
      const realSecondsSinceLast = (tickStartReal - lastTickRealMs) / 1000;
      await logHourlyConsumption(simulatedTime, devices, realSecondsSinceLast || 5);
      lastTickRealMs = tickStartReal;

      // ── 5. Log simulated hour transition ──────────────────────
      if (simHour !== lastSimHour) {
        console.log(`[SIM] 🕐 Hour transition: ${lastSimHour}:00 → ${simHour}:00`);
      }
      lastSimHour = simHour;
    } catch (err) {
      console.error('[SIM ERROR]', err);
    }

    await sleep(TICK_MS);
  }
}

startSimulator().catch((err) => {
  console.error('Simulator crashed:', err);
  process.exit(1);
});
