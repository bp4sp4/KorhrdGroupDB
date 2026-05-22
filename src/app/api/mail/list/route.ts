import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import {
  listMails,
  listFolders,
  FolderName,
  FOLDER_KO_NAME_MAP,
} from "@/lib/naverWorks/mail";
import { NaverWorksError } from "@/lib/naverWorks/token";
import {
  getUserNaverWorksAccess,
  NaverWorksAuthRequiredError,
} from "@/lib/naverWorks/userTokens";

// GET /api/mail/list?folder=INBOX&count=30&cursor=...
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  // OAuth 사용자 토큰 + 이메일
  let accessToken: string;
  let worksUserEmail: string | null;
  try {
    const ctx = await getUserNaverWorksAccess(appUser.id);
    accessToken = ctx.accessToken;
    worksUserEmail = ctx.worksUserEmail;
  } catch (err) {
    if (err instanceof NaverWorksAuthRequiredError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: "NW_AUTH_REQUIRED" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }

  const userId = worksUserEmail || "me";

  const { searchParams } = new URL(request.url);
  const folder = (searchParams.get("folder") || FolderName.Inbox) as string;
  const count = Number(searchParams.get("count") || 30);
  const cursor = searchParams.get("cursor") || undefined;
  const isUnread = searchParams.get("isUnread") === "true" ? true : undefined;

  try {
    // 1) 폴더 목록 조회 → folderName → folderId 매핑
    const foldersRes = await listFolders(accessToken, userId);
    const candidates = FOLDER_KO_NAME_MAP[folder] || [folder];
    const target = foldersRes.mailFolders.find((f) =>
      candidates.includes(f.folderName),
    );
    if (!target) {
      return NextResponse.json(
        {
          ok: false,
          error: `폴더 매핑 실패 (folder=${folder}). 존재 폴더: ${foldersRes.mailFolders
            .map((f) => f.folderName)
            .join(", ")}`,
        },
        { status: 404 },
      );
    }

    // 2) 메일 목록 조회
    const data = await listMails(accessToken, userId, target.folderId, {
      count,
      cursor,
      isUnread,
    });

    // 3) 페이지 UI 호환 형태로 변환 (mailId → messageId 등)
    const messages = data.mails.map((m) => ({
      messageId: m.mailId,
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
      receivedTime: m.receivedTime,
      sentTime: m.sentTime,
      hasAttachment: (m.attachCount || 0) > 0,
      isRead:
        m.status === undefined ? undefined : !/UNREAD/i.test(m.status || ""),
      bodyPreview: undefined,
    }));

    return NextResponse.json({
      ok: true,
      messages,
      unreadCount: data.unreadCount,
      totalCount: data.totalCount,
      nextCursor: data.responseMetaData?.nextCursor,
    });
  } catch (err) {
    if (err instanceof NaverWorksError) {
      return NextResponse.json(
        { ok: false, error: err.message, status: err.status, body: err.body },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
