'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import styles from './storefront.module.css'

type Props = {
  name: string
  images: string[]
  activeIdx: number
  onChange: (index: number) => void
  onZoom: () => void
}

export function ProductGallery({ name, images, activeIdx, onChange, onZoom }: Props) {
  const current = images[activeIdx]
  const count = images.length

  useEffect(() => {
    if (count <= 1) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') onChange((activeIdx - 1 + count) % count)
      if (event.key === 'ArrowRight') onChange((activeIdx + 1) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIdx, count, onChange])

  return (
    <div className={styles.gallery}>
      <div className={styles.galleryMain}>
        {current ? (
          <>
            <Image
              src={current}
              alt={name}
              fill
              sizes="(max-width: 899px) 100vw, 55vw"
              priority={activeIdx === 0}
              loading={activeIdx === 0 ? 'eager' : undefined}
            />
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={onZoom}
              aria-label={`Ampliar imagen de ${name}`}
            />
          </>
        ) : (
          <span className={styles.photoFallback} role="img" aria-label={`${name}, sin imagen`}>
            Sin imagen
          </span>
        )}
        {count > 1 && current ? (
          <>
            <button
              type="button"
              className={`${styles.galleryNav} ${styles.galleryNavLeft}`}
              onClick={() => onChange((activeIdx - 1 + count) % count)}
              aria-label="Imagen anterior"
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.galleryNav} ${styles.galleryNavRight}`}
              onClick={() => onChange((activeIdx + 1) % count)}
              aria-label="Imagen siguiente"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div className={styles.thumbs}>
          {images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              className={`${styles.thumb} ${index === activeIdx ? styles.thumbActive : ''}`}
              onClick={() => onChange(index)}
              aria-label={`Ver imagen ${index + 1} de ${count}`}
              aria-current={index === activeIdx ? 'true' : undefined}
            >
              <Image src={src} alt="" fill sizes="72px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
