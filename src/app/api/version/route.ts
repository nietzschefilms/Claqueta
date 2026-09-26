import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Devuelve un identificador que cambia en cada deploy (el commit de Vercel).
// El cliente lo consulta cada tanto para avisar "hay versión nueva".
export function GET() {
  const v =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    "dev";
  return NextResponse.json(
    { v },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
  );
}
