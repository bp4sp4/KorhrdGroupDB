import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // 폰트는 내용이 바뀌지 않으므로 1년 immutable 캐시 —
        // CDN/브라우저 캐시를 타게 해서 origin 재전송(Pretendard 4종 × 반복 다운로드) 차단
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
