import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'Manual device control is disabled in this simulation' },
    { status: 403 }
  );
}
