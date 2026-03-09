import { motion } from 'framer-motion'
import type { Language } from '../types'

interface Props {
  language: Language
  onLanguageChange: (lang: Language) => void
  onStart: () => void
}

export function CoverScreen({ language, onLanguageChange, onStart }: Props) {
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
        {language === 'sv'
          ? 'Förvandla vilket ögonblick som helst till en filmisk historia'
          : 'Turn any moment into a cinematic story'}
      </motion.p>

      {/* Language selector */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.65 }}
        style={S.langRow}
      >
        {(['en', 'sv'] as Language[]).map(lang => (
          <button
            key={lang}
            onClick={() => onLanguageChange(lang)}
            style={{
              ...S.langBtn,
              background: language === lang ? 'rgba(201, 162, 39, 0.18)' : 'rgba(255,255,255,0.03)',
              borderColor: language === lang ? 'rgba(201, 162, 39, 0.5)' : 'rgba(255,255,255,0.08)',
              color: language === lang ? '#c9a227' : '#666',
            }}
          >
            {lang === 'en' ? (
              <><span style={{ display: 'inline-flex', width: 20, height: 14, borderRadius: 2, overflow: 'hidden', verticalAlign: 'middle', marginRight: 6 }}>
                <svg viewBox="0 0 60 30" width="20" height="14">
                  <rect width="60" height="30" fill="#002868"/>
                  {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(i=><rect key={i} y={i*30/13} width="60" height={30/13} fill={i%2===0?'#BF0A30':'#fff'}/>)}
                  <rect width="24" height={30*7/13} fill="#002868"/>
                </svg>
              </span> English</>
            ) : (
              <><span style={{ display: 'inline-flex', width: 20, height: 14, borderRadius: 2, overflow: 'hidden', verticalAlign: 'middle', marginRight: 6 }}>
                <svg viewBox="0 0 16 10" width="20" height="14">
                  <rect width="16" height="10" fill="#006AA7"/>
                  <rect x="5" width="2" height="10" fill="#FECC02"/>
                  <rect y="4" width="16" height="2" fill="#FECC02"/>
                </svg>
              </span> Svenska</>
            )}
          </button>
        ))}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8 }}
        whileHover={{ scale: 1.05, boxShadow: '0 8px 32px rgba(201, 162, 39, 0.4)' }}
        whileTap={{ scale: 0.97 }}
        onClick={onStart}
        style={S.btn}
      >
        {language === 'sv' ? 'Låt äventyret börja!' : 'Let the adventure begin!'}
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
    fontSize: 16, color: '#777', fontWeight: 400, marginBottom: 4,
    letterSpacing: '0.06em',
  },
  langRow: {
    display: 'flex', gap: 10, marginBottom: 4,
  },
  langBtn: {
    fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600,
    padding: '8px 18px', borderRadius: 10,
    border: '1px solid', cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
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
