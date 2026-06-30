// Tmap 보행자 경로안내 API 서버 사이드 유틸리티
// TMAP_APP_KEY 환경변수 필요 (SK open API에서 발급)

import type { RouteResult } from "@/lib/naver-directions";

interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * 출발 → 목적지 도보 경로의 소요시간/거리를 반환한다. 실패 시 null.
 * (출발·도착이 너무 가깝거나 보행 경로가 없으면 null일 수 있음)
 */
export async function getWalkingRoute(
  start: LatLng,
  goal: LatLng,
): Promise<RouteResult | null> {
  const appKey = process.env.TMAP_APP_KEY || "";
  if (!appKey) {
    console.error("[Tmap] TMAP_APP_KEY 환경변수가 설정되지 않았습니다.");
    return null;
  }

  try {
    const res = await fetch(
      "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          appKey,
        },
        body: JSON.stringify({
          startX: String(start.longitude),
          startY: String(start.latitude),
          endX: String(goal.longitude),
          endY: String(goal.latitude),
          startName: encodeURIComponent("출발"),
          endName: encodeURIComponent("도착"),
          reqCoordType: "WGS84GEO",
          resCoordType: "WGS84GEO",
        }),
      },
    );

    if (!res.ok) {
      console.error(`[Tmap] API 응답 오류: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    // GeoJSON FeatureCollection — 첫 feature properties 에 전체 합계
    const props = data?.features?.[0]?.properties;
    if (!props || props.totalTime == null) return null;

    return {
      durationMin: Math.round(Number(props.totalTime) / 60), // 초 → 분
      distanceM: Number(props.totalDistance),
    };
  } catch (error) {
    console.error("[Tmap] API 호출 중 오류:", error);
    return null;
  }
}
