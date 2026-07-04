import { supabase } from '../lib/supabase';
import { DeviceService } from './device.service';
import { getSimulatedTime } from './power.service';

/** Price constant: 1 kWh = 13.01 BDT */
export const BDT_PER_KWH = 13.01;

export interface DeviceBreakdown {
  id: string;
  name: string;
  type: string;
  status: boolean;
  kwh: number;
  costBDT: number;
}

export interface RoomBreakdown {
  roomId: string;
  roomName: string;
  kwh: number;
  costBDT: number;
  devices: DeviceBreakdown[];
}

export interface ConsumptionBreakdown {
  simulatedTime: string;
  totalKWh: number;
  totalCostBDT: number;
  rooms: RoomBreakdown[];
}

const ROOM_NAMES: Record<string, string> = {
  'drawing-room': 'Drawing Room',
  'work-room-1':  'Work Room 1',
  'work-room-2':  'Work Room 2',
};

/**
 * Shared helper: reconstructs per-device kWh usage for the simulated today.
 * Returns a map: device.id → watt-hours consumed today.
 */
async function buildDeviceWattHoursMap(
  simulatedNow: Date,
  today: Date,
  midnightISO: string
): Promise<Map<string, number>> {
  const devices = await DeviceService.getAllDevices();

  const { data: todayHistory, error: historyError } = await supabase
    .from('device_history')
    .select('*')
    .gte('changed_at', midnightISO)
    .lte('changed_at', simulatedNow.toISOString())
    .order('changed_at', { ascending: true });

  if (historyError) throw historyError;

  const events = todayHistory || [];

  // Group events by device_id
  const deviceEventsMap = new Map<string, typeof events>();
  for (const event of events) {
    if (!deviceEventsMap.has(event.device_id)) {
      deviceEventsMap.set(event.device_id, []);
    }
    deviceEventsMap.get(event.device_id)!.push(event);
  }

  const wattHoursMap = new Map<string, number>();

  for (const device of devices) {
    const deviceEvents = deviceEventsMap.get(device.id) || [];
    let isCurrentlyOn = false;

    const { data: preMidnight } = await supabase
      .from('device_history')
      .select('new_status')
      .eq('device_id', device.id)
      .lt('changed_at', midnightISO)
      .order('changed_at', { ascending: false })
      .limit(1);

    if (preMidnight && preMidnight.length > 0) {
      isCurrentlyOn = preMidnight[0].new_status;
    } else {
      isCurrentlyOn = deviceEvents.length > 0 ? deviceEvents[0].previous_status : device.status;
    }

    let wattHours = 0;
    let lastTime = today.getTime();

    for (const event of deviceEvents) {
      const eventTime = new Date(event.changed_at).getTime();
      if (isCurrentlyOn) {
        wattHours += ((eventTime - lastTime) / 3_600_000) * device.wattage;
      }
      isCurrentlyOn = event.new_status;
      lastTime = eventTime;
    }

    if (isCurrentlyOn) {
      wattHours += ((simulatedNow.getTime() - lastTime) / 3_600_000) * device.wattage;
    }

    wattHoursMap.set(device.id, wattHours);
  }

  return wattHoursMap;
}

export class ConsumptionService {
  /**
   * Returns the total energy consumed today (kWh) using simulated time.
   */
  static async getDailyConsumption(): Promise<number> {
    const simulatedNow = await getSimulatedTime();
    const today = new Date(simulatedNow);
    today.setHours(0, 0, 0, 0);
    const midnightISO = today.toISOString();

    const devices = await DeviceService.getAllDevices();
    const wattHoursMap = await buildDeviceWattHoursMap(simulatedNow, today, midnightISO);

    let total = 0;
    for (const device of devices) {
      total += wattHoursMap.get(device.id) ?? 0;
    }

    return Math.round((total / 1000) * 10_000) / 10_000;
  }

  /**
   * Returns a detailed per-room, per-device breakdown of energy consumption today.
   * Used by the /api/consumption/breakdown endpoint and the dashboard modal.
   */
  static async getDetailedBreakdown(): Promise<ConsumptionBreakdown> {
    const simulatedNow = await getSimulatedTime();
    const today = new Date(simulatedNow);
    today.setHours(0, 0, 0, 0);
    const midnightISO = today.toISOString();

    const devices = await DeviceService.getAllDevices();
    const wattHoursMap = await buildDeviceWattHoursMap(simulatedNow, today, midnightISO);

    const roomIds = ['drawing-room', 'work-room-1', 'work-room-2'];

    const rooms: RoomBreakdown[] = roomIds.map((roomId) => {
      const roomDevices = devices.filter((d) => d.room_id === roomId);

      const deviceBreakdowns: DeviceBreakdown[] = roomDevices.map((device) => {
        const wh = wattHoursMap.get(device.id) ?? 0;
        const kwh = Math.round((wh / 1000) * 10_000) / 10_000;
        return {
          id: device.id,
          name: device.name,
          type: device.type,
          status: device.status,
          kwh,
          costBDT: Math.round(kwh * BDT_PER_KWH * 100) / 100,
        };
      });

      const roomKwh = Math.round(
        deviceBreakdowns.reduce((s, d) => s + d.kwh, 0) * 10_000
      ) / 10_000;

      return {
        roomId,
        roomName: ROOM_NAMES[roomId] ?? roomId,
        kwh: roomKwh,
        costBDT: Math.round(roomKwh * BDT_PER_KWH * 100) / 100,
        devices: deviceBreakdowns,
      };
    });

    const totalKWh = Math.round(
      rooms.reduce((s, r) => s + r.kwh, 0) * 10_000
    ) / 10_000;

    return {
      simulatedTime: simulatedNow.toISOString(),
      totalKWh,
      totalCostBDT: Math.round(totalKWh * BDT_PER_KWH * 100) / 100,
      rooms,
    };
  }

  static async getConsumptionLogs(): Promise<any[]> {
    const { data, error } = await supabase
      .from('consumption_logs')
      .select('*')
      .order('sim_time', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching consumption logs:', error);
      throw error;
    }
    return data || [];
  }

  static async logConsumption(logs: Array<{ room_id: string; sim_time: string; kwh: number; cost_bdt: number }>): Promise<void> {
    const { error } = await supabase
      .from('consumption_logs')
      .insert(logs);

    if (error) {
      console.error('Error saving consumption logs:', error);
      throw error;
    }
  }
}
