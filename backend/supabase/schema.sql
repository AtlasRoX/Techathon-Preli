-- Enums
CREATE TYPE device_type AS ENUM ('fan', 'light');
CREATE TYPE alert_type AS ENUM ('after_hours', 'continuous_usage');

-- Rooms Table
CREATE TABLE rooms (
  id TEXT PRIMARY KEY, -- 'drawing-room', 'work-room-1', 'work-room-2'
  name TEXT NOT NULL
);

-- Devices Table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type device_type NOT NULL,
  status BOOLEAN NOT NULL DEFAULT false,
  wattage INTEGER NOT NULL CHECK (wattage > 0),
  last_changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Device History Table (Transitions Only)
CREATE TABLE device_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
  previous_status BOOLEAN NOT NULL,
  new_status BOOLEAN NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alerts Table (Deduplicated Alerts)
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  type alert_type NOT NULL,
  message TEXT NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Optimization Indexes
CREATE INDEX idx_devices_room ON devices(room_id);
CREATE INDEX idx_history_device_time ON device_history(device_id, changed_at DESC);
CREATE INDEX idx_alerts_active ON alerts(active);

-- Enforce uniqueness of active alerts per room/type (prevents duplicate active alerts)
CREATE UNIQUE INDEX idx_alerts_active_room_type 
ON alerts (room_id, type) 
WHERE (active = true);

-- Enable Supabase Realtime for Devices and Alerts tables
ALTER PUBLICATION supabase_realtime ADD TABLE devices;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;

-- Postgres RPC function for Atomic Toggle & History Insertion
CREATE OR REPLACE FUNCTION toggle_device_status(p_device_id UUID, p_new_status BOOLEAN)
RETURNS void AS $$
DECLARE
  v_old_status BOOLEAN;
BEGIN
  SELECT status INTO v_old_status FROM devices WHERE id = p_device_id;
  
  IF v_old_status IS DISTINCT FROM p_new_status THEN
    UPDATE devices 
    SET status = p_new_status, last_changed_at = now() 
    WHERE id = p_device_id;
    
    INSERT INTO device_history (device_id, previous_status, new_status, changed_at)
    VALUES (p_device_id, v_old_status, p_new_status, now());
  END IF;
END;
$$ LANGUAGE plpgsql;
