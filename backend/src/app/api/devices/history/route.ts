import { NextResponse } from 'next/server';
import { DeviceService } from '@/services/device.service';

export async function GET() {
  try {
    const history = await DeviceService.getDeviceHistory();
    return NextResponse.json(history);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
