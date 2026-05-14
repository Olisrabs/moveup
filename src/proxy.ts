import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The Supabase browser client stores sessions in localStorage, not cookies,
// so we can't reliably check auth state here.
// Dashboard protection is handled client-side in src/app/dashboard/layout.tsx.
// This proxy is a pass-through kept for future SSR auth upgrades.
//
// NOTE: "middleware" file + function were renamed to "proxy" in Next.js 16.
// See: https://nextjs.org/docs/messages/middleware-to-proxy

export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
