import { NextResponse } from 'next/server';
import { DeviceService } from '@/services/device.service';

export async function GET() {
  try {
    const devices = await DeviceService.getAllDevices();
    return NextResponse.json(devices);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
