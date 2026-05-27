/**
 * 메일 자격증명(앱 비밀번호) 암호화 모듈
 * - AES-256-GCM 사용
 * - 환경변수 MAIL_PASSWORD_ENCRYPTION_KEY (32바이트 hex = 64자) 필요
 * - 출력 포맷: base64(iv(12) | authTag(16) | ciphertext)
 */

import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12 // GCM 권장
const TAG_LEN = 16

function getKey(): Buffer {
  const hex = process.env.MAIL_PASSWORD_ENCRYPTION_KEY
  if (!hex) {
    throw new Error(
      'MAIL_PASSWORD_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. ' +
        '32바이트 hex(64자) 키를 .env 에 설정하세요. ' +
        '예: openssl rand -hex 32',
    )
  }
  if (hex.length !== 64) {
    throw new Error(
      `MAIL_PASSWORD_ENCRYPTION_KEY 는 64자 hex 여야 합니다. (현재 ${hex.length}자)`,
    )
  }
  return Buffer.from(hex, 'hex')
}

/** 평문 → 암호화된 base64 문자열 */
export function encryptMailPassword(plaintext: string): string {
  if (!plaintext) throw new Error('비밀번호가 비어있습니다.')
  const key = getKey()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  // iv | authTag | ciphertext 합쳐서 base64
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/** 암호화된 base64 → 평문 */
export function decryptMailPassword(encrypted: string): string {
  if (!encrypted) throw new Error('암호문이 비어있습니다.')
  const key = getKey()
  const buf = Buffer.from(encrypted, 'base64')
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('암호문 형식이 올바르지 않습니다.')
  }
  const iv = buf.subarray(0, IV_LEN)
  const authTag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
