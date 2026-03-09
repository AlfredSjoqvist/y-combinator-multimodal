export type Genre = 'adventure' | 'noir' | 'comedy' | 'sci-fi' | 'romance' | 'ghibli'
export type Language = 'en' | 'sv'

export interface GenreConfig {
  id: Genre
  label: string
  description: string
  gradient: string
  accentColor: string
}

export interface DialogueLine {
  speaker: string
  text: string
  voiceHint: string | null
  audioUrl: string | null // pre-generated Gemini TTS audio data URL
}

export interface StoryPanel {
  imageUrl: string
  dialogues: DialogueLine[]
  narration: string | null
  emotionalBeat: string
}

export interface StoryResult {
  title: string
  genre: Genre
  panels: StoryPanel[]
  audioUrl: string | null
}

export const GENRES: GenreConfig[] = [
  {
    id: 'adventure',
    label: 'Adventure',
    description: 'Epic quests & bold heroes',
    gradient: 'linear-gradient(135deg, #f97316, #eab308)',
    accentColor: '#f97316',
  },
  {
    id: 'noir',
    label: 'Noir',
    description: 'Shadows, mystery & intrigue',
    gradient: 'linear-gradient(135deg, #374151, #111827)',
    accentColor: '#9ca3af',
  },
  {
    id: 'comedy',
    label: 'Comedy',
    description: 'Laughs & wild twists',
    gradient: 'linear-gradient(135deg, #facc15, #fb923c)',
    accentColor: '#facc15',
  },
  {
    id: 'sci-fi',
    label: 'Sci-Fi',
    description: 'Neon futures & alien worlds',
    gradient: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
    accentColor: '#8b5cf6',
  },
  {
    id: 'romance',
    label: 'Romance',
    description: 'Soft light & stolen glances',
    gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)',
    accentColor: '#ec4899',
  },
  {
    id: 'ghibli',
    label: 'Ghibli',
    description: 'Whimsical & painterly',
    gradient: 'linear-gradient(135deg, #34d399, #60a5fa)',
    accentColor: '#34d399',
  },
]
