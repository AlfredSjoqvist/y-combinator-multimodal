import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  Track,
  RemoteTrack,
  Participant,
  TrackPublication,
  type TranscriptionSegment,
} from 'livekit-client'

// Data messages the agent can send to control the UI
export type AgentCommand =
  | { type: 'start_pipeline'; genre: string; imageUrl: string }
  | { type: 'show_panel'; panelIndex: number; imageUrl: string; narration: string; dialogue: string | null }
  | { type: 'play_music'; audioUrl: string }
  | { type: 'set_title'; title: string }
  | { type: 'navigate'; screen: 'upload' | 'generating' | 'gallery' }
  | { type: 'wizard_status'; text: string }
  | { type: 'custom'; payload: Record<string, unknown> }

interface UseLiveKitOptions {
  url: string
  token: string
}

// Module-level singleton to survive React strict mode
let _room: Room | null = null
let _connectPromise: Promise<void> | null = null

export function useLiveKit({ url, token }: UseLiveKitOptions) {
  const [connected, setConnected] = useState(false)
  const [lastCommand, setLastCommand] = useState<AgentCommand | null>(null)
  const [wizardStatus, setWizardStatus] = useState<string>('')
  const [commands, setCommands] = useState<AgentCommand[]>([])
  const [videoTrack, setVideoTrack] = useState<RemoteTrack | null>(null)
  const [agentTranscript, setAgentTranscript] = useState<string>('')
  const roomRef = useRef<Room | null>(null)
  const segmentsRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (!url || !token) return

    // Reuse existing room if already connected (React strict mode protection)
    if (_room && _room.state === 'connected') {
      console.log('[LiveKit] Reusing existing room connection')
      roomRef.current = _room
      setConnected(true)
      return
    }

    // If a connection is already in progress, wait for it
    if (_connectPromise) {
      console.log('[LiveKit] Connection already in progress, skipping')
      return
    }

    const room = new Room()
    _room = room
    roomRef.current = room

    room.on(RoomEvent.Connected, () => {
      console.log('[LiveKit] Connected to room')
      console.log('[LiveKit] Local participant:', room.localParticipant.identity)
      const remotes = Array.from(room.remoteParticipants.values()).map(p => p.identity)
      console.log('[LiveKit] Remote participants:', remotes)
      setConnected(true)
    })

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('[LiveKit] Participant joined:', participant.identity)
    })

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log('[LiveKit] Participant left:', participant.identity)
    })

    room.on(RoomEvent.Disconnected, () => {
      console.log('[LiveKit] Disconnected')
      setConnected(false)
      setVideoTrack(null)
      _room = null
      _connectPromise = null
    })

    // Track subscribed - pick up remote video and agent audio
    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        console.log('[LiveKit] Track subscribed:', track.kind, 'from', participant.identity)

        if (track.kind === Track.Kind.Video) {
          setVideoTrack(track)
        }

        if (track.kind === Track.Kind.Audio) {
          // ONLY play audio from the agent, NOT from phone-user (prevents feedback loop)
          if (participant.identity === 'phone-user') {
            console.log('[LiveKit] Skipping phone-user audio (prevents feedback)')
            return
          }
          const el = document.createElement('audio')
          el.autoplay = true
          el.id = `audio-${participant.identity}-${pub.trackSid}`
          document.body.appendChild(el)
          track.attach(el)
          console.log('[LiveKit] Audio attached for', participant.identity)
        }
      },
    )

    room.on(
      RoomEvent.TrackUnsubscribed,
      (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video) {
          setVideoTrack(null)
        }
        if (track.kind === Track.Kind.Audio && participant.identity !== 'phone-user') {
          track.detach()
          const el = document.getElementById(`audio-${participant.identity}-${pub.trackSid}`)
          el?.remove()
          console.log('[LiveKit] Audio detached for', participant.identity)
        }
      },
    )

    // Listen for data messages from the agent
    room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
      try {
        const text = new TextDecoder().decode(payload)
        const command = JSON.parse(text) as AgentCommand
        console.log('[LiveKit] Data command:', command.type, 'from', participant?.identity)
        setLastCommand(command)
        setCommands(prev => [...prev, command])

        if (command.type === 'wizard_status') {
          console.log('[LiveKit] >>> wizard_status:', command.text)
          setWizardStatus(command.text)
        }
      } catch (e) {
        console.warn('[LiveKit] Failed to parse data message:', e)
      }
    })

    // Listen for transcriptions from the agent
    room.on(
      RoomEvent.TranscriptionReceived,
      (segments: TranscriptionSegment[], participant?: Participant, _pub?: TrackPublication) => {
        console.log(`[LiveKit] >>> TRANSCRIPTION from ${participant?.identity}: ${segments.length} segments`)
        for (const seg of segments) {
          console.log(`[LiveKit]   seg[${seg.id}] "${seg.text}" final=${seg.final}`)
          segmentsRef.current.set(seg.id, seg.text)
        }
        const full = Array.from(segmentsRef.current.values()).join(' ')
        console.log('[LiveKit] >>> Full transcript:', full)
        setAgentTranscript(full)
      },
    )

    console.log('[LiveKit] Connecting to', url)
    _connectPromise = room.connect(url, token).then(() => {
      console.log('[LiveKit] Connection established successfully')
      _connectPromise = null
    }).catch(err => {
      console.error('[LiveKit] Connection failed:', err)
      _connectPromise = null
      _room = null
    })

    // Do NOT disconnect on cleanup - let the room persist across strict mode remounts
    return () => {
      roomRef.current = null
    }
  }, [url, token])

  // Enable microphone - must be called from a user gesture (click/tap)
  const enableMicrophone = useCallback(async () => {
    const room = _room
    if (!room) return
    try {
      await room.localParticipant.setMicrophoneEnabled(true)
      console.log('[LiveKit] Microphone enabled via user gesture')
    } catch (err) {
      // Not critical - user talks through phone, not laptop
      console.warn('[LiveKit] Could not enable microphone (not critical):', err)
    }
  }, [])

  // Send a message to the agent via data channel
  const sendToAgent = useCallback((data: Record<string, unknown>) => {
    const room = _room
    if (!room || room.state !== 'connected') {
      console.error('[LiveKit] Cannot send - room not connected. State:', room?.state)
      return
    }
    const encoded = new TextEncoder().encode(JSON.stringify(data))
    room.localParticipant.publishData(encoded, { reliable: true })
      .then(() => console.log('[LiveKit] Data sent:', data))
      .catch(err => console.error('[LiveKit] Failed to send:', err))
  }, [])

  return {
    connected,
    lastCommand,
    commands,
    wizardStatus,
    agentTranscript,
    enableMicrophone,
    sendToAgent,
    videoTrack,
    room: roomRef,
  }
}
