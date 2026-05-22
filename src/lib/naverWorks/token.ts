// Naver Works OpenAPI Service Account 토큰 발급 + 캐시
// JWT Bearer 방식으로 access_token 발급 (서버 사이드 전용)
import jwt from "jsonwebtoken";

const NW_CLIENT_ID = process.env.NW_CLIENT_ID || "";
const NW_CLIENT_SECRET = process.env.NW_CLIENT_SECRET || "";
const NW_SERVICE_ACCOUNT = process.env.NW_SERVICE_ACCOUNT || "";
const NW_PRIVATE_KEY = (process.env.NW_PRIVATE_KEY || "").replace(/\\n/g, "\n");

// Naver Works OAuth Scopes (Developer Console에 등록된 항목과 일치해야 함):
//  - mail        : 메일 발송 (POST /users/{id}/mail)
//  - mail.read   : 메일 조회 (GET /users/{id}/mail/messages 등)
//  - user.read   : 사용자 정보(이름 등) 조회
const DEFAULT_SCOPE = "mail mail.read user.read";

interface TokenCache {
  token: string;
  expiresAt: number; // ms epoch
}
let cached: TokenCache | null = null;

export class NaverWorksError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function assertEnv() {
  if (!NW_CLIENT_ID || !NW_CLIENT_SECRET || !NW_SERVICE_ACCOUNT || !NW_PRIVATE_KEY) {
    throw new NaverWorksError(
      "Naver Works 환경변수가 설정되지 않았습니다. NW_CLIENT_ID/NW_CLIENT_SECRET/NW_SERVICE_ACCOUNT/NW_PRIVATE_KEY 를 .env 에 추가하세요.",
      500,
    );
  }
}

/**
 * Service Account 로 access_token 발급 (1시간 유효, 캐시)
 */
export async function getNaverWorksToken(
  scope: string = DEFAULT_SCOPE,
): Promise<string> {
  assertEnv();

  // 캐시가 유효(만료 60초 전까지)하면 재사용
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: NW_CLIENT_ID,
      sub: NW_SERVICE_ACCOUNT,
      iat: now,
      exp: now + 60 * 60, // 1시간
    },
    NW_PRIVATE_KEY,
    { algorithm: "RS256" },
  );

  const body = new URLSearchParams({
    assertion,
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    client_id: NW_CLIENT_ID,
    client_secret: NW_CLIENT_SECRET,
    scope,
  });

  const res = await fetch("https://auth.worksmobile.com/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text();
    // 서버 콘솔에도 자세히 로그
    console.error("[NaverWorks token] failed:", res.status, errBody);
    console.error("[NaverWorks token] used config:", {
      clientId: NW_CLIENT_ID ? `${NW_CLIENT_ID.slice(0, 8)}...` : "MISSING",
      serviceAccount: NW_SERVICE_ACCOUNT || "MISSING",
      hasPrivateKey: !!NW_PRIVATE_KEY,
      privateKeyStart: NW_PRIVATE_KEY ? NW_PRIVATE_KEY.slice(0, 30) : "",
      scope,
    });
    throw new NaverWorksError(
      `Naver Works token 발급 실패 (${res.status}): ${errBody}`,
      res.status,
      errBody,
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };

  // ★ 발급된 토큰에 실제로 어떤 scope이 부여됐는지 로그 (요청 vs 응답 비교)
  console.log("[NaverWorks token] issued OK:", {
    requestedScope: scope,
    grantedScope: data.scope,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
  });

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cached.token;
}

/** 캐시 강제 무효화 (디버깅용) */
export function clearNaverWorksTokenCache() {
  cached = null;
}

/**
 * Naver Works API 호출 헬퍼 (Service Account JWT 토큰 사용)
 * ⚠️ 주의: 메일 API 는 Service Account 로 호출 불가 (auth-jwt 문서 참고).
 * 메일 관련 endpoint 호출에는 nwFetchAsUser() 사용할 것.
 */
export async function nwFetch<T = unknown>(
  path: string,
  init?: RequestInit & { searchParams?: Record<string, string | number | undefined> },
): Promise<T> {
  const token = await getNaverWorksToken();
  return nwFetchWithToken<T>(token, path, init);
}

/**
 * 명시적으로 전달된 access_token 으로 Naver Works API 호출
 * — OAuth Code Flow 로 발급받은 사용자 토큰을 넘겨주는 용도
 */
export async function nwFetchWithToken<T = unknown>(
  accessToken: string,
  path: string,
  init?: RequestInit & { searchParams?: Record<string, string | number | undefined> },
): Promise<T> {
  let url = `https://www.worksapis.com${path}`;
  if (init?.searchParams) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(init.searchParams)) {
      if (v === undefined || v === null) continue;
      params.append(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[NaverWorks API] failed:", res.status, path, errBody);
    throw new NaverWorksError(
      `Naver Works API 오류 (${res.status} ${path}): ${errBody}`,
      res.status,
      errBody,
    );
  }

  // 응답이 비어있을 수 있음 (DELETE 등)
  const text = await res.text();
  if (!text) return undefined as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
