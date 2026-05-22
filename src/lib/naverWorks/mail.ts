// Naver Works Mail API 래퍼 (OAuth Code Flow 사용자 토큰 기반)
// 공식: https://developers.worksmobile.com/kr/docs/mail
//
// 메일 API 는 JWT(Service Account) 로는 호출 불가 — auth-jwt 금지 목록 참고.
// 반드시 OAuth Authorization Code Flow 로 발급받은 사용자 토큰 사용.
import { nwFetchWithToken } from "./token";

// ─── 타입 ────────────────────────────────────────────────────────────────
export interface MailAddress {
  emailAddress: { address: string; name?: string };
}

export interface MailListItem {
  messageId: string;
  threadId?: string;
  subject: string;
  from?: MailAddress;
  to?: MailAddress[];
  cc?: MailAddress[];
  receivedTime?: string; // ISO
  sentTime?: string;
  hasAttachment?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  folderName?: string;
  bodyPreview?: string;
}

export interface MailListResponse {
  messages?: MailListItem[];
  messageCount?: number;
  // Naver Works 페이지네이션 정보
  nextCursor?: string;
}

export interface MailDetail extends MailListItem {
  body?: {
    contentType: "HTML" | "TEXT";
    content: string;
  };
  attachments?: {
    attachmentId: string;
    fileName: string;
    size: number;
    contentType?: string;
  }[];
}

// 네이버 웍스 raw 응답 — mail-get
export interface MailGetResponse {
  mail: {
    mailId: number | string;
    folderId?: number;
    status?: number;
    from?: { email?: string; name?: string };
    to?: { email?: string; name?: string }[];
    cc?: { email?: string; name?: string }[];
    bcc?: { email?: string; name?: string }[];
    subject?: string;
    body?: string;
    receivedTime?: string;
    sentTime?: string;
    size?: number;
    securityLevel?: string;
  };
  attachments?: {
    attachmentId: number | string;
    contentType?: string;
    filename?: string;
    size?: number;
  }[];
  threads?: unknown[];
}

export interface SendMailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  attachmentIds?: string[];
}

// ─── 폴더 이름 상수 ──────────────────────────────────────────────────────
// 우리 앱 내부 식별자
export const FolderName = {
  Inbox: "INBOX",
  Sent: "SENT",
  Drafts: "DRAFTS",
  Trash: "DELETED",
  Spam: "JUNK",
  All: "ALL",
} as const;
export type FolderName = (typeof FolderName)[keyof typeof FolderName];

// 네이버 웍스 시스템 폴더 한국어 이름 ← 우리 식별자 매핑용
// (실제 folderId 는 listFolders 응답에서 가져옴)
export const FOLDER_KO_NAME_MAP: Record<string, string[]> = {
  INBOX: ["받은메일함", "받은편지함"],
  SENT: ["보낸메일함", "보낸편지함"],
  DRAFTS: ["임시보관함", "임시보관"],
  DELETED: ["휴지통"],
  JUNK: ["스팸메일함", "스팸"],
};

// ─── API 호출 ────────────────────────────────────────────────────────────

/**
 * 특정 메일함의 메일 목록 조회
 * 공식: GET /v1.0/users/{userId}/mail/mailfolders/{folderId}/children
 * 응답: { mails[], unreadCount, folderName, listCount, totalCount, responseMetaData: { nextCursor } }
 */
export interface MailListMail {
  mailId: string;
  status?: string;          // 메일 상태 (읽음/안읽음 등)
  from?: { email?: string; name?: string };
  to?: { email?: string; name?: string }[];
  subject?: string;
  receivedTime?: string;
  sentTime?: string;
  size?: number;
  isImportant?: boolean;
  attachCount?: number;
  securityLevel?: string;
  useForwarding?: boolean;
}
export interface MailListChildrenResponse {
  mails: MailListMail[];
  unreadCount?: number;
  folderName?: string;
  listCount?: number;
  totalCount?: number;
  responseMetaData?: { nextCursor?: string };
}

export async function listMails(
  accessToken: string,
  userId: string,
  folderId: number,
  options: {
    count?: number;
    cursor?: string;
    searchFilterType?: "all" | "mark" | "attach" | "tome";
    isUnread?: boolean;
  } = {},
) {
  return nwFetchWithToken<MailListChildrenResponse>(
    accessToken,
    `/v1.0/users/${encodeURIComponent(userId)}/mail/mailfolders/${folderId}/children`,
    {
      method: "GET",
      searchParams: {
        count: options.count ?? 30,
        cursor: options.cursor,
        searchFilterType: options.searchFilterType,
        isUnread: options.isUnread === undefined ? undefined : String(options.isUnread),
      },
    },
  );
}

/**
 * 메일 상세 조회 (본문 + 첨부 메타)
 * 공식: GET /v1.0/users/{userId}/mail/{mailId}
 */
export async function getMail(accessToken: string, userId: string, mailId: string) {
  return nwFetchWithToken<MailGetResponse>(
    accessToken,
    `/v1.0/users/${encodeURIComponent(userId)}/mail/${encodeURIComponent(mailId)}`,
  );
}

/**
 * 메일 발송
 * 공식: POST /v1.0/users/{userId}/mail
 * https://developers.worksmobile.com/kr/docs/mail-create
 */
export async function sendMail(accessToken: string, userId: string, input: SendMailInput) {
  // 네이버 웍스 mail-create body 구조:
  // { to, cc?, bcc?, subject, body, contentType, attachments? }
  // 다중 수신자는 콤마 구분 문자열로 전달
  const body: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    contentType: "html" | "text";
    attachments?: { fileId: string }[];
  } = {
    to: input.to.join(","),
    subject: input.subject,
    body: input.bodyHtml || input.bodyText || "",
    contentType: input.bodyHtml ? "html" : "text",
  };
  if (input.cc?.length) body.cc = input.cc.join(",");
  if (input.bcc?.length) body.bcc = input.bcc.join(",");
  if (input.attachmentIds?.length) {
    body.attachments = input.attachmentIds.map((id) => ({ fileId: id }));
  }

  return nwFetchWithToken<{ messageId: string }>(
    accessToken,
    `/v1.0/users/${encodeURIComponent(userId)}/mail`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

/**
 * 메일 삭제
 * 공식: DELETE /v1.0/users/{userId}/mail/{mailId}
 */
export async function deleteMail(accessToken: string, userId: string, mailId: string) {
  return nwFetchWithToken<void>(
    accessToken,
    `/v1.0/users/${encodeURIComponent(userId)}/mail/${encodeURIComponent(mailId)}`,
    { method: "DELETE" },
  );
}

/**
 * 중요 표시 / 읽음 표시
 * 공식: PATCH /v1.0/users/{userId}/mail/{mailId}
 */
export async function markAsRead(
  accessToken: string,
  userId: string,
  mailId: string,
  isRead = true,
) {
  return nwFetchWithToken<void>(
    accessToken,
    `/v1.0/users/${encodeURIComponent(userId)}/mail/${encodeURIComponent(mailId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ isRead }),
    },
  );
}

/**
 * 메일함(폴더) 목록 조회
 * 공식: GET /v1.0/users/{userId}/mail/mailfolders
 */
export interface MailFolder {
  folderId: number;
  folderType: "S" | "U"; // S=system, U=user-created
  folderName: string;
  unreadMailCount?: number;
  mailCount?: number;
  usage?: number;
  folderDepth?: number;
  parentFolderId?: number;
  hasChildFolder?: boolean;
}
export async function listFolders(accessToken: string, userId: string) {
  return nwFetchWithToken<{ mailFolders: MailFolder[] }>(
    accessToken,
    `/v1.0/users/${encodeURIComponent(userId)}/mail/mailfolders`,
  );
}
