import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RecipeList from './RecipeList'
import { ToastProvider } from './ToastManager'
import * as services from '../api/services'
import { mockRecipes, mockRecipe } from '../test/mocks'

vi.mock('../api/services', () => ({
  getRecipes: vi.fn()
}))

describe('RecipeList', () => {
  const renderPage = () => {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<RecipeList />} />
            <Route path="/extract" element={<div>Extract Page</div>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders the main heading', async () => {
      ;(services.getRecipes as ReturnType<typeof vi.fn>).mockResolvedValue([])
      renderPage()
      expect(screen.getByText('Deine Rezepte')).toBeInTheDocument()
    })

    it('renders the refresh button', async () => {
      ;(services.getRecipes as ReturnType<typeof vi.fn>).mockResolvedValue([])
      renderPage()
      expect(screen.getByRole('button', { name: /aktualisieren/i })).toBeInTheDocument()
    })

    it('shows migration banner', async () => {
      ;(services.getRecipes as ReturnType<typeof vi.fn>).mockResolvedValue([])
      renderPage()
      expect(screen.getByText('React Migration läuft!')).toBeInTheDocument()
    })
  })

  describe('Recipe List Display', () => {
    it('displays all recipes when data is available', async () => {
      ;(services.getRecipes as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecipes)
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('Klassische Tomatensuppe')).toBeInTheDocument()
        expect(screen.getByText('Spaghetti Carbonara')).toBeInTheDocument()
        expect(screen.getByText('Avocado Toast mit Ei')).toBeInTheDocument()
      })
    })

    it('displays recipe emoji for each recipe', async () => {
      ;(services.getRecipes as ReturnType<typeof vi.fn>).mockResolvedValue([mockRecipe])
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('🍅')).toBeInTheDocument()
      })
    })

    it('displays recipe tags', async () => {
      ;(services.getRecipes as ReturnType<typeof vi.fn>).mockResolvedValue([mockRecipe])
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('Suppe')).toBeInTheDocument()
        expect(screen.getByText('Vegetarisch')).toBeInTheDocument()
      })
    })

    it('displays recipe metadata', async () => {
      ;(services.getRecipes as ReturnType<typeof vi.fn>).mockResolvedValue([mockRecipe])
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('30 min')).toBeInTheDocument()
        expect(screen.getByText('4')).toBeInTheDocument()
        expect(screen.getByText('250')).toBeInTheDocument()
      })
    })
  })

  describe('Empty State', () => {
    it('shows empty state when no recipes available', async () => {
      ;(services.getRecipes as ReturnType<typeof vi.fn>).mockResolvedValue([])
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('Keine Rezepte')).toBeInTheDocument()
      })
    })

    it('shows link to extract page in empty state', async () => {
      ;(services.getRecipes as ReturnType<typeof vi.fn>).mockResolvedValue([])
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /rezept extrahieren/i })).toBeInTheDocument()
      })
    })
  })

  describe('Error States', () => {
    it('shows retry option when API fails', async () => {
      ;(services.getRecipes as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Server error')
      )
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText(/erneut versuchen/i)).toBeInTheDocument()
      })
    })
  })

  describe('User Interactions', () => {
    it('refresh button is clickable', async () => {
      ;(services.getRecipes as ReturnType<typeof vi.fn>).mockResolvedValue([])
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /aktualisieren/i })).toBeInTheDocument()
      })
      
      const refreshButton = screen.getByRole('button', { name: /aktualisieren/i })
      fireEvent.click(refreshButton)
      
      expect(services.getRecipes).toHaveBeenCalled()
    })
  })

  describe('Mock API Calls', () => {
    it('fetches recipes on mount', () => {
      ;(services.getRecipes as ReturnType<typeof vi.fn>).mockResolvedValue([])
      renderPage()
      expect(services.getRecipes).toHaveBeenCalledTimes(1)
    })
  })
})
