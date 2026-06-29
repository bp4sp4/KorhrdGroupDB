"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import styles from "./navermap.module.css";
import type { LatLng, MapItem } from "./types";

// 두 좌표 거리(km)
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function distText(km: number) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

// 컨테이너 크기 변화 후 타일이 안 그려지는 문제 — 리사이즈 이벤트 + refresh 둘 다 쏨
function nudgeMap(map: unknown) {
  if (typeof naver === "undefined" || !naver.maps) return;
  try {
    (
      naver.maps.Event as unknown as {
        trigger?: (t: unknown, e: string) => void;
      }
    ).trigger?.(map, "resize");
  } catch {
    /* 무시 */
  }
  try {
    (map as { refresh?: (b?: boolean) => void }).refresh?.(true);
  } catch {
    /* 무시 */
  }
}

interface NaverMapViewProps {
  userLocation: LatLng;
  items: MapItem[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  showUserMarker?: boolean;
}

export default function NaverMapView({
  userLocation,
  items,
  selectedId = null,
  onSelect,
  showUserMarker = false,
}: NaverMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<naver.maps.Map | null>(null);
  const markersRef = useRef<naver.maps.Marker[]>([]);
  const infoWindowRef = useRef<naver.maps.InfoWindow | null>(null);
  const polylineRef = useRef<{ setMap: (m: unknown) => void } | null>(null);
  const mapElRef = useRef<HTMLElement | null>(null);
  const isDestroyedRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // naver.maps 사용 가능 여부 확인
  const isNaverReady = () =>
    typeof window !== "undefined" &&
    typeof naver !== "undefined" &&
    naver.maps != null;

  // 네이버 지도 스크립트 로드
  const loadNaverMapScript = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      // 인증 실패(도메인 미등록 등) 콜백 — 항상 먼저 등록 (스크립트 재사용 시에도)
      (
        window as unknown as { navermap_authFailure?: () => void }
      ).navermap_authFailure = () => {
        console.error(
          "[NaverMap] 인증 실패 — 이 클라이언트 ID에 현재 접속 주소(도메인/포트)가 등록돼 있는지 확인하세요.",
        );
        setAuthFailed(true);
      };

      if (isNaverReady()) {
        resolve();
        return;
      }

      const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
      if (!clientId) {
        console.error(
          "[NaverMap] NEXT_PUBLIC_NAVER_MAP_CLIENT_ID가 설정되지 않았습니다.",
        );
        reject(new Error("Client ID 없음"));
        return;
      }

      const waitForNaver = () => {
        // 스크립트 로드 후 naver.maps가 실제로 준비될 때까지 대기
        const check = () => {
          if (isNaverReady()) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      };

      // 이미 스크립트가 로딩 중인지 확인
      const existingScript = document.querySelector(
        'script[src*="oapi.map.naver.com"]',
      );
      if (existingScript) {
        waitForNaver();
        return;
      }

      const script = document.createElement("script");
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
      script.async = true;
      script.onload = () => waitForNaver();
      script.onerror = () => reject(new Error("스크립트 로드 실패"));
      document.head.appendChild(script);
    });
  }, []);

  // 스크립트 로드 후 초기화
  useEffect(() => {
    let cancelled = false;
    loadNaverMapScript()
      .then(() => {
        if (!cancelled) setIsLoaded(true);
      })
      .catch((err) => {
        console.error("[NaverMap]", err);
      });
    return () => {
      cancelled = true;
    };
  }, [loadNaverMapScript]);

  // 컨테이너 크기 변화 시 지도 갱신 — 초기 0크기로 그려져 빈 화면 되는 문제 방지
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    const el = mapRef.current;
    const ro = new ResizeObserver(() => {
      if (mapInstanceRef.current) nudgeMap(mapInstanceRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoaded]);

  // 지도 초기화 & 마커 업데이트
  useEffect(() => {
    if (
      !isLoaded ||
      !mapRef.current ||
      isDestroyedRef.current ||
      typeof naver === "undefined" ||
      !naver.maps
    )
      return;

    const center = new naver.maps.LatLng(
      userLocation.latitude,
      userLocation.longitude,
    );

    // HMR/리마운트로 기존 지도가 현재 컨테이너와 분리됐으면 폐기 후 재생성
    if (mapInstanceRef.current && mapElRef.current !== mapRef.current) {
      try {
        (mapInstanceRef.current as unknown as { destroy?: () => void }).destroy?.();
      } catch {
        /* 무시 */
      }
      mapInstanceRef.current = null;
    }

    // 지도 생성 (한 번만) — 생성 시에만 중심/줌 지정
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new naver.maps.Map(mapRef.current, {
        center,
        zoom: 13,
        zoomControl: true,
        zoomControlOptions: {
          position: naver.maps.Position.TOP_RIGHT,
        },
        mapTypeControl: false,
        scaleControl: false,
      });
      mapElRef.current = mapRef.current;
      mapInstanceRef.current.setZoom(13);
      // 생성 직후 레이아웃이 늦게 잡혀 타일이 안 그려지는 경우 방지 — 여러 시점에 리사이즈 nudge
      const created = mapInstanceRef.current;
      requestAnimationFrame(() => nudgeMap(created));
      setTimeout(() => nudgeMap(created), 300);
      setTimeout(() => nudgeMap(created), 900);
    }

    const map = mapInstanceRef.current;
    const NAVY = "#16205A";

    // 기존 마커 제거
    markersRef.current.forEach((marker) => {
      try {
        marker.setMap(null);
      } catch {
        // 이미 제거된 마커 무시
      }
    });
    markersRef.current = [];

    // 기존 연결선 제거
    if (polylineRef.current) {
      try {
        polylineRef.current.setMap(null);
      } catch {
        /* 무시 */
      }
      polylineRef.current = null;
    }

    // InfoWindow (선택 시 팝업)
    if (infoWindowRef.current) {
      try {
        infoWindowRef.current.close();
      } catch {
        /* 무시 */
      }
    }
    const infoWindow = new naver.maps.InfoWindow({
      borderWidth: 0,
      disableAnchor: true,
      backgroundColor: "transparent",
      pixelOffset: new naver.maps.Point(0, -23),
    });
    infoWindowRef.current = infoWindow;
    let selectedMarker: naver.maps.Marker | null = null;

    // 사용자 위치 마커 (눈에 띄게: 펄스 링 + 점 + "내 위치" 라벨) — 실제 위치 잡았을 때만
    if (showUserMarker) {
      const userContent = `
        <div style="transform:translate(-50%,-50%);position:relative;width:20px;height:20px;">
          <span style="position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(0,81,255,.22);animation:nmpulse 1.6s ease-out infinite;"></span>
          <span style="position:absolute;inset:0;border-radius:50%;background:#0051FF;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);"></span>
          <span style="position:absolute;left:50%;top:26px;transform:translateX(-50%);white-space:nowrap;background:#0051FF;color:#fff;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;font-family:Pretendard,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.25);">내 위치</span>
        </div>
        <style>@keyframes nmpulse{0%{transform:scale(.5);opacity:.7}100%{transform:scale(1.6);opacity:0}}</style>`;
      const userMarker = new naver.maps.Marker({
        position: center,
        map,
        title: "내 위치",
        icon: { content: userContent, anchor: new naver.maps.Point(0, 0) },
        zIndex: 300,
      });
      markersRef.current.push(userMarker);
    }

    // 기관/교육원 마커 (알약형 핀)
    items.forEach((item) => {
      const position = new naver.maps.LatLng(item.latitude, item.longitude);
      const sel = item.id === selectedId;
      const label = item.label || item.name;
      const badgeHtml = item.badge
        ? `<span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:5px;background:${sel ? "rgba(255,255,255,.22)" : "#EEF1FB"};color:${sel ? "#fff" : "#3650C7"};">${item.badge}</span>`
        : "";
      const content = `<div style="transform:translate(-50%,-50%);display:flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;background:${sel ? NAVY : "#fff"};color:${sel ? "#fff" : "#1A1D24"};border:1px solid ${sel ? NAVY : "#E2E5EC"};box-shadow:${sel ? "0 8px 18px rgba(22,32,90,.4)" : "0 2px 7px rgba(20,25,40,.16)"};font-size:12px;font-weight:700;white-space:nowrap;font-family:Pretendard,sans-serif;cursor:pointer;">
        <span>${label}</span>${badgeHtml}
      </div>`;
      const marker = new naver.maps.Marker({
        position,
        map,
        title: item.name,
        icon: { content, anchor: new naver.maps.Point(0, 0) },
        zIndex: sel ? 200 : 10,
      });
      naver.maps.Event.addListener(marker, "click", () => {
        onSelectRef.current?.(item.id);
      });
      markersRef.current.push(marker);
      if (sel) selectedMarker = marker;
    });

    // 중심 이동 + 선택 항목 팝업
    if (selectedId != null) {
      const selItem = items.find((it) => it.id === selectedId);
      if (selItem) {
        const selPos = new naver.maps.LatLng(
          selItem.latitude,
          selItem.longitude,
        );
        map.panTo(selPos);

        // 내 위치 ↔ 선택 기관 직선거리
        let distHtml = "";
        if (showUserMarker) {
          const km = haversineKm(
            userLocation.latitude,
            userLocation.longitude,
            selItem.latitude,
            selItem.longitude,
          );
          distHtml = `<div style="margin-top:8px;display:flex;align-items:center;gap:5px;font-size:12px;color:#16205A;font-weight:700;">📍 내 위치에서 ${distText(km)}</div>`;
        }

        if (selectedMarker) {
          const lawHtml = selItem.lawType
            ? `<span style="font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:6px;background:${
                selItem.lawType === "신법" ? "#EAF2FF" : "#F2EEFB"
              };color:${selItem.lawType === "신법" ? "#2563EB" : "#7048C4"};">${selItem.lawType}</span>`
            : "";
          infoWindow.setContent(`
            <div style="padding:13px 14px;font-family:Pretendard,sans-serif;min-width:200px;max-width:240px;background:#fff;border-radius:11px;box-shadow:0 10px 30px rgba(16,24,40,.22);">
              <div style="display:flex;align-items:center;gap:7px;margin-bottom:7px;">
                <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;background:#EEF1FB;color:#3650C7;">${selItem.type || ""}</span>
                <span style="font-weight:700;font-size:14px;color:#1A1D24;">${selItem.name}</span>
              </div>
              <div style="font-size:12px;color:#5A6071;line-height:1.5;">${selItem.regionText || selItem.address || ""}</div>
              ${lawHtml ? `<div style="margin-top:8px;">${lawHtml}</div>` : ""}
              ${distHtml}
            </div>
          `);
          infoWindow.open(map, selectedMarker);
        }
      }
    } else {
      map.setCenter(center);
    }

    // cleanup: 마커만 제거 (지도는 유지)
    return () => {
      markersRef.current.forEach((marker) => {
        try {
          marker.setMap(null);
        } catch {
          // 무시
        }
      });
      markersRef.current = [];

      if (polylineRef.current) {
        try {
          polylineRef.current.setMap(null);
        } catch {
          // 무시
        }
        polylineRef.current = null;
      }

      if (infoWindowRef.current) {
        try {
          infoWindowRef.current.close();
        } catch {
          // 무시
        }
        infoWindowRef.current = null;
      }
    };
  }, [isLoaded, userLocation, items, selectedId, showUserMarker]);

  // 컴포넌트 언마운트 시 지도 파괴
  useEffect(() => {
    return () => {
      isDestroyedRef.current = true;

      // 마커 정리
      markersRef.current.forEach((marker) => {
        try {
          marker.setMap(null);
        } catch {
          // 무시
        }
      });
      markersRef.current = [];
      infoWindowRef.current = null;

      // 지도 파괴
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy();
        } catch {
          // 이미 파괴된 경우 무시
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (authFailed) {
    return (
      <div className={styles.mapLoading}>
        네이버 지도 인증 실패 — 클라이언트 ID에 현재 도메인 등록이 필요합니다.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className={styles.mapLoading}>지도 로딩 중...</div>;
  }

  return <div ref={mapRef} className={styles.mapContainer} />;
}
