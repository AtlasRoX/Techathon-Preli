import { NextResponse } from 'next/server';
import { ConsumptionService } from '@/services/consumption.service';

/**
 * GET /api/consumption
 *
 * Returns the full breakdown snapshot so the dashboard card and the
 * breakdown modal both read from the same computation path and the
 * same simulated-time snapshot.
 *
 * Shape:  { dailyKWh, totalCostBDT, simulatedTime, rooms[] }
 *
 * `dailyKWh` is kept for backwards-compatibility with existing dashboard reads.
 * `totalCostBDT` replaces the old client-side multiplication so the card
 *  always shows exactly what the modal shows.
 */
export async function GET() {
  try {
    const breakdown = await ConsumptionService.getDetailedBreakdown();
    return NextResponse.json({
      // Legacy field — dashboard card reads this
      dailyKWh: breakdown.totalKWh,
      // Explicit field — breakdown modal reads this
      totalKWh: breakdown.totalKWh,
      // Cost & metadata
      totalCostBDT: breakdown.totalCostBDT,
      simulatedTime: breakdown.simulatedTime,
      rooms: breakdown.rooms,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
