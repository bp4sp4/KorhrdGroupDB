/**
 * 다음 스마트워크 (또는 기타) 메일 서버 IMAP/SMTP 클라이언트
 * - SMTP: nodemailer
 * - IMAP: imapflow
 *
 * 사용자별 mail_credentials 에서 자격증명 조회 → 복호화 → 호출
 */

import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { simpleParser } from 'mailparser'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { decryptMailPassword } from '@/lib/crypto/mailPassword'

export interface MailCredentials {
  email: string
  password: string
  imap_host: string
  imap_port: number
  smtp_host: string
  smtp_port: number
  use_tls: boolean
}

export class MailCredentialsNotFoundError extends Error {
  constructor() {
    super(
      '메일 자격증명이 등록되지 않았습니다. 먼저 메일 설정 페이지에서 등록해주세요.',
    )
  }
}

/** 본인 메일 자격증명 조회 + 비밀번호 복호화 */
export async function getUserMailCredentials(
  appUserId: number,
): Promise<MailCredentials> {
  const { data, error } = await supabaseAdmin
    .from('mail_credentials')
    .select(
      'email, password_encrypted, imap_host, imap_port, smtp_host, smtp_port, use_tls',
    )
    .eq('user_id', appUserId)
    .maybeSingle()
  if (error) throw new Error(`자격증명 조회 실패: ${error.message}`)
  if (!data) throw new MailCredentialsNotFoundError()
  return {
    email: data.email as string,
    password: decryptMailPassword(data.password_encrypted as string),
    imap_host: data.imap_host as string,
    imap_port: data.imap_port as number,
    smtp_host: data.smtp_host as string,
    smtp_port: data.smtp_port as number,
    use_tls: data.use_tls as boolean,
  }
}

// ─── SMTP (발송) ─────────────────────────────────────────────────────

export interface SendMailParams {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  bodyHtml?: string
  bodyText?: string
  attachments?: { filename: string; content: Buffer; contentType?: string }[]
}

export async function sendMail(
  creds: MailCredentials,
  params: SendMailParams,
): Promise<{ messageId: string }> {
  // 1) raw RFC822 메시지를 먼저 빌드 (SMTP 전송 + IMAP append 양쪽에 재사용)
  const composer = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
  })
  const built = await composer.sendMail({
    from: creds.email,
    to: params.to.join(', '),
    cc: params.cc?.join(', '),
    bcc: params.bcc?.join(', '),
    subject: params.subject,
    text: params.bodyText,
    html: params.bodyHtml,
    attachments: params.attachments,
  })
  const rawMessage = built.message as Buffer

  // 2) SMTP 로 실제 발송
  const transporter = nodemailer.createTransport({
    host: creds.smtp_host,
    port: creds.smtp_port,
    secure: creds.smtp_port === 465,
    auth: { user: creds.email, pass: creds.password },
  })
  const sendInfo = await transporter.sendMail({
    envelope: built.envelope,
    raw: rawMessage,
  })

  // 3) IMAP "보낸편지함" 에도 동일 메시지 append
  //    - fire-and-forget: 사용자 응답을 빨리 돌려주기 위해 await 하지 않음
  //    - 실패해도 발송 자체는 성공이므로 무시
  void (async () => {
    try {
      const client = new ImapFlow({
        host: creds.imap_host,
        port: creds.imap_port,
        secure: creds.use_tls,
        auth: { user: creds.email, pass: creds.password },
        logger: false,
      })
      await client.connect()
      try {
        const sentFolder = await resolveFolderPath(client, 'SENT')
        await client.append(sentFolder, rawMessage, ['\\Seen'])
      } finally {
        await client.logout().catch(() => {})
      }
    } catch {
      // append 실패는 사용자에게 영향 없음
    }
  })()

  return { messageId: sendInfo.messageId }
}

// ─── IMAP (수신/조회) ────────────────────────────────────────────────

export interface MailListItem {
  uid: number
  seq: number
  subject: string
  from: { name?: string; address: string } | null
  date: string | null
  flags: string[]
  isUnread: boolean
  hasAttachment: boolean
  preview?: string
}

/**
 * 폴더 키(INBOX/SENT/DRAFTS/DELETED) 를 실제 IMAP 폴더 path 로 변환.
 * - special-use 플래그 우선 (\Sent, \Drafts, \Trash)
 * - 한국어 폴더명도 fallback 매칭
 */
async function resolveFolderPath(
  client: ImapFlow,
  key: string,
): Promise<string> {
  const upper = key.toUpperCase()
  if (upper === 'INBOX') return 'INBOX'

  const specialUseMap: Record<string, string> = {
    SENT: '\\Sent',
    DRAFTS: '\\Drafts',
    DELETED: '\\Trash',
    TRASH: '\\Trash',
    JUNK: '\\Junk',
  }
  const nameCandidatesMap: Record<string, string[]> = {
    SENT: ['Sent', 'Sent Items', 'Sent Messages', '보낸편지함', '보낸 편지함'],
    DRAFTS: ['Drafts', '임시보관함', '임시보관', '임시 보관함'],
    DELETED: ['Trash', 'Deleted Items', 'Deleted Messages', '휴지통'],
    TRASH: ['Trash', 'Deleted Items', '휴지통'],
    JUNK: ['Junk', 'Spam', '스팸'],
  }

  const list = await client.list()
  // 1) special-use 플래그 우선
  const specialUse = specialUseMap[upper]
  if (specialUse) {
    const bySpecial = list.find(
      (l) => l.specialUse === specialUse,
    )
    if (bySpecial) return bySpecial.path
  }
  // 2) 폴더명 매칭
  const names = nameCandidatesMap[upper] || [key]
  const byName = list.find(
    (l) => names.includes(l.name) || names.includes(l.path),
  )
  if (byName) return byName.path
  // 3) fallback — 표준 영문명 시도
  return upper === 'SENT'
    ? 'Sent'
    : upper === 'DRAFTS'
      ? 'Drafts'
      : upper === 'DELETED' || upper === 'TRASH'
        ? 'Trash'
        : key
}

/**
 * 받은편지함(또는 지정 폴더) 목록 조회
 * @param folder INBOX | SENT | DRAFTS | DELETED | 또는 실제 폴더명
 * @param limit 최근 N개
 */
export async function listMessages(
  creds: MailCredentials,
  options: { folder?: string; limit?: number } = {},
): Promise<MailListItem[]> {
  const folderKey = options.folder ?? 'INBOX'
  const limit = options.limit ?? 30

  const client = new ImapFlow({
    host: creds.imap_host,
    port: creds.imap_port,
    secure: creds.use_tls,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
  })

  await client.connect()
  const folder = await resolveFolderPath(client, folderKey)
  const result: MailListItem[] = []
  try {
    const lock = await client.getMailboxLock(folder)
    try {
      const mailbox = client.mailbox
      if (!mailbox || typeof mailbox === 'boolean') return []
      const total = mailbox.exists
      if (total === 0) return []
      const start = Math.max(1, total - limit + 1)
      const range = `${start}:${total}`
      for await (const msg of client.fetch(range, {
        envelope: true,
        flags: true,
        bodyStructure: true,
        internalDate: true,
      })) {
        const env = msg.envelope
        const isUnread = !msg.flags?.has('\\Seen')
        // 첨부 여부 추정 (bodyStructure 의 disposition 검사)
        let hasAttachment = false
        try {
          const bs = msg.bodyStructure
          const walk = (node: unknown): void => {
            if (!node || typeof node !== 'object') return
            const n = node as { disposition?: string; childNodes?: unknown[] }
            if (
              n.disposition === 'attachment' ||
              n.disposition === 'inline'
            ) {
              hasAttachment = true
            }
            n.childNodes?.forEach(walk)
          }
          walk(bs)
        } catch {
          // ignore
        }
        const sender = env?.from?.[0]
        const rawDate = env?.date ?? msg.internalDate
        result.push({
          uid: msg.uid,
          seq: msg.seq,
          subject: env?.subject ?? '(제목 없음)',
          from: sender
            ? {
                name: sender.name ?? undefined,
                address: sender.address ?? '',
              }
            : null,
          date: rawDate ? new Date(rawDate).toISOString() : null,
          flags: Array.from(msg.flags ?? []),
          isUnread,
          hasAttachment,
        })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
  // 최신 순
  return result.reverse()
}

export interface MailDetail {
  uid: number
  subject: string
  from: { name?: string; address: string } | null
  to: { name?: string; address: string }[]
  cc: { name?: string; address: string }[]
  date: string | null
  bodyHtml?: string
  bodyText?: string
  attachments: {
    filename: string
    size: number
    contentType: string
    partId?: string
  }[]
}

/** 메일 단건 조회 (본문 + 첨부 메타) — mailparser 로 mime/multipart/encoding 처리 */
export async function getMessage(
  creds: MailCredentials,
  uid: number,
  folderKey = 'INBOX',
): Promise<MailDetail | null> {
  const client = new ImapFlow({
    host: creds.imap_host,
    port: creds.imap_port,
    secure: creds.use_tls,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
  })

  await client.connect()
  try {
    const folder = await resolveFolderPath(client, folderKey)
    const lock = await client.getMailboxLock(folder)
    try {
      const msg = await client.fetchOne(
        String(uid),
        { envelope: true, source: true },
        { uid: true },
      )
      if (!msg || !msg.source) return null

      const parsed = await simpleParser(msg.source)

      const parseAddress = (v: unknown) => {
        if (!v) return null
        const obj = v as { value?: Array<{ address?: string; name?: string }> }
        const first = obj.value?.[0]
        if (!first) return null
        return {
          address: first.address || '',
          name: first.name || undefined,
        }
      }
      const parseAddressList = (v: unknown) => {
        if (!v) return []
        const obj = v as { value?: Array<{ address?: string; name?: string }> }
        return (
          obj.value?.map((a) => ({
            address: a.address || '',
            name: a.name || undefined,
          })) ?? []
        )
      }

      const attachments: MailDetail['attachments'] = (parsed.attachments ?? [])
        .filter((a) => a.filename)
        .map((a) => ({
          filename: a.filename || 'untitled',
          size: a.size ?? 0,
          contentType: a.contentType ?? 'application/octet-stream',
          partId: a.cid || a.filename,
        }))

      return {
        uid: msg.uid,
        subject: parsed.subject || '(제목 없음)',
        from: parseAddress(parsed.from),
        to: parseAddressList(parsed.to),
        cc: parseAddressList(parsed.cc),
        date: parsed.date?.toISOString() ?? null,
        bodyHtml: parsed.html || undefined,
        bodyText: parsed.text || undefined,
        attachments,
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

/** 읽음/안읽음 플래그 토글 */
export async function markAsRead(
  creds: MailCredentials,
  uid: number,
  isRead: boolean,
  folderKey = 'INBOX',
): Promise<void> {
  const client = new ImapFlow({
    host: creds.imap_host,
    port: creds.imap_port,
    secure: creds.use_tls,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
  })
  await client.connect()
  try {
    const folder = await resolveFolderPath(client, folderKey)
    const lock = await client.getMailboxLock(folder)
    try {
      if (isRead) {
        await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
      } else {
        await client.messageFlagsRemove(String(uid), ['\\Seen'], { uid: true })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

/** 휴지통 이동 (실제 휴지통 폴더로 자동 매핑) */
export async function moveToTrash(
  creds: MailCredentials,
  uid: number,
  folderKey = 'INBOX',
): Promise<void> {
  const client = new ImapFlow({
    host: creds.imap_host,
    port: creds.imap_port,
    secure: creds.use_tls,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
  })
  await client.connect()
  try {
    const folder = await resolveFolderPath(client, folderKey)
    const trash = await resolveFolderPath(client, 'TRASH')
    const lock = await client.getMailboxLock(folder)
    try {
      try {
        await client.messageMove(String(uid), trash, { uid: true })
      } catch {
        // 휴지통 폴더 못 찾으면 그냥 삭제 플래그
        await client.messageFlagsAdd(String(uid), ['\\Deleted'], { uid: true })
        await client.messageDelete(String(uid), { uid: true })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

/** IMAP 연결 테스트 (자격증명 등록 시 검증용) */
export async function testImapConnection(
  creds: MailCredentials,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = new ImapFlow({
    host: creds.imap_host,
    port: creds.imap_port,
    secure: creds.use_tls,
    auth: { user: creds.email, pass: creds.password },
    logger: false,
  })
  try {
    await client.connect()
    await client.logout()
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
