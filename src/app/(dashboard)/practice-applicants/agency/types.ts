// 좌표 쌍
export interface LatLng {
  latitude: number;
  longitude: number;
}

// 지도 마커 아이템 (교육원/현장실습기관 공통)
export interface MapItem {
  id: number;
  name: string;
  address: string;
  contact: string | null;
  distance?: number;
  latitude: number;
  longitude: number;
  label?: string; // 마커 핀에 표시할 짧은 이름 (없으면 name)
  badge?: string; // 마커 핀 우측 배지 (예: 법령)
  // 선택 시 뜨는 팝업용
  type?: string; // 교육원 / 기관 유형
  regionText?: string; // 실습 가능 지역 / 주소
  lawType?: string; // 적용 법령 (교육원)
}

// Geocoding API 응답
export interface GeocodeResult {
  latitude: number;
  longitude: number;
  roadAddress?: string;
  jibunAddress?: string;
}

// 사용자 위치 상태 (위치검색)
export interface UserLocationState {
  coords: LatLng | null;
  addressText: string;
  isLoading: boolean;
  error: string | null;
  source: "gps" | "manual" | null;
}
