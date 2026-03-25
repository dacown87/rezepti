import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToastProvider, useToast } from './ToastManager'

describe('ToastProvider Component', () => {
  describe('Rendering', () => {
    it('renders children correctly', () => {
      render(
        <ToastProvider>
          <div data-testid="child">Child Content</div>
        </ToastProvider>
      )
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('renders toast container', () => {
      const { container } = render(
        <ToastProvider>
          <div>Content</div>
        </ToastProvider>
      )
      expect(container.querySelector('.fixed')).toBeInTheDocument()
    })

    it('does not render toasts initially', () => {
      render(
        <ToastProvider>
          <div>Content</div>
        </ToastProvider>
      )
      expect(screen.queryByText(/message/)).not.toBeInTheDocument()
    })
  })

  describe('useToast Hook', () => {
    it('throws error when used outside ToastProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const InvalidComponent = () => {
        useToast()
        return null
      }
      
      expect(() => render(<InvalidComponent />)).toThrow('useToast must be used within ToastProvider')
      
      consoleError.mockRestore()
    })
  })

  describe('Toast Types Styling', () => {
    it('renders success toasts container', () => {
      const SuccessToast = () => {
        const { addToast } = useToast()
        return <button onClick={() => addToast('Success', 'success', 100000)}>Add</button>
      }
      
      const { container } = render(
        <ToastProvider>
          <SuccessToast />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Add'))
      
      const toast = container.querySelector('.rounded-lg')
      expect(toast).toBeInTheDocument()
    })
  })
})

