import { NextRequest, NextResponse } from 'next/server';
import { ConsumptionService } from '@/services/consumption.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { logs } = body;

    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json({ error: 'Missing required field: logs (Array)' }, { status: 400 });
    }

    await ConsumptionService.logConsumption(logs);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[CONSUMPTION REPORT ERROR]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
