import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ExtractionPage from './ExtractionPage'
import { ToastProvider } from './ToastManager'
import * as services from '../api/services'
import { mockJobStatus, mockPendingJobStatus, mockFailedJobStatus } from '../test/mocks'

vi.mock('../api/services', () => ({
  startExtraction: vi.fn(),
  pollJobStatus: vi.fn()
}))

const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageMock.store[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageMock.store[key] }),
  clear: vi.fn(() => { localStorageMock.store = {} })
}

describe('ExtractionPage', () => {
  const renderPage = () => {
    return render(
      <MemoryRouter>
        <ToastProvider>
          <ExtractionPage />
        </ToastProvider>
      </MemoryRouter>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    })
  })

  describe('Component Rendering', () => {
    it('renders the main heading', () => {
      renderPage()
      expect(screen.getByText('Rezept extrahieren')).toBeInTheDocument()
    })

    it('renders the URL input field', () => {
      renderPage()
      expect(screen.getByPlaceholderText('https://www.youtube.com/watch?v=...')).toBeInTheDocument()
    })

    it('renders the submit button', () => {
      renderPage()
      expect(screen.getByRole('button', { name: /extrahiere/i })).toBeInTheDocument()
    })

    it('renders all supported platforms', () => {
      renderPage()
      expect(screen.getByText('YouTube')).toBeInTheDocument()
      expect(screen.getByText('Instagram')).toBeInTheDocument()
      expect(screen.getByText('TikTok')).toBeInTheDocument()
      expect(screen.getByText('Webseite')).toBeInTheDocument()
    })

    it('renders BYOK info section', () => {
      renderPage()
      expect(screen.getByText('BYOK Support')).toBeInTheDocument()
    })
  })

  describe('User Input Handling', () => {
    it('allows URL input when not loading', async () => {
      renderPage()
      const input = screen.getByPlaceholderText('https://www.youtube.com/watch?v=...') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=test123' } })
      expect(input.value).toBe('https://www.youtube.com/watch?v=test123')
    })
  })

  describe('Loading States', () => {
    it('shows loading state when submitting form', async () => {
      vi.useFakeTimers()
      ;(services.startExtraction as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('job-123'), 10000))
      )
      
      renderPage()
      
      const input = screen.getByPlaceholderText('https://www.youtube.com/watch?v=...')
      const submitButton = screen.getByRole('button', { name: /extrahiere/i })
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=test' } })
        fireEvent.click(submitButton)
      })
      
      await vi.advanceTimersByTimeAsync(100)
      expect(submitButton).toHaveTextContent(/wird extrahiert/i)
      
      vi.useRealTimers()
    })
  })

  describe('Error States', () => {
    it('displays error message on extraction failure', async () => {
      vi.useFakeTimers()
      ;(services.startExtraction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Netzwerkfehler')
      )
      
      renderPage()
      
      const input = screen.getByPlaceholderText('https://www.youtube.com/watch?v=...')
      const submitButton = screen.getByRole('button', { name: /extrahiere/i })
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=test' } })
        fireEvent.click(submitButton)
      })
      
      await vi.runAllTimersAsync()
      
      expect(screen.getByText(/netzwerkfehler/i)).toBeInTheDocument()
      
      vi.useRealTimers()
    })
  })

  describe('Mock API Calls', () => {
    it('calls startExtraction with correct parameters', async () => {
      vi.useFakeTimers()
      ;(services.startExtraction as ReturnType<typeof vi.fn>).mockResolvedValue('job-123')
      ;(services.pollJobStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockJobStatus)
      
      renderPage()
      
      const input = screen.getByPlaceholderText('https://www.youtube.com/watch?v=...')
      const submitButton = screen.getByRole('button', { name: /extrahiere/i })
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=test' } })
        fireEvent.click(submitButton)
      })
      
      await vi.runAllTimersAsync()
      
      expect(services.startExtraction).toHaveBeenCalledTimes(1)
      
      vi.useRealTimers()
    })

    it('retrieves user API key from localStorage', async () => {
      vi.useFakeTimers()
      ;(services.startExtraction as ReturnType<typeof vi.fn>).mockResolvedValue('job-123')
      ;(services.pollJobStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockJobStatus)
      localStorageMock.store['rezepti_groq_key'] = 'user-api-key'
      
      renderPage()
      
      const input = screen.getByPlaceholderText('https://www.youtube.com/watch?v=...')
      const submitButton = screen.getByRole('button', { name: /extrahiere/i })
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=test' } })
        fireEvent.click(submitButton)
      })
      
      await vi.runAllTimersAsync()
      
      expect(services.startExtraction).toHaveBeenCalledWith('https://www.youtube.com/watch?v=test', 'user-api-key')
      
      vi.useRealTimers()
    })
  })
})
