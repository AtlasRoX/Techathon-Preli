import { supabase } from '../lib/supabase';
import { Alert } from '../lib/types';
import { DeviceService } from './device.service';

export class AlertService {
  static async getActiveAlerts(): Promise<Alert[]> {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('active', true)
      .order('triggered_at', { ascending: false });

    if (error) {
      console.error('Error fetching active alerts:', error);
      throw error;
    }
    return data || [];
  }

  /**
   * Evaluates the office state and updates the alerts table.
   * Runs checks for After Hours and All-Devices-ON (Continuous Usage).
   */
  static async evaluateAlerts(simulatedTimeStr?: string): Promise<void> {
    const rooms = ['drawing-room', 'work-room-1', 'work-room-2'];
    
    // Get simulated or real hour — always evaluated in Asia/Dhaka timezone (UTC+6)
    const localTime = simulatedTimeStr ? new Date(simulatedTimeStr) : new Date();
    // Offset UTC time by 6 hours to get Dhaka local time
    const dhakaTime = new Date(localTime.getTime() + 6 * 60 * 60 * 1000);
    const hour = dhakaTime.getUTCHours();
    const isAfterHours = hour < 9 || hour >= 17; // Outside 9 AM - 5 PM
    const timestampISO = localTime.toISOString();

    for (const roomId of rooms) {
      const devices = await DeviceService.getDevicesByRoom(roomId);
      const activeDevices = devices.filter((d) => d.status);
      const totalDevicesCount = devices.length;

      // --- CHECK 1: After Hours Alert ---
      if (isAfterHours && activeDevices.length > 0) {
        // Trigger After Hours alert if not already active
        const alertMessage = `${roomId === 'drawing-room' ? 'Drawing Room' : roomId === 'work-room-1' ? 'Work Room 1' : 'Work Room 2'} has ${activeDevices.length} active devices running after office hours.`;
        
        await this.triggerAlert(roomId, 'after_hours', alertMessage, timestampISO);
      } else {
        // If it's work hours, or all devices are off, resolve any active After Hours alert
        await this.resolveAlert(roomId, 'after_hours', timestampISO);
      }

      // --- CHECK 2: All-Devices-ON Alert (Continuous Usage) ---
      // Requirement: All devices in a room have been ON for more than 2 hours continuously.
      const allOn = activeDevices.length === totalDevicesCount && totalDevicesCount > 0;
      
      if (allOn) {
        const twoHoursAgo = new Date(localTime.getTime() - 2 * 60 * 60 * 1000);
        
        // Check if the latest changed_at for any device in the room is older than 2 hours ago.
        // That means the most recently turned ON device has been ON for at least 2 hours.
        const allOnForTwoHours = devices.every(
          (d) => new Date(d.last_changed_at) <= twoHoursAgo
        );

        if (allOnForTwoHours) {
          const alertMessage = `All devices in ${roomId === 'drawing-room' ? 'Drawing Room' : roomId === 'work-room-1' ? 'Work Room 1' : 'Work Room 2'} have been left running continuously for over 2 hours.`;
          await this.triggerAlert(roomId, 'continuous_usage', alertMessage, timestampISO);
        } else {
          // If all on, but not for 2 hours yet, do nothing (keep waiting)
        }
      } else {
        // If at least one device is OFF, resolve any active continuous usage alert
        await this.resolveAlert(roomId, 'continuous_usage', timestampISO);
      }
    }
  }

  private static async triggerAlert(
    roomId: string,
    type: 'after_hours' | 'continuous_usage',
    message: string,
    timestampISO: string
  ): Promise<void> {
    // Check if an active alert of this type already exists in this room
    const { data: existingAlerts, error: checkError } = await supabase
      .from('alerts')
      .select('id')
      .eq('room_id', roomId)
      .eq('type', type)
      .eq('active', true)
      .limit(1);

    if (checkError) {
      console.error('Error checking active alerts:', checkError);
      return;
    }

    if (existingAlerts && existingAlerts.length > 0) {
      // Alert already active, do not insert duplicate
      return;
    }

    // Insert alert
    const { error: insertError } = await supabase.from('alerts').insert({
      room_id: roomId,
      type,
      message,
      active: true,
      triggered_at: timestampISO,
    });

    if (insertError) {
      // Catch unique constraint violation in case of simultaneous execution
      if (insertError.code === '23505') {
        return; // Handled duplicate active alert gracefully
      }
      console.error(`Error triggering alert ${type} for room ${roomId}:`, insertError);
    } else {
      console.log(`[ALERT] Triggered ${type} in ${roomId}: ${message}`);
    }
  }

  private static async resolveAlert(
    roomId: string,
    type: 'after_hours' | 'continuous_usage',
    timestampISO: string
  ): Promise<void> {
    const { error } = await supabase
      .from('alerts')
      .update({
        active: false,
        resolved_at: timestampISO,
      })
      .eq('room_id', roomId)
      .eq('type', type)
      .eq('active', true);

    if (error) {
      console.error(`Error resolving alert ${type} for room ${roomId}:`, error);
    }
  }
}
