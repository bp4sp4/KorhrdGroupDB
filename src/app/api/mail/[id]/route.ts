import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import {
  getUserMailCredentials,
  getMessage,
  markAsRead,
  moveToTrash,
  MailCredentialsNotFoundError,
} from "@/lib/imapMail";

async function loadCreds(appUserId: number) {
  try {
    return { ok: true as const, creds: await getUserMailCredentials(appUserId) };
  } catch (err) {
    if (err instanceof MailCredentialsNotFoundError) {
      return {
        ok: false as const,
        status: 401,
        body: {
          ok: false,
          error: err.message,
          code: "MAIL_CREDENTIALS_REQUIRED",
        },
      };
    }
    return {
      ok: false as const,
      status: 500,
      body: { ok: false, error: (err as Error).message },
    };
  }
}

// GET /api/mail/[id]?folder=INBOX|SENT|DRAFTS|DELETED — 메일 상세
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const uid = Number(id);
  if (!Number.isFinite(uid)) {
    return NextResponse.json(
      { ok: false, error: "잘못된 메일 ID" },
      { status: 400 },
    );
  }

  const folder = new URL(req.url).searchParams.get("folder") || "INBOX";

  const r = await loadCreds(appUser.id);
  if (!r.ok) return NextResponse.json(r.body, { status: r.status });

  try {
    const msg = await getMessage(r.creds, uid, folder);
    if (!msg) {
      return NextResponse.json(
        { ok: false, error: "메일을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const body = msg.bodyHtml || msg.bodyText || "";
    const contentType = msg.bodyHtml ? "HTML" : "TEXT";

    return NextResponse.json({
      ok: true,
      data: {
        messageId: String(msg.uid),
        subject: msg.subject,
        from: msg.from
          ? {
              emailAddress: {
                address: msg.from.address,
                name: msg.from.name || undefined,
              },
            }
          : undefined,
        to: msg.to.map((t) => ({
          emailAddress: { address: t.address, name: t.name || undefined },
        })),
        cc: msg.cc.map((t) => ({
          emailAddress: { address: t.address, name: t.name || undefined },
        })),
        bcc: undefined,
        receivedTime: msg.date,
        sentTime: msg.date,
        body: {
          contentType: contentType as "HTML" | "TEXT",
          content: body,
        },
        attachments: msg.attachments.map((a) => ({
          attachmentId: a.partId || a.filename,
          fileName: a.filename,
          size: a.size,
          contentType: a.contentType,
        })),
        hasAttachment: msg.attachments.length > 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

// DELETE /api/mail/[id]?folder=... — 휴지통 이동
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const uid = Number(id);
  if (!Number.isFinite(uid)) {
    return NextResponse.json(
      { ok: false, error: "잘못된 메일 ID" },
      { status: 400 },
    );
  }

  const folder = new URL(req.url).searchParams.get("folder") || "INBOX";

  const r = await loadCreds(appUser.id);
  if (!r.ok) return NextResponse.json(r.body, { status: r.status });

  try {
    await moveToTrash(r.creds, uid, folder);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

// PATCH /api/mail/[id] — 읽음 표시
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const uid = Number(id);
  if (!Number.isFinite(uid)) {
    return NextResponse.json(
      { ok: false, error: "잘못된 메일 ID" },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { isRead?: boolean };
  if (typeof body.isRead !== "boolean") {
    return NextResponse.json({ ok: true });
  }

  const folder = new URL(req.url).searchParams.get("folder") || "INBOX";

  const r = await loadCreds(appUser.id);
  if (!r.ok) return NextResponse.json(r.body, { status: r.status });

  try {
    await markAsRead(r.creds, uid, body.isRead, folder);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
