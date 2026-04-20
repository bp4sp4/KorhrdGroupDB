// eslint-disable-next-line @typescript-eslint/no-require-imports
const popbill = require('popbill')

popbill.config({
  LinkID: process.env.POPBILL_LINK_ID,
  SecretKey: process.env.POPBILL_SECRET_KEY,
  IsTest: process.env.POPBILL_IS_TEST === 'true',
  defaultErrorHandler: (err: unknown) => console.error('[Popbill]', err),
})

export const easyFinBankService = popbill.EasyFinBankService()
export const CORP_NUM = process.env.POPBILL_CORP_NUM ?? ''
