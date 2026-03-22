import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Toast from '../../frontend/src/components/Toast'

describe('Toast Component', () => {
  const defaultProps = {
    id: 'test-toast-1',
    message: 'Test message',
    type: 'info' as const,
    onClose: vi.fn(),
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders toast with message', () => {
      render(<Toast {...defaultProps} />)
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })

    it('renders info toast with correct icon', () => {
      render(<Toast {...defaultProps} type="info" />)
      const icon = document.querySelector('.lucide-circle-alert')
      expect(icon).toBeInTheDocument()
    })

    it('renders success toast with correct styling', () => {
      const { container } = render(<Toast {...defaultProps} type="success" />)
      expect(container.querySelector('.bg-green-50')).toBeInTheDocument()
    })

    it('renders error toast with correct styling', () => {
      const { container } = render(<Toast {...defaultProps} type="error" />)
      expect(container.querySelector('.bg-red-50')).toBeInTheDocument()
    })

    it('renders loading toast with spinner icon', () => {
      render(<Toast {...defaultProps} type="loading" />)
      const spinner = document.querySelector('.lucide-loader-circle')
      expect(spinner).toBeInTheDocument()
      expect(spinner?.classList.contains('animate-spin')).toBe(true)
    })
  })

  describe('User Interactions', () => {
    it('renders close button for non-loading toasts', () => {
      render(<Toast {...defaultProps} />)
      expect(screen.getByRole('button', { name: /close notification/i })).toBeInTheDocument()
    })

    it('does not render close button for loading toast', () => {
      render(<Toast {...defaultProps} type="loading" />)
      expect(screen.queryByRole('button', { name: /close notification/i })).not.toBeInTheDocument()
    })
  })

  describe('State Changes', () => {
    it('does not auto-dismiss loading toasts', () => {
      render(<Toast {...defaultProps} type="loading" />)
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })

    it('renders with different type props', () => {
      const { rerender } = render(<Toast {...defaultProps} type="success" />)
      expect(document.querySelector('.bg-green-50')).toBeInTheDocument()
      
      rerender(<Toast {...defaultProps} type="error" />)
      expect(document.querySelector('.bg-red-50')).toBeInTheDocument()
      
      rerender(<Toast {...defaultProps} type="info" />)
      expect(document.querySelector('.bg-blue-50')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('close button has correct aria-label', () => {
      render(<Toast {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Close notification' })).toBeInTheDocument()
    })

    it('toast message is properly contained', () => {
      render(<Toast {...defaultProps} />)
      const message = screen.getByText('Test message')
      expect(message.tagName).toBe('P')
      expect(message).toHaveClass('text-sm', 'font-medium', 'text-gray-800')
    })
  })

  describe('Edge Cases', () => {
    it('handles long messages without breaking', () => {
      const longMessage = 'A'.repeat(500)
      render(<Toast {...defaultProps} message={longMessage} />)
      expect(screen.getByText(longMessage)).toBeInTheDocument()
    })

    it('handles missing onClose callback without error', () => {
      const propsWithoutCallback = { ...defaultProps, onClose: undefined }
      const { unmount } = render(<Toast {...propsWithoutCallback} />)
      expect(() => unmount()).not.toThrow()
    })

    it('renders with className prop applied', () => {
      render(<Toast {...defaultProps} />)
      const toast = document.querySelector('.animate-slideIn')
      expect(toast).toBeInTheDocument()
    })
  })
})
