import React from "react";
import styles from "./styles.module.css";
import type { DocBodyProps, FieldDef, BankAccountLite } from "../types";

export const EXPENSE_RESOLUTION_TRANSFER_FIELDS: FieldDef[] = [
  { key: "belong_dept", label: "소속부서", type: "text", required: true },
  { key: "bank_account_id", label: "출금 통장", type: "text", required: false },
  {
    key: "vendor_name",
    label: "상호명(거래처명)",
    type: "text",
    required: true,
  },
  { key: "vendor_phone", label: "거래처 담당 전화번호", type: "text" },
  { key: "detail", label: "상세내역", type: "text", required: true },
  { key: "category", label: "분류", type: "text" },
  { key: "bank_name", label: "입금 은행명", type: "text", required: true },
  {
    key: "account_number",
    label: "입금 계좌번호(-제외)",
    type: "text",
    required: true,
  },
  {
    key: "account_holder",
    label: "입금 예금자명",
    type: "text",
    required: true,
  },
  { key: "amount", label: "요청금액", type: "number", required: true },
  { key: "cost_type", label: "비용처리", type: "text" },
  { key: "special_note", label: "특이사항", type: "textarea" },
];

const COST_TYPE_OPTIONS = [
  { value: "tax_invoice", label: "세금계산서 (VAT 10%별도)" },
  { value: "cash_receipt", label: "현금영수증 (지출증빙 / 227-88-03196)" },
  { value: "other", label: "기타 (특이사항 기재)" },
];

const CATEGORY_OPTIONS = ["운영비", "예산비"] as const;

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? "");
}

function numDisplay(str: string): string {
  const n = Number(str);
  return !str || isNaN(n) || n === 0 ? "" : n.toLocaleString();
}

function AccountDisplay({ account }: { account: BankAccountLite | null }) {
  if (!account)
    return (
      <span className={styles.empty_account}>등록된 통장이 없습니다.</span>
    );
  return (
    <div className={styles.account_display}>
      <span className={styles.account_display_main}>
        {account.bank_name}
        {account.account_holder ? ` · ${account.account_holder}` : ""}
      </span>
      <span className={styles.account_display_sub}>
        {account.account_number}
      </span>
      {account.memo && (
        <span className={styles.account_display_memo}>{account.memo}</span>
      )}
    </div>
  );
}

function AccountList({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: BankAccountLite[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <select
      className={styles.account_select}
      value={selectedId}
      onChange={(e) => onSelect(e.target.value)}
    >
      <option value="">통장 선택</option>
      {accounts.map((a) => {
        const label = `${a.account_number}${a.memo ? ` (${a.memo})` : ""}`;
        return (
          <option key={a.id} value={a.id}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

export function ExpenseResolutionTransferBody({
  content,
  onChange,
  departments = [],
  bankAccounts = [],
}: DocBodyProps) {
  const ro = !onChange;

  const costType = v(content, "cost_type") || "tax_invoice";
  const belongDeptId = v(content, "belong_dept");
  const accountId = v(content, "bank_account_id");

  const deptAccounts = bankAccounts.filter(
    (b) => b.department_id === belongDeptId,
  );
  const selectedAccount = bankAccounts.find((b) => b.id === accountId) ?? null;

  React.useEffect(() => {
    if (ro) return;
    if (!belongDeptId) return;
    if (accountId && !deptAccounts.find((a) => a.id === accountId)) {
      onChange!("bank_account_id", "");
    } else if (!accountId && deptAccounts.length === 1) {
      onChange!("bank_account_id", deptAccounts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [belongDeptId, deptAccounts.length]);

  return (
    <>
      {/* ── 출금 사업부 / 출금 통장 ── */}
      <table className={styles.table_main}>
        <thead>
          <tr>
            <th colSpan={4} className={styles.th_title}>
              출금(자사) 정보
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={styles.label_cell}>소속부서</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>
                  {(departments.find((d) => d.id === belongDeptId)?.name ??
                    belongDeptId) ||
                    "-"}
                </span>
              ) : (
                <select
                  className={styles.select_full}
                  value={belongDeptId}
                  onChange={(e) => onChange!("belong_dept", e.target.value)}
                >
                  <option value="">-</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </td>
            <td className={styles.label_cell}>출금 통장</td>
            <td className={styles.value_cell}>
              {ro ? (
                <AccountDisplay account={selectedAccount} />
              ) : !belongDeptId ? (
                <span className={styles.empty_account}>
                  소속부서를 먼저 선택하세요.
                </span>
              ) : deptAccounts.length === 0 ? (
                <span className={styles.empty_account}>
                  이 사업부에 등록된 통장이 없습니다.
                </span>
              ) : (
                <AccountList
                  accounts={deptAccounts}
                  selectedId={accountId}
                  onSelect={(id) => onChange!("bank_account_id", id)}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── 입금요청 상세 ── */}

      <table className={styles.table_main}>
        <tbody>
          {/* 상호명 / 거래처 전화번호 */}
          <tr>
            <td className={styles.label_cell}>상호명(거래처명)</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, "vendor_name") || "-"}</span>
              ) : (
                <input
                  type="text"
                  className={styles.input_full}
                  value={v(content, "vendor_name")}
                  placeholder=""
                  onChange={(e) => onChange!("vendor_name", e.target.value)}
                />
              )}
            </td>
            <td className={styles.label_cell}>거래처 담당 전화번호</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, "vendor_phone") || "-"}</span>
              ) : (
                <input
                  type="text"
                  className={styles.input_full}
                  value={v(content, "vendor_phone")}
                  placeholder="010-0000-0000"
                  onChange={(e) => {
                    const digits = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 11);
                    let formatted = digits;
                    if (digits.length > 7)
                      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
                    else if (digits.length > 3)
                      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                    onChange!("vendor_phone", formatted);
                  }}
                />
              )}
            </td>
          </tr>

          {/* 상세내역 / 분류 (반반) */}
          <tr>
            <td className={styles.label_cell}>상세내역</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, "detail") || "-"}</span>
              ) : (
                <input
                  type="text"
                  className={styles.input_full}
                  value={v(content, "detail")}
                  placeholder=""
                  onChange={(e) => onChange!("detail", e.target.value)}
                />
              )}
            </td>
            <td className={styles.label_cell}>분류</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, "category") || "-"}</span>
              ) : (
                <select
                  className={styles.select_full}
                  value={v(content, "category")}
                  onChange={(e) => onChange!("category", e.target.value)}
                >
                  <option value="">분류</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </td>
          </tr>

          {/* 입금 은행명 / 입금 계좌번호 */}
          <tr>
            <td className={styles.label_cell}>입금 은행명</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, "bank_name") || "-"}</span>
              ) : (
                <input
                  type="text"
                  className={styles.input_full}
                  value={v(content, "bank_name")}
                  placeholder=""
                  onChange={(e) => onChange!("bank_name", e.target.value)}
                />
              )}
            </td>
            <td className={styles.label_cell}>입금 계좌번호 (- 제외)</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, "account_number") || "-"}</span>
              ) : (
                <input
                  type="text"
                  className={styles.input_full}
                  value={v(content, "account_number")}
                  placeholder=""
                  onChange={(e) => onChange!("account_number", e.target.value)}
                />
              )}
            </td>
          </tr>

          {/* 입금 예금자명 / 요청금액 */}
          <tr>
            <td className={styles.label_cell}>입금 예금자명</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, "account_holder") || "-"}</span>
              ) : (
                <input
                  type="text"
                  className={styles.input_full}
                  value={v(content, "account_holder")}
                  placeholder=""
                  onChange={(e) => onChange!("account_holder", e.target.value)}
                />
              )}
            </td>
            <td className={styles.label_cell}>요청금액</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>
                  {numDisplay(v(content, "amount"))}
                  {v(content, "amount") ? " 원" : ""}
                </span>
              ) : (
                <div className={styles.amount_row}>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`${styles.input_full} ${styles.amount_input}`}
                    value={numDisplay(v(content, "amount"))}
                    placeholder=""
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, "");
                      onChange!("amount", raw);
                    }}
                  />
                  <span className={styles.amount_unit}>원</span>
                </div>
              )}
            </td>
          </tr>

          {/* 비용처리 */}
          <tr>
            <td className={styles.label_cell}>비용처리</td>
            <td colSpan={3} className={styles.value_cell}>
              {ro ? (
                <span>
                  {COST_TYPE_OPTIONS.find((o) => o.value === costType)?.label ??
                    costType}
                </span>
              ) : (
                <div className={styles.radio_group}>
                  {COST_TYPE_OPTIONS.map((opt) => (
                    <label key={opt.value} className={styles.radio_label}>
                      <input
                        type="radio"
                        name="cost_type_transfer"
                        value={opt.value}
                        checked={costType === opt.value}
                        onChange={() => onChange!("cost_type", opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}
            </td>
          </tr>

          {/* 특이사항 */}
          <tr>
            <td className={styles.label_cell}>특이사항</td>
            <td className={styles.value_cell} colSpan={3}>
              {ro ? (
                <span className={styles.pre_wrap}>
                  {v(content, "special_note") || ""}
                </span>
              ) : (
                <textarea
                  className={styles.textarea_full}
                  value={v(content, "special_note")}
                  placeholder=""
                  onChange={(e) => onChange!("special_note", e.target.value)}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <p className={styles.note}>
        ※ 문자/고지서/이메일 청구서 수령 여부 사진 첨부
      </p>
    </>
  );
}
