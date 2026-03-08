import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GENRES, type Genre, type StoryResult } from '../types'
import { runPipeline, type PipelineProgress } from '../pipeline'

interface Props {
  imageUrl: string
  genre: Genre
  prompt: string
  testMode?: boolean
  useHardcodedStory?: boolean
  onComplete: (result: StoryResult) => void
}

type ModelType = 'gemini' | 'nanobanana' | 'lyria' | 'livekit'

const MODELS: Record<ModelType, { name: string; color: string; dim: string; label: string; logo: string }> = {
  gemini:     { name: 'Gemini 3.1',    color: '#4db8cc', dim: '#1a3a44', label: 'Vision & Reasoning', logo: '/gemini.png' },
  nanobanana: { name: 'NanoBanana 2',  color: '#e88a20', dim: '#3a2800', label: 'Image Generation',   logo: '/nanobanana.png' },
  lyria:      { name: 'Lyria',         color: '#cc5588', dim: '#3a1428', label: 'Music & Audio',       logo: '/lyria.png' },
  livekit:    { name: 'LiveKit',       color: '#7c3aed', dim: '#2a1452', label: 'Realtime Voice',     logo: '/livekit.png' },
}

// ─── Pipeline steps ───
// Each output is either a text label or an image reference (prefixed with "img:")

interface Step {
  id: string; title: string; model: ModelType | null; duration: number
  desc: string; outputs: string[]
}

function buildPipeline(): Step[] {
  return [
    { id: 'input', title: 'Initialize Pipeline', model: null, duration: 1400,
      desc: 'Ingesting',
      outputs: ['img:photo', 'Prompt'] },
    { id: 'scan', title: 'Agentic Vision Decomposition', model: 'gemini', duration: 3500,
      desc: 'Agentic-visioning',
      outputs: ['Characters', 'Scene Graph', 'Narrative Seed', 'img:photo'] },
    { id: 'storyboard', title: 'Long-Context Storyboarding', model: 'gemini', duration: 4000,
      desc: 'Long-context plotting',
      outputs: ['Panel 1 Brief', 'Panel 2 Brief', 'Panel 3 Brief', 'Panel 4 Brief', 'Panel 5 Brief', 'Panel 6 Brief', 'Story Arc'] },
    { id: 'p1', title: 'Panel 1 - Character Lock', model: 'nanobanana', duration: 4000,
      desc: 'Identity-locking',
      outputs: ['img:p1', 'Panel 1 Brief'] },
    { id: 'r1', title: 'Agentic Consistency Review', model: 'gemini', duration: 2000,
      desc: 'Cross-modal verifying',
      outputs: ['img:p1', 'Adjusted Brief 2', 'Character Notes'] },
    { id: 'p2', title: 'Panel 2 - Multi-Reference', model: 'nanobanana', duration: 4500,
      desc: 'Context-chaining',
      outputs: ['img:p1', 'img:p2', 'Panel 2 Brief'] },
    { id: 'r2', title: 'Agentic Arc Refinement', model: 'gemini', duration: 2000,
      desc: 'Agentic-replanning',
      outputs: ['img:p1', 'img:p2', 'Adjusted Brief 3', 'Arc Update'] },
    { id: 'p3', title: 'Panel 3 - Context Chain', model: 'nanobanana', duration: 4500,
      desc: 'Multi-referencing',
      outputs: ['img:p1', 'img:p2', 'img:p3', 'Panel 3 Brief'] },
    { id: 'p4', title: 'Panel 4 - Context Chain', model: 'nanobanana', duration: 4500,
      desc: 'Fidelity-maximizing',
      outputs: ['img:p1', 'img:p2', 'img:p3', 'img:p4', 'Panel 4 Brief'] },
    { id: 'p5', title: 'Panel 5 - Context Chain', model: 'nanobanana', duration: 4500,
      desc: 'Sub-pixel preserving',
      outputs: ['img:p1', 'img:p2', 'img:p3', 'img:p4', 'img:p5', 'Panel 5 Brief'] },
    { id: 'p6', title: 'Panel 6 - Full Context', model: 'nanobanana', duration: 4500,
      desc: 'Full-context rendering',
      outputs: ['img:p1', 'img:p2', 'img:p3', 'img:p4', 'img:p5', 'img:p6'] },
    { id: 'polish', title: '1M-Token Script Refinement', model: 'gemini', duration: 3000,
      desc: 'Million-token polishing',
      outputs: ['img:p1', 'img:p2', 'img:p3', 'img:p4', 'img:p5', 'img:p6', 'Dialogues', 'Narrations', 'Title'] },
    { id: 'voices', title: 'Cloning Voices from LiveKit Call', model: 'livekit', duration: 5000,
      desc: 'Voice-cloning',
      outputs: ['Participant Voiceprints', 'Character Voice Map', 'Dialogue Audio'] },
    { id: 'music', title: 'Original Score Composition', model: 'lyria', duration: 2000,
      desc: 'Scoring',
      outputs: ['Orchestral Score', 'Ambient Layers'] },
    { id: 'cinema', title: 'Final Assembly', model: null, duration: 2000,
      desc: 'Assembling',
      outputs: ['Complete Story'] },
  ]
}

const PANEL_SCRIPTS = [
  'Just another normal day... or so they thought.',
  'Wait... who invited this guy?',
  'Okay, that definitely was not in the brochure.',
  'Things went sideways. Like, completely sideways.',
  'Plot armor: activated. Let\'s do this.',
  'And just like that, a legend was born.',
]

// ─── Animated dots component ───

function AnimatedDots({ color }: { color: string }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setCount(c => (c + 1) % 4), 500)
    return () => clearInterval(t)
  }, [])
  return (
    <span style={{ color, opacity: 0.6, minWidth: 20, display: 'inline-block' }}>
      {'.'.repeat(count || 0)}
    </span>
  )
}

// ─── Data flow connector with visible images and text ───

function DataFlow({ sent, sending, outputs, nextColor, imageUrl, panelImages }: {
  sent: boolean
  sending: boolean
  outputs: string[]
  nextColor: string
  imageUrl: string
  panelImages: Record<string, string>
}) {
  // Split into image items and text items
  const imgItems = outputs.filter(o => o.startsWith('img:'))
  const textItems = outputs.filter(o => !o.startsWith('img:'))
  // Show up to 6 images and 3 text labels
  const showImgs = imgItems.slice(0, 6)
  const showTexts = textItems.slice(0, 3)

  // Width scales with amount of data
  const baseW = 160
  const extraW = Math.min(imgItems.length * 20 + textItems.length * 14, 100)
  const totalW = baseW + extraW

  return (
    <div style={{
      width: totalW, flexShrink: 0, alignSelf: 'center',
      position: 'relative', height: 80,
      display: 'flex', alignItems: 'center',
    }}>
      {/* Track line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '50%',
        height: 3, transform: 'translateY(-50%)',
        background: sent || sending ? `${nextColor}40` : 'rgba(255,255,255,0.04)',
        transition: 'background 0.4s',
      }} />

      {/* Arrow */}
      <div style={{
        position: 'absolute', right: -1, top: '50%', transform: 'translateY(-50%)',
        width: 0, height: 0,
        borderTop: '7px solid transparent', borderBottom: '7px solid transparent',
        borderLeft: `10px solid ${sent || sending ? nextColor + '60' : 'rgba(255,255,255,0.06)'}`,
        transition: 'border-color 0.4s',
      }} />

      {/* Animated items - images flow on top row, text on bottom */}
      {sending && (
        <>
          {showImgs.map((item, i) => {
            const panelId = item.replace('img:', '')
            const pNum = panelId === 'photo' ? 0 : parseInt(panelId.replace('p', ''))
            const imgSrc = pNum > 0 ? getPanelImg(pNum, imageUrl, panelImages) : imageUrl
            return (
              <motion.div
                key={`img-${item}-${i}`}
                initial={{ left: '-12%', opacity: 0 }}
                animate={{ left: '112%', opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2, ease: 'linear' }}
                style={{
                  position: 'absolute', top: 2,
                  width: 38, height: 28, borderRadius: 3, overflow: 'hidden',
                  border: `1px solid ${nextColor}50`,
                  boxShadow: `0 2px 6px rgba(0,0,0,0.4)`,
                }}
              >
                <img src={imgSrc} alt="" style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                }} />
              </motion.div>
            )
          })}
          {showTexts.map((item, i) => (
            <motion.div
              key={`txt-${item}-${i}`}
              initial={{ left: '-10%', opacity: 0 }}
              animate={{ left: '110%', opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: 0.3 + i * 0.35, ease: 'linear' }}
              style={{
                position: 'absolute', bottom: 3,
                fontSize: 12, fontWeight: 500, color: nextColor, whiteSpace: 'nowrap',
                background: `${nextColor}10`, border: `1px solid ${nextColor}20`,
                padding: '3px 8px', borderRadius: 4,
              }}
            >
              {item}
            </motion.div>
          ))}
        </>
      )}

      {/* Static dim dots when delivered */}
      {sent && !sending && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', justifyContent: 'space-evenly',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: nextColor, opacity: 0.15 }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Step card ───

function StepCard({ step, isActive, isDone, isPending, imageUrl, prompt, panelImages }: {
  step: Step; isActive: boolean; isDone: boolean; isPending: boolean; imageUrl: string; prompt?: string; panelImages: Record<string, string>
}) {
  const modelInfo = step.model ? MODELS[step.model] : null
  const color = modelInfo?.color || '#c9a227'

  return (
    <motion.div
      initial={{ opacity: 0.15 }}
      animate={{ opacity: isPending ? 0.2 : 1, scale: isActive ? 1.02 : 1 }}
      transition={{ duration: 0.3 }}
      style={{
        width: 500, height: 480, flexShrink: 0,
        background: '#101018', borderRadius: 16,
        border: `2px solid ${isActive ? color + '60' : isDone ? color + '20' : 'rgba(255,255,255,0.04)'}`,
        boxShadow: isActive ? `0 0 36px ${color}15, 0 6px 30px rgba(0,0,0,0.4)` : '0 3px 18px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 22px',
        borderBottom: `1px solid ${isActive ? color + '15' : 'rgba(255,255,255,0.04)'}`,
      }}>
        {modelInfo ? (
          <img src={modelInfo.logo} alt={modelInfo.name} style={{
            width: 32, height: 32, flexShrink: 0, objectFit: 'contain',
            opacity: isPending ? 0.2 : 1,
            filter: isActive ? `drop-shadow(0 0 6px ${color}50)` : 'none',
            transition: 'opacity 0.3s, filter 0.3s',
          }} />
        ) : (
          <div style={{
            width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
            background: isDone ? '#4ade80' : isActive ? color : 'rgba(255,255,255,0.08)',
            boxShadow: isDone ? '0 0 8px rgba(74,222,128,0.4)' : isActive ? `0 0 8px ${color}80` : 'none',
            transition: 'all 0.3s',
          }} />
        )}
        <div style={{ flex: 1 }}>
          {modelInfo ? (
            <>
              <div style={{
                fontSize: 17, fontWeight: 700, color: isPending ? '#222' : color,
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: '0.02em',
              }}>{modelInfo.name}</div>
              <div style={{
                fontSize: 15, fontWeight: 500, color: isPending ? '#333' : '#999',
                marginTop: 1,
              }}>{step.title}</div>
            </>
          ) : (
            <div style={{
              fontSize: 18, fontWeight: 600, color: isPending ? '#333' : '#ddd',
              fontFamily: "'Space Grotesk', sans-serif",
            }}>{step.title}</div>
          )}
        </div>
        {isDone && <span style={{ fontSize: 20, color: '#4ade80', fontWeight: 600 }}>{'\u2713'}</span>}
        {isActive && (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            style={{ width: 26, height: 26, borderRadius: '50%', border: `3px solid ${color}30`, borderTopColor: color }} />
        )}
      </div>

      {/* Visual area */}
      <div style={{
        flex: 1, minHeight: 200, padding: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.15)',
      }}>
        {step.id === 'input'
          ? <InputVisual imageUrl={imageUrl} prompt={prompt || ''} isActive={isActive} isDone={isDone} color={color} />
          : renderVisual(step, isActive, isDone, imageUrl, color, panelImages)}
      </div>

      {/* Description */}
      {(isActive || isDone) && (
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          fontSize: 16, color: '#666', lineHeight: 1.4,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {isActive && (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${color}30`, borderTopColor: color, flexShrink: 0 }} />
          )}
          <span>{step.desc}{isActive && <AnimatedDots color={color} />}</span>
        </div>
      )}

      {/* Output summary when done - compact single line */}
      {isDone && step.outputs.length > 0 && (
        <div style={{
          padding: '8px 22px 12px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>{'\u2713'}</span>
          <span style={{ fontSize: 13, color: '#555' }}>
            {step.outputs.filter(o => o.startsWith('img:')).length > 0 &&
              `${step.outputs.filter(o => o.startsWith('img:')).length} image${step.outputs.filter(o => o.startsWith('img:')).length > 1 ? 's' : ''}`}
            {step.outputs.filter(o => o.startsWith('img:')).length > 0 && step.outputs.filter(o => !o.startsWith('img:')).length > 0 && ' + '}
            {step.outputs.filter(o => !o.startsWith('img:')).length > 0 &&
              `${step.outputs.filter(o => !o.startsWith('img:')).length} output${step.outputs.filter(o => !o.startsWith('img:')).length > 1 ? 's' : ''}`}
          </span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Visual content per step ───

function InputVisual({ imageUrl, isActive, isDone, color }: {
  imageUrl: string; prompt: string; isActive: boolean; isDone: boolean; color: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0.8, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        width: 280, height: 180, borderRadius: 10, overflow: 'hidden',
        border: `1.5px solid ${isDone ? '#4ade8030' : isActive ? color + '40' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isActive ? `0 0 24px ${color}15` : 'none',
        position: 'relative',
      }}
    >
      <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {isActive && (
        <motion.div
          animate={{ top: ['0%', '100%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      )}
      {isDone && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#4ade80', fontSize: 24, fontWeight: 700 }}>{'\u2713'}</span>
        </div>
      )}
    </motion.div>
  )
}

/** Get the image for a panel number — use real generated image if available, otherwise fallback to original */
function getPanelImg(panelNum: number, imageUrl: string, panelImages: Record<string, string>): string {
  return panelImages[`p${panelNum}`] || imageUrl
}

function renderVisual(step: Step, isActive: boolean, isDone: boolean, imageUrl: string, color: string, panelImages: Record<string, string>) {
  // 'input' step is handled by InputVisual component directly in StepCard

  if (step.id === 'input') return null

  if (step.id === 'scan') {
    return (
      <div style={{ width: 250, height: 170, borderRadius: 8, overflow: 'hidden', border: `1px solid ${color}30`, position: 'relative' }}>
        <img src={imageUrl} alt="" style={{
          width: '100%', height: '100%', objectFit: 'cover',
          filter: isActive ? 'brightness(1.1)' : isDone ? 'none' : 'brightness(0.25)',
        }} />
        {isActive && (
          <motion.div animate={{ top: ['0%', '100%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
              boxShadow: `0 0 8px ${color}`,
            }} />
        )}
        {isDone && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#4ade80', fontSize: 24, fontWeight: 700 }}>{'\u2713'}</span>
          </div>
        )}
      </div>
    )
  }

  // Storyboard generation
  if (step.id === 'storyboard') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, width: '90%' }}>
          {[0,1,2,3,4,5].map(i => (
            <motion.div key={i}
              animate={isActive ? { opacity: [0.2, 0.6, 0.2] } : {}}
              transition={isActive ? { duration: 1.2, repeat: Infinity, delay: i * 0.15 } : {}}
              style={{
                aspectRatio: '16/10', borderRadius: 4,
                border: `1px solid ${isDone ? '#4ade8025' : isActive ? color + '20' : 'rgba(255,255,255,0.03)'}`,
                background: isDone ? `${color}08` : '#0a0a0f',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {isDone && <span style={{ fontSize: 14, color: '#4ade80', fontWeight: 600 }}>P{i+1}</span>}
              {isActive && <span style={{ fontSize: 12, color: color + '60' }}>{i+1}</span>}
            </motion.div>
          ))}
        </div>
        {isActive && (
          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }}
            style={{ fontSize: 14, color, fontWeight: 500 }}>Writing storyboard...</motion.span>
        )}
        {isDone && <span style={{ fontSize: 14, color: '#4ade80', fontWeight: 500 }}>6 panel briefs ready</span>}
      </div>
    )
  }

  // Review steps
  if (step.id.startsWith('r')) {
    const reviewNum = parseInt(step.id.slice(1))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: reviewNum }, (_, i) => (
            <div key={i} style={{
              width: 66, height: 48, borderRadius: 4, overflow: 'hidden',
              border: `1px solid ${color}30`,
            }}>
              <img src={getPanelImg(i + 1, imageUrl, panelImages)} alt="" style={{
                width: '100%', height: '100%', objectFit: 'cover',
              }} />
            </div>
          ))}
        </div>
        {isActive && (
          <>
            <motion.div animate={{ top: ['0%', '100%'] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              style={{ position: 'absolute', left: 10, right: 10, height: 1, background: `${color}40` }} />
            <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }}
              style={{ fontSize: 14, color, fontWeight: 500 }}>Reviewing output...</motion.span>
          </>
        )}
        {isDone && <span style={{ fontSize: 14, color: '#4ade80', fontWeight: 500 }}>Storyboard updated</span>}
      </div>
    )
  }

  // Panel generation
  if (step.id.startsWith('p') && step.id.length === 2) {
    const num = parseInt(step.id.slice(1))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {/* Previously generated panels (context) */}
        {num > 1 && (isActive || isDone) && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            {Array.from({ length: num - 1 }, (_, i) => (
              <div key={i} style={{
                width: 42, height: 30, borderRadius: 3, overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)', opacity: 0.6,
              }}>
                <img src={getPanelImg(i + 1, imageUrl, panelImages)} alt="" style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                }} />
              </div>
            ))}
          </div>
        )}
        {/* Current panel */}
        <div style={{
          width: 240, height: 165, borderRadius: 8, overflow: 'hidden',
          border: `1px solid ${isDone ? '#4ade8030' : isActive ? color + '30' : 'rgba(255,255,255,0.04)'}`,
          background: '#0a0a0f', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isDone ? (
            <>
              <img src={getPanelImg(num, imageUrl, panelImages)} alt="" style={{
                width: '100%', height: '100%', objectFit: 'cover',
              }} />
              <div style={{
                position: 'absolute', top: 5, right: 5,
                background: '#4ade80', color: '#000', fontSize: 13, fontWeight: 700,
                padding: '3px 7px', borderRadius: 4,
              }}>P{num}</div>
            </>
          ) : isActive ? (
            <>
              <div style={{
                position: 'absolute', inset: 6, display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(4, 1fr)', gap: 3,
              }}>
                {Array.from({ length: 24 }, (_, i) => (
                  <motion.div key={i}
                    animate={{ opacity: [0, 0.5, 0] }}
                    transition={{ duration: 0.6 + Math.random() * 0.4, repeat: Infinity, delay: Math.random() * 1.5 }}
                    style={{ background: color, borderRadius: 2 }}
                  />
                ))}
              </div>
              <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }}
                style={{ fontSize: 16, fontWeight: 600, color, zIndex: 1 }}>Rendering...</motion.span>
            </>
          ) : (
            <span style={{ color: '#222', fontSize: 32, fontWeight: 700 }}>{num}</span>
          )}
        </div>
      </div>
    )
  }

  if (step.id === 'polish') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, width: '90%' }}>
          {[1,2,3,4,5,6].map(num => (
            <div key={num} style={{
              aspectRatio: '16/10', borderRadius: 4, overflow: 'hidden',
              border: `1px solid ${isDone ? color + '25' : isActive ? color + '15' : 'rgba(255,255,255,0.03)'}`,
            }}>
              <img src={getPanelImg(num, imageUrl, panelImages)} alt="" style={{
                width: '100%', height: '100%', objectFit: 'cover',
                filter: `${isActive ? 'brightness(1)' : isDone ? 'brightness(0.8)' : 'brightness(0.2)'}`,
              }} />
            </div>
          ))}
        </div>
        {isActive && (
          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }}
            style={{ fontSize: 14, color, fontWeight: 500 }}>Refining scripts...</motion.span>
        )}
        {isDone && <span style={{ fontSize: 14, color: '#4ade80', fontWeight: 500 }}>All scripts refined</span>}
      </div>
    )
  }

  if (step.id === 'music') {
    const BAR_COUNT = 28
    // Deterministic per-bar heights and timing
    const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
      const phase = (i / BAR_COUNT) * Math.PI * 2
      const baseH = 8 + Math.sin(phase) * 6
      const peakH = 16 + Math.sin(phase * 1.5 + 1) * 18 + Math.cos(phase * 0.7) * 8
      const dur = 0.8 + Math.sin(phase * 2.3) * 0.4
      return { baseH, peakH, dur }
    })

    return (
      <div style={{
        display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'center',
        height: 100, padding: '0 16px', width: '100%',
      }}>
        {bars.map((bar, i) => {
          const doneH = bar.baseH + Math.sin((i / BAR_COUNT) * Math.PI) * 14
          return (
            <motion.div key={i}
              animate={isActive ? {
                height: [bar.baseH, bar.peakH, bar.baseH * 0.6, bar.peakH * 0.7, bar.baseH],
                opacity: [0.6, 1, 0.7, 1, 0.6],
              } : {}}
              transition={isActive ? {
                duration: bar.dur + 0.6,
                repeat: Infinity,
                delay: i * 0.04,
                ease: 'easeInOut',
              } : {}}
              style={{
                width: 5, borderRadius: 3, flexShrink: 0,
                height: isDone ? doneH : isActive ? bar.baseH : 3,
                background: isDone || isActive
                  ? `linear-gradient(180deg, ${color}, ${color}60)`
                  : 'rgba(255,255,255,0.05)',
                opacity: isDone ? 0.6 : 1,
                boxShadow: isActive ? `0 0 4px ${color}40` : 'none',
                transition: isDone ? 'height 0.6s ease, opacity 0.4s' : undefined,
              }}
            />
          )
        })}
      </div>
    )
  }

  if (step.id === 'cinema') {
    return (
      <div style={{
        width: '90%', aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden',
        border: `1px solid ${isDone ? '#c9a22740' : isActive ? '#c9a22720' : 'rgba(255,255,255,0.04)'}`,
        background: '#0a0a0f',
        boxShadow: isDone ? '0 0 20px rgba(201,162,39,0.1)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isDone ? (
          <div style={{ display: 'flex', gap: 4, padding: 5, width: '100%', height: '100%', alignItems: 'center' }}>
            {[1,2,3,4,5,6].map(num => (
              <motion.div key={num} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: num * 0.06 }}
                style={{ flex: 1, height: '80%', borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(201,162,39,0.15)' }}>
                <img src={getPanelImg(num, imageUrl, panelImages)} alt="" style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                }} />
              </motion.div>
            ))}
          </div>
        ) : isActive ? (
          <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
            style={{ fontSize: 18, fontWeight: 600, color: '#c9a227' }}>Assembling...</motion.span>
        ) : (
          <span style={{ color: '#1a1a1a', fontSize: 18, fontWeight: 600 }}>Final</span>
        )}
      </div>
    )
  }

  return null
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function GeneratingScreen({ imageUrl, genre, prompt, testMode = false, useHardcodedStory = false, onComplete }: Props) {
  const genreConfig = GENRES.find(g => g.id === genre)!
  const STEPS = useRef(buildPipeline()).current

  const [phase, setPhase] = useState<'running' | 'zoom'>('running')
  const [active, setActive] = useState(0)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [transferring, setTransferring] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [pipelineResult, setPipelineResult] = useState<StoryResult | null>(null)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [panelImages, setPanelImages] = useState<Record<string, string>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const pipelineStarted = useRef(false)

  const TRANSFER_TIME = 1200

  // ─── Real pipeline mode ───
  // Map step IDs to STEPS indices for progress-driven advancement
  const stepIdToIndex = useMemo(() => {
    const map: Record<string, number> = {}
    STEPS.forEach((s, i) => { map[s.id] = i })
    return map
  }, [STEPS])

  // Advance to next step with transfer animation
  const advanceToStep = useCallback((nextIndex: number) => {
    setTransferring(true)
    setTimeout(() => {
      setTransferring(false)
      setActive(nextIndex)
    }, TRANSFER_TIME)
  }, [])

  // Mark current step done and optionally advance
  const markDoneAndAdvance = useCallback((stepIndex: number, nextIndex?: number) => {
    setDone(prev => { const n = new Set(prev); n.add(stepIndex); return n })
    if (nextIndex !== undefined && nextIndex < STEPS.length) {
      advanceToStep(nextIndex)
    }
  }, [STEPS.length, advanceToStep])

  // Complete the pipeline with a result
  const finishPipeline = useCallback((result: StoryResult) => {
    // Mark all remaining steps done
    setDone(prev => {
      const n = new Set(prev)
      STEPS.forEach((_, i) => n.add(i))
      return n
    })
    setPhase('zoom')
    setTimeout(() => onComplete(result), 1800)
  }, [STEPS, onComplete])

  // Launch real pipeline
  useEffect(() => {
    if (testMode || pipelineStarted.current) return
    pipelineStarted.current = true

    console.log('[GeneratingScreen] Starting real pipeline...')

    const handleProgress = (progress: PipelineProgress) => {
      console.log('[GeneratingScreen] Progress:', progress.stepId, progress.status)
      const idx = stepIdToIndex[progress.stepId]
      if (idx === undefined) return

      if (progress.status === 'start') {
        // Make sure we're on this step
        setActive(prev => prev === idx ? prev : idx)
      } else if (progress.status === 'done') {
        // Capture generated panel images
        if (progress.stepId.match(/^p\d$/) && progress.data && typeof progress.data === 'string') {
          setPanelImages(prev => ({ ...prev, [progress.stepId]: progress.data as string }))
        }
        // Find next step
        const nextIdx = idx + 1
        if (nextIdx < STEPS.length) {
          markDoneAndAdvance(idx, nextIdx)
        } else {
          // Last step done
          setDone(prev => { const n = new Set(prev); n.add(idx); return n })
        }
      } else if (progress.status === 'error') {
        console.error('[GeneratingScreen] Step error:', progress.stepId, progress.data)
        setPipelineError(`Error in ${progress.stepId}: ${progress.data}`)
      }
    }

    runPipeline(imageUrl, genre, prompt, handleProgress, useHardcodedStory)
      .then(result => {
        console.log('[GeneratingScreen] Pipeline complete:', result.title)
        setPipelineResult(result)
        finishPipeline(result)
      })
      .catch(err => {
        console.error('[GeneratingScreen] Pipeline failed:', err)
        setPipelineError(String(err))
      })
  }, [testMode, useHardcodedStory, imageUrl, genre, prompt, stepIdToIndex, STEPS, markDoneAndAdvance, finishPipeline])

  // ─── Test mode: timer-based advancement ───

  const advanceTest = useCallback(() => {
    setDone(prev => { const n = new Set(prev); n.add(active); return n })
    if (active < STEPS.length - 1) {
      setTransferring(true)
      setTimeout(() => {
        setTransferring(false)
        setActive(prev => prev + 1)
      }, TRANSFER_TIME)
    } else {
      setPhase('zoom')
      const result: StoryResult = {
        title: `The ${genreConfig.label} of a Lifetime`,
        genre,
        panels: PANEL_SCRIPTS.map((text, i) => ({
          imageUrl,
          dialogues: i % 2 === 0 ? [{ speaker: 'Narrator', text, voiceHint: 'neutral male narrator', audioUrl: null }] : [],
          narration: text,
          emotionalBeat: ['curious', 'tense', 'wonder', 'determined', 'dramatic', 'triumphant'][i],
        })),
        audioUrl: null,
      }
      setTimeout(() => onComplete(result), 1800)
    }
  }, [active, STEPS, genre, genreConfig, imageUrl, onComplete])

  useEffect(() => {
    if (!testMode) return
    if (phase !== 'running' || done.has(active) || transferring) return
    const t = setTimeout(advanceTest, STEPS[active].duration)
    return () => clearTimeout(t)
  }, [testMode, active, done, advanceTest, STEPS, phase, transferring])

  useEffect(() => {
    if (phase !== 'running') return
    const i = setInterval(() => setElapsed(e => e + 100), 100)
    return () => clearInterval(i)
  }, [phase])

  // Scroll to center using actual DOM positions
  useEffect(() => {
    if (!scrollRef.current || phase !== 'running') return
    const container = scrollRef.current
    const stepGroups = container.children
    if (!stepGroups.length) return
    const idx = Math.min(active, stepGroups.length - 1)
    const group = stepGroups[idx] as HTMLElement

    if (transferring) {
      const connector = group.children[1] as HTMLElement | undefined
      if (connector) {
        const targetLeft = connector.offsetLeft + connector.offsetWidth / 2 - container.clientWidth / 2
        container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
      }
    } else {
      const card = group.children[0] as HTMLElement
      const targetLeft = card.offsetLeft + card.offsetWidth / 2 - container.clientWidth / 2
      container.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: active === 0 && phase === 'running' ? 'auto' : 'smooth',
      })
    }
  }, [active, phase, transferring])

  const progress = (done.size / STEPS.length) * 100

  const panelCount = useMemo(() => {
    let c = 0
    for (const s of STEPS) { if (s.id.startsWith('p') && s.id.length === 2 && done.has(STEPS.indexOf(s))) c++ }
    return c
  }, [done, STEPS])

  // ─── Render ───

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0 } }}
      transition={{ duration: 0.3 }} style={S.screen}>

      {/* Pipeline */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{
          opacity: phase === 'zoom' ? 0 : 1,
          scale: phase === 'zoom' ? 1.15 : 1,
          filter: phase === 'zoom' ? 'blur(12px)' : 'blur(0px)',
        }}
        transition={{ duration: phase === 'zoom' ? 1.2 : 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={S.pipeline}
      >
          <div style={S.topBar}>
            <div>
              <div style={S.topTitle}>Storybox</div>
              <div style={S.topSub}>Multimodal AI Pipeline</div>
            </div>
            <div style={S.topCenter}>
              <span style={S.topLabel}>Step {active + 1}/{STEPS.length}</span>
              <div style={S.progressOuter}>
                <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} style={S.progressInner} />
              </div>
              <span style={S.topPercent}>{Math.round(progress)}%</span>
            </div>
            <div style={S.topRight}>
              <span style={S.topLabel}>Time</span>
              <span style={S.topVal}>{(elapsed / 1000).toFixed(1)}s</span>
            </div>
          </div>

          <div ref={scrollRef} className="pipeline-scroll" style={S.scroll}>
            {STEPS.map((step, i) => {
              const isDone = done.has(i)
              const isActive = i === active && !isDone && phase === 'running'
              const isPending = !isDone && !isActive

              return (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <StepCard step={step} isActive={isActive} isDone={isDone} isPending={isPending} imageUrl={imageUrl} prompt={prompt} panelImages={panelImages} />
                  {i < STEPS.length - 1 && (
                    <DataFlow
                      sent={isDone}
                      sending={isDone && transferring && i === active}
                      outputs={step.outputs}
                      nextColor={STEPS[i+1].model ? MODELS[STEPS[i+1].model!].color : '#c9a227'}
                      imageUrl={imageUrl}
                      panelImages={panelImages}
                    />
                  )}
                </div>
              )
            })}
          </div>

          <div style={S.bottomBar}>
            <div style={S.botSection}>
              <span style={S.botLabel}>Panels</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1,2,3,4,5,6].map(num => {
                  const stepIdx = STEPS.findIndex(s => s.id === `p${num}`)
                  const ready = stepIdx >= 0 && done.has(stepIdx)
                  return (
                    <div key={num} style={{
                      width: 56, height: 40, borderRadius: 4, overflow: 'hidden',
                      border: `1px solid ${ready ? '#e88a2030' : 'rgba(255,255,255,0.04)'}`,
                      background: '#0a0a0f',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: ready ? 1 : 0.25, transition: 'all 0.3s',
                    }}>
                      {ready ? (
                        <img src={getPanelImg(num, imageUrl, panelImages)} alt="" style={{
                          width: '100%', height: '100%', objectFit: 'cover',
                        }} />
                      ) : (
                        <span style={{ color: '#333', fontSize: 12, fontWeight: 600 }}>{num}</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <span style={{ ...S.botVal, color: '#e88a20' }}>{panelCount}/6</span>
            </div>

            <div style={S.botSection}>
              <span style={S.botLabel}>Scripts</span>
              <span style={{ ...S.botVal, color: done.has(STEPS.findIndex(s => s.id === 'polish')) ? '#4db8cc' : '#333' }}>
                {done.has(STEPS.findIndex(s => s.id === 'polish')) ? '\u2713 Done' : 'Pending'}
              </span>
            </div>

            <div style={S.botSection}>
              <span style={S.botLabel}>Audio</span>
              <span style={{ ...S.botVal, color: done.has(STEPS.findIndex(s => s.id === 'music')) ? '#cc5588' : '#333' }}>
                {done.has(STEPS.findIndex(s => s.id === 'music')) ? '\u2713 Done' : 'Pending'}
              </span>
            </div>

            <div style={{ ...S.botSection, flex: 2, alignItems: 'flex-start' }}>
              <span style={S.botLabel}>Current</span>
              <span style={{
                fontSize: 15, fontWeight: 600,
                color: STEPS[active].model ? MODELS[STEPS[active].model!].color : '#c9a227',
              }}>{STEPS[active].title}</span>
              <span style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{STEPS[active].desc}</span>
            </div>
          </div>
        </motion.div>

      {/* Zoom transition */}
      <AnimatePresence>
        {phase === 'zoom' && (
          <motion.div
            initial={{ clipPath: 'circle(5% at 50% 50%)', opacity: 0.8 }}
            animate={{ clipPath: 'circle(100% at 50% 50%)', opacity: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={S.zoomOverlay}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              style={S.zoomContent}
            >
              <h1 style={S.zoomTitle}>
                {pipelineResult?.title || `The ${genreConfig.label} of a Lifetime`}
              </h1>
              <p style={S.zoomGenre}>{genre}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pipeline error overlay */}
      {pipelineError && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, padding: '12px 24px', borderRadius: 12,
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444', fontSize: 14, maxWidth: 500, textAlign: 'center',
        }}>
          Pipeline error: {pipelineError}
        </div>
      )}
    </motion.div>
  )
}

// ─── Styles ───

const S: Record<string, React.CSSProperties> = {
  screen: { width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#0a0a0f' },
  zoomOverlay: {
    position: 'absolute', inset: 0, zIndex: 50,
    background: '#050408',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  zoomContent: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
  },
  zoomTitle: {
    fontFamily: "'Space Grotesk', sans-serif", fontSize: 48, fontWeight: 700,
    background: 'linear-gradient(135deg, #f5e6c4, #c9a227)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    textAlign: 'center' as const, maxWidth: 600,
  },
  zoomGenre: {
    fontSize: 16, fontWeight: 500, color: '#6b6455',
    textTransform: 'uppercase' as const, letterSpacing: '0.15em',
  },
  pipeline: {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    padding: '8px 10px', gap: 6, position: 'relative', zIndex: 2,
  },
  topBar: {
    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 24px', borderRadius: 12,
    background: 'rgba(16,16,24,0.8)', border: '1px solid rgba(255,255,255,0.05)',
  },
  topTitle: { fontSize: 18, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#c9a227' },
  topSub: { fontSize: 12, color: '#555' },
  topCenter: { display: 'flex', alignItems: 'center', gap: 12 },
  topLabel: { fontSize: 13, fontWeight: 600, color: '#555' },
  progressOuter: { width: 220, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' },
  progressInner: { height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #c9a227, #e88a20)' },
  topPercent: { fontSize: 16, fontWeight: 700, color: '#c9a227', minWidth: 40, textAlign: 'right' },
  topRight: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  topVal: { fontSize: 18, fontWeight: 700, color: '#c9a227', fontVariantNumeric: 'tabular-nums' },
  scroll: {
    flex: 1, display: 'flex', alignItems: 'stretch',
    overflowX: 'auto', overflowY: 'hidden',
    padding: '4px calc(50vw - 250px)',
    scrollBehavior: 'smooth',
    msOverflowStyle: 'none', scrollbarWidth: 'none',
  },
  bottomBar: {
    flexShrink: 0, display: 'flex', gap: 24, padding: '12px 24px',
    borderRadius: 12, background: 'rgba(16,16,24,0.8)',
    border: '1px solid rgba(255,255,255,0.05)', alignItems: 'center',
  },
  botSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  botLabel: { fontSize: 11, fontWeight: 600, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em' },
  botVal: { fontSize: 14, fontWeight: 600 },
}
