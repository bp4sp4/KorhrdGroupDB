import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getDrivingRoute } from "@/lib/naver-directions";
import { getWalkingRoute } from "@/lib/tmap-directions";

// GET /api/directions?sx=경도&sy=위도&gx=경도&gy=위도
// 출발(sx,sy) → 목적지(gx,gy) 자동차(네이버)·도보(Tmap) 소요시간/거리
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const sp = request.nextUrl.searchParams;
  const sx = Number(sp.get("sx"));
  const sy = Number(sp.get("sy"));
  const gx = Number(sp.get("gx"));
  const gy = Number(sp.get("gy"));

  if (![sx, sy, gx, gy].every(Number.isFinite)) {
    return NextResponse.json(
      { error: "좌표(sx, sy, gx, gy)가 필요합니다." },
      { status: 400 },
    );
  }

  const start = { latitude: sy, longitude: sx };
  const goal = { latitude: gy, longitude: gx };

  const [car, walk] = await Promise.all([
    getDrivingRoute(start, goal),
    getWalkingRoute(start, goal),
  ]);

  return NextResponse.json({ car, walk });
}
