import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { sendMail } from "@/lib/naverWorks/mail";
import { NaverWorksError } from "@/lib/naverWorks/token";
import {
  getUserNaverWorksAccess,
  NaverWorksAuthRequiredError,
} from "@/lib/naverWorks/userTokens";

// POST /api/mail/send
export async function POST(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

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

  const body = (await req.json()) as {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    bodyHtml?: string;
    bodyText?: string;
    attachmentIds?: string[];
  };

  if (!body.to?.length || !body.subject) {
    return NextResponse.json(
      { error: "to / subject 는 필수입니다." },
      { status: 400 },
    );
  }

  try {
    const data = await sendMail(accessToken, worksUserEmail || "me", body);
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    if (err instanceof NaverWorksError) {
      return NextResponse.json(
        { ok: false, error: err.message, body: err.body },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
