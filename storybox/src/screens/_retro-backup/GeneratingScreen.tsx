import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GENRES, type Genre, type StoryResult } from '../types'

interface Props {
  imageUrl: string
  genre: Genre
  prompt: string
  onComplete: (result: StoryResult) => void
}

// ═══════════════════════════════════════════════════════
//  MODEL IDENTITY — Each AI model is a distinct machine
// ═══════════════════════════════════════════════════════

type ModelType = 'gemini' | 'nanobanana' | 'lyria'

const MODELS: Record<ModelType, {
  name: string
  fullName: string
  color: string
  dim: string
  glyph: string
  capability: string
}> = {
  gemini: {
    name: 'GEMINI 3.1',
    fullName: 'Google DeepMind Gemini 3.1',
    color: '#00d4ff',
    dim: '#005566',
    glyph: '\u25C6', // diamond
    capability: 'AGENTIC VISION / 1M CONTEXT',
  },
  nanobanana: {
    name: 'NANOBANANA 2',
    fullName: 'Google DeepMind NanoBanana 2',
    color: '#ff9900',
    dim: '#664400',
    glyph: '\u25A0', // square
    capability: 'MULTI-CHAR CONSISTENCY',
  },
  lyria: {
    name: 'LYRIA',
    fullName: 'Google DeepMind Lyria',
    color: '#ff55aa',
    dim: '#662244',
    glyph: '\u266B', // music note
    capability: 'AUDIO SYNTHESIS',
  },
}

// ═══════════════════════════════════════════════════════
//  PIPELINE DEFINITION
// ═══════════════════════════════════════════════════════

interface Step {
  id: string
  title: string
  model: ModelType | null
  duration: number
  desc: string
  inputs: string[]
  outputs: string[]
}

function buildPipeline(prompt: string): Step[] {
  return [
    {
      id: 'input', title: 'LOAD INPUT', model: null, duration: 1200,
      desc: 'Ingesting photo + prompt data',
      inputs: [], outputs: ['Photo Data', 'Story Prompt'],
    },
    {
      id: 'scan', title: 'AGENTIC VISION', model: 'gemini', duration: 3500,
      desc: 'Scene decomposition via native agentic vision',
      inputs: ['Photo', 'Prompt', '1M Token Context'],
      outputs: ['Character Embeddings', 'Scene Graph', 'Narrative Seed'],
    },
    {
      id: 'p2', title: 'PANEL 2', model: 'nanobanana', duration: 4500,
      desc: 'Character-locked generation (5 chars, 14 objects)',
      inputs: ['Scene Graph', 'Char Lock', 'P1 Ref'],
      outputs: ['Panel 2 Image', 'Panel 2 Script'],
    },
    {
      id: 'p3', title: 'PANEL 3', model: 'nanobanana', duration: 4500,
      desc: 'Multi-panel context chain rendering',
      inputs: ['P1-P2 Context', 'Char Lock', 'Arc'],
      outputs: ['Panel 3 Image', 'Panel 3 Script'],
    },
    {
      id: 'p4', title: 'PANEL 4', model: 'nanobanana', duration: 4500,
      desc: 'Midpoint escalation with 3-panel grounding',
      inputs: ['P1-P3 Context', 'Char Lock', 'Midpoint'],
      outputs: ['Panel 4 Image', 'Panel 4 Script'],
    },
    {
      id: 'p5', title: 'PANEL 5', model: 'nanobanana', duration: 4500,
      desc: 'Climax beat — max character consistency',
      inputs: ['P1-P4 Context', 'Char Lock', 'Climax'],
      outputs: ['Panel 5 Image', 'Panel 5 Script'],
    },
    {
      id: 'p6', title: 'PANEL 6', model: 'nanobanana', duration: 4500,
      desc: 'Resolution — 5-image context for peak consistency',
      inputs: ['P1-P5 Context', 'Char Lock', 'Resolve'],
      outputs: ['Panel 6 Image', 'Panel 6 Script'],
    },
    {
      id: 'polish', title: 'REFINE TEXT', model: 'gemini', duration: 3000,
      desc: 'Long-context pass: all 6 scripts simultaneously',
      inputs: ['6 Panel Scripts', 'Full Arc', 'Genre'],
      outputs: ['6 Polished Dialogues', 'Narrations', 'Title'],
    },
    {
      id: 'music', title: 'COMPOSE', model: 'lyria', duration: 4000,
      desc: 'Transformational audio: 30s original score + lyrics',
      inputs: ['Narrative Summary', 'Emotional Arc', 'Mood Seq'],
      outputs: ['30s Score', 'Generated Lyrics'],
    },
    {
      id: 'cinema', title: 'ASSEMBLY', model: null, duration: 2000,
      desc: 'Final multimodal assembly',
      inputs: ['6 Panels', 'Scripts', 'Score', 'Title'],
      outputs: ['Complete Story'],
    },
  ]
}

// ═══════════════════════════════════════════════════════
//  BOOT SEQUENCE LINES
// ═══════════════════════════════════════════════════════

const BOOT_LINES: { text: string; color: string }[] = [
  { text: 'STORYBOX FACTORY v2.0', color: '#00ff41' },
  { text: 'INITIALIZING AI CORES...', color: '#888' },
  { text: 'GEMINI 3.1 ............ [ONLINE]', color: '#00d4ff' },
  { text: 'NANOBANANA 2 .......... [ONLINE]', color: '#ff9900' },
  { text: 'LYRIA ................. [ONLINE]', color: '#ff55aa' },
  { text: 'LOADING IMAGE DATA .... [OK]', color: '#00ff41' },
  { text: 'PIPELINE CONFIGURED ... [OK]', color: '#00ff41' },
  { text: 'COMMENCING GENERATION', color: '#ffcc00' },
]

const PANEL_SCRIPTS = [
  'The story begins in a familiar place...',
  'An unexpected visitor changes everything...',
  'Together they discover something extraordinary...',
  'The journey takes a dramatic turn...',
  'Against all odds, they press forward...',
  'A new chapter begins...',
]

// ═══════════════════════════════════════════════════════
//  DATA TRACK — pixel-style conveyor between machines
// ═══════════════════════════════════════════════════════

function DataTrack({ sent, sending, fromModel, toModel }: {
  sent: boolean    // data was already delivered (static, no animation)
  sending: boolean // currently transferring data (animate packets)
  fromModel: ModelType | null
  toModel: ModelType | null
}) {
  const fromColor = fromModel ? MODELS[fromModel].color : '#00ff41'
  const toColor = toModel ? MODELS[toModel].color : '#00ff41'
  const lit = sent || sending

  return (
    <div style={S.track}>
      {/* Track rail */}
      <div style={{
        ...S.trackRail,
        background: lit ? fromColor : '#1a1a2e',
        boxShadow: lit ? `0 0 8px ${fromColor}60` : 'none',
        opacity: sent && !sending ? 0.35 : 1,
      }} />

      {/* Animated data packets — ONLY while actively sending */}
      {sending && (
        <>
          {[0, 1, 2, 3].map(i => (
            <motion.div
              key={i}
              animate={{ left: ['-8%', '108%'] }}
              transition={{
                duration: 0.7 + i * 0.1,
                repeat: Infinity,
                delay: i * 0.18,
                ease: 'linear',
              }}
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                width: 8,
                height: 8,
                background: i % 2 === 0 ? fromColor : toColor,
                boxShadow: `0 0 6px ${i % 2 === 0 ? fromColor : toColor}`,
              }}
            />
          ))}
        </>
      )}

      {/* Static "delivered" dots when sent but no longer sending */}
      {sent && !sending && (
        <div style={{
          position: 'absolute', left: 0, right: 14, top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex', justifyContent: 'space-evenly', alignItems: 'center',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5, height: 5, background: fromColor, opacity: 0.25,
            }} />
          ))}
        </div>
      )}

      {/* Arrow indicator */}
      <div style={{
        ...S.trackArrow,
        color: lit ? toColor : '#1a1a2e',
        textShadow: lit ? `0 0 6px ${toColor}` : 'none',
        opacity: sent && !sending ? 0.35 : 1,
      }}>
        {'\u25B6'}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
//  MACHINE WORKING ANIMATIONS (per model type)
// ═══════════════════════════════════════════════════════

function WorkingAnim({ model }: { model: ModelType | null }) {
  if (!model) return null
  const color = MODELS[model].color

  if (model === 'gemini') {
    // Scanning grid — pulsing crosshairs
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Horizontal scan */}
        <motion.div
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: color, opacity: 0.4,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
        {/* Vertical scan */}
        <motion.div
          animate={{ left: ['0%', '100%', '0%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', top: 0, bottom: 0, width: 2,
            background: color, opacity: 0.3,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
        {/* Corner brackets */}
        {[
          { top: 4, left: 4 }, { top: 4, right: 4 },
          { bottom: 4, left: 4 }, { bottom: 4, right: 4 },
        ].map((pos, i) => (
          <motion.div key={i}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
            style={{
              position: 'absolute', ...pos, width: 12, height: 12,
              borderColor: color, borderStyle: 'solid', borderWidth: 0,
              ...(i === 0 ? { borderTopWidth: 2, borderLeftWidth: 2 } :
                i === 1 ? { borderTopWidth: 2, borderRightWidth: 2 } :
                i === 2 ? { borderBottomWidth: 2, borderLeftWidth: 2 } :
                { borderBottomWidth: 2, borderRightWidth: 2 }),
            } as React.CSSProperties}
          />
        ))}
      </div>
    )
  }

  if (model === 'nanobanana') {
    // Pixel grid materializing
    return (
      <div style={{
        position: 'absolute', inset: 8, overflow: 'hidden', pointerEvents: 'none',
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(4, 1fr)', gap: 2,
      }}>
        {Array.from({ length: 24 }, (_, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{
              duration: 0.8 + Math.random() * 0.4,
              repeat: Infinity,
              delay: Math.random() * 1.5,
            }}
            style={{ background: color, borderRadius: 0 }}
          />
        ))}
      </div>
    )
  }

  if (model === 'lyria') {
    // Equalizer bars
    return (
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3,
        padding: '0 12px 8px',
      }}>
        {Array.from({ length: 10 }, (_, i) => (
          <motion.div
            key={i}
            animate={{ height: [4, 12 + Math.random() * 40, 4] }}
            transition={{
              duration: 0.3 + Math.random() * 0.3,
              repeat: Infinity,
              delay: i * 0.05,
            }}
            style={{ width: 4, background: color, opacity: 0.5 }}
          />
        ))}
      </div>
    )
  }

  return null
}

// ═══════════════════════════════════════════════════════
//  VISUAL RENDERERS PER STEP
// ═══════════════════════════════════════════════════════

function renderVisual(step: Step, isActive: boolean, isDone: boolean, imageUrl: string) {
  const modelColor = step.model ? MODELS[step.model].color : '#00ff41'

  // INPUT — show the photo
  if (step.id === 'input') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 120, height: 90, border: `2px solid ${modelColor}`, overflow: 'hidden',
          position: 'relative',
        }}>
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'auto' }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(0,0,0,0.8)', padding: '2px 4px',
            fontSize: 8, color: modelColor, fontFamily: "'Press Start 2P', monospace",
            textAlign: 'center',
          }}>PHOTO</div>
        </div>
      </div>
    )
  }

  // GEMINI SCAN — photo with scan overlay
  if (step.id === 'scan') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{
          width: 140, height: 100, border: `2px solid ${modelColor}`, overflow: 'hidden',
          position: 'relative',
        }}>
          <img src={imageUrl} alt="" style={{
            width: '100%', height: '100%', objectFit: 'cover',
            filter: isActive ? 'brightness(1.2) contrast(1.1)' : isDone ? 'sepia(0.1)' : 'brightness(0.3)',
          }} />
          {isActive && <WorkingAnim model="gemini" />}
          {isDone && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#00ff41', fontSize: 20, fontFamily: "'Press Start 2P', monospace",
            }}>OK</div>
          )}
        </div>
      </div>
    )
  }

  // NANOBANANA PANELS — panel being generated
  if (step.id.startsWith('p')) {
    const num = parseInt(step.id.slice(1))
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{
          width: 130, height: 95, border: `2px solid ${isDone ? '#00ff41' : isActive ? modelColor : '#222'}`,
          overflow: 'hidden', position: 'relative', background: '#0a0a14',
        }}>
          {isDone ? (
            <>
              <img src={imageUrl} alt="" style={{
                width: '100%', height: '100%', objectFit: 'cover',
                filter: `hue-rotate(${(num - 1) * 40}deg) saturate(1.1)`,
              }} />
              <div style={{
                position: 'absolute', top: 2, right: 2, background: '#00ff41', color: '#000',
                fontSize: 6, fontFamily: "'Press Start 2P', monospace", padding: '1px 3px',
              }}>P{num}</div>
            </>
          ) : isActive ? (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <WorkingAnim model="nanobanana" />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  style={{ color: modelColor, fontSize: 7, fontFamily: "'Press Start 2P', monospace", textAlign: 'center', lineHeight: 1.6 }}
                >RENDERING<br/>P{num}</motion.span>
              </div>
            </div>
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#222', fontSize: 16, fontFamily: "'Press Start 2P', monospace" }}>{num}</span>
            </div>
          )}
        </div>
        {(isActive || isDone) && (
          <div style={{
            fontSize: 6, color: '#666', fontFamily: "'Press Start 2P', monospace",
          }}>{num - 1} PANEL{num > 2 ? 'S' : ''} CTX</div>
        )}
      </div>
    )
  }

  // POLISH — text refinement grid
  if (step.id === 'polish') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3,
          width: '90%', maxWidth: 160,
        }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              aspectRatio: '16/10', overflow: 'hidden',
              border: `1px solid ${isDone ? '#00d4ff40' : isActive ? '#00d4ff20' : '#1a1a2e'}`,
              background: '#050510',
            }}>
              <img src={imageUrl} alt="" style={{
                width: '100%', height: '100%', objectFit: 'cover',
                filter: `hue-rotate(${i * 40}deg) ${isActive ? 'brightness(1.2)' : 'brightness(0.5)'}`,
              }} />
            </div>
          ))}
        </div>
        {isActive && (
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ fontSize: 6, color: '#00d4ff', fontFamily: "'Press Start 2P', monospace" }}
          >REFINING...</motion.span>
        )}
        {isDone && (
          <span style={{ fontSize: 6, color: '#00ff41', fontFamily: "'Press Start 2P', monospace" }}>6 SCRIPTS OK</span>
        )}
      </div>
    )
  }

  // MUSIC — equalizer
  if (step.id === 'music') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{
          display: 'flex', gap: 3, alignItems: 'flex-end', height: 60,
          padding: '0 8px',
        }}>
          {Array.from({ length: 14 }, (_, i) => (
            <motion.div key={i}
              animate={isActive ? { height: [6, 14 + Math.random() * 35, 6] } : {}}
              transition={isActive ? { duration: 0.3 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.04 } : {}}
              style={{
                width: 4,
                height: isDone ? 8 + i * 2 : 6,
                background: isDone ? '#ff55aa' : isActive ? '#ff55aa' : '#1a1a2e',
                opacity: isDone ? 0.7 : 1,
              }}
            />
          ))}
        </div>
        {isActive && (
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ fontSize: 6, color: '#ff55aa', fontFamily: "'Press Start 2P', monospace" }}
          >COMPOSING...</motion.span>
        )}
        {isDone && (
          <span style={{ fontSize: 6, color: '#00ff41', fontFamily: "'Press Start 2P', monospace" }}>30s SCORE OK</span>
        )}
      </div>
    )
  }

  // CINEMA / ASSEMBLY
  if (step.id === 'cinema') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <div style={{
          width: '90%', maxWidth: 180, aspectRatio: '16/9',
          border: `2px solid ${isDone ? '#ffcc00' : isActive ? '#ffcc0060' : '#1a1a2e'}`,
          background: '#050510', overflow: 'hidden',
          boxShadow: isDone ? '0 0 20px rgba(255,204,0,0.2)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {isDone ? (
            <div style={{ display: 'flex', gap: 2, padding: 4, width: '100%', height: '100%', alignItems: 'center' }}>
              {[0, 1, 2, 3, 4, 5].map(pi => (
                <motion.div key={pi}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: pi * 0.08 }}
                  style={{ flex: 1, height: '80%', overflow: 'hidden', border: '1px solid #ffcc0030' }}
                >
                  <img src={imageUrl} alt="" style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    filter: pi === 0 ? 'none' : `hue-rotate(${pi * 40}deg)`,
                  }} />
                </motion.div>
              ))}
            </div>
          ) : isActive ? (
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ fontSize: 7, color: '#ffcc00', fontFamily: "'Press Start 2P', monospace", textAlign: 'center', lineHeight: 1.8 }}
            >ASSEMBLING<br/>STORY...</motion.span>
          ) : (
            <span style={{ color: '#1a1a2e', fontSize: 10, fontFamily: "'Press Start 2P', monospace" }}>---</span>
          )}
        </div>
        {isDone && (
          <span style={{ fontSize: 6, color: '#ffcc00', fontFamily: "'Press Start 2P', monospace" }}>READY</span>
        )}
      </div>
    )
  }

  return null
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function GeneratingScreen({ imageUrl, genre, prompt, onComplete }: Props) {
  const genreConfig = GENRES.find(g => g.id === genre)!
  const STEPS = useRef(buildPipeline(prompt)).current

  const [phase, setPhase] = useState<'boot' | 'running' | 'complete'>('boot')
  const [bootLine, setBootLine] = useState(0)
  const [active, setActive] = useState(0)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [elapsed, setElapsed] = useState(0)
  const [score, setScore] = useState(0)
  const [notification, setNotification] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ─── Boot sequence ───
  useEffect(() => {
    if (phase !== 'boot') return
    if (bootLine < BOOT_LINES.length) {
      const timer = setTimeout(() => setBootLine(b => b + 1), 220)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => setPhase('running'), 600)
      return () => clearTimeout(timer)
    }
  }, [phase, bootLine])

  // ─── Pipeline progression ───
  const advance = useCallback(() => {
    const stepName = STEPS[active].title
    setDone(prev => { const n = new Set(prev); n.add(active); return n })
    setScore(s => s + 1000 + active * 500)
    setNotification(`${stepName} COMPLETE +${1000 + active * 500}`)
    setTimeout(() => setNotification(null), 1200)

    if (active < STEPS.length - 1) {
      setActive(prev => prev + 1)
    } else {
      setPhase('complete')
      const result: StoryResult = {
        title: `The ${genreConfig.label} of a Lifetime`,
        genre,
        panels: PANEL_SCRIPTS.map((text, i) => ({
          imageUrl,
          dialogue: i % 2 === 0 ? `"${text}"` : null,
          narration: text,
          emotionalBeat: ['curious', 'tense', 'wonder', 'determined', 'dramatic', 'triumphant'][i],
        })),
        audioUrl: null,
      }
      setTimeout(() => onComplete(result), 2800)
    }
  }, [active, STEPS, genre, genreConfig, imageUrl, onComplete])

  useEffect(() => {
    if (phase !== 'running') return
    if (done.has(active)) return
    const timer = setTimeout(advance, STEPS[active].duration)
    return () => clearTimeout(timer)
  }, [active, done, advance, STEPS, phase])

  // ─── Timer ───
  useEffect(() => {
    if (phase !== 'running') return
    const interval = setInterval(() => setElapsed(e => e + 100), 100)
    return () => clearInterval(interval)
  }, [phase])

  // ─── Camera scroll (center active machine) ───
  useEffect(() => {
    if (!scrollRef.current) return
    if (phase !== 'running' && phase !== 'boot') return
    const unitW = 280 + 80 // machine + track
    const containerW = scrollRef.current.clientWidth
    const target = active * unitW - containerW / 2 + 140
    // On first render (boot→running), jump instantly to center
    if (active === 0 && phase === 'running') {
      scrollRef.current.scrollTo({ left: Math.max(0, target), behavior: 'auto' })
    } else {
      scrollRef.current.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
    }
  }, [active, phase])

  const progress = (done.size / STEPS.length) * 100
  const panelReady = (i: number) => i === 0 ? true : done.has(i + 1)

  // Panel/text/audio status for bottom bar
  const panelCount = useMemo(() => {
    let count = 1 // P1 always ready
    for (let i = 2; i <= 6; i++) {
      if (done.has(i)) count++
    }
    return count
  }, [done])

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={S.screen}
    >
      {/* ── CRT SCANLINES OVERLAY ── */}
      <div style={S.scanlines} />

      {/* ── PIXEL BORDER FRAME ── */}
      <div style={S.pixelFrame}>
        <div style={S.pixelFrameTop} />
        <div style={S.pixelFrameBottom} />
        <div style={S.pixelFrameLeft} />
        <div style={S.pixelFrameRight} />
      </div>

      {/* ═══════ BOOT OVERLAY (floats above pipeline, same visual language) ═══════ */}
      <AnimatePresence>
        {phase === 'boot' && (
          <motion.div
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.5 }}
            style={S.bootScreen}
          >
            {/* Boot content — game-themed terminal box */}
            <div style={S.bootBox}>
              {/* Top bar mimics the HUD */}
              <div style={S.bootHud}>
                <span style={S.bootHudTitle}>STORYBOX FACTORY</span>
                <span style={{ fontSize: 7, color: '#555', fontFamily: "'Press Start 2P', monospace" }}>SYSTEM INIT</span>
              </div>

              {/* Main boot area: terminal + photo side by side */}
              <div style={S.bootMain}>
                {/* Terminal lines */}
                <div style={S.bootLines}>
                  {BOOT_LINES.slice(0, bootLine).map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.08 }}
                      style={{ ...S.bootLineText, color: line.color }}
                    >
                      {line.text}
                    </motion.div>
                  ))}
                  {bootLine < BOOT_LINES.length && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.4, repeat: Infinity }}
                      style={{ color: '#00ff41', fontFamily: "'Press Start 2P', monospace", fontSize: 10 }}
                    >{'\u2588'}</motion.span>
                  )}
                </div>

                {/* Photo + prompt panel */}
                <div style={S.bootSide}>
                  {bootLine >= 4 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={S.bootPhoto}
                    >
                      <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={S.bootPhotoLabel}>INPUT</div>
                    </motion.div>
                  ) : (
                    <div style={{ ...S.bootPhoto, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#1a1a2e', fontSize: 8, fontFamily: "'Press Start 2P', monospace" }}>WAITING</span>
                    </div>
                  )}
                  {bootLine >= 5 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={S.bootPrompt}
                    >
                      <span style={{ color: '#555', fontSize: 6, fontFamily: "'Press Start 2P', monospace" }}>PROMPT</span>
                      <span style={{ color: '#aaa', fontSize: 8, fontFamily: "'Press Start 2P', monospace", lineHeight: 1.6 }}>
                        {prompt.slice(0, 50)}{prompt.length > 50 ? '...' : ''}
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Bottom: start indicator */}
              <div style={S.bootFooter}>
                {bootLine >= BOOT_LINES.length ? (
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    style={{ color: '#ffcc00', fontSize: 8, fontFamily: "'Press Start 2P', monospace", textShadow: '0 0 10px #ffcc00' }}
                  >{'\u25B6\u25B6\u25B6'} STARTING PIPELINE {'\u25C0\u25C0\u25C0'}</motion.span>
                ) : (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: BOOT_LINES.length }, (_, i) => (
                      <div key={i} style={{
                        width: 8, height: 8,
                        background: i < bootLine ? '#00ff41' : '#1a1a2e',
                        boxShadow: i < bootLine ? '0 0 4px #00ff41' : 'none',
                        transition: 'all 0.2s',
                      }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ COMPLETE / STAGE CLEAR ═══════ */}
      <AnimatePresence>
        {phase === 'complete' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={S.completeOverlay}
          >
            {/* Flash */}
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ position: 'absolute', inset: 0, background: '#fff', zIndex: 1 }}
            />

            <motion.div style={S.completeContent}>
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: [0.3, 1.15, 1], opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                style={S.completeTitle}
              >
                STAGE CLEAR!
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                style={S.completeStats}
              >
                <div style={S.completeStat}>
                  <span style={{ color: '#666' }}>TIME</span>
                  <span style={{ color: '#00ff41' }}>{(elapsed / 1000).toFixed(1)}s</span>
                </div>
                <div style={S.completeStat}>
                  <span style={{ color: '#666' }}>SCORE</span>
                  <span style={{ color: '#ffcc00' }}>{score.toString().padStart(6, '0')}</span>
                </div>
                <div style={S.completeStat}>
                  <span style={{ color: '#666' }}>PANELS</span>
                  <span style={{ color: '#ff9900' }}>6/6</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                style={S.completeModels}
              >
                {(['gemini', 'nanobanana', 'lyria'] as ModelType[]).map((m, i) => (
                  <motion.div
                    key={m}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 1.4 + i * 0.15 }}
                    style={{ ...S.completeModelRow, color: MODELS[m].color }}
                  >
                    {MODELS[m].glyph} {MODELS[m].name} <span style={{ color: '#00ff41' }}>[OK]</span>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ delay: 2.0, duration: 0.8, repeat: Infinity }}
                style={S.completeLoading}
              >
                LOADING STORY...
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ PIPELINE VIEW (always rendered, blurred during boot) ═══════ */}
      {phase !== 'complete' && (
        <motion.div
          initial={{ opacity: 0.15, filter: 'blur(8px)' }}
          animate={{
            opacity: phase === 'running' ? 1 : 0.15,
            filter: phase === 'running' ? 'blur(0px)' : 'blur(8px)',
          }}
          transition={{ duration: 0.6 }}
          style={S.pipelineView}
        >
          {/* ── TOP HUD ── */}
          <div style={S.hud}>
            <div style={S.hudLeft}>
              <div style={S.hudTitle}>STORYBOX FACTORY</div>
              <div style={S.hudSub}>3 AI MODELS {'\u00B7'} FULL MULTIMODAL PIPELINE</div>
            </div>
            <div style={S.hudCenter}>
              <div style={S.hudLabel}>STAGE {active + 1}/{STEPS.length}</div>
              <div style={S.xpBarOuter}>
                {Array.from({ length: STEPS.length }, (_, i) => (
                  <div key={i} style={{
                    flex: 1, height: '100%',
                    background: done.has(i) ? '#00ff41' : i === active ? `${STEPS[i].model ? MODELS[STEPS[i].model!].color : '#00ff41'}60` : '#1a1a2e',
                    boxShadow: done.has(i) ? '0 0 4px #00ff4180' : 'none',
                    transition: 'all 0.3s',
                  }} />
                ))}
              </div>
              <div style={S.hudPercent}>{Math.round(progress)}%</div>
            </div>
            <div style={S.hudRight}>
              <div style={S.hudReadout}>
                <span style={S.hudLabel}>TIME</span>
                <span style={S.hudVal}>{(elapsed / 1000).toFixed(1)}s</span>
              </div>
              <div style={S.hudReadout}>
                <span style={S.hudLabel}>SCORE</span>
                <span style={{ ...S.hudVal, color: '#ffcc00' }}>{score.toString().padStart(6, '0')}</span>
              </div>
            </div>
          </div>

          {/* ── Notification popup ── */}
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                style={S.notification}
              >
                {notification}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PIPELINE SCROLL ── */}
          <div ref={scrollRef} className="pipeline-scroll" style={S.pipelineScroll}>
            {STEPS.map((step, i) => {
              const isDone = done.has(i)
              const isActive = i === active && !isDone && phase === 'running'
              const isPending = !isDone && !isActive
              const modelInfo = step.model ? MODELS[step.model] : null
              const machineColor = modelInfo?.color || '#00ff41'

              return (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {/* ════ MACHINE CARD ════ */}
                  <motion.div
                    initial={{ opacity: 0.2 }}
                    animate={{
                      opacity: isPending ? 0.2 : 1,
                      scale: isActive ? 1.04 : 1,
                    }}
                    transition={{ duration: 0.3 }}
                    style={{
                      ...S.machine,
                      borderColor: isActive ? machineColor : isDone ? `${machineColor}50` : '#1a1a2e',
                      boxShadow: isActive
                        ? `0 0 30px ${machineColor}30, 0 0 60px ${machineColor}10, inset 0 0 15px ${machineColor}08`
                        : isDone ? `0 0 10px ${machineColor}10` : 'none',
                      // Distinct border-radius per model type
                      borderRadius: step.model === 'gemini' ? '12px' : step.model === 'lyria' ? '4px 20px 4px 20px' : 0,
                    }}
                  >
                    {/* ── Model-specific decorative elements ── */}
                    {step.model === 'gemini' && (isActive || isDone) && (
                      <>
                        {/* Gemini: circular eye/radar motif in corners */}
                        <div style={{
                          position: 'absolute', top: -8, left: -8, width: 16, height: 16,
                          borderRadius: '50%', border: `2px solid ${machineColor}40`,
                          zIndex: 11, background: '#0d0d1a',
                        }}>
                          <div style={{
                            position: 'absolute', inset: 3, borderRadius: '50%',
                            background: isActive ? machineColor : `${machineColor}60`,
                            boxShadow: isActive ? `0 0 8px ${machineColor}` : 'none',
                          }} />
                        </div>
                        <div style={{
                          position: 'absolute', top: -8, right: -8, width: 16, height: 16,
                          borderRadius: '50%', border: `2px solid ${machineColor}40`,
                          zIndex: 11, background: '#0d0d1a',
                        }}>
                          <div style={{
                            position: 'absolute', inset: 3, borderRadius: '50%',
                            background: isActive ? machineColor : `${machineColor}60`,
                            boxShadow: isActive ? `0 0 8px ${machineColor}` : 'none',
                          }} />
                        </div>
                        {/* Circular scan ring behind content */}
                        {isActive && (
                          <motion.div
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                            style={{
                              position: 'absolute', top: '50%', left: '50%',
                              width: 200, height: 200, marginTop: -100, marginLeft: -100,
                              borderRadius: '50%', border: `1px dashed ${machineColor}20`,
                              pointerEvents: 'none', zIndex: 0,
                            }}
                          />
                        )}
                      </>
                    )}

                    {step.model === 'nanobanana' && (isActive || isDone) && (
                      <>
                        {/* NanoBanana: angular corner brackets — blocky/industrial */}
                        {[
                          { top: 0, left: 0, borderTop: `3px solid ${machineColor}`, borderLeft: `3px solid ${machineColor}` },
                          { top: 0, right: 0, borderTop: `3px solid ${machineColor}`, borderRight: `3px solid ${machineColor}` },
                          { bottom: 0, left: 0, borderBottom: `3px solid ${machineColor}`, borderLeft: `3px solid ${machineColor}` },
                          { bottom: 0, right: 0, borderBottom: `3px solid ${machineColor}`, borderRight: `3px solid ${machineColor}` },
                        ].map((pos, ci) => (
                          <div key={ci} style={{
                            position: 'absolute', width: 14, height: 14, zIndex: 11,
                            ...pos,
                            opacity: isDone ? 0.5 : 0.9,
                          } as React.CSSProperties} />
                        ))}
                        {/* Pixel grid overlay */}
                        {isActive && (
                          <div style={{
                            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.04,
                            backgroundImage: `linear-gradient(${machineColor} 1px, transparent 1px), linear-gradient(90deg, ${machineColor} 1px, transparent 1px)`,
                            backgroundSize: '12px 12px',
                          }} />
                        )}
                      </>
                    )}

                    {step.model === 'lyria' && (isActive || isDone) && (
                      <>
                        {/* Lyria: wave decorations along top and bottom edges */}
                        <svg style={{ position: 'absolute', top: -1, left: 0, width: '100%', height: 8, zIndex: 11, pointerEvents: 'none' }} viewBox="0 0 280 8" preserveAspectRatio="none">
                          <motion.path
                            d="M0,4 Q35,0 70,4 Q105,8 140,4 Q175,0 210,4 Q245,8 280,4"
                            fill="none" stroke={machineColor} strokeWidth="1.5"
                            animate={isActive ? { opacity: [0.3, 0.8, 0.3] } : {}}
                            transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
                            style={{ opacity: isDone ? 0.4 : 0.7 }}
                          />
                        </svg>
                        <svg style={{ position: 'absolute', bottom: -1, left: 0, width: '100%', height: 8, zIndex: 11, pointerEvents: 'none' }} viewBox="0 0 280 8" preserveAspectRatio="none">
                          <motion.path
                            d="M0,4 Q35,8 70,4 Q105,0 140,4 Q175,8 210,4 Q245,0 280,4"
                            fill="none" stroke={machineColor} strokeWidth="1.5"
                            animate={isActive ? { opacity: [0.3, 0.8, 0.3] } : {}}
                            transition={isActive ? { duration: 1.5, repeat: Infinity, delay: 0.5 } : {}}
                            style={{ opacity: isDone ? 0.4 : 0.7 }}
                          />
                        </svg>
                        {/* Vertical sound bars decoration on left edge */}
                        <div style={{
                          position: 'absolute', left: 0, top: 30, bottom: 30, width: 6,
                          display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly',
                          zIndex: 11, pointerEvents: 'none',
                        }}>
                          {Array.from({ length: 8 }, (_, bi) => (
                            <motion.div key={bi}
                              animate={isActive ? { width: [2, 6, 2] } : {}}
                              transition={isActive ? { duration: 0.4, repeat: Infinity, delay: bi * 0.06 } : {}}
                              style={{ width: isDone ? 3 : 2, height: 2, background: machineColor, opacity: isDone ? 0.3 : 0.5 }}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Input/Assembly: simple terminal corners */}
                    {!step.model && (isActive || isDone) && (
                      <>
                        <div style={{
                          position: 'absolute', top: 2, left: 2, zIndex: 11,
                          fontSize: 10, color: `${machineColor}60`, fontFamily: 'monospace', lineHeight: 1,
                        }}>{'\u250C'}</div>
                        <div style={{
                          position: 'absolute', top: 2, right: 2, zIndex: 11,
                          fontSize: 10, color: `${machineColor}60`, fontFamily: 'monospace', lineHeight: 1,
                        }}>{'\u2510'}</div>
                        <div style={{
                          position: 'absolute', bottom: 2, left: 2, zIndex: 11,
                          fontSize: 10, color: `${machineColor}60`, fontFamily: 'monospace', lineHeight: 1,
                        }}>{'\u2514'}</div>
                        <div style={{
                          position: 'absolute', bottom: 2, right: 2, zIndex: 11,
                          fontSize: 10, color: `${machineColor}60`, fontFamily: 'monospace', lineHeight: 1,
                        }}>{'\u2518'}</div>
                      </>
                    )}

                    {/* ── Active glow border animation ── */}
                    {isActive && (
                      <motion.div
                        animate={{ opacity: [0.3, 0.8, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        style={{
                          position: 'absolute', inset: -1,
                          border: `2px solid ${machineColor}`,
                          borderRadius: step.model === 'gemini' ? '12px' : step.model === 'lyria' ? '4px 20px 4px 20px' : 0,
                          pointerEvents: 'none', zIndex: 10,
                        }}
                      />
                    )}

                    {/* ── HEADER: Model identity ── */}
                    <div style={{
                      ...S.machineHeader,
                      borderBottomColor: isActive ? `${machineColor}40` : '#1a1a2e',
                      background: step.model === 'gemini' ? 'rgba(0,212,255,0.03)'
                        : step.model === 'nanobanana' ? 'rgba(255,153,0,0.03)'
                        : step.model === 'lyria' ? 'rgba(255,85,170,0.03)'
                        : 'rgba(255,255,255,0.02)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        {/* Model-specific icon shape */}
                        <div style={{
                          width: 22, height: 22,
                          borderRadius: step.model === 'gemini' ? '50%' : step.model === 'lyria' ? '50% 4px 50% 4px' : 2,
                          border: `2px solid ${machineColor}60`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: `${machineColor}10`,
                          flexShrink: 0,
                        }}>
                          <span style={{
                            color: machineColor,
                            fontSize: 9,
                            fontFamily: "'Press Start 2P', monospace",
                          }}>{modelInfo?.glyph || '\u25A0'}</span>
                        </div>
                        <div>
                          <div style={{
                            fontSize: 8, fontFamily: "'Press Start 2P', monospace",
                            color: machineColor, letterSpacing: '0.05em',
                          }}>
                            {modelInfo ? `AI: ${modelInfo.name}` : step.id === 'cinema' ? 'ASSEMBLY' : 'INPUT'}
                          </div>
                          {modelInfo && (
                            <div style={{
                              fontSize: 7, color: `${machineColor}80`,
                              fontFamily: 'monospace', marginTop: 2,
                            }}>{modelInfo.capability}</div>
                          )}
                        </div>
                      </div>
                      {/* Status indicator — shape matches model */}
                      {isActive && (
                        <motion.div
                          animate={{ opacity: [1, 0.2, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity }}
                          style={{
                            width: 10, height: 10,
                            background: machineColor,
                            boxShadow: `0 0 8px ${machineColor}`,
                            borderRadius: step.model === 'gemini' ? '50%' : step.model === 'lyria' ? '50%' : 0,
                          }}
                        />
                      )}
                      {isDone && (
                        <div style={{
                          width: 10, height: 10, background: '#00ff41',
                          boxShadow: '0 0 6px #00ff41',
                          borderRadius: step.model === 'gemini' ? '50%' : step.model === 'lyria' ? '50%' : 0,
                        }} />
                      )}
                    </div>

                    {/* ── STEP TITLE ── */}
                    <div style={{
                      ...S.stepTitle,
                      color: isPending ? '#333' : '#fff',
                      background: isActive ? `${machineColor}08` : 'transparent',
                    }}>
                      {step.title}
                    </div>

                    {/* ── VISUAL / SCREEN AREA ── */}
                    <div style={{
                      ...S.machineScreen,
                      // Distinct screen shape per model
                      borderRadius: step.model === 'gemini' ? '0 0 8px 8px' : 0,
                    }}>
                      {renderVisual(step, isActive, isDone, imageUrl)}
                    </div>

                    {/* ── I/O TAGS ── */}
                    {(isActive || isDone) && (
                      <div style={S.ioArea}>
                        {step.inputs.length > 0 && (
                          <div style={S.ioRow}>
                            <span style={{ ...S.ioLabel, color: machineColor }}>IN:</span>
                            {step.inputs.map((inp, j) => (
                              <motion.span
                                key={j}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: j * 0.05 }}
                                style={{ ...S.ioTag, borderColor: `${machineColor}30`, color: `${machineColor}cc` }}
                              >{inp}</motion.span>
                            ))}
                          </div>
                        )}
                        {step.outputs.length > 0 && isDone && (
                          <div style={S.ioRow}>
                            <span style={{ ...S.ioLabel, color: '#00ff41' }}>OUT:</span>
                            {step.outputs.map((out, j) => (
                              <motion.span
                                key={j}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: j * 0.05 }}
                                style={{ ...S.ioTag, borderColor: '#00ff4130', color: '#00ff41cc' }}
                              >{out}</motion.span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── STATUS BAR ── */}
                    <div style={{
                      ...S.statusBar,
                      borderTopColor: isDone ? '#00ff4130' : isActive ? `${machineColor}30` : '#1a1a2e',
                      color: isDone ? '#00ff41' : isActive ? machineColor : '#333',
                    }}>
                      {isDone ? (
                        <span>{'[\u2713 COMPLETE]'}</span>
                      ) : isActive ? (
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >{'[\u25B6 PROCESSING...]'}</motion.span>
                      ) : (
                        <span>{'[  WAITING  ]'}</span>
                      )}
                    </div>
                  </motion.div>

                  {/* ════ DATA TRACK TO NEXT MACHINE ════ */}
                  {i < STEPS.length - 1 && (
                    <DataTrack
                      sent={isDone}
                      sending={isDone && (i + 1 === active)}
                      fromModel={step.model}
                      toModel={STEPS[i + 1].model}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* ── BOTTOM STATUS BAR ── */}
          <div style={S.bottomBar}>
            {/* Panel inventory */}
            <div style={S.bottomSection}>
              <div style={S.bottomLabel}>PANELS</div>
              <div style={S.panelSlots}>
                {[0, 1, 2, 3, 4, 5].map(i => {
                  const ready = panelReady(i)
                  return (
                    <motion.div
                      key={i}
                      animate={{ opacity: ready ? 1 : 0.2 }}
                      style={{
                        ...S.panelSlot,
                        borderColor: ready ? '#ff9900' : '#1a1a2e',
                      }}
                    >
                      {ready ? (
                        <img src={imageUrl} alt="" style={{
                          width: '100%', height: '100%', objectFit: 'cover',
                          filter: i === 0 ? 'none' : `hue-rotate(${i * 40}deg)`,
                        }} />
                      ) : (
                        <span style={{
                          color: '#333', fontSize: 8,
                          fontFamily: "'Press Start 2P', monospace",
                        }}>{i + 1}</span>
                      )}
                    </motion.div>
                  )
                })}
              </div>
              <div style={{ ...S.bottomMini, color: '#ff9900' }}>{panelCount}/6</div>
            </div>

            {/* Text status */}
            <div style={S.bottomSection}>
              <div style={S.bottomLabel}>TEXT</div>
              <div style={{
                ...S.statusBlock,
                borderColor: done.has(7) ? '#00d4ff40' : '#1a1a2e',
                color: done.has(7) ? '#00d4ff' : '#333',
              }}>
                {done.has(7) ? '[\u2713]' : '[--]'}
              </div>
              <div style={{ ...S.bottomMini, color: done.has(7) ? '#00d4ff' : '#333' }}>
                {done.has(7) ? 'REFINED' : 'PENDING'}
              </div>
            </div>

            {/* Audio status */}
            <div style={S.bottomSection}>
              <div style={S.bottomLabel}>AUDIO</div>
              <div style={{
                ...S.statusBlock,
                borderColor: done.has(8) ? '#ff55aa40' : '#1a1a2e',
                color: done.has(8) ? '#ff55aa' : '#333',
              }}>
                {done.has(8) ? '[\u2713]' : '[--]'}
              </div>
              <div style={{ ...S.bottomMini, color: done.has(8) ? '#ff55aa' : '#333' }}>
                {done.has(8) ? 'COMPOSED' : 'PENDING'}
              </div>
            </div>

            {/* Active step info */}
            <div style={{ ...S.bottomSection, flex: 2, alignItems: 'flex-start' }}>
              <div style={S.bottomLabel}>ACTIVE</div>
              <div style={{
                fontSize: 8, fontFamily: "'Press Start 2P', monospace",
                color: STEPS[active].model ? MODELS[STEPS[active].model!].color : '#00ff41',
              }}>
                {STEPS[active].title}
              </div>
              <div style={{
                fontSize: 9, fontFamily: 'monospace', color: '#555',
                marginTop: 2, lineHeight: 1.3,
              }}>
                {STEPS[active].desc}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════

const S: Record<string, React.CSSProperties> = {
  screen: {
    width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
    background: '#0a0a14',
    animation: 'crt-flicker 4s ease-in-out infinite',
  },

  // CRT scanlines overlay
  scanlines: {
    position: 'absolute', inset: 0, zIndex: 100, pointerEvents: 'none',
    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)',
    opacity: 0.6,
  },

  // Pixel border frame
  pixelFrame: { position: 'absolute', inset: 0, zIndex: 99, pointerEvents: 'none' },
  pixelFrameTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    background: 'linear-gradient(90deg, #00ff41, #00d4ff, #ff9900, #ff55aa, #ffcc00, #00ff41)',
    opacity: 0.6,
  },
  pixelFrameBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
    background: 'linear-gradient(90deg, #ff55aa, #ffcc00, #00ff41, #00d4ff, #ff9900, #ff55aa)',
    opacity: 0.6,
  },
  pixelFrameLeft: {
    position: 'absolute', top: 3, bottom: 3, left: 0, width: 3,
    background: 'linear-gradient(180deg, #00ff41, #00d4ff, #ff9900, #ff55aa)',
    opacity: 0.4,
  },
  pixelFrameRight: {
    position: 'absolute', top: 3, bottom: 3, right: 0, width: 3,
    background: 'linear-gradient(180deg, #ff55aa, #ff9900, #00d4ff, #00ff41)',
    opacity: 0.4,
  },

  // ═══ BOOT SCREEN (floating overlay above blurred pipeline) ═══
  bootScreen: {
    position: 'absolute', inset: 0, zIndex: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(10,10,20,0.92) 0%, rgba(10,10,20,0.98) 100%)',
  },
  bootBox: {
    width: '90%', maxWidth: 640,
    border: '2px solid #1a1a2e',
    background: 'rgba(10,10,20,0.95)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  bootHud: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 12px',
    borderBottom: '2px solid #1a1a2e',
    background: 'rgba(0,255,65,0.02)',
  },
  bootHudTitle: {
    fontSize: 10, fontFamily: "'Press Start 2P', monospace",
    color: '#00ff41', letterSpacing: '0.05em',
    textShadow: '0 0 6px #00ff4140',
  },
  bootMain: {
    display: 'flex', gap: 16, padding: 16,
    minHeight: 180,
  },
  bootLines: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: 5,
    minHeight: 0,
  },
  bootLineText: {
    fontSize: 8, fontFamily: "'Press Start 2P', monospace",
    letterSpacing: '0.02em', lineHeight: 1.8,
  },
  bootSide: {
    width: 160, flexShrink: 0,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  bootPhoto: {
    width: '100%', height: 110, overflow: 'hidden',
    border: '2px solid #00ff41',
    position: 'relative',
    background: '#050510',
  },
  bootPhotoLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'rgba(0,0,0,0.85)', textAlign: 'center',
    fontSize: 7, fontFamily: "'Press Start 2P', monospace",
    color: '#00ff41', padding: '2px 0',
  },
  bootPrompt: {
    display: 'flex', flexDirection: 'column', gap: 3,
    padding: '6px 8px',
    border: '1px solid #1a1a2e',
    background: 'rgba(0,0,0,0.3)',
  },
  bootFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px 12px',
    borderTop: '2px solid #1a1a2e',
    minHeight: 32,
  },

  // ═══ COMPLETE OVERLAY ═══
  completeOverlay: {
    position: 'absolute', inset: 0, zIndex: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0a0a14',
  },
  completeContent: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    position: 'relative', zIndex: 2,
  },
  completeTitle: {
    fontSize: 28, fontFamily: "'Press Start 2P', monospace",
    color: '#ffcc00', textShadow: '0 0 20px #ffcc00, 0 0 40px #ffcc0060',
    letterSpacing: '0.1em',
  },
  completeStats: {
    display: 'flex', gap: 32,
  },
  completeStat: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    fontSize: 10, fontFamily: "'Press Start 2P', monospace",
  },
  completeModels: {
    display: 'flex', flexDirection: 'column', gap: 6,
    padding: '12px 0',
    borderTop: '1px solid #1a1a2e',
    borderBottom: '1px solid #1a1a2e',
  },
  completeModelRow: {
    fontSize: 9, fontFamily: "'Press Start 2P', monospace",
    letterSpacing: '0.05em',
  },
  completeLoading: {
    fontSize: 10, fontFamily: "'Press Start 2P', monospace",
    color: '#00ff41', textShadow: '0 0 8px #00ff41',
  },

  // ═══ PIPELINE VIEW ═══
  pipelineView: {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    padding: '8px 10px', gap: 6,
    position: 'relative', zIndex: 2,
  },

  // HUD
  hud: {
    flexShrink: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '6px 12px',
    border: '2px solid #1a1a2e',
    background: 'rgba(10,10,20,0.9)',
  },
  hudLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
  hudTitle: {
    fontSize: 10, fontFamily: "'Press Start 2P', monospace",
    color: '#00ff41', letterSpacing: '0.05em',
    textShadow: '0 0 6px #00ff4140',
  },
  hudSub: {
    fontSize: 7, fontFamily: 'monospace',
    color: '#555', letterSpacing: '0.05em',
  },
  hudCenter: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  hudLabel: {
    fontSize: 7, fontFamily: "'Press Start 2P', monospace",
    color: '#666', letterSpacing: '0.05em',
  },
  xpBarOuter: {
    width: 180, height: 12, display: 'flex', gap: 2,
    padding: 2, border: '2px solid #333',
    background: '#0a0a14',
  },
  hudPercent: {
    fontSize: 9, fontFamily: "'Press Start 2P', monospace",
    color: '#00ff41', minWidth: 36, textAlign: 'right',
    textShadow: '0 0 4px #00ff4140',
  },
  hudRight: { display: 'flex', gap: 16, alignItems: 'center' },
  hudReadout: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  hudVal: {
    fontSize: 10, fontFamily: "'Press Start 2P', monospace",
    color: '#00ff41', fontVariantNumeric: 'tabular-nums',
  },

  // Notification
  notification: {
    position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
    zIndex: 20, padding: '6px 16px',
    background: '#ffcc00', color: '#000',
    fontSize: 8, fontFamily: "'Press Start 2P', monospace",
    letterSpacing: '0.05em',
    boxShadow: '0 0 20px #ffcc0060',
  },

  // Pipeline scroll
  pipelineScroll: {
    flex: 1, display: 'flex', alignItems: 'stretch', gap: 0,
    overflowX: 'auto', overflowY: 'hidden',
    padding: '4px 60px', minHeight: 0,
    scrollBehavior: 'smooth',
    msOverflowStyle: 'none', scrollbarWidth: 'none',
  },

  // Machine card
  machine: {
    width: 280, border: '2px solid',
    position: 'relative', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', background: '#0d0d1a',
    flexShrink: 0,
  },
  machineHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', borderBottom: '1px solid',
    background: 'rgba(255,255,255,0.02)',
  },
  stepTitle: {
    fontFamily: "'Press Start 2P', monospace", fontSize: 9,
    letterSpacing: '0.08em', padding: '6px 10px', textAlign: 'center',
    borderBottom: '1px solid #1a1a2e',
  },
  machineScreen: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 8, minHeight: 120,
    background: 'rgba(0,0,0,0.3)',
    position: 'relative',
  },
  ioArea: {
    display: 'flex', flexDirection: 'column', gap: 3,
    padding: '6px 10px', borderTop: '1px solid #1a1a2e',
    background: 'rgba(0,0,0,0.2)',
  },
  ioRow: {
    display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center',
  },
  ioLabel: {
    fontSize: 7, fontFamily: "'Press Start 2P', monospace",
    letterSpacing: '0.05em', flexShrink: 0,
  },
  ioTag: {
    fontSize: 7, fontFamily: 'monospace',
    padding: '1px 4px', border: '1px solid',
    background: 'rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
  },
  statusBar: {
    padding: '5px 10px', textAlign: 'center',
    fontSize: 7, fontFamily: "'Press Start 2P', monospace",
    letterSpacing: '0.08em',
    borderTop: '1px solid',
    background: 'rgba(0,0,0,0.2)',
  },

  // Data track
  track: {
    width: 80, display: 'flex', alignItems: 'center',
    position: 'relative', flexShrink: 0,
    alignSelf: 'center', height: 20,
  },
  trackRail: {
    position: 'absolute', left: 0, right: 14, top: '50%',
    height: 3, transform: 'translateY(-50%)',
    transition: 'all 0.3s',
  },
  trackArrow: {
    position: 'absolute', right: 0, top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 10, lineHeight: 1,
    transition: 'all 0.3s',
  },

  // Bottom bar
  bottomBar: {
    flexShrink: 0, display: 'flex', gap: 12, padding: '6px 10px',
    border: '2px solid #1a1a2e', background: 'rgba(10,10,20,0.9)',
    alignItems: 'center',
  },
  bottomSection: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
  },
  bottomLabel: {
    fontSize: 6, fontFamily: "'Press Start 2P', monospace",
    color: '#555', letterSpacing: '0.08em',
  },
  bottomMini: {
    fontSize: 6, fontFamily: "'Press Start 2P', monospace",
  },
  panelSlots: { display: 'flex', gap: 3 },
  panelSlot: {
    width: 36, height: 28, border: '2px solid',
    overflow: 'hidden', background: '#0a0a14',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  statusBlock: {
    fontSize: 9, fontFamily: "'Press Start 2P', monospace",
    padding: '4px 8px', border: '2px solid',
    background: '#0a0a14',
  },
}
