import { NextResponse } from 'next/server';
import { PowerService, getSimulatedTime, getVoltage } from '@/services/power.service';

export async function GET() {
  try {
    const voltage = await getVoltage();
    const { watts: currentPower } = await PowerService.getCurrentPower();
    const roomBreakdown = await PowerService.getRoomPowerBreakdown(voltage);
    const simulatedTime = await getSimulatedTime();

    return NextResponse.json({
      currentPower,
      voltage: Math.round(voltage * 10) / 10,
      simulatedTime: simulatedTime.toISOString(),
      roomBreakdown,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
