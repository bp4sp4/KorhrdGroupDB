import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/naver-geocode";

// GET /api/geocode - 쿼리 파라미터로 주소 변환 지원
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "주소를 입력해주세요. (?address=서울시 강남구)" },
      { status: 400 },
    );
  }

  const result = await geocodeAddress(address.trim());

  if (!result) {
    return NextResponse.json(
      { error: "주소를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    latitude: result.latitude,
    longitude: result.longitude,
    roadAddress: result.roadAddress,
    jibunAddress: result.jibunAddress,
  });
}

// POST /api/geocode - 단일 주소 → 좌표 변환
export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "주소를 입력해주세요." },
        { status: 400 },
      );
    }

    const result = await geocodeAddress(address.trim());

    if (!result) {
      return NextResponse.json(
        { error: "주소를 찾을 수 없습니다. 정확한 주소를 입력해주세요." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      latitude: result.latitude,
      longitude: result.longitude,
      roadAddress: result.roadAddress,
      jibunAddress: result.jibunAddress,
    });
  } catch (error) {
    console.error("[Geocode API] 오류:", error);
    return NextResponse.json(
      { error: "주소 변환 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
