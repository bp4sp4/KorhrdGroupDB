# Shinhan Proxy

신한은행 오픈API 호출 전용 프록시 서버. Vercel 등 동적 IP 환경에서 IP 화이트리스트 제한을 우회하기 위해 사용.

## 구조

```
Vercel (Next.js) → 이 프록시 (고정 IP) → 신한 API
```

## 배포

### 환경변수 (.env)
```
PORT=8080
SHINHAN_APP_KEY=l7xx...
SHINHAN_APP_SECRET=...
SHINHAN_SUB_CHANNEL=P6
SHINHAN_ENV=dev
PROXY_SECRET=<랜덤 비밀키 - Vercel과 공유>
```

### Ubuntu 서버

```bash
npm ci
pm2 start server.js --name shinhan-proxy
pm2 save
```

## API

### POST /shinhan/transactions

헤더: `x-proxy-secret: <PROXY_SECRET>`

요청 본문:
```json
{
  "accountNumber": "140015029000",
  "startDate": "20260401",
  "endDate": "20260429",
  "clientIp": "1.2.3.4"
}
```

### GET /health

인증 없이 접근 가능. `{ ok: true }`
