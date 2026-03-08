import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { heicTo } from 'heic-to'

interface Props {
  onSubmit: (imageDataUrl: string, prompt: string) => void
}

export function UploadScreen({ onSubmit }: Props) {
  const [image, setImage] = useState<string | null>(null)
  const [prompt, setPrompt] = useState(
    'A day in the life — follow the characters on an unexpected adventure'
  )
  const [isDragging, setIsDragging] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    const isHeic = file.name.toLowerCase().endsWith('.heic') ||
      file.type === 'image/heic' || file.type === 'image/heif'

    if (isHeic) {
      setIsConverting(true)
      try {
        const jpegBlob = await heicTo({
          blob: file,
          type: 'image/jpeg',
          quality: 0.9,
        })
        const reader = new FileReader()
        reader.onload = (e) => {
          setIsConverting(false)
          if (e.target?.result) setImage(e.target.result as string)
        }
        reader.readAsDataURL(jpegBlob)
        return
      } catch (e) {
        console.error('HEIC conversion failed:', e)
        setIsConverting(false)
      }
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) setImage(e.target.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])
  const handleClick = useCallback(() => inputRef.current?.click(), [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) processFile(file)
          return
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [processFile])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.4 }}
      style={styles.container}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* CRT scanline overlay */}
      <div style={styles.scanlines} />

      {/* Pixel border frame */}
      <div style={styles.pixelFrame}>
        <div style={styles.pixelCornerTL} />
        <div style={styles.pixelCornerTR} />
        <div style={styles.pixelCornerBL} />
        <div style={styles.pixelCornerBR} />
      </div>

      {/* HUD top bar */}
      <div style={styles.hudBar}>
        <span style={styles.hudLabel}>SYS:STORYBOX</span>
        <span style={styles.hudDivider}>|</span>
        <span style={styles.hudLabel}>MODE:UPLOAD</span>
        <span style={{ flex: 1 }} />
        <span style={styles.hudLabel}>v1.0</span>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6, ease: 'easeOut' }}
        style={styles.title}
      >
        STORYBOX
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={styles.subtitle}
      >
        {'> ONE PHOTO. THREE AI MODELS. YOUR STORY IN 60 SEC.'}
      </motion.p>

      {!image ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{
            ...styles.dropzone,
            borderColor: isDragging ? '#00ff41' : '#00ff4133',
            background: isDragging
              ? 'rgba(0, 255, 65, 0.06)'
              : 'rgba(0, 255, 65, 0.02)',
            boxShadow: isDragging
              ? '0 0 30px rgba(0, 255, 65, 0.15), inset 0 0 30px rgba(0, 255, 65, 0.05)'
              : '0 0 20px rgba(0, 255, 65, 0.05)',
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic"
            onChange={handleChange}
            style={{ display: 'none' }}
          />

          {isConverting ? (
            <>
              <div style={styles.spinner} />
              <p style={styles.dropText}>CONVERTING HEIC...</p>
            </>
          ) : (
            <>
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={styles.uploadIcon}
              >
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </motion.div>
              <p style={styles.dropText}>DROP YOUR PHOTO HERE</p>
              <p style={styles.dropHint}>
                CLICK / DRAG & DROP / CTRL+V
              </p>
              <div style={styles.dropzoneCorners}>
                <span style={{ ...styles.cornerMark, top: 8, left: 8 }}>+</span>
                <span style={{ ...styles.cornerMark, top: 8, right: 8 }}>+</span>
                <span style={{ ...styles.cornerMark, bottom: 8, left: 8 }}>+</span>
                <span style={{ ...styles.cornerMark, bottom: 8, right: 8 }}>+</span>
              </div>
            </>
          )}
        </motion.div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={styles.previewArea}
          >
            <div style={styles.previewWrapper}>
              <img src={image} alt="Uploaded" style={styles.previewImage} />
              {/* Scanline on preview */}
              <div style={styles.previewScanline} />
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={styles.readyBadge}
            >
              {'> LOADED'}
              <span style={styles.blinkCursor}>_</span>
            </motion.div>
            <button
              onClick={() => setImage(null)}
              style={styles.changeBtn}
            >
              [CHANGE PHOTO]
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            style={styles.promptSection}
          >
            <label style={styles.promptLabel}>{'// STORY PROMPT'}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              style={styles.promptInput}
              rows={2}
              placeholder="DESCRIBE THE STORY YOU WANT..."
            />
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSubmit(image, prompt)}
            style={styles.generateBtn}
          >
            {'>>> START GENERATION <<<'}
          </motion.button>
        </>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        style={styles.footer}
      >
        {[
          { name: 'GEMINI 3.1', color: '#00d4ff' },
          { name: 'NANOBANANA 2', color: '#ff9900' },
          { name: 'LYRIA', color: '#ff55aa' },
        ].map((model, i) => (
          <motion.span
            key={model.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + i * 0.1 }}
            style={{
              ...styles.badge,
              borderColor: `${model.color}44`,
              color: model.color,
            }}
          >
            <span style={{
              ...styles.badgeDot,
              background: model.color,
              boxShadow: `0 0 6px ${model.color}88`,
            }} />
            {model.name}
          </motion.span>
        ))}
      </motion.div>
    </motion.div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
    position: 'relative',
    overflow: 'hidden',
    background: '#0a0a14',
    animation: 'crt-flicker 4s infinite',
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
    pointerEvents: 'none' as const,
    zIndex: 10,
  },
  pixelFrame: {
    position: 'absolute',
    inset: 12,
    border: '2px solid rgba(0, 255, 65, 0.12)',
    pointerEvents: 'none' as const,
    zIndex: 2,
  },
  pixelCornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 12,
    height: 12,
    borderTop: '2px solid #00ff41',
    borderLeft: '2px solid #00ff41',
  },
  pixelCornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderTop: '2px solid #00ff41',
    borderRight: '2px solid #00ff41',
  },
  pixelCornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 12,
    height: 12,
    borderBottom: '2px solid #00ff41',
    borderLeft: '2px solid #00ff41',
  },
  pixelCornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderBottom: '2px solid #00ff41',
    borderRight: '2px solid #00ff41',
  },
  hudBar: {
    position: 'absolute',
    top: 20,
    left: 24,
    right: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    zIndex: 3,
  },
  hudLabel: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 8,
    color: '#00ff4166',
    letterSpacing: '0.05em',
  },
  hudDivider: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 8,
    color: '#00ff4133',
  },
  title: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 36,
    fontWeight: 400,
    color: '#00ff41',
    textShadow: '0 0 20px rgba(0, 255, 65, 0.5), 0 0 40px rgba(0, 255, 65, 0.2)',
    zIndex: 3,
    letterSpacing: '0.05em',
  },
  subtitle: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 8,
    color: '#00ff4188',
    marginBottom: 12,
    letterSpacing: '0.02em',
    zIndex: 3,
  },
  dropzone: {
    width: '100%',
    maxWidth: 520,
    height: 240,
    border: '2px solid #00ff4133',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    zIndex: 3,
    position: 'relative',
  },
  uploadIcon: {
    color: '#00ff41',
    marginBottom: 4,
  },
  dropText: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 11,
    fontWeight: 400,
    color: '#00ff41',
  },
  dropHint: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 7,
    color: '#00ff4155',
  },
  dropzoneCorners: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none' as const,
  },
  cornerMark: {
    position: 'absolute',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 10,
    color: '#00ff4144',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid rgba(0, 255, 65, 0.15)',
    borderTopColor: '#00ff41',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  previewArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    zIndex: 3,
  },
  previewWrapper: {
    width: 100,
    height: 100,
    overflow: 'hidden',
    border: '2px solid #00ff4144',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  previewScanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    background: 'rgba(0, 255, 65, 0.3)',
    animation: 'scan-line 2s linear infinite',
    pointerEvents: 'none' as const,
  },
  readyBadge: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 8,
    color: '#00ff41',
    padding: '4px 10px',
    border: '1px solid #00ff4133',
    background: 'rgba(0, 255, 65, 0.05)',
    letterSpacing: '0.03em',
  },
  blinkCursor: {
    animation: 'retro-blink 1s step-end infinite',
  },
  changeBtn: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 7,
    color: '#00ff4166',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    marginTop: 2,
  },
  promptSection: {
    width: '100%',
    maxWidth: 500,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 4,
    zIndex: 3,
  },
  promptLabel: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 7,
    color: '#00ff4155',
    letterSpacing: '0.05em',
  },
  promptInput: {
    width: '100%',
    padding: '10px 14px',
    border: '2px solid #00ff4122',
    background: 'rgba(0, 255, 65, 0.03)',
    color: '#00ff41',
    fontSize: 12,
    fontFamily: "'Press Start 2P', monospace",
    resize: 'none',
    outline: 'none',
    lineHeight: 1.8,
  },
  generateBtn: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 11,
    fontWeight: 400,
    color: '#0a0a14',
    padding: '14px 32px',
    background: '#00ff41',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    boxShadow: '0 0 20px rgba(0, 255, 65, 0.3), 0 0 40px rgba(0, 255, 65, 0.1)',
    marginTop: 8,
    zIndex: 3,
  },
  footer: {
    display: 'flex',
    gap: 10,
    marginTop: 24,
    zIndex: 3,
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: 7,
    fontFamily: "'Press Start 2P', monospace",
    fontWeight: 400,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid',
    letterSpacing: '0.02em',
  },
  badgeDot: {
    width: 4,
    height: 4,
  },
}
