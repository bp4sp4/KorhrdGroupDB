import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getUserMailCredentials,
  sendMail,
  MailCredentialsNotFoundError,
} from "@/lib/imapMail";

const ATTACH_BUCKET = "mail-attachments";

// Vercel: SMTP/IMAP 통신은 10초 초과될 수 있음
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/mail/send
// body: { to: string[], cc?: string[], bcc?: string[], subject, bodyHtml?, bodyText? }
export async function POST(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  let creds;
  try {
    creds = await getUserMailCredentials(appUser.id);
  } catch (err) {
    if (err instanceof MailCredentialsNotFoundError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          code: "MAIL_CREDENTIALS_REQUIRED",
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    attachments?: {
      path: string;
      filename: string;
      contentType?: string;
    }[];
  } | null;

  if (!body || !body.to?.length || !body.subject) {
    return NextResponse.json(
      { ok: false, error: "to / subject 는 필수입니다." },
      { status: 400 },
    );
  }

  // Storage 경로 첨부 → 서버에서 다운로드해 Buffer 로 변환
  const attachInputs = (body.attachments ?? []).filter(
    (a) => a && a.path && a.filename,
  );
  const attachments: {
    filename: string;
    content: Buffer;
    contentType?: string;
  }[] = [];
  for (const a of attachInputs) {
    const { data, error } = await supabaseAdmin.storage
      .from(ATTACH_BUCKET)
      .download(a.path);
    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: `첨부파일을 불러오지 못했습니다: ${a.filename}` },
        { status: 500 },
      );
    }
    const buf = Buffer.from(await data.arrayBuffer());
    attachments.push({
      filename: a.filename,
      content: buf,
      contentType: a.contentType,
    });
  }

  try {
    const data = await sendMail(creds, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    // 발송 성공 → 임시 첨부 파일 정리 (실패해도 무시)
    const paths = attachInputs.map((a) => a.path);
    if (paths.length > 0) {
      await supabaseAdmin.storage
        .from(ATTACH_BUCKET)
        .remove(paths)
        .catch(() => {});
    }
    return NextResponse.json({
      ok: true,
      messageId: data.messageId,
      sentFolderSynced: data.sentFolderSynced,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
