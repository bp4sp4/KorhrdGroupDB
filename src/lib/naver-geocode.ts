// 네이버 Geocoding API 서버 사이드 유틸리티

export interface GeocodeResponse {
  latitude: number;
  longitude: number;
  roadAddress: string;
  jibunAddress: string;
}

/**
 * 주소를 네이버 Geocoding API로 좌표 변환합니다.
 * 서버 사이드에서만 사용 (API Key가 필요하므로)
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocodeResponse | null> {
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "";
  const clientSecret = process.env.NAVER_GEOCODING_API_KEY || "";

  if (!clientId || !clientSecret) {
    console.error(
      "[Geocoding] NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 또는 NAVER_GEOCODING_API_KEY 환경 변수가 설정되지 않았습니다.",
    );
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`,
      {
        headers: {
          "x-ncp-apigw-api-key-id": clientId,
          "x-ncp-apigw-api-key": clientSecret,
        },
      },
    );

    if (!response.ok) {
      console.error(
        `[Geocoding] API 응답 오류: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json();

    if (data.meta?.totalCount > 0) {
      const addr = data.addresses[0];
      return {
        latitude: parseFloat(addr.y),
        longitude: parseFloat(addr.x),
        roadAddress: addr.roadAddress || "",
        jibunAddress: addr.jibunAddress || "",
      };
    }

    return null;
  } catch (error) {
    console.error("[Geocoding] API 호출 중 오류:", error);
    return null;
  }
}
