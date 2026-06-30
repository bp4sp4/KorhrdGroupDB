// 네이버 Directions 5 (자동차 길찾기) 서버 사이드 유틸리티
// 지오코딩과 동일한 NCP Maps 인증키를 그대로 사용한다.

export interface RouteResult {
  durationMin: number; // 소요 시간(분)
  distanceM: number; // 거리(m)
}

interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * 출발 → 목적지 자동차 경로의 소요시간/거리를 반환한다 (실시간 교통 반영).
 * option=traoptimal (실시간 최적). 실패 시 null.
 */
export async function getDrivingRoute(
  start: LatLng,
  goal: LatLng,
): Promise<RouteResult | null> {
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "";
  const clientSecret = process.env.NAVER_GEOCODING_API_KEY || "";

  if (!clientId || !clientSecret) {
    console.error("[Directions] 네이버 인증 환경변수가 설정되지 않았습니다.");
    return null;
  }

  try {
    // start/goal 좌표 순서는 경도,위도 (x,y)
    const url =
      `https://maps.apigw.ntruss.com/map-direction/v1/driving` +
      `?start=${start.longitude},${start.latitude}` +
      `&goal=${goal.longitude},${goal.latitude}` +
      `&option=traoptimal`;

    const res = await fetch(url, {
      headers: {
        "x-ncp-apigw-api-key-id": clientId,
        "x-ncp-apigw-api-key": clientSecret,
      },
    });

    if (!res.ok) {
      console.error(`[Directions] API 응답 오류: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const summary = data?.route?.traoptimal?.[0]?.summary;
    if (!summary) return null;

    return {
      durationMin: Math.round(Number(summary.duration) / 60000), // ms → 분
      distanceM: Number(summary.distance),
    };
  } catch (error) {
    console.error("[Directions] API 호출 중 오류:", error);
    return null;
  }
}
