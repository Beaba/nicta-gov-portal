import { NextResponse } from 'next/server';
import { getAuthProvider } from '@/lib/auth';

export async function POST(request: Request) {
  await getAuthProvider().signOut();
  return NextResponse.redirect(new URL('/login', request.url));
}
