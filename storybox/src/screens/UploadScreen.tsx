import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { RemoteTrack } from 'livekit-client'

interface Props {
  videoTrack: RemoteTrack | null
  connected: boolean
  storyConcept: string
  onStoryConceptChange: (text: string) => void
  onTakePicture: (imageDataUrl: string) => void
  onTestAnimation?: () => void
  onTestPipeline?: () => void
  onTestStoryboard?: () => void
}

export function UploadScreen({ videoTrack, connected, storyConcept, onStoryConceptChange, onTakePicture, onTestAnimation, onTestPipeline, onTestStoryboard }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const el = videoRef.current
    if (!el || !videoTrack) return
    videoTrack.attach(el)
    return () => { videoTrack.detach(el) }
  }, [videoTrack])

  const handleTakePicture = useCallback(() => {
    const el = videoRef.current
    if (!el || !videoTrack) return

    setFlash(true)
    setTimeout(() => setFlash(false), 300)

    const vw = el.videoWidth || 1280
    const vh = el.videoHeight || 720
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    // The video is displayed rotated -90deg, so the captured frame
    // needs the same rotation: swap width/height and rotate
    canvas.width = vh
    canvas.height = vw
    ctx.translate(vh / 2, vw / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.drawImage(el, -vw / 2, -vh / 2, vw, vh)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    onTakePicture(dataUrl)
  }, [onTakePicture, videoTrack])

  // Keyboard shortcut: J to take picture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'j' || e.key === 'J') {
        // Don't trigger if typing in the textarea
        if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return
        handleTakePicture()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleTakePicture])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0 } }}
      transition={{ duration: 0.4 }}
      style={S.container}
    >
      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={S.title}
      >
        Storybox
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={S.subtitle}
      >
        Talk to The Sage or type your story concept. Take a picture when ready.
      </motion.p>

      {/* Main content: video + story concept side by side */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        style={S.mainRow}
      >
        {/* Video frame */}
        <div style={{
          ...S.frame,
          borderColor: videoTrack
            ? 'rgba(201, 162, 39, 0.3)'
            : 'rgba(255,255,255,0.08)',
          boxShadow: videoTrack
            ? '0 0 40px rgba(201,162,39,0.1)'
            : 'none',
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={S.video}
          />

          {/* Camera flash overlay */}
          {flash && <div style={S.flash} />}

          {!videoTrack && (
            <div style={S.placeholder}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <p style={{ fontSize: 13, color: '#555', fontWeight: 500, margin: 0 }}>
                {connected ? 'Waiting for camera...' : 'No LiveKit connection'}
              </p>
            </div>
          )}

          {videoTrack && (
            <div style={S.liveBadge}>
              <span style={S.liveDot} />
              LIVE
            </div>
          )}
        </div>

        {/* Editable story concept panel */}
        <div style={S.summaryPanel}>
          <div style={S.summaryLabel}>Story Concept</div>
          <textarea
            value={storyConcept}
            onChange={e => onStoryConceptChange(e.target.value)}
            placeholder="Describe your visual story here... The Sage will also update this as you talk."
            style={S.textarea}
          />
          <div style={S.summaryHint}>
            The Sage listens and summarizes here. You can also edit directly.
          </div>
        </div>
      </motion.div>

      {/* Buttons row */}
      <div style={{ display: 'flex', gap: 10, zIndex: 1, alignItems: 'center' }}>
        {onTestAnimation && (
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onTestAnimation}
            style={S.testBtn}
          >
            Test Anim
          </motion.button>
        )}
        {onTestPipeline && (
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onTestPipeline}
            style={S.testBtn}
          >
            Test Pipe
          </motion.button>
        )}
        {onTestStoryboard && (
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onTestStoryboard}
            style={{ ...S.testBtn, background: 'rgba(124,58,237,0.2)', borderColor: 'rgba(124,58,237,0.4)' }}
          >
            Test Story
          </motion.button>
        )}
      </div>

    </motion.div>
  )
}

const S: Record<string, React.CSSProperties> = {
  container: {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 16, padding: 32, position: 'relative', overflow: 'hidden',
  },
  title: {
    fontFamily: "'Space Grotesk', sans-serif", fontSize: 48, fontWeight: 700,
    letterSpacing: '-0.03em',
    background: 'linear-gradient(135deg, #f5e6c4 0%, #c9a227 50%, #a67c10 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    filter: 'drop-shadow(0 0 30px rgba(201,162,39,0.15))',
    zIndex: 1, margin: 0,
  },
  subtitle: {
    fontSize: 14, color: '#666', fontWeight: 400, marginBottom: 4, zIndex: 1,
  },
  mainRow: {
    display: 'flex', gap: 20, width: '100%', maxWidth: '95vw',
    alignItems: 'stretch', zIndex: 1,
  },
  frame: {
    flex: '1 1 65%', aspectRatio: '16 / 9',
    borderRadius: 12, border: '1.5px solid',
    background: '#000',
    position: 'relative', overflow: 'hidden',
    transition: 'border-color 0.3s, box-shadow 0.3s',
  },
  video: {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    objectFit: 'contain',
    transform: 'rotate(-90deg) scale(1.778)',
  },
  flash: {
    position: 'absolute', inset: 0,
    background: 'white', zIndex: 10,
    animation: 'flashFade 0.3s ease-out forwards',
    pointerEvents: 'none' as const,
  },
  placeholder: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 8,
  },
  liveBadge: {
    position: 'absolute', top: 10, left: 10,
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 6,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    fontSize: 11, fontWeight: 700, color: '#ef4444',
    letterSpacing: '0.05em',
  },
  liveDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: '#ef4444',
    boxShadow: '0 0 6px #ef4444',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  summaryPanel: {
    flex: '1 1 40%',
    display: 'flex', flexDirection: 'column', gap: 12,
    padding: '20px 24px',
    borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(16, 16, 24, 0.6)',
    backdropFilter: 'blur(8px)',
  },
  summaryLabel: {
    fontSize: 12, fontWeight: 700, color: '#666',
    textTransform: 'uppercase', letterSpacing: '0.1em',
  },
  textarea: {
    flex: 1,
    fontSize: 16, color: '#ccc', fontWeight: 400,
    lineHeight: 1.6,
    fontFamily: "'Space Grotesk', sans-serif",
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '14px 16px',
    resize: 'none' as const,
    outline: 'none',
    minHeight: 100,
  },
  summaryHint: {
    fontSize: 12, color: '#555', lineHeight: 1.4,
    borderTop: '1px solid rgba(255,255,255,0.04)',
    paddingTop: 12,
  },
  testBtn: {
    fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 500,
    color: '#666', padding: '10px 20px', borderRadius: 8,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)', outline: 'none', cursor: 'pointer',
  },
}
