import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getUserMailCredentials,
  saveDraft,
  MailCredentialsNotFoundError,
} from "@/lib/imapMail";

const ATTACH_BUCKET = "mail-attachments";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/mail/drafts — 작성 중인 메일을 IMAP 임시보관함(Drafts)에 저장
// body: { to?, cc?, bcc?, subject, bodyHtml?, bodyText?, attachments?, replaceUid? }
export async function POST(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  let creds;
  try {
    creds = await getUserMailCredentials(appUser.id);
  } catch (err) {
    if (err instanceof MailCredentialsNotFoundError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: "MAIL_CREDENTIALS_REQUIRED" },
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
    attachments?: { path: string; filename: string; contentType?: string }[];
    replaceUid?: number | null;
  } | null;

  if (!body) {
    return NextResponse.json(
      { ok: false, error: "잘못된 요청입니다." },
      { status: 400 },
    );
  }

  // 첨부 — Storage 경로에서 다운로드해 Buffer 로 변환 (send 라우트와 동일)
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
    const result = await saveDraft(creds, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject ?? "",
      bodyText: body.bodyText,
      bodyHtml: body.bodyHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
      replaceUid:
        typeof body.replaceUid === "number" ? body.replaceUid : undefined,
    });
    return NextResponse.json({ ok: true, uid: result.uid });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
