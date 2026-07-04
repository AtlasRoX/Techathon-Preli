import { supabase } from '../lib/supabase';
import { Device } from '../lib/types';

export class DeviceService {
  static async getAllDevices(): Promise<Device[]> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching all devices:', error);
      throw error;
    }
    return data || [];
  }

  static async getDevicesByRoom(roomId: string): Promise<Device[]> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('room_id', roomId)
      .order('name');

    if (error) {
      console.error(`Error fetching devices for room ${roomId}:`, error);
      throw error;
    }
    return data || [];
  }

  static async toggleDevice(deviceId: string, newStatus: boolean): Promise<void> {
    const { error } = await supabase.rpc('toggle_device_status', {
      p_device_id: deviceId,
      p_new_status: newStatus,
    });

    if (error) {
      console.error(`Error toggling device status for ${deviceId}:`, error);
      throw error;
    }
  }

  static async updateDeviceStatusSimulated(deviceId: string, newStatus: boolean, simulatedTime: string): Promise<void> {
    const { data: device, error: fetchErr } = await supabase
      .from('devices')
      .select('status')
      .eq('id', deviceId)
      .single();

    if (fetchErr) {
      console.error(`Error fetching device status for ${deviceId}:`, fetchErr);
      throw fetchErr;
    }

    if (device && device.status !== newStatus) {
      // Update devices status & last_changed_at
      const { error: updateErr } = await supabase
        .from('devices')
        .update({
          status: newStatus,
          last_changed_at: simulatedTime,
        })
        .eq('id', deviceId);

      if (updateErr) {
        console.error(`Error updating device status for ${deviceId}:`, updateErr);
        throw updateErr;
      }

      // Insert into history with simulated time
      const { error: historyErr } = await supabase
        .from('device_history')
        .insert({
          device_id: deviceId,
          previous_status: device.status,
          new_status: newStatus,
          changed_at: simulatedTime,
        });

      if (historyErr) {
        console.error(`Error inserting history for device ${deviceId}:`, historyErr);
        throw historyErr;
      }
    }
  }

  static async getDeviceHistory(): Promise<any[]> {
    const { data, error } = await supabase
      .from('device_history')
      .select('*, devices(name, type, room_id)')
      .order('changed_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching device history:', error);
      throw error;
    }
    return data || [];
  }
}
