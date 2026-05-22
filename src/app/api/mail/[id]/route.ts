import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { getMail, deleteMail, markAsRead } from "@/lib/naverWorks/mail";
import { NaverWorksError } from "@/lib/naverWorks/token";
import {
  getUserNaverWorksAccess,
  NaverWorksAuthRequiredError,
} from "@/lib/naverWorks/userTokens";

async function withToken<T>(
  appUserId: number,
  fn: (accessToken: string, userId: string) => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; code?: string }> {
  let accessToken: string;
  let userId: string;
  try {
    const ctx = await getUserNaverWorksAccess(appUserId);
    accessToken = ctx.accessToken;
    userId = ctx.worksUserEmail || "me";
  } catch (err) {
    if (err instanceof NaverWorksAuthRequiredError) {
      return { ok: false, status: 401, error: err.message, code: "NW_AUTH_REQUIRED" };
    }
    return { ok: false, status: 500, error: (err as Error).message };
  }
  try {
    const data = await fn(accessToken, userId);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof NaverWorksError) {
      return { ok: false, status: err.status, error: err.message };
    }
    return { ok: false, status: 500, error: (err as Error).message };
  }
}

// GET /api/mail/[id] — 메일 상세
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const result = await withToken(appUser.id, (token, userId) =>
    getMail(token, userId, id),
  );
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.status },
    );
  }

  // ── 네이버 웍스 응답을 페이지가 기대하는 형식으로 변환 ──
  const raw = result.data;
  const m = raw.mail;
  const bodyContent = m.body || "";
  // contentType 추정: HTML 태그 있으면 HTML, 아니면 TEXT
  const contentType = /<\/?[a-z][\s\S]*>/i.test(bodyContent) ? "HTML" : "TEXT";

  const data = {
    messageId: String(m.mailId),
    subject: m.subject || "(제목 없음)",
    from: m.from
      ? {
          emailAddress: {
            address: m.from.email || "",
            name: m.from.name || undefined,
          },
        }
      : undefined,
    to: m.to?.map((t) => ({
      emailAddress: { address: t.email || "", name: t.name || undefined },
    })),
    cc: m.cc?.map((t) => ({
      emailAddress: { address: t.email || "", name: t.name || undefined },
    })),
    bcc: m.bcc?.map((t) => ({
      emailAddress: { address: t.email || "", name: t.name || undefined },
    })),
    receivedTime: m.receivedTime,
    sentTime: m.sentTime,
    body: {
      contentType: contentType as "HTML" | "TEXT",
      content: bodyContent,
    },
    attachments: raw.attachments
      ?.filter((a) => {
        // 인라인 이미지(-2 등 음수 ID) 제외 — 본문 안에 내장됨
        const id = Number(a.attachmentId);
        return Number.isFinite(id) ? id >= 0 : true;
      })
      .map((a) => ({
        attachmentId: String(a.attachmentId),
        fileName: a.filename || "untitled",
        size: a.size || 0,
        contentType: a.contentType,
      })),
    hasAttachment:
      (raw.attachments || []).some((a) => {
        const id = Number(a.attachmentId);
        return Number.isFinite(id) ? id >= 0 : true;
      }) || false,
  };

  return NextResponse.json({ ok: true, data });
}

// DELETE /api/mail/[id] — 휴지통 이동
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const result = await withToken(appUser.id, (token, userId) => deleteMail(token, userId, id));
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true });
}

// PATCH /api/mail/[id] — 읽음 표시
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const body = (await req.json()) as { isRead?: boolean };

  if (typeof body.isRead !== "boolean") {
    return NextResponse.json({ ok: true });
  }

  const result = await withToken(appUser.id, (token, userId) =>
    markAsRead(token, userId, id, body.isRead),
  );
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, code: result.code },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true });
}
