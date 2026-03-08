import { motion } from 'framer-motion'
import type { StoryResult } from '../types'

interface Props {
  story: StoryResult
  originalImage?: string
  onNewPhoto: () => void
  onReplay: () => void
}

export function GalleryScreen({ story, onNewPhoto, onReplay }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={styles.container}
    >
      <div style={styles.header}>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={styles.title}
        >
          {story.title}
        </motion.h1>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={styles.meta}
        >
          <span style={styles.genreBadge}>{story.genre}</span>
          <span style={styles.modelInfo}>Gemini 3.1 + NanoBanana 2 + Lyria</span>
        </motion.div>
      </div>

      {/* Full-width comic grid */}
      <div style={styles.grid}>
        {story.panels.map((panel, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
            style={styles.panelCard}
          >
            <img src={panel.imageUrl} alt={`Panel ${i + 1}`} style={styles.panelImage} />
            <div style={styles.panelNumberBadge}>
              <span style={styles.panelNum}>{i + 1}</span>
            </div>
            {panel.narration && (
              <div style={styles.panelNarration}>{panel.narration}</div>
            )}
            {panel.dialogues?.length > 0 && (
              <div style={styles.panelDialogue}>
                {panel.dialogues.map((d, di) => (
                  <span key={di}>"{d.text}" </span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        style={styles.actions}
      >
        <button onClick={onReplay} style={styles.btnSecondary}>
          Replay
        </button>
        <button onClick={onNewPhoto} style={styles.btnPrimary}>
          New Storyboard
        </button>
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
    gap: 12,
    padding: '16px 24px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  title: {
    fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
    fontSize: 26,
    fontWeight: 700,
    margin: 0,
    color: '#ede8d8',
    letterSpacing: '0.03em',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  genreBadge: {
    fontFamily: "'Cinzel', serif",
    padding: '4px 12px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    background: 'rgba(201, 162, 39, 0.12)',
    color: '#c9a227',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  modelInfo: {
    fontSize: 12,
    color: '#6b6455',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    flex: 1,
    width: '100%',
    maxWidth: '95vw',
    minHeight: 0,
    alignContent: 'center',
  },
  panelCard: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    border: '1px solid rgba(201, 162, 39, 0.1)',
    background: '#0e0c08',
    aspectRatio: '16 / 9',
  },
  panelImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  panelNumberBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 8,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelNum: {
    fontSize: 12,
    fontWeight: 700,
    color: '#c9a227',
  },
  panelNarration: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '20px 10px 8px',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
    fontFamily: "'Cinzel', serif",
    fontSize: 14,
    color: 'rgba(237, 232, 216, 0.85)',
    fontStyle: 'italic',
    lineHeight: 1.4,
    letterSpacing: '0.02em',
  },
  panelDialogue: {
    position: 'absolute',
    top: 10,
    right: 12,
    left: 40,
    padding: '0',
    background: 'none',
    fontFamily: "'Cinzel', serif",
    fontSize: 15,
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 1.4,
    textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)',
  },
  actions: {
    display: 'flex',
    gap: 12,
  },
  btnPrimary: {
    padding: '12px 28px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #c9a227, #a67c10)',
    color: '#0a0908',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'Cinzel', serif",
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 16px rgba(201, 162, 39, 0.2)',
    letterSpacing: '0.04em',
  },
  btnSecondary: {
    padding: '12px 28px',
    borderRadius: 12,
    border: '1px solid rgba(201, 162, 39, 0.12)',
    background: 'rgba(18, 14, 10, 0.6)',
    color: '#ede8d8',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: "'Cinzel', serif",
    transition: 'all 0.2s ease',
    letterSpacing: '0.04em',
  },
}
