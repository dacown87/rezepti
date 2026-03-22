import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RecipeDetail from './RecipeDetail'
import { ToastProvider } from './ToastManager'
import * as services from '../api/services'
import { mockRecipe } from '../test/mocks'

vi.mock('../api/services', () => ({
  getRecipe: vi.fn(),
  deleteRecipe: vi.fn()
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

describe('RecipeDetail', () => {
  const renderPage = (id = '1') => {
    return render(
      <MemoryRouter initialEntries={[`/recipe/${id}`]}>
        <ToastProvider>
          <Routes>
            <Route path="/recipe/:id" element={<RecipeDetail />} />
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders back button', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe)
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /zurück zu rezepten/i })).toBeInTheDocument()
      })
    })

    it('renders recipe name as heading', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe)
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('Klassische Tomatensuppe')).toBeInTheDocument()
      })
    })

    it('renders recipe emoji', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe)
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('🍅')).toBeInTheDocument()
      })
    })

    it('renders Zutaten section', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe)
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /zutaten/i })).toBeInTheDocument()
      })
    })

    it('renders Zubereitung section', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe)
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /zubereitung/i })).toBeInTheDocument()
      })
    })
  })

  describe('Recipe Data Display', () => {
    it('displays all ingredients', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe)
      renderPage()
      
      await waitFor(() => {
        mockRecipe.ingredients.forEach(ingredient => {
          expect(screen.getByText(ingredient)).toBeInTheDocument()
        })
      })
    })

    it('displays all steps with numbers', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe)
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument()
        mockRecipe.steps.forEach(step => {
          expect(screen.getByText(step)).toBeInTheDocument()
        })
      })
    })

    it('displays duration, servings, and calories', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe)
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('30 min')).toBeInTheDocument()
        expect(screen.getByText('250 kcal')).toBeInTheDocument()
      })
    })

    it('displays recipe image when available', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe)
      renderPage()
      
      await waitFor(() => {
        const img = screen.getByAltText('Klassische Tomatensuppe') as HTMLImageElement
        expect(img).toBeInTheDocument()
        expect(img.src).toBe(mockRecipe.imageUrl)
      })
    })

    it('handles missing image gracefully', async () => {
      const recipeWithoutImage = { ...mockRecipe, imageUrl: undefined }
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(recipeWithoutImage)
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText(mockRecipe.name)).toBeInTheDocument()
      })
    })
  })

  describe('Error States', () => {
    it('displays error message when recipe not found', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Recipe not found')
      )
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText(/nicht gefunden/i)).toBeInTheDocument()
      })
    })

    it('shows link to recipes when error occurs', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Error')
      )
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /zurück zur übersicht/i })).toBeInTheDocument()
      })
    })
  })

  describe('User Interactions', () => {
    it('delete button exists after recipe loads', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe)
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /löschen/i })).toBeInTheDocument()
      })
    })
  })

  describe('Mock API Calls', () => {
    it('fetches recipe on mount with correct ID', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe)
      renderPage('123')
      
      await waitFor(() => {
        expect(services.getRecipe).toHaveBeenCalledWith(123)
      })
    })
  })

  describe('Notes Section', () => {
    it('displays notes section', async () => {
      ;(services.getRecipe as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipe)
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('Hinweise')).toBeInTheDocument()
      })
    })
  })
})
