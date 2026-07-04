import { supabase } from '../lib/supabase';

export async function getSimulatedTime(): Promise<Date> {
  // Always return the real current system/world time
  return new Date();
}

export async function getVoltage(): Promise<number> {
  // Return standard 220V with minor random fluctuations between 218.0V and 222.0V
  return Math.round((220 + (Math.random() * 4 - 2)) * 10) / 10;
}

export class PowerService {
  static async getCurrentPower(): Promise<{ watts: number; voltage: number }> {
    const { data, error } = await supabase
      .from('devices')
      .select('wattage')
      .eq('status', true);

    if (error) {
      console.error('Error calculating current power:', error);
      throw error;
    }

    const voltage = await getVoltage();
    // Apply voltage scaling: P = P_nominal * (V/220)^2
    const scaleFactor = Math.pow(voltage / 220, 2);
    const total = Math.round(
      (data || []).reduce((sum, device) => sum + device.wattage, 0) * scaleFactor
    );
    return { watts: total, voltage };
  }

  static async getRoomPowerBreakdown(voltage?: number): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('devices')
      .select('room_id, wattage')
      .eq('status', true);

    if (error) {
      console.error('Error calculating room power breakdown:', error);
      throw error;
    }

    const v = voltage ?? (await getVoltage());
    const scaleFactor = Math.pow(v / 220, 2);

    const breakdown: Record<string, number> = {
      'drawing-room': 0,
      'work-room-1': 0,
      'work-room-2': 0,
    };

    (data || []).forEach((device) => {
      if (device.room_id in breakdown) {
        breakdown[device.room_id] += Math.round(device.wattage * scaleFactor);
      } else {
        breakdown[device.room_id] = Math.round(device.wattage * scaleFactor);
      }
    });

    return breakdown;
  }
}
