import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Howl } from 'howler'
import type { StoryResult, DialogueLine } from '../types'

interface Props {
  story: StoryResult
  sendToAgent: (data: Record<string, unknown>) => void
  onComplete: () => void
}

const PANEL_DURATION = 20000 // 20 seconds per panel

/** Play a pre-generated audio data URL and return a cleanup function */
function playAudioClip(audioUrl: string): { stop: () => void; promise: Promise<void> } {
  const audio = new Audio(audioUrl)
  audio.volume = 1.0
  const promise = new Promise<void>((resolve) => {
    audio.onended = () => resolve()
    audio.onerror = () => resolve()
    audio.play().catch(() => resolve())
  })
  return {
    stop: () => { audio.pause(); audio.currentTime = 0 },
    promise,
  }
}

export function PlaybackScreen({ story, sendToAgent, onComplete }: Props) {
  const [currentPanel, setCurrentPanel] = useState(-1) // -1 = title card
  const [showDialogue, setShowDialogue] = useState(false)
  const [activeDialogueIdx, setActiveDialogueIdx] = useState(-1)
  const howlRef = useRef<Howl | null>(null)
  const nativeAudioRef = useRef<HTMLAudioElement | null>(null)
  const dialogueCleanupRef = useRef<(() => void) | null>(null)
  const dialogueCancelledRef = useRef(false)

  // Background music
  useEffect(() => {
    if (!story.audioUrl) {
      console.log('[Playback] No audio URL, skipping music')
      return
    }
    console.log('[Playback] Setting up background music:', story.audioUrl.startsWith('data:') ? `data URL (${story.audioUrl.length} chars)` : story.audioUrl)

    const isDirectUrl = !story.audioUrl.startsWith('data:')
    const format = isDirectUrl ? 'mp3' : (() => {
      const mimeMatch = story.audioUrl.match(/^data:(audio\/[^;]+);/)
      const mime = mimeMatch ? mimeMatch[1] : 'audio/wav'
      const fmtMap: Record<string, string> = { 'audio/wav': 'wav', 'audio/mp3': 'mp3', 'audio/mpeg': 'mp3', 'audio/L16': 'wav' }
      return fmtMap[mime] || 'wav'
    })()

    let howl: Howl | null = null
    let nativeAudio: HTMLAudioElement | null = null

    try {
      howl = new Howl({
        src: [story.audioUrl],
        format: [format],
        html5: true,
        volume: 0.35,
        loop: true,
        onplay: () => console.log('[Playback] Music playing (Howler)'),
        onloaderror: (_id: number, err: unknown) => {
          console.error('[Playback] Howler load error, trying native Audio:', err)
          try {
            nativeAudio = new Audio(story.audioUrl!)
            nativeAudio.volume = 0.35
            nativeAudio.loop = true
            nativeAudioRef.current = nativeAudio
            nativeAudio.play().then(() => {
              console.log('[Playback] Music playing (native Audio)')
            }).catch(e => console.error('[Playback] Native audio play failed:', e))
          } catch (e2) {
            console.error('[Playback] All music playback failed:', e2)
          }
        },
        onplayerror: (_id: number, err: unknown) => {
          console.error('[Playback] Howler play error:', err)
        },
      })
      howlRef.current = howl
    } catch (e) {
      console.error('[Playback] Howl creation failed, trying native Audio:', e)
      try {
        nativeAudio = new Audio(story.audioUrl)
        nativeAudio.volume = 0.35
        nativeAudio.loop = true
        nativeAudioRef.current = nativeAudio
      } catch (e2) {
        console.error('[Playback] Native Audio creation also failed:', e2)
      }
    }

    // Start music when first panel begins (after title card)
    const startTimer = setTimeout(() => {
      if (howl) {
        howl.play()
      } else if (nativeAudio) {
        nativeAudio.play().catch(e => console.error('[Playback] Native audio start failed:', e))
      }
    }, 2500)

    return () => {
      clearTimeout(startTimer)
      if (howl) { howl.stop(); howl.unload() }
      howlRef.current = null
      if (nativeAudio) { nativeAudio.pause(); nativeAudio.src = '' }
      nativeAudioRef.current = null
    }
  }, [story.audioUrl])

  // Play dialogue audio clips sequentially when panel changes
  useEffect(() => {
    if (currentPanel < 0) return
    const panel = story.panels[currentPanel]
    if (!panel?.dialogues?.length) return

    dialogueCancelledRef.current = false
    let cancelled = false

    const playDialogues = async () => {
      // Wait for image to settle
      await new Promise(r => setTimeout(r, 1200))

      for (let i = 0; i < panel.dialogues.length; i++) {
        if (cancelled || dialogueCancelledRef.current) break

        const d = panel.dialogues[i]
        setActiveDialogueIdx(i)

        if (d.audioUrl) {
          // Play pre-generated Gemini TTS audio
          console.log(`[Playback] Playing audio for ${d.speaker}: mime=${d.audioUrl.slice(0, 30)}, length=${d.audioUrl.length}`)
          const clip = playAudioClip(d.audioUrl)
          dialogueCleanupRef.current = clip.stop
          await clip.promise
          dialogueCleanupRef.current = null
          console.log(`[Playback] Finished audio for ${d.speaker}`)
        } else {
          // No audio — just show text for 3 seconds
          console.warn(`[Playback] NO AUDIO for ${d.speaker}: "${d.text.slice(0, 40)}" — showing text only`)
          await new Promise(r => setTimeout(r, 3000))
        }

        if (cancelled || dialogueCancelledRef.current) break

        // Brief pause between speakers
        if (i < panel.dialogues.length - 1) {
          await new Promise(r => setTimeout(r, 400))
        }
      }

      if (!cancelled && !dialogueCancelledRef.current) {
        setActiveDialogueIdx(-1)
      }
    }

    // Start showing dialogue text and playing audio
    const timer = setTimeout(() => {
      setShowDialogue(true)
      playDialogues()
      // Also notify LiveKit agent
      panel.dialogues.forEach((d, i) => {
        if (d.speaker) {
          sendToAgent({
            type: 'speak_dialogue',
            text: d.text,
            speaker: d.speaker,
            voiceHint: d.voiceHint || 'neutral',
            panelIndex: currentPanel,
            dialogueIndex: i,
          })
        }
      })
    }, 800)

    return () => {
      cancelled = true
      dialogueCancelledRef.current = true
      clearTimeout(timer)
      if (dialogueCleanupRef.current) {
        dialogueCleanupRef.current()
        dialogueCleanupRef.current = null
      }
    }
  }, [currentPanel, story.panels, sendToAgent])

  const stopDialogue = useCallback(() => {
    dialogueCancelledRef.current = true
    if (dialogueCleanupRef.current) {
      dialogueCleanupRef.current()
      dialogueCleanupRef.current = null
    }
    setActiveDialogueIdx(-1)
  }, [])

  const advancePanel = useCallback(() => {
    stopDialogue()
    if (currentPanel < story.panels.length - 1) {
      setCurrentPanel(prev => prev + 1)
      setShowDialogue(false)
      setActiveDialogueIdx(-1)
    } else {
      setTimeout(onComplete, 1000)
    }
  }, [currentPanel, story.panels.length, onComplete, stopDialogue])

  // Auto-advance timer
  useEffect(() => {
    if (currentPanel === -1) {
      const timer = setTimeout(() => {
        setCurrentPanel(0)
      }, 2500)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(advancePanel, PANEL_DURATION)
    return () => clearTimeout(timer)
  }, [currentPanel, advancePanel])

  // K key to skip
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'k' || e.key === 'K') {
        console.log('[Playback] K pressed — skipping panel')
        advancePanel()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [advancePanel])

  // Cleanup all audio on unmount
  useEffect(() => {
    return () => {
      stopDialogue()
      if (howlRef.current) {
        howlRef.current.stop()
        howlRef.current.unload()
      }
      if (nativeAudioRef.current) {
        nativeAudioRef.current.pause()
        nativeAudioRef.current.src = ''
      }
    }
  }, [stopDialogue])

  const panel = currentPanel >= 0 ? story.panels[currentPanel] : null

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={styles.container}
      tabIndex={0}
    >
      <AnimatePresence mode="wait">
        {currentPanel === -1 ? (
          <motion.div
            key="title"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6 }}
            style={styles.titleCard}
          >
            <h1 style={styles.storyTitle}>{story.title}</h1>
            <p style={styles.genreLabel}>{story.genre}</p>
          </motion.div>
        ) : panel ? (
          <motion.div
            key={`panel-${currentPanel}`}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={styles.panelContainer}
          >
            {/* Panel image with Ken Burns */}
            <motion.div
              animate={{ scale: [1, 1.08] }}
              transition={{ duration: PANEL_DURATION / 1000, ease: 'linear' }}
              style={styles.panelImageWrapper}
            >
              <img src={panel.imageUrl} alt={`Panel ${currentPanel + 1}`} style={styles.panelImage} />
              <div style={styles.panelOverlay} />
            </motion.div>

            {/* Panel number */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={styles.panelNumber}
            >
              {currentPanel + 1} / {story.panels.length}
            </motion.div>

            {/* Narration — top of screen */}
            <AnimatePresence>
              {showDialogue && panel.narration && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  style={styles.narration}
                >
                  {panel.narration && panel.narration.length > 120
                    ? panel.narration.slice(0, 117) + '...'
                    : panel.narration}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dialogues — positioned left/right for different characters */}
            <AnimatePresence>
              {showDialogue && panel.dialogues.length > 0 && panel.dialogues.map((d: DialogueLine, i: number) => {
                // Alternate sides: even index = left, odd = right
                const isLeft = i % 2 === 0
                const posStyle: React.CSSProperties = {
                  position: 'absolute',
                  bottom: 80 + (panel.dialogues.length - 1 - i) * 100,
                  left: isLeft ? 40 : undefined,
                  right: isLeft ? undefined : 40,
                  textAlign: isLeft ? 'left' : 'right',
                  alignItems: isLeft ? 'flex-start' : 'flex-end',
                  maxWidth: '45%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  zIndex: 2,
                }
                return (
                  <motion.div
                    key={`${currentPanel}-dlg-${i}`}
                    initial={{ opacity: 0, x: isLeft ? -20 : 20 }}
                    animate={{ opacity: i <= activeDialogueIdx || activeDialogueIdx === -1 ? 1 : 0.3, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.15 }}
                    style={{
                      ...posStyle,
                      transform: i === activeDialogueIdx ? 'scale(1.04)' : 'scale(1)',
                      transition: 'transform 0.3s ease',
                    }}
                  >
                    <span style={{
                      ...styles.dialogueText,
                      background: i === activeDialogueIdx
                        ? 'rgba(201, 162, 39, 0.15)'
                        : 'rgba(5, 4, 8, 0.7)',
                      padding: '12px 22px',
                      borderRadius: 14,
                      borderTopLeftRadius: isLeft ? 2 : 14,
                      borderTopRightRadius: isLeft ? 14 : 2,
                      backdropFilter: 'blur(8px)',
                      border: i === activeDialogueIdx
                        ? '1.5px solid rgba(201, 162, 39, 0.6)'
                        : '1px solid rgba(201, 162, 39, 0.15)',
                      boxShadow: i === activeDialogueIdx
                        ? '0 0 20px rgba(201, 162, 39, 0.25), 0 0 60px rgba(201, 162, 39, 0.1)'
                        : 'none',
                      transition: 'all 0.3s ease',
                    }}>"{d.text}"</span>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {/* Skip hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ delay: 3 }}
              style={styles.skipHint}
            >
              Press K to skip
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Progress dots */}
      {currentPanel >= 0 && (
        <div style={styles.dots}>
          {story.panels.map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.dot,
                background: i === currentPanel ? '#c9a227' : i < currentPanel ? '#4ade80' : '#2a2518',
                width: i === currentPanel ? 24 : 8,
              }}
            />
          ))}
        </div>
      )}
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
    background: '#050408',
    position: 'relative',
    overflow: 'hidden',
    outline: 'none',
  },
  titleCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  storyTitle: {
    fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
    fontSize: 48,
    fontWeight: 700,
    textAlign: 'center',
    background: 'linear-gradient(135deg, #f5e6c4, #c9a227, #d4a844)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    maxWidth: 600,
    textShadow: 'none',
    letterSpacing: '0.04em',
  },
  genreLabel: {
    fontFamily: "'Cinzel', serif",
    fontSize: 14,
    fontWeight: 600,
    color: '#6b6455',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
  },
  panelContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelImageWrapper: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  panelImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    filter: 'brightness(0.75)',
  },
  panelOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    background: 'linear-gradient(transparent, rgba(5, 4, 8, 0.92))',
    pointerEvents: 'none',
  },
  panelNumber: {
    position: 'absolute',
    top: 24,
    right: 24,
    fontFamily: "'Cinzel', serif",
    fontSize: 14,
    fontWeight: 600,
    color: 'rgba(201, 162, 39, 0.5)',
    zIndex: 2,
    letterSpacing: '0.1em',
  },
  dialogueContainer: {
    position: 'absolute',
    bottom: 90,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    zIndex: 2,
    maxWidth: 650,
    textAlign: 'center',
  },
  dialogueLine: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    transition: 'transform 0.3s ease, opacity 0.3s ease',
  },
  dialogueText: {
    fontFamily: "'Cinzel', serif",
    fontSize: 24,
    fontWeight: 500,
    color: '#f0e8d0',
    textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.5)',
    lineHeight: 1.5,
    letterSpacing: '0.02em',
  },
  narration: {
    position: 'absolute',
    top: 40,
    left: '50%',
    transform: 'translateX(-50%)',
    fontFamily: "'Cinzel', serif",
    color: 'rgba(237, 232, 216, 0.95)',
    fontSize: 20,
    fontStyle: 'italic',
    fontWeight: 400,
    maxWidth: 700,
    textAlign: 'center',
    zIndex: 2,
    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
    letterSpacing: '0.03em',
    lineHeight: 1.5,
    background: 'rgba(5, 4, 8, 0.7)',
    padding: '14px 28px',
    borderRadius: 10,
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(201, 162, 39, 0.15)',
  },
  skipHint: {
    position: 'absolute',
    top: 24,
    left: 24,
    fontSize: 12,
    color: '#666',
    zIndex: 2,
  },
  dots: {
    position: 'absolute',
    bottom: 16,
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    zIndex: 3,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    transition: 'all 0.3s ease',
  },
}
