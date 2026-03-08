import { motion } from 'framer-motion'

interface Props {
  onStart: () => void
}

export function CoverScreen({ onStart }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      transition={{ duration: 0.6 }}
      style={S.container}
    >
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        style={S.title}
      >
        Storybox
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        style={S.tagline}
      >
        Turn any moment into a cinematic story
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8 }}
        whileHover={{ scale: 1.05, boxShadow: '0 8px 32px rgba(201, 162, 39, 0.4)' }}
        whileTap={{ scale: 0.97 }}
        onClick={onStart}
        style={S.btn}
      >
        Let the adventure begin!
      </motion.button>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.1 }}
        style={S.models}
      >
        {[
          { name: 'Gemini 3.1', color: '#4db8cc' },
          { name: 'NanoBanana 2', color: '#e88a20' },
          { name: 'Lyria', color: '#cc5588' },
          { name: 'LiveKit', color: '#4ade80' },
        ].map((m, i) => (
          <motion.span key={m.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 + i * 0.08 }}
            style={{ ...S.modelBadge, borderColor: `${m.color}30` }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.color, boxShadow: `0 0 6px ${m.color}60` }} />
            <span style={{ color: '#aaa' }}>{m.name}</span>
          </motion.span>
        ))}
      </motion.div>
    </motion.div>
  )
}

const S: Record<string, React.CSSProperties> = {
  container: {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 24, position: 'relative',
  },
  title: {
    fontFamily: "'Cinzel Decorative', 'Cinzel', serif", fontSize: 72, fontWeight: 700,
    letterSpacing: '0.02em',
    background: 'linear-gradient(135deg, #f5e6c4 0%, #c9a227 50%, #a67c10 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    filter: 'drop-shadow(0 0 40px rgba(201,162,39,0.2))',
    margin: 0,
  },
  tagline: {
    fontFamily: "'Cinzel', serif",
    fontSize: 16, color: '#777', fontWeight: 400, marginBottom: 16,
    letterSpacing: '0.06em',
  },
  btn: {
    fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 700,
    color: '#0a0a0f', padding: '18px 52px', borderRadius: 14,
    background: 'linear-gradient(135deg, #c9a227, #a67c10)',
    border: 'none', outline: 'none', cursor: 'pointer',
    boxShadow: '0 6px 24px rgba(201,162,39,0.25)',
    letterSpacing: '0.04em',
  },
  models: {
    display: 'flex', gap: 8, marginTop: 24,
  },
  modelBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 12px', borderRadius: 20,
    fontSize: 11, fontWeight: 500,
    background: 'rgba(255,255,255,0.02)', border: '1px solid',
  },
}
