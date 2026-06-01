"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PdfSignCanvas.module.css";

interface PdfSignCanvasProps {
  pdfUrl: string;
  stampUrl: string;
  /** 각 페이지의 캔버스 dataURL 을 부모로 전달 (제출 시 사용) */
  onChange: (
    pages: { pageNumber: number; drawingDataUrl: string }[],
  ) => void;
  /** 하단 액션 바의 제출 버튼 콜백 + 라벨/disabled */
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
}

// PDF 한 페이지 + 그 위 손글씨 캔버스 오버레이 + 직인 합성
// pdf.js 를 동적 import 해서 클라이언트에서만 로드 (SSR 회피)
export default function PdfSignCanvas({
  pdfUrl,
  stampUrl,
  onChange,
  onSubmit,
  submitLabel = "제출하기",
  submitDisabled,
}: PdfSignCanvasProps) {
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pageRefs, setPageRefs] = useState<HTMLDivElement[]>([]);
  // 각 페이지의 손글씨 캔버스 DOM 참조 (dataURL 추출용)
  const drawingCanvasesRef = useRef<HTMLCanvasElement[]>([]);
  const stampImgRef = useRef<HTMLImageElement | null>(null);

  // 펜 굵기 / 지우개 모드
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [strokeColor, setStrokeColor] = useState<string>("#000000");

  // PDF.js 로드 + 렌더링
  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const pdfjs = await import("pdfjs-dist");
        // worker 는 public 폴더에 복사된 .mjs 파일 사용
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({ url: pdfUrl });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);
        const newRefs: HTMLDivElement[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          // 화면 너비에 맞게 scale (최대 가로 1000px)
          const baseViewport = page.getViewport({ scale: 1 });
          const targetWidth = Math.min(1000, window.innerWidth - 80);
          const scale = targetWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const container = document.createElement("div");
          container.style.position = "relative";
          container.style.width = `${viewport.width}px`;
          container.style.height = `${viewport.height}px`;
          container.style.margin = "12px auto";
          container.style.background = "#fff";
          container.style.boxShadow = "0 4px 16px rgba(15,23,42,0.08)";

          // PDF 렌더 캔버스 (배경, 손대지 않음)
          const pdfCanvas = document.createElement("canvas");
          pdfCanvas.width = viewport.width;
          pdfCanvas.height = viewport.height;
          pdfCanvas.style.position = "absolute";
          pdfCanvas.style.left = "0";
          pdfCanvas.style.top = "0";
          pdfCanvas.style.pointerEvents = "none";
          container.appendChild(pdfCanvas);
          const pdfCtx = pdfCanvas.getContext("2d");
          if (!pdfCtx) continue;
          await page.render({ canvas: pdfCanvas, canvasContext: pdfCtx, viewport }).promise;

          // 손글씨 캔버스 (투명, pointer events)
          const drawCanvas = document.createElement("canvas");
          drawCanvas.width = viewport.width;
          drawCanvas.height = viewport.height;
          drawCanvas.style.position = "absolute";
          drawCanvas.style.left = "0";
          drawCanvas.style.top = "0";
          drawCanvas.style.touchAction = "none";
          drawCanvas.style.cursor = "crosshair";
          drawCanvas.dataset.pageNumber = String(i);
          container.appendChild(drawCanvas);
          drawingCanvasesRef.current[i - 1] = drawCanvas;

          newRefs.push(container);
        }
        if (cancelled) return;
        setPageRefs(newRefs);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setErr(`PDF 로드 실패: ${(e as Error).message}`);
        setLoading(false);
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // 직인 이미지 미리 로드 (placeStamp 에서 사용)
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      stampImgRef.current = img;
    };
    img.src = stampUrl;
  }, [stampUrl]);

  // 손글씨 그리기 이벤트 핸들러 등록 — 페이지 렌더 후
  useEffect(() => {
    if (pageRefs.length === 0) return;
    const cleanups: (() => void)[] = [];
    drawingCanvasesRef.current.forEach((canvas) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      let drawing = false;
      let last: { x: number; y: number } | null = null;

      const getPos = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: (e.clientX - rect.left) * (canvas.width / rect.width),
          y: (e.clientY - rect.top) * (canvas.height / rect.height),
        };
      };

      const onDown = (e: PointerEvent) => {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        drawing = true;
        last = getPos(e);
      };
      const onMove = (e: PointerEvent) => {
        if (!drawing || !last) return;
        const pos = getPos(e);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (tool === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.lineWidth = 24;
          ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = strokeColor;
        }
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        last = pos;
        emit();
      };
      const onUp = (e: PointerEvent) => {
        if (canvas.hasPointerCapture(e.pointerId))
          canvas.releasePointerCapture(e.pointerId);
        drawing = false;
        last = null;
      };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      cleanups.push(() => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
      });
    });
    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageRefs, tool, strokeColor]);

  // 부모에게 dataURL 전달
  const emit = () => {
    const pages = drawingCanvasesRef.current
      .filter(Boolean)
      .map((canvas) => ({
        pageNumber: Number(canvas.dataset.pageNumber ?? "0"),
        drawingDataUrl: canvas.toDataURL("image/png"),
      }))
      .filter((p) => p.pageNumber > 0);
    onChange(pages);
  };

  // 페이지 컨테이너를 wrapper 에 mount
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!wrapperRef.current) return;
    pageRefs.forEach((c) => wrapperRef.current?.appendChild(c));
    return () => {
      pageRefs.forEach((c) => c.parentElement?.removeChild(c));
    };
  }, [pageRefs]);

  // 갑(회사) 직인 자동 합성 — 마지막 페이지의 우측 상단 영역에 직인 찍기 (간단 처리)
  // 양식마다 직인 위치가 다르므로, 추후 양식별 좌표 보정 가능. 현재는 직인을 마지막 페이지에 표시.
  const placeStamp = () => {
    const img = stampImgRef.current;
    if (!img || pageCount === 0) return;
    const lastCanvas = drawingCanvasesRef.current[pageCount - 1];
    if (!lastCanvas) return;
    const ctx = lastCanvas.getContext("2d");
    if (!ctx) return;
    // 직인 크기: 캔버스 너비의 10%
    const size = lastCanvas.width * 0.1;
    // 위치: 우측 하단 ((갑) 대표자 (인) 영역 근처 추정)
    const x = lastCanvas.width * 0.32;
    const y = lastCanvas.height * 0.62;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img, x, y, size, size);
    emit();
  };

  // 전체 지우기
  const clearAll = () => {
    drawingCanvasesRef.current.forEach((canvas) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
    emit();
  };

  return (
    <div>
      {loading && (
        <div className={styles.statusBox}>양식 로드 중…</div>
      )}
      {err && <div className={styles.errorBox}>{err}</div>}

      {/* PDF 페이지들 — 하단 고정 액션바에 가리지 않도록 padding-bottom */}
      <div ref={wrapperRef} className={styles.pagesArea} />

      {/* 하단 고정 액션바 — 도구 + 제출 */}
      <div className={styles.actionBar}>
        <div className={styles.toolGroup}>
          <button
            type="button"
            onClick={() => setTool("pen")}
            className={`${styles.toolBtn} ${tool === "pen" ? styles.toolBtnActive : ""}`}
          >
            ✏️ 펜
          </button>
          <button
            type="button"
            onClick={() => setTool("eraser")}
            className={`${styles.toolBtn} ${tool === "eraser" ? styles.toolBtnActive : ""}`}
          >
            🧽 지우개
          </button>
          <span className={styles.divider} />
          {["#000000", "#1f3a8a", "#d11"].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setStrokeColor(c);
                setTool("pen");
              }}
              className={`${styles.colorBtn} ${strokeColor === c ? styles.colorBtnActive : ""}`}
              style={{ background: c }}
              aria-label={`색상 ${c}`}
            />
          ))}
          <span className={styles.divider} />
          <button
            type="button"
            onClick={placeStamp}
            className={styles.toolBtn}
          >
            🟥 갑 직인
          </button>
          <button
            type="button"
            onClick={clearAll}
            className={styles.toolBtn}
          >
            전체 지우기
          </button>
        </div>
        {onSubmit && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className={styles.submitBtn}
          >
            {submitLabel}
          </button>
        )}
      </div>
    </div>
  );
}
