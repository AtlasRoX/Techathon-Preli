import { NextResponse } from 'next/server';
import { ConsumptionService } from '@/services/consumption.service';

export async function GET() {
  try {
    const logs = await ConsumptionService.getConsumptionLogs();
    return NextResponse.json(logs);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
