// 계약서 미리보기 DOM → A4 여러 장 PDF (정상 페이지 분할 + PNG 또렷하게)
export async function buildContractPdf(
  el: HTMLElement,
  cleanClass: string,
): Promise<import("jspdf").jsPDF> {
  const [{ default: html2canvas }, jspdfMod] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const JsPDF = jspdfMod.jsPDF;

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    windowWidth: 900,
    onclone: (doc) => {
      const n = doc.getElementById("contract-doc") as HTMLElement | null;
      if (n) {
        n.classList.add(cleanClass);
        n.style.width = "760px";
        n.style.maxWidth = "760px";
      }
    },
  });

  const pdf = new JsPDF("p", "mm", "a4");
  const pw = 210;
  const ph = 297;
  const margin = 16; // 상하좌우 여백(mm) — 글자 크기 축소 + 문서 여백
  const contentW = pw - margin * 2;
  const contentH = ph - margin * 2;
  const pxPerMm = canvas.width / contentW; // 캔버스 폭을 본문 폭(여백 제외)에 매핑
  const pageHpx = Math.floor(contentH * pxPerMm); // 한 페이지 본문 영역에 해당하는 원본 px

  let rendered = 0;
  let pageIdx = 0;
  while (rendered < canvas.height) {
    const sliceH = Math.min(pageHpx, canvas.height - rendered);
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = sliceH;
    const ctx = tmp.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, tmp.width, sliceH);
      ctx.drawImage(
        canvas,
        0,
        rendered,
        canvas.width,
        sliceH,
        0,
        0,
        canvas.width,
        sliceH,
      );
    }
    if (pageIdx > 0) pdf.addPage();
    pdf.addImage(
      tmp.toDataURL("image/png"),
      "PNG",
      margin,
      margin,
      contentW,
      sliceH / pxPerMm,
    );
    rendered += sliceH;
    pageIdx += 1;
  }
  return pdf;
}
