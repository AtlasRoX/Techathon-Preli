import { NextRequest, NextResponse } from 'next/server';
import { DeviceService } from '@/services/device.service';
import { AlertService } from '@/services/alert.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId, devices, simulatedTime } = body;

    if (!roomId || !devices || !Array.isArray(devices) || !simulatedTime) {
      return NextResponse.json({ error: 'Missing required fields: roomId, devices, simulatedTime' }, { status: 400 });
    }

    console.log(`[HARDWARE REPORT] Room ${roomId} reporting ${devices.length} devices at simulated time ${simulatedTime}`);

    for (const dev of devices) {
      await DeviceService.updateDeviceStatusSimulated(dev.id, dev.status, simulatedTime);
    }

    // Evaluate alerts using simulated time
    await AlertService.evaluateAlerts(simulatedTime);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[HARDWARE REPORT ERROR]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
