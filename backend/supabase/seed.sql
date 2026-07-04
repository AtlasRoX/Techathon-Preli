-- Seed Rooms
INSERT INTO rooms (id, name) VALUES
('drawing-room', 'Drawing Room'),
('work-room-1', 'Work Room 1'),
('work-room-2', 'Work Room 2')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Seed Devices (2 Fans at 60W, 3 Lights at 15W for each room)
INSERT INTO devices (id, room_id, name, type, status, wattage, last_changed_at) VALUES
-- Drawing Room (id: drawing-room)
('d1000000-0000-0000-0000-000000000001', 'drawing-room', 'Fan 1', 'fan', false, 60, now()),
('d1000000-0000-0000-0000-000000000002', 'drawing-room', 'Fan 2', 'fan', false, 60, now()),
('d1000000-0000-0000-0000-000000000003', 'drawing-room', 'Light 1', 'light', false, 15, now()),
('d1000000-0000-0000-0000-000000000004', 'drawing-room', 'Light 2', 'light', false, 15, now()),
('d1000000-0000-0000-0000-000000000005', 'drawing-room', 'Light 3', 'light', false, 15, now()),

-- Work Room 1 (id: work-room-1)
('d2000000-0000-0000-0000-000000000001', 'work-room-1', 'Fan 1', 'fan', false, 60, now()),
('d2000000-0000-0000-0000-000000000002', 'work-room-1', 'Fan 2', 'fan', false, 60, now()),
('d2000000-0000-0000-0000-000000000003', 'work-room-1', 'Light 1', 'light', false, 15, now()),
('d2000000-0000-0000-0000-000000000004', 'work-room-1', 'Light 2', 'light', false, 15, now()),
('d2000000-0000-0000-0000-000000000005', 'work-room-1', 'Light 3', 'light', false, 15, now()),

-- Work Room 2 (id: work-room-2)
('d3000000-0000-0000-0000-000000000001', 'work-room-2', 'Fan 1', 'fan', false, 60, now()),
('d3000000-0000-0000-0000-000000000002', 'work-room-2', 'Fan 2', 'fan', false, 60, now()),
('d3000000-0000-0000-0000-000000000003', 'work-room-2', 'Light 1', 'light', false, 15, now()),
('d3000000-0000-0000-0000-000000000004', 'work-room-2', 'Light 2', 'light', false, 15, now()),
('d3000000-0000-0000-0000-000000000005', 'work-room-2', 'Light 3', 'light', false, 15, now())
ON CONFLICT (id) DO UPDATE SET 
  room_id = EXCLUDED.room_id,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  wattage = EXCLUDED.wattage;
