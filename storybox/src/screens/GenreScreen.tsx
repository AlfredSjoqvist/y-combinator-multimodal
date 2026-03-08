import { useState } from 'react'
import { motion } from 'framer-motion'
import { GENRES, type Genre } from '../types'

interface Props {
  imageUrl: string
  onGenerate: (genre: Genre, prompt: string) => void
}

export function GenreScreen({ imageUrl, onGenerate }: Props) {
  const [selected, setSelected] = useState<Genre | null>(null)
  const [prompt, setPrompt] = useState(
    'A day in the life — follow the characters on an unexpected adventure'
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.4 }}
      style={styles.container}
    >
      <div style={styles.top}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          style={styles.imageWrapper}
        >
          <img src={imageUrl} alt="Uploaded" style={styles.image} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={styles.readyBadge}
        >
          Photo loaded
        </motion.div>
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        style={styles.heading}
      >
        Choose your story genre
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={styles.subheading}
      >
        This shapes the art style, narrative tone, and soundtrack
      </motion.p>

      <div style={styles.grid}>
        {GENRES.map((genre, i) => {
          const isSelected = selected === genre.id
          return (
            <motion.button
              key={genre.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
              whileHover={{ scale: 1.04, y: -4 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelected(genre.id)}
              style={{
                ...styles.card,
                borderColor: isSelected
                  ? `${genre.accentColor}88`
                  : 'rgba(201, 162, 39, 0.06)',
                boxShadow: isSelected
                  ? `0 0 24px ${genre.accentColor}30, inset 0 0 30px ${genre.accentColor}10`
                  : 'none',
                background: isSelected
                  ? `rgba(18, 14, 10, 0.7)`
                  : 'rgba(18, 14, 10, 0.5)',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.borderColor = `${genre.accentColor}66`
                  el.style.boxShadow = `0 8px 32px ${genre.accentColor}22, inset 0 0 30px ${genre.accentColor}08`
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.borderColor = 'rgba(201, 162, 39, 0.06)'
                  el.style.boxShadow = 'none'
                }
              }}
            >
              <div style={{ ...styles.cardGradient, background: genre.gradient }} />
              <span style={styles.cardLabel}>{genre.label}</span>
              <span style={styles.cardDesc}>{genre.description}</span>
            </motion.button>
          )
        })}
      </div>

      {/* Prompt input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        style={styles.promptSection}
      >
        <label style={styles.promptLabel}>Story prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={styles.promptInput}
          rows={2}
          placeholder="Describe the story you want..."
        />
      </motion.div>

      {/* Generate button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: selected ? 1 : 0.35, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        whileHover={selected ? { scale: 1.03 } : {}}
        whileTap={selected ? { scale: 0.97 } : {}}
        onClick={() => selected && onGenerate(selected, prompt)}
        disabled={!selected}
        style={{
          ...styles.generateBtn,
          cursor: selected ? 'pointer' : 'not-allowed',
        }}
      >
        Generate Story
      </motion.button>
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
    padding: 28,
  },
  top: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  imageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 16,
    overflow: 'hidden',
    border: '2px solid rgba(201, 162, 39, 0.12)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  readyBadge: {
    fontSize: 10,
    fontWeight: 500,
    color: '#4ade80',
    padding: '2px 8px',
    borderRadius: 6,
    background: 'rgba(74, 222, 128, 0.08)',
    border: '1px solid rgba(74, 222, 128, 0.15)',
    letterSpacing: '0.03em',
  },
  heading: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 24,
    fontWeight: 600,
    color: '#ede8d8',
    marginTop: 4,
  },
  subheading: {
    fontSize: 13,
    color: '#6b6455',
    marginBottom: 4,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 160px)',
    gap: 10,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '18px 14px',
    borderRadius: 14,
    border: '1px solid rgba(201, 162, 39, 0.06)',
    background: 'rgba(18, 14, 10, 0.5)',
    backdropFilter: 'blur(12px)',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    outline: 'none',
    fontFamily: 'inherit',
    color: 'inherit',
  },
  cardGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#ede8d8',
  },
  cardDesc: {
    fontSize: 10,
    color: '#6b6455',
    textAlign: 'center',
    lineHeight: 1.4,
  },
  promptSection: {
    width: '100%',
    maxWidth: 500,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 4,
  },
  promptLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6b6455',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  promptInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(201, 162, 39, 0.10)',
    background: 'rgba(18, 14, 10, 0.5)',
    backdropFilter: 'blur(12px)',
    color: '#d4c8a8',
    fontSize: 13,
    fontFamily: "'Inter', sans-serif",
    resize: 'none',
    outline: 'none',
    lineHeight: 1.5,
  },
  generateBtn: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    color: '#0a0908',
    padding: '12px 36px',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #c9a227, #a67c10)',
    border: '1px solid rgba(201, 162, 39, 0.4)',
    outline: 'none',
    letterSpacing: '0.02em',
    boxShadow: '0 4px 20px rgba(201, 162, 39, 0.25)',
    marginTop: 4,
  },
}
