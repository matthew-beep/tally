import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'OCR not available in Phase 1' }, { status: 501 })
}
