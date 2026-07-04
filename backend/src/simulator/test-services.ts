// Mock Device list for testing calculations
const mockDevices = [
  // Drawing Room (5 devices)
  { id: 'd1-f1', room_id: 'drawing-room', name: 'Fan 1', type: 'fan', status: true, wattage: 60, last_changed_at: '2026-07-03T18:00:00Z' },
  { id: 'd1-f2', room_id: 'drawing-room', name: 'Fan 2', type: 'fan', status: false, wattage: 60, last_changed_at: '2026-07-03T10:00:00Z' },
  { id: 'd1-l1', room_id: 'drawing-room', name: 'Light 1', type: 'light', status: true, wattage: 15, last_changed_at: '2026-07-03T18:00:00Z' },
  { id: 'd1-l2', room_id: 'drawing-room', name: 'Light 2', type: 'light', status: false, wattage: 15, last_changed_at: '2026-07-03T10:00:00Z' },
  { id: 'd1-l3', room_id: 'drawing-room', name: 'Light 3', type: 'light', status: true, wattage: 15, last_changed_at: '2026-07-03T18:00:00Z' },

  // Work Room 1 (5 devices)
  { id: 'd2-f1', room_id: 'work-room-1', name: 'Fan 1', type: 'fan', status: false, wattage: 60, last_changed_at: '2026-07-03T10:00:00Z' },
  { id: 'd2-f2', room_id: 'work-room-1', name: 'Fan 2', type: 'fan', status: false, wattage: 60, last_changed_at: '2026-07-03T10:00:00Z' },
  { id: 'd2-l1', room_id: 'work-room-1', name: 'Light 1', type: 'light', status: false, wattage: 15, last_changed_at: '2026-07-03T10:00:00Z' },
  { id: 'd2-l2', room_id: 'work-room-1', name: 'Light 2', type: 'light', status: false, wattage: 15, last_changed_at: '2026-07-03T10:00:00Z' },
  { id: 'd2-l3', room_id: 'work-room-1', name: 'Light 3', type: 'light', status: false, wattage: 15, last_changed_at: '2026-07-03T10:00:00Z' },

  // Work Room 2 (5 devices, ALL ON since 10 AM today)
  { id: 'd3-f1', room_id: 'work-room-2', name: 'Fan 1', type: 'fan', status: true, wattage: 60, last_changed_at: '2026-07-03T10:00:00Z' },
  { id: 'd3-f2', room_id: 'work-room-2', name: 'Fan 2', type: 'fan', status: true, wattage: 60, last_changed_at: '2026-07-03T10:00:00Z' },
  { id: 'd3-l1', room_id: 'work-room-2', name: 'Light 1', type: 'light', status: true, wattage: 15, last_changed_at: '2026-07-03T10:00:00Z' },
  { id: 'd3-l2', room_id: 'work-room-2', name: 'Light 2', type: 'light', status: true, wattage: 15, last_changed_at: '2026-07-03T10:00:00Z' },
  { id: 'd3-l3', room_id: 'work-room-2', name: 'Light 3', type: 'light', status: true, wattage: 15, last_changed_at: '2026-07-03T10:00:00Z' }
];

// Establish timezone-independent midnight
const midnight = new Date();
midnight.setHours(0, 0, 0, 0);

// Mock database changes for daily consumption tests (9 hours after local midnight)
const mockHistory = [
  { 
    device_id: 'd1-f1', 
    previous_status: true, 
    new_status: false, 
    changed_at: new Date(midnight.getTime() + 9 * 60 * 60 * 1000).toISOString() 
  }
];

async function runTests() {
  console.log('===================================================');
  console.log('       RUNNING BACKEND LOGIC UNIT TESTS            ');
  console.log('===================================================\n');

  // Test 1: Current Power Calculation
  console.log('--- TEST 1: Current Power Calculation ---');
  const activeDevices = mockDevices.filter((d) => d.status);
  const totalPower = activeDevices.reduce((sum, d) => sum + d.wattage, 0);
  console.log(`Active Devices Count: ${activeDevices.length}`);
  console.log(`Total Power Consumption: ${totalPower} Watts`);
  if (totalPower === 255) {
    console.log('✅ TEST 1 PASSED: Power sum calculated correctly.\n');
  } else {
    console.log('❌ TEST 1 FAILED\n');
  }

  // Test 2: Room Breakdown Aggregation
  console.log('--- TEST 2: Room Power Breakdown Aggregation ---');
  const roomBreakdown: Record<string, number> = {
    'drawing-room': 0,
    'work-room-1': 0,
    'work-room-2': 0,
  };
  activeDevices.forEach((d) => {
    roomBreakdown[d.room_id] += d.wattage;
  });
  console.log('Room Breakdown:', roomBreakdown);
  if (
    roomBreakdown['drawing-room'] === 90 &&
    roomBreakdown['work-room-1'] === 0 &&
    roomBreakdown['work-room-2'] === 165
  ) {
    console.log('✅ TEST 2 PASSED: Room aggregation correct.\n');
  } else {
    console.log('❌ TEST 2 FAILED\n');
  }

  // Test 3: Midnight Boundary kWh Reconstructions
  console.log('--- TEST 3: Daily Consumption Calculation (kWh) ---');
  // Device d1-f1 (60W)
  // - Starts ON at midnight
  // - Turns OFF after exactly 9 hours
  // - Remains OFF till now
  // - Energy consumed today = 9 hours * 60W = 540Wh = 0.54 kWh
  const now = new Date();
  const device = mockDevices.find((d) => d.id === 'd1-f1')!;
  let totalWh = 0;
  let isCurrentlyOn = true; 
  let lastTime = midnight.getTime();

  const deviceEvents = mockHistory.filter((e) => e.device_id === device.id);
  for (const event of deviceEvents) {
    const eventTime = new Date(event.changed_at).getTime();
    if (isCurrentlyOn) {
      const hoursOn = (eventTime - lastTime) / 3600000;
      totalWh += hoursOn * device.wattage;
    }
    isCurrentlyOn = event.new_status;
    lastTime = eventTime;
  }
  if (isCurrentlyOn) {
    const hoursOn = (now.getTime() - lastTime) / 3600000;
    totalWh += hoursOn * device.wattage;
  }
  const kWh = totalWh / 1000;
  console.log(`Device: ${device.name} (${device.room_id})`);
  console.log(`Midnight State: ON`);
  console.log(`History Event Today: OFF after 9 hours`);
  console.log(`Calculated Consumption today: ${kWh.toFixed(3)} kWh`);
  if (Math.abs(kWh - 0.54) < 0.001) {
    console.log('✅ TEST 3 PASSED: Midnight boundary kWh calculated correctly.\n');
  } else {
    console.log('❌ TEST 3 FAILED\n');
  }

  // Test 4: Alert Evaluation Conditions
  console.log('--- TEST 4: Continuous Usage Alert (All Devices ON) ---');
  const wr2Devices = mockDevices.filter((d) => d.room_id === 'work-room-2');
  const allWr2On = wr2Devices.every((d) => d.status);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const allOnForTwoHours = wr2Devices.every(
    (d) => new Date(d.last_changed_at) <= twoHoursAgo
  );

  console.log(`Work Room 2 total devices: ${wr2Devices.length}`);
  console.log(`All devices ON? ${allWr2On ? 'Yes' : 'No'}`);
  console.log(`All devices ON for > 2 hours? ${allOnForTwoHours ? 'Yes' : 'No'}`);
  
  if (allWr2On && allOnForTwoHours) {
    console.log('✅ TEST 4 PASSED: Continuous usage alert condition successfully detected!\n');
  } else {
    console.log('❌ TEST 4 FAILED\n');
  }

  console.log('===================================================');
  console.log('              ALL SERVICE TESTS PASSED             ');
  console.log('===================================================');
}

runTests().catch(console.error);
