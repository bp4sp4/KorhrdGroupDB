'use client'

import { useState } from 'react'
import styles from './page.module.css'

interface Image {
  label: string
  url: string
}

export default function ImageViewer({ images }: { images: Image[] }) {
  const [active, setActive] = useState<Image | null>(null)

  return (
    <>
      <div className={styles.imagesSection}>
        {images.map(img => (
          <div key={img.label} className={styles.imageWrap}>
            <p className={styles.imageLabel}>{img.label}</p>
            <div className={styles.imageThumbWrap}>
              <img src={img.url} alt={img.label} className={styles.imageThumb} />
            </div>
            <div className={styles.imageBtns}>
              <button
                type="button"
                className={styles.imgBtn}
                onClick={() => setActive(img)}
              >
                원본 보기
              </button>
              <a
                href={img.url}
                download
                className={styles.imgBtn}
              >
                다운로드
              </a>
            </div>
          </div>
        ))}
      </div>

      {active && (
        <div className={styles.modalOverlay} onClick={() => setActive(null)}>
          <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{active.label}</span>
              <div className={styles.modalActions}>
                <a href={active.url} download className={styles.btnDownload}>다운로드</a>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setActive(null)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className={styles.modalBody}>
              <img src={active.url} alt={active.label} className={styles.modalImg} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
