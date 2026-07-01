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

  // 미리보기(.doc)는 max-width:760px 로 렌더되지만, 좁은 화면(모바일)에서는
  // width:100% 가 화면 폭으로 줄어 html2canvas 가 좁게 캡처 → A4 로 늘어나며
  // 글자가 확대돼 보인다. 화면 레이아웃의 영향을 받지 않도록 문서를 760px 고정
  // 폭으로 복제해 화면 밖(off-screen)에 붙여 캡처한다(미리보기와 동일 비율).
  const RENDER_W = 760;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.classList.add(cleanClass);
  clone.style.setProperty("width", `${RENDER_W}px`, "important");
  clone.style.setProperty("max-width", `${RENDER_W}px`, "important");
  clone.style.margin = "0";
  clone.style.position = "fixed";
  clone.style.left = "-10000px";
  clone.style.top = "0";
  clone.style.background = "#ffffff";
  document.body.appendChild(clone);

  const SCALE = 2;
  // 페이지에서 쪼개지면 안 되는 블록(조항·서명 갑/을)의 세로 범위를 캔버스 px로 수집
  const cloneTop = clone.getBoundingClientRect().top;
  const keepRanges = Array.from(clone.querySelectorAll("[data-keep]")).map(
    (node) => {
      const r = (node as HTMLElement).getBoundingClientRect();
      return {
        top: (r.top - cloneTop) * SCALE,
        bottom: (r.bottom - cloneTop) * SCALE,
      };
    },
  );

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(clone, {
      scale: SCALE,
      backgroundColor: "#ffffff",
      useCORS: true,
      width: RENDER_W,
      windowWidth: RENDER_W,
    });
  } finally {
    document.body.removeChild(clone);
  }

  const pdf = new JsPDF("p", "mm", "a4");
  const pw = 210;
  const ph = 297;
  const margin = 16; // 상하좌우 여백(mm) — 글자 크기 축소 + 문서 여백
  const contentW = pw - margin * 2;
  const contentH = ph - margin * 2;
  const pxPerMm = canvas.width / contentW; // 캔버스 폭을 본문 폭(여백 제외)에 매핑
  const pageHpx = Math.floor(contentH * pxPerMm); // 한 페이지 본문 영역에 해당하는 원본 px

  // 페이지 경계 근처에서 글자 줄을 자르지 않도록, 목표 높이 위쪽의 '빈(흰) 줄'을
  // 찾아 그 지점에서 자른다. (tainted canvas 등 실패 시 고정 높이로 폴백)
  const srcCtx = canvas.getContext("2d");
  const findWhiteCut = (start: number, ideal: number): number => {
    if (!srcCtx) return ideal;
    const win = Math.min(160, ideal - 40); // 위로 최대 160px 탐색
    if (win <= 0) return ideal;
    let band: Uint8ClampedArray;
    try {
      band = srcCtx.getImageData(0, start + ideal - win, canvas.width, win).data;
    } catch {
      return ideal; // cross-origin 등으로 읽기 불가 → 고정 높이
    }
    const w = canvas.width;
    for (let y = win - 1; y >= 0; y--) {
      const base = y * w * 4;
      let white = true;
      for (let x = 0; x < w; x++) {
        const i = base + x * 4;
        if (band[i] < 245 || band[i + 1] < 245 || band[i + 2] < 245) {
          white = false;
          break;
        }
      }
      if (white) return ideal - win + y + 1;
    }
    return ideal; // 빈 줄 못 찾으면 고정 높이
  };

  let rendered = 0;
  let pageIdx = 0;
  while (rendered < canvas.height) {
    let sliceH = Math.min(pageHpx, canvas.height - rendered);
    // 마지막 페이지가 아니면: ① keep 블록이 경계에 걸치면 그 블록 시작 전에서 자름
    //                         ② 아니면 빈 줄(여백)에서 자름
    if (rendered + sliceH < canvas.height) {
      const idealCut = rendered + sliceH;
      let keepCut = Infinity;
      for (const k of keepRanges) {
        if (
          k.top > rendered + 8 &&
          k.top < idealCut &&
          k.bottom > idealCut &&
          k.bottom - k.top <= pageHpx
        ) {
          keepCut = Math.min(keepCut, k.top);
        }
      }
      sliceH =
        keepCut !== Infinity
          ? Math.round(keepCut - rendered)
          : findWhiteCut(rendered, sliceH);
    }
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
    // JPEG(품질 0.85)로 인코딩 — 텍스트 위주 흰 배경 문서는 PNG 대비 용량이
    // 수십 배 작아져 업로드 본문 크기 제한(10MB) 초과로 저장 실패하던 문제 해결
    pdf.addImage(
      tmp.toDataURL("image/jpeg", 0.85),
      "JPEG",
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
