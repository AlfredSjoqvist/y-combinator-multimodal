import { useState, useCallback, useEffect, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CoverScreen } from './screens/CoverScreen'
import { UploadScreen } from './screens/UploadScreen'
import { GeneratingScreen } from './screens/GeneratingScreen'
import { PlaybackScreen } from './screens/PlaybackScreen'
import { GalleryScreen } from './screens/GalleryScreen'
import { useLiveKit } from './useLiveKit'
import { DebugConsole } from './DebugConsole'
import type { StoryResult } from './types'
import './App.css'

type Screen = 'cover' | 'upload' | 'generating' | 'playback' | 'gallery'

export default function App() {
  const [screen, setScreen] = useState<Screen>('cover')
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [storyPrompt, setStoryPrompt] = useState<string>('')
  const [storyResult, setStoryResult] = useState<StoryResult | null>(null)
  const [testMode, setTestMode] = useState(false)
  const [useHardcodedStory, setUseHardcodedStory] = useState(false)

  // LiveKit connection - reads from URL params, falling back to env vars
  const lkParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      url: params.get('livekit_url') || import.meta.env.VITE_LIVEKIT_URL || '',
      token: params.get('livekit_token') || import.meta.env.VITE_LIVEKIT_TOKEN || '',
    }
  }, [])

  const { connected, lastCommand, wizardStatus, agentTranscript, enableMicrophone, sendToAgent, videoTrack } = useLiveKit(lkParams)

  // When the agent updates the story summary, put it in the prompt field
  useEffect(() => {
    if (wizardStatus && wizardStatus !== 'The Sage is listening...') {
      setStoryPrompt(wizardStatus)
    }
  }, [wizardStatus])

  // Show agent transcript in the prompt field as a fallback
  useEffect(() => {
    if (agentTranscript) {
      setStoryPrompt(agentTranscript)
    }
  }, [agentTranscript])

  // React to agent commands
  useEffect(() => {
    if (!lastCommand) return
    console.log('[App] Processing agent command:', lastCommand)

    switch (lastCommand.type) {
      case 'navigate':
        if (['upload', 'generating', 'gallery'].includes(lastCommand.screen)) {
          setScreen(lastCommand.screen as Screen)
        }
        break
      case 'start_pipeline':
        if (lastCommand.imageUrl) setUploadedImage(lastCommand.imageUrl)
        if (lastCommand.genre) setStoryPrompt(lastCommand.genre)
        setScreen('generating')
        break
    }
  }, [lastCommand])

  // "G" key = load demo image + run with hardcoded storyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'g' || e.key === 'G') {
        // Only trigger from upload or cover screen
        if (screen !== 'upload' && screen !== 'cover') return
        console.log('[App] G pressed — launching hardcoded storyboard mode')
        // Load demo image and start pipeline with hardcoded story
        fetch('/demo-input.jpg')
          .then(r => r.blob())
          .then(blob => {
            const reader = new FileReader()
            reader.onload = () => {
              setUploadedImage(reader.result as string)
              setStoryPrompt('Hackathon dragon quest — hardcoded demo')
              setTestMode(false)
              setUseHardcodedStory(true)
              setScreen('generating')
            }
            reader.readAsDataURL(blob)
          })
          .catch(err => console.error('[App] Failed to load demo image for G-mode:', err))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [screen])

  const handleStart = useCallback(async () => {
    // Enable mic on user gesture - required by browser autoplay policy
    await enableMicrophone()
    setScreen('upload')
    sendToAgent({ type: 'say_hi' })
  }, [enableMicrophone, sendToAgent])

  const handleTakePicture = useCallback((imageDataUrl: string) => {
    setUploadedImage(imageDataUrl || null)
    setTestMode(false)
    setUseHardcodedStory(false)
  }, [])

  const handleCreateAdventure = useCallback(() => {
    if (!uploadedImage) return
    sendToAgent({ type: 'capture_taken' })
    setScreen('generating')
  }, [uploadedImage, sendToAgent])

  const handleTestPipeline = useCallback(async () => {
    // Load mock.jpg from public dir, convert to data URL, run real pipeline
    try {
      const resp = await fetch('/demo-input.jpg')
      const blob = await resp.blob()
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        setUploadedImage(dataUrl)
        setStoryPrompt('An epic fantasy adventure — the characters discover a hidden portal and must save a magical realm')
        setTestMode(false)
        setUseHardcodedStory(false)
        setScreen('generating')
      }
      reader.readAsDataURL(blob)
    } catch (e) {
      console.error('Failed to load mock image:', e)
    }
  }, [])

  const handleTestAnimation = useCallback(() => {
    // Use a 1x1 placeholder image for test mode
    const canvas = document.createElement('canvas')
    canvas.width = 640; canvas.height = 360
    const ctx = canvas.getContext('2d')!
    // Draw a gradient placeholder
    const grad = ctx.createLinearGradient(0, 0, 640, 360)
    grad.addColorStop(0, '#1a1a2e'); grad.addColorStop(0.5, '#16213e'); grad.addColorStop(1, '#0f3460')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 640, 360)
    ctx.fillStyle = '#c9a227'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('Test Mode', 320, 190)
    setUploadedImage(canvas.toDataURL('image/jpeg'))
    setStoryPrompt('A day in the life — follow the characters on an unexpected adventure')
    setTestMode(true)
    setScreen('generating')
  }, [])

  const handleSubmit = useCallback((imageDataUrl: string, prompt: string) => {
    setUploadedImage(imageDataUrl)
    setStoryPrompt(prompt)
    setScreen('generating')
  }, [])

  const handleGenerationComplete = useCallback((result: StoryResult) => {
    setStoryResult(result)
    // Cache the result for "Test Storyboard" debugging
    // Strip large panel images (keep dialogue audio which is smaller)
    try {
      const cacheResult = {
        ...result,
        panels: result.panels.map(p => ({
          ...p,
          imageUrl: '', // stripped — will use placeholder in test mode
        })),
        audioUrl: null, // strip music too — too large
      }
      localStorage.setItem('storybox_cached_result', JSON.stringify(cacheResult))
      console.log('[App] Cached pipeline result to localStorage (images/music stripped, dialogue audio preserved)')
    } catch (e) {
      // If still too large, strip audio too
      try {
        const minResult = {
          ...result,
          panels: result.panels.map(p => ({
            ...p,
            imageUrl: '',
            dialogues: p.dialogues.map(d => ({ ...d, audioUrl: null })),
          })),
          audioUrl: null,
        }
        localStorage.setItem('storybox_cached_result', JSON.stringify(minResult))
        console.log('[App] Cached minimal result (text only)')
      } catch (e2) {
        console.warn('[App] Failed to cache result:', e2)
      }
    }
    setScreen('playback')
  }, [])

  const handlePlaybackComplete = useCallback(() => {
    setScreen('gallery')
  }, [])

  const handleTryAgain = useCallback(() => {
    setScreen('upload')
  }, [])

  const handleNewPhoto = useCallback(() => {
    setUploadedImage(null)
    setStoryPrompt('')
    setStoryResult(null)
    setTestMode(false)
    setScreen('upload')
  }, [])

  const handleReplay = useCallback(() => {
    setScreen('playback')
  }, [])

  const handleTestStoryboard = useCallback(() => {
    try {
      const cached = localStorage.getItem('storybox_cached_result')
      if (!cached) {
        console.error('[App] No cached storyboard result found. Run the full pipeline first.')
        alert('No cached storyboard found. Run the pipeline once first.')
        return
      }
      const result = JSON.parse(cached) as StoryResult

      // Fill in placeholder images for stripped panels
      const canvas = document.createElement('canvas')
      canvas.width = 640; canvas.height = 360
      const ctx = canvas.getContext('2d')!
      result.panels.forEach((p, i) => {
        if (!p.imageUrl || p.imageUrl.length < 100) {
          const grad = ctx.createLinearGradient(0, 0, 640, 360)
          grad.addColorStop(0, '#1a1a2e'); grad.addColorStop(0.5, '#16213e'); grad.addColorStop(1, '#0f3460')
          ctx.fillStyle = grad; ctx.fillRect(0, 0, 640, 360)
          ctx.fillStyle = '#c9a227'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'
          ctx.fillText(`Panel ${i + 1}`, 320, 190)
          p.imageUrl = canvas.toDataURL('image/jpeg')
        }
      })

      console.log('[App] Loaded cached result:', result.title, '— panels:', result.panels.length)
      result.panels.forEach((p, i) => {
        console.log(`[App] Panel ${i + 1}: ${p.dialogues.length} dialogues, narration: ${!!p.narration}`)
        p.dialogues.forEach((d, di) => {
          console.log(`  [${di}] ${d.speaker}: audioUrl=${d.audioUrl ? d.audioUrl.slice(0, 60) + '...' : 'NULL'}`)
        })
      })
      console.log(`[App] Music audioUrl: ${result.audioUrl ? result.audioUrl.slice(0, 60) + '...' : 'NULL'}`)
      setStoryResult(result)
      setUploadedImage(result.panels[0]?.imageUrl || null)
      setScreen('playback')
    } catch (e) {
      console.error('[App] Failed to load cached result:', e)
      alert('Failed to load cached storyboard: ' + e)
    }
  }, [])

  return (
    <div className="app">
      {/* LiveKit connection indicator */}
      {!!lkParams.url && (
        <div style={{
          position: 'fixed', top: 12, right: 16, zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 20,
          background: 'rgba(10,10,15,0.85)', border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: connected ? '#4ade80' : '#ef4444',
            boxShadow: connected ? '0 0 6px #4ade80' : '0 0 6px #ef4444',
          }} />
          <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>
            {connected ? 'Sage Connected' : 'Connecting...'}
          </span>
        </div>
      )}

      {/* Wizard status text - show on generating/playback/gallery screens */}
      {wizardStatus && connected && screen !== 'upload' && screen !== 'cover' && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, padding: '10px 24px', borderRadius: 12,
          background: 'rgba(10,10,15,0.9)', border: '1px solid rgba(201,162,39,0.15)',
          backdropFilter: 'blur(8px)',
          fontSize: 14, color: '#c9a227', fontWeight: 500,
          fontStyle: 'italic',
        }}>
          {wizardStatus}
        </div>
      )}

      <AnimatePresence mode="wait">
        {screen === 'cover' && (
          <CoverScreen
            key="cover"
            onStart={handleStart}
          />
        )}
        {screen === 'upload' && (
          <UploadScreen
            key="upload"
            videoTrack={videoTrack}
            connected={connected}
            storyConcept={storyPrompt}
            onStoryConceptChange={setStoryPrompt}
            onTakePicture={handleTakePicture}
            uploadedImage={uploadedImage}
            onCreateAdventure={handleCreateAdventure}
            phoneUrl={`https://meet.livekit.io/custom?liveKitUrl=${encodeURIComponent(lkParams.url)}&token=${import.meta.env.VITE_PHONE_TOKEN || ''}`}
          />
        )}
        {screen === 'generating' && uploadedImage && (
          <GeneratingScreen
            key="generating"
            imageUrl={uploadedImage}
            genre="adventure"
            prompt={storyPrompt}
            testMode={testMode}
            useHardcodedStory={useHardcodedStory}
            onComplete={handleGenerationComplete}
          />
        )}
        {screen === 'playback' && storyResult && (
          <PlaybackScreen
            key="playback"
            story={storyResult}
            sendToAgent={sendToAgent}
            onComplete={handlePlaybackComplete}
          />
        )}
        {screen === 'gallery' && storyResult && uploadedImage && (
          <GalleryScreen
            key="gallery"
            story={storyResult}
            originalImage={uploadedImage}
            onNewPhoto={handleNewPhoto}
            onReplay={handleReplay}
          />
        )}
      </AnimatePresence>
      <DebugConsole />
    </div>
  )
}
