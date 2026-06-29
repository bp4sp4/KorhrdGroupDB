"use client";
import { useState, useCallback } from "react";
import type { UserLocationState } from "./types";

export function useUserLocation() {
  const [locationState, setLocationState] = useState<UserLocationState>({
    coords: null,
    addressText: "",
    isLoading: false,
    error: null,
    source: null,
  });

  // 방법 1: GPS 자동 감지
  const detectGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState((prev) => ({
        ...prev,
        error: "GPS를 지원하지 않는 브라우저입니다.",
      }));
      return;
    }

    setLocationState((prev) => ({ ...prev, isLoading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationState({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          addressText: "현재 위치",
          isLoading: false,
          error: null,
          source: "gps",
        });
      },
      (error) => {
        let message = "위치를 가져올 수 없습니다.";
        if (error.code === error.PERMISSION_DENIED) {
          message =
            "위치 접근이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.";
        } else if (error.code === error.TIMEOUT) {
          message = "위치 요청 시간이 초과되었습니다. 다시 시도해주세요.";
        }
        setLocationState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  // 방법 2: 주소 직접 입력 → Geocoding API 호출
  const geocodeAddress = useCallback(async (address: string) => {
    if (!address.trim()) {
      setLocationState((prev) => ({
        ...prev,
        error: "주소를 입력해주세요.",
      }));
      return;
    }

    setLocationState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "주소 변환에 실패했습니다.");
      }

      setLocationState({
        coords: { latitude: data.latitude, longitude: data.longitude },
        addressText: data.roadAddress || address,
        isLoading: false,
        error: null,
        source: "manual",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "주소 변환 중 오류가 발생했습니다.";
      setLocationState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  // 좌표 직접 설정
  const setCoords = useCallback((latitude: number, longitude: number, label: string) => {
    setLocationState({
      coords: { latitude, longitude },
      addressText: label,
      isLoading: false,
      error: null,
      source: "manual",
    });
  }, []);

  // 위치 초기화
  const clearLocation = useCallback(() => {
    setLocationState({
      coords: null,
      addressText: "",
      isLoading: false,
      error: null,
      source: null,
    });
  }, []);

  return { locationState, detectGPS, geocodeAddress, setCoords, clearLocation };
}
