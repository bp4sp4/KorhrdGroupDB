import * as XLSX from 'xlsx'

function saveAs(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename)
}

function toSheet(headers: string[], rows: (string | number | null | undefined)[][]): XLSX.WorkSheet {
  const data = [headers, ...rows.map(r => r.map(v => v ?? ''))]
  return XLSX.utils.aoa_to_sheet(data)
}

export function downloadExcel(filename: string, sheets: { name: string; headers: string[]; rows: (string | number | null | undefined)[][] }[]) {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = toSheet(s.headers, s.rows)
    XLSX.utils.book_append_sheet(wb, ws, s.name)
  }
  saveAs(wb, filename)
}
