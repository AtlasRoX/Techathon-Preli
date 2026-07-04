import { NextResponse } from 'next/server';
import { AlertService } from '@/services/alert.service';

export async function GET() {
  try {
    const activeAlerts = await AlertService.getActiveAlerts();
    return NextResponse.json(activeAlerts);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
