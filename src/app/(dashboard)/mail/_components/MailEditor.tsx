"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link2,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table,
  Image as ImageIcon,
} from "lucide-react";
import styles from "./MailEditor.module.css";

// 글자색 프리셋
const COLOR_PRESETS = [
  "#191f28",
  "#e2483a",
  "#e8772e",
  "#f5a623",
  "#1aab5e",
  "#2f6df0",
  "#7c3aed",
  "#8b95a1",
];

// 가벼운 contentEditable 위지윅 에디터 (외부 라이브러리 없음)
export default function MailEditor({
  onChange,
  initialHtml = "",
}: {
  onChange: (html: string) => void;
  initialHtml?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [hover, setHover] = useState({ r: 0, c: 0 });
  const [imgSelected, setImgSelected] = useState(false);
  const [imgWidth, setImgWidthState] = useState(320);
  const selectedImgRef = useRef<HTMLImageElement | null>(null);
  const MAX_R = 8;
  const MAX_C = 10;

  // 초기 내용 주입 (답장/전달 인용, 임시저장 복원, 서명) — 최초 1회
  useEffect(() => {
    if (ref.current && initialHtml) {
      ref.current.innerHTML = initialHtml;
      onChange(initialHtml);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 색상 등을 style 속성으로 적용 (font 태그 대신)
  useEffect(() => {
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      /* ignore */
    }
  }, []);

  // 표 크기 선택 팝업 외부 클릭 시 닫기
  useEffect(() => {
    if (!tableOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        tableWrapRef.current &&
        !tableWrapRef.current.contains(e.target as Node)
      ) {
        setTableOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [tableOpen]);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  // onMouseDown preventDefault 로 본문 선택을 유지한 채 명령 실행
  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    emit();
  };

  const addLink = () => {
    const url = window.prompt("링크 URL을 입력하세요", "https://");
    if (url) exec("createLink", url);
  };

  const insertTable = (rows: number, cols: number) => {
    let html =
      '<table style="border-collapse:collapse;border:1px solid #c8ccd0;margin:8px 0;">';
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html +=
          '<td style="border:1px solid #c8ccd0;padding:6px 10px;min-width:110px;">&nbsp;</td>';
      }
      html += "</tr>";
    }
    html += "</table><p><br/></p>";
    exec("insertHTML", html);
  };

  // 이미지 삽입 (파일 → data URL, 기본 폭 320px)
  const onPickImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      ref.current?.focus();
      const src = String(reader.result ?? "");
      document.execCommand(
        "insertHTML",
        false,
        `<img src="${src}" style="max-width:100%;width:320px;" />`,
      );
      emit();
    };
    reader.readAsDataURL(file);
  };

  // 본문 클릭 — 이미지면 선택해 크기 조절 바 노출
  const onEditorClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "IMG") {
      const img = t as HTMLImageElement;
      selectedImgRef.current = img;
      setImgWidthState(Math.round(img.getBoundingClientRect().width));
      setImgSelected(true);
    } else {
      selectedImgRef.current = null;
      setImgSelected(false);
    }
  };

  // px 로 너비 설정 (null 이면 원본)
  const applyImgWidth = (px: number | null) => {
    const img = selectedImgRef.current;
    if (!img) return;
    if (px == null) {
      img.style.removeProperty("width");
      setImgWidthState(Math.round(img.getBoundingClientRect().width));
    } else {
      img.style.width = `${px}px`;
      setImgWidthState(px);
    }
    emit();
  };

  // 현재 커서가 위치한 표 셀 찾기
  const getCurrentCell = (): HTMLTableCellElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== ref.current) {
      if (
        node instanceof HTMLTableCellElement &&
        ref.current?.contains(node)
      ) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  };

  const CELL_STYLE = "border:1px solid #c8ccd0;padding:6px 10px;min-width:110px;";

  const addTableRow = () => {
    const cell = getCurrentCell();
    const row = cell?.closest("tr");
    if (!row) {
      window.alert("표 안에 커서를 두고 눌러주세요.");
      return;
    }
    const colCount = row.children.length;
    const newRow = document.createElement("tr");
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement("td");
      td.setAttribute("style", CELL_STYLE);
      td.innerHTML = "&nbsp;";
      newRow.appendChild(td);
    }
    row.after(newRow);
    emit();
  };

  const addTableCol = () => {
    const cell = getCurrentCell();
    const table = cell?.closest("table");
    if (!cell || !table) {
      window.alert("표 안에 커서를 두고 눌러주세요.");
      return;
    }
    const idx = Array.from(cell.parentElement!.children).indexOf(cell);
    table.querySelectorAll("tr").forEach((tr) => {
      const td = document.createElement("td");
      td.setAttribute("style", CELL_STYLE);
      td.innerHTML = "&nbsp;";
      const refCell = tr.children[idx];
      if (refCell) refCell.after(td);
      else tr.appendChild(td);
    });
    emit();
  };

  const Btn = ({
    cmd,
    title,
    children,
  }: {
    cmd: string;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      className={styles.toolBtn}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => exec(cmd)}
    >
      {children}
    </button>
  );

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Btn cmd="bold" title="굵게">
          <Bold size={15} />
        </Btn>
        <Btn cmd="italic" title="기울임">
          <Italic size={15} />
        </Btn>
        <Btn cmd="underline" title="밑줄">
          <Underline size={15} />
        </Btn>
        <Btn cmd="strikeThrough" title="취소선">
          <Strikethrough size={15} />
        </Btn>

        <span className={styles.divider} />

        <span className={styles.colorLabel}>글자색</span>
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            className={styles.swatch}
            style={{ background: c }}
            title={`색상 ${c}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("foreColor", c)}
          />
        ))}
        <label
          className={styles.swatchCustom}
          title="직접 선택"
          onMouseDown={(e) => e.preventDefault()}
        >
          +
          <input
            type="color"
            onChange={(e) => exec("foreColor", e.target.value)}
          />
        </label>

        <span className={styles.divider} />

        <button
          type="button"
          className={styles.toolBtn}
          title="링크"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addLink}
        >
          <Link2 size={15} />
        </button>
        <Btn cmd="insertUnorderedList" title="글머리 기호">
          <List size={15} />
        </Btn>
        <Btn cmd="insertOrderedList" title="번호 매기기">
          <ListOrdered size={15} />
        </Btn>

        <span className={styles.divider} />

        <Btn cmd="justifyLeft" title="왼쪽 정렬">
          <AlignLeft size={15} />
        </Btn>
        <Btn cmd="justifyCenter" title="가운데 정렬">
          <AlignCenter size={15} />
        </Btn>
        <Btn cmd="justifyRight" title="오른쪽 정렬">
          <AlignRight size={15} />
        </Btn>

        <span className={styles.divider} />

        <div className={styles.tableWrap} ref={tableWrapRef}>
          <button
            type="button"
            className={styles.toolBtn}
            title="표 삽입"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTableOpen((v) => !v)}
          >
            <Table size={15} />
          </button>
          {tableOpen && (
            <div
              className={styles.tablePop}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div
                className={styles.tableGrid}
                onMouseLeave={() => setHover({ r: 0, c: 0 })}
              >
                {Array.from({ length: MAX_R }).map((_, r) => (
                  <div key={r} className={styles.tableGridRow}>
                    {Array.from({ length: MAX_C }).map((_, c) => (
                      <div
                        key={c}
                        className={`${styles.tableGridCell} ${
                          r <= hover.r && c <= hover.c
                            ? styles.tableGridCellOn
                            : ""
                        }`}
                        onMouseEnter={() => setHover({ r, c })}
                        onClick={() => {
                          insertTable(hover.r + 1, hover.c + 1);
                          setTableOpen(false);
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className={styles.tableGridLabel}>
                {hover.r + 1} × {hover.c + 1}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className={styles.toolTextBtn}
          title="표 행 추가"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addTableRow}
        >
          행＋
        </button>
        <button
          type="button"
          className={styles.toolTextBtn}
          title="표 열 추가"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addTableCol}
        >
          열＋
        </button>

        <span className={styles.divider} />

        <button
          type="button"
          className={styles.toolBtn}
          title="이미지 삽입"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => imgInputRef.current?.click()}
        >
          <ImageIcon size={15} />
        </button>
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            onPickImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {imgSelected && (
        <div className={styles.imgBar}>
          <span className={styles.imgBarLabel}>이미지 크기</span>
          <input
            type="range"
            className={styles.imgSlider}
            min={80}
            max={640}
            value={Math.min(640, Math.max(80, imgWidth))}
            onChange={(e) => applyImgWidth(Number(e.target.value))}
          />
          <span className={styles.imgBarPx}>{imgWidth}px</span>
          <button
            type="button"
            className={styles.imgBarBtn}
            onClick={() => applyImgWidth(180)}
          >
            작게
          </button>
          <button
            type="button"
            className={styles.imgBarBtn}
            onClick={() => applyImgWidth(320)}
          >
            보통
          </button>
          <button
            type="button"
            className={styles.imgBarBtn}
            onClick={() => applyImgWidth(520)}
          >
            크게
          </button>
          <button
            type="button"
            className={styles.imgBarBtn}
            onClick={() => applyImgWidth(null)}
          >
            원본
          </button>
        </div>
      )}

      <div
        ref={ref}
        className={styles.editor}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onClick={onEditorClick}
        data-placeholder="내용을 입력하세요"
      />
    </div>
  );
}
