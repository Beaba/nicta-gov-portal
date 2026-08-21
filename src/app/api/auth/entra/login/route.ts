import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { buildEntraAuthCodeUrl } from '@/lib/auth/entraProvider';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const state = randomUUID();
  const session = await getSession();
  session.oauthState = state;
  await session.save();

  const url = await buildEntraAuthCodeUrl(state);
  return NextResponse.redirect(url);
}
