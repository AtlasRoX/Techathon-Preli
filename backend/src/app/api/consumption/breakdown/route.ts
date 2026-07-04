import { NextResponse } from 'next/server';
import { ConsumptionService } from '@/services/consumption.service';

export async function GET() {
  try {
    const breakdown = await ConsumptionService.getDetailedBreakdown();
    return NextResponse.json(breakdown);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
