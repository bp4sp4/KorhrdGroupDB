import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import {
  getUserMailCredentials,
  listMessages,
  MailCredentialsNotFoundError,
} from "@/lib/imapMail";

// GET /api/mail/list?folder=INBOX&count=30
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const folder = searchParams.get("folder") || "INBOX";
  const count = Number(searchParams.get("count") || 30);

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

  try {
    const list = await listMessages(creds, { folder, limit: count });
    // 기존 페이지가 기대하는 형태로 매핑
    const messages = list.map((m) => ({
      messageId: String(m.uid),
      subject: m.subject,
      from: m.from
        ? {
            emailAddress: {
              address: m.from.address,
              name: m.from.name || undefined,
            },
          }
        : undefined,
      to: m.to.length
        ? m.to.map((t) => ({
            emailAddress: { address: t.address, name: t.name || undefined },
          }))
        : undefined,
      receivedTime: m.date,
      sentTime: m.date,
      hasAttachment: m.hasAttachment,
      isRead: !m.isUnread,
      bodyPreview: m.preview,
    }));

    return NextResponse.json({
      ok: true,
      messages,
      unreadCount: list.filter((m) => m.isUnread).length,
      totalCount: messages.length,
      nextCursor: undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
