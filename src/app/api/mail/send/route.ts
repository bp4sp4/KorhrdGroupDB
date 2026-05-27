import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import {
  getUserMailCredentials,
  sendMail,
  MailCredentialsNotFoundError,
} from "@/lib/imapMail";

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
  } | null;

  if (!body || !body.to?.length || !body.subject) {
    return NextResponse.json(
      { ok: false, error: "to / subject 는 필수입니다." },
      { status: 400 },
    );
  }

  try {
    const data = await sendMail(creds, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
    });
    return NextResponse.json({ ok: true, messageId: data.messageId });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
