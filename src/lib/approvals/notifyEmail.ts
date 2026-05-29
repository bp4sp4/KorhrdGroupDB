/**
 * 전자결재 알림 메일 (다음 스마트워크 SMTP)
 *
 * - 발신: 시스템 계정(app_users.id). env APPROVAL_MAIL_SENDER_USER_ID 로 지정, 기본 14(admin).
 *   ※ 실제 From 주소는 해당 계정의 mail_credentials.email 로 고정됨 (SMTP 인증 계정과 동일해야 발송 가능).
 * - 수신: app_user 의 mail_credentials.email (메일 미연동 사용자는 자동 스킵).
 * - 메일 실패가 결재 흐름/인앱 알림을 막지 않도록 모두 내부에서 try/catch 처리.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUserMailCredentials, sendMail } from "@/lib/imapMail";

const SENDER_USER_ID = Number(process.env.APPROVAL_MAIL_SENDER_USER_ID ?? 14);

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ""
  ).replace(/\/$/, "");
}

/** app_user id → 스마트워크 이메일 (mail_credentials). 없으면 null */
async function resolveEmail(appUserId: number): Promise<string | null> {
  if (!Number.isFinite(appUserId)) return null;
  const { data } = await supabaseAdmin
    .from("mail_credentials")
    .select("email")
    .eq("user_id", appUserId)
    .maybeSingle();
  const email = (data?.email as string | undefined)?.trim();
  return email || null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(subject: string, bodyText: string, url?: string): string {
  const safeBody = escapeHtml(bodyText).replace(/\n/g, "<br/>");
  const font =
    "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',Pretendard,'Malgun Gothic',sans-serif";
  const button = url
    ? `<tr><td style="padding:8px 0 4px">
         <a href="${url}" style="display:inline-block;padding:12px 24px;background:#0084fe;color:#ffffff !important;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">결재 보러가기 →</a>
       </td></tr>`
    : "";
  return `<div style="margin:0;padding:24px 12px;background:#f4f6f9;font-family:${font}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e9ecf1;border-radius:14px;overflow:hidden">
    <tr>
      <td style="height:4px;background:#0084fe;line-height:4px;font-size:0">&nbsp;</td>
    </tr>
    <tr>
      <td style="padding:28px 28px 8px">
        <span style="display:inline-block;padding:4px 10px;background:#eaf4ff;color:#0084fe;font-size:12px;font-weight:700;border-radius:999px;letter-spacing:0.2px">전자결재</span>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 28px 0">
        <h1 style="margin:0;font-size:18px;font-weight:700;color:#191f28;line-height:1.4">${escapeHtml(subject)}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px 4px;font-size:14px;line-height:1.7;color:#4e5968">${safeBody}</td>
    </tr>
    <tr>
      <td style="padding:12px 28px 4px">
        <table role="presentation" cellpadding="0" cellspacing="0">${button}</table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px 24px">
        <div style="border-top:1px solid #f1f3f5;padding-top:14px;font-size:12px;color:#adb5bd;line-height:1.5">
          본 메일은 한평생그룹 전자결재 시스템에서 자동 발송되었습니다.<br/>회신하지 마세요.
        </div>
      </td>
    </tr>
  </table>
</div>`;
}

/** 단일/다중 app_user 에게 동일 내용의 알림 메일 발송 (한 통에 묶어 전송) */
export async function sendApprovalEmail(opts: {
  toAppUserIds: (number | string)[];
  subject: string;
  bodyText: string;
  link?: string;
}): Promise<void> {
  try {
    const ids = Array.from(
      new Set(opts.toAppUserIds.map((v) => Number(v)).filter(Number.isFinite)),
    );
    if (ids.length === 0) return;

    const emails = (
      await Promise.all(ids.map((id) => resolveEmail(id)))
    ).filter((e): e is string => !!e);
    if (emails.length === 0) return;

    const creds = await getUserMailCredentials(SENDER_USER_ID);

    const url = opts.link ? `${appBaseUrl()}${opts.link}` : undefined;
    const bodyText = url ? `${opts.bodyText}\n\n바로가기: ${url}` : opts.bodyText;

    await sendMail(creds, {
      to: emails,
      subject: opts.subject,
      bodyText,
      bodyHtml: buildHtml(opts.subject, opts.bodyText, url),
      skipSentFolder: true,
    });
  } catch (err) {
    console.error("[approval-email] 발송 실패:", err);
  }
}
