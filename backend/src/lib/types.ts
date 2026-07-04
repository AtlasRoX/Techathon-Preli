export type DeviceType = 'fan' | 'light';
export type AlertType = 'after_hours' | 'continuous_usage';

export interface Room {
  id: string; // 'drawing-room', 'work-room-1', 'work-room-2'
  name: string;
}

export interface Device {
  id: string;
  room_id: string;
  name: string;
  type: DeviceType;
  status: boolean;
  wattage: number;
  last_changed_at: string;
}

export interface DeviceHistory {
  id: string;
  device_id: string;
  previous_status: boolean;
  new_status: boolean;
  changed_at: string;
}

export interface Alert {
  id: string;
  room_id: string;
  type: AlertType;
  message: string;
  active: boolean;
  triggered_at: string;
  resolved_at: string | null;
}
