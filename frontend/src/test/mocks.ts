import type { Recipe, JobStatus } from '../../api/types'

export const mockRecipe: Recipe = {
  id: 1,
  name: 'Klassische Tomatensuppe',
  emoji: '🍅',
  duration: '30 min',
  servings: '4',
  calories: 250,
  tags: ['Suppe', 'Vegetarisch', 'Einfach'],
  ingredients: [
    '1 kg Tomaten',
    '1 Zwiebel',
    '2 Knoblauchzehen',
    '1 EL Olivenöl',
    '1 TL Zucker',
    'Salz und Pfeffer',
    'Frischer Basilikum'
  ],
  steps: [
    'Tomaten waschen und klein schneiden',
    'Zwiebel und Knoblauch fein hacken',
    'Olivenöl in einem Topf erhitzen',
    'Zwiebel und Knoblauch glasig dünsten',
    'Tomaten hinzufügen und 20 Minuten köcheln lassen',
    'Mit Zucker, Salz und Pfeffer abschmecken',
    'Pürieren und mit Basilikum garnieren'
  ],
  imageUrl: 'https://example.com/tomatensuppe.jpg',
  source_url: 'https://www.chefkoch.de/rezepte/123456/klassische-tomatensuppe.html',
  created_at: '2026-03-20T10:00:00Z',
  updated_at: '2026-03-20T10:00:00Z'
}

export const mockRecipes: Recipe[] = [
  mockRecipe,
  {
    id: 2,
    name: 'Spaghetti Carbonara',
    emoji: '🍝',
    duration: '25 min',
    servings: '4',
    calories: 450,
    tags: ['Pasta', 'Italienisch', 'Klassiker'],
    ingredients: ['400g Spaghetti', '200g Pancetta', '4 Eigelb', '100g Pecorino'],
    steps: ['Spaghetti kochen', 'Pancetta braten', 'Eimasse unterrühren'],
    source_url: 'https://www.youtube.com/watch?v=abc123',
    created_at: '2026-03-19T10:00:00Z',
    updated_at: '2026-03-19T10:00:00Z'
  },
  {
    id: 3,
    name: 'Avocado Toast mit Ei',
    emoji: '🥑',
    duration: '15 min',
    servings: '2',
    calories: 320,
    tags: ['Frühstück', 'Gesund', 'Schnell'],
    ingredients: ['2 Scheiben Brot', '1 Avocado', '2 Eier'],
    steps: ['Brot toasten', 'Avocado zerdrücken', 'Ei anrichten'],
    source_url: 'https://www.instagram.com/p/xyz123/',
    created_at: '2026-03-18T10:00:00Z',
    updated_at: '2026-03-18T10:00:00Z'
  }
]

export const mockJobStatus: JobStatus = {
  jobId: 'test-job-123',
  status: 'completed',
  progress: 100,
  stage: 'Extraction complete',
  message: 'Recipe extracted successfully',
  recipeId: 1
}

export const mockPendingJobStatus: JobStatus = {
  jobId: 'test-job-456',
  status: 'processing',
  progress: 50,
  stage: 'Analyzing content',
  message: 'Processing video transcript'
}

export const mockFailedJobStatus: JobStatus = {
  jobId: 'test-job-789',
  status: 'failed',
  progress: 30,
  error: 'Failed to extract recipe: Unsupported platform'
}

export function createMockFetch(response: unknown, ok = true, status = 200) {
  return vi.fn(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(response)
    })
  ) as unknown as typeof fetch
}

export function createMockFailedFetch(message: string, status = 500) {
  return vi.fn(() =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({ error: message })
    })
  ) as unknown as typeof fetch
}

export function mockLocalStorage() {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) })
  }
}
