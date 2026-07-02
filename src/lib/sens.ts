import { createHmac } from "crypto";

// 네이버 클라우드 SENS — SMS v2 발송
// env (기존 값 재사용, 없으면 NAVER_SENS_* 로도 인식):
//   Access Key : NAVER_SENS_ACCESS_KEY | NAVER_CLOUD_ACCESS_KEY
//   Secret Key : NAVER_CLOUD_SECRET_KEY | NAVER_SENS_SECRET_KEY
//   Service ID : NAVER_SENS_SERVICE_ID   (ncp:sms:kr:...:...)
//   발신번호    : NAVER_CLOUD_SMS_SENDER | NAVER_SENS_SENDER (숫자만)

const BASE = "https://sens.apigw.ntruss.com";

function makeSignature(
  method: string,
  urlPath: string,
  timestamp: string,
  accessKey: string,
  secretKey: string,
): string {
  const message = `${method} ${urlPath}\n${timestamp}\n${accessKey}`;
  return createHmac("sha256", secretKey).update(message).digest("base64");
}

export async function sendSensSms({
  to,
  message,
}: {
  to: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  const accessKey =
    process.env.NAVER_SENS_ACCESS_KEY || process.env.NAVER_CLOUD_ACCESS_KEY;
  const secretKey =
    process.env.NAVER_SENS_SECRET_KEY || process.env.NAVER_CLOUD_SECRET_KEY;
  const serviceId = process.env.NAVER_SENS_SERVICE_ID;
  const sender =
    process.env.NAVER_SENS_SENDER || process.env.NAVER_CLOUD_SMS_SENDER;

  if (!accessKey || !secretKey || !serviceId || !sender) {
    return { success: false, error: "SENS env 미설정" };
  }

  const receiver = to.replace(/[^0-9]/g, "");
  if (receiver.length < 10) return { success: false, error: "수신번호 오류" };

  const urlPath = `/sms/v2/services/${encodeURIComponent(serviceId)}/messages`;
  const timestamp = String(Date.now());
  const signature = makeSignature(
    "POST",
    urlPath,
    timestamp,
    accessKey,
    secretKey,
  );

  const byteLen = new TextEncoder().encode(message).length;
  const body = {
    type: byteLen > 90 ? "LMS" : "SMS",
    from: sender.replace(/[^0-9]/g, ""),
    content: message,
    messages: [{ to: receiver }],
  };

  try {
    const res = await fetch(`${BASE}${urlPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-ncp-apigw-timestamp": timestamp,
        "x-ncp-iam-access-key": accessKey,
        "x-ncp-apigw-signature-v2": signature,
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    if (!res.ok) {
      return { success: false, error: `SENS ${res.status}: ${raw.slice(0, 200)}` };
    }
    let parsed: { statusCode?: string } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* 응답이 비어도 202면 성공 처리 */
    }
    if (parsed.statusCode && parsed.statusCode !== "202") {
      return { success: false, error: `SENS statusCode ${parsed.statusCode}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
