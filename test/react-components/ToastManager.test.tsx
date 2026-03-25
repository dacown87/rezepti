import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ToastProvider, useToast } from '../../frontend/src/components/ToastManager'

describe('ToastProvider Component', () => {
  const TestComponent: React.FC = () => {
    const { addToast, removeToast } = useToast()
    
    return (
      <div>
        <button onClick={() => addToast('Success message', 'success')}>Add Success</button>
        <button onClick={() => addToast('Error message', 'error')}>Add Error</button>
        <button onClick={() => addToast('Info message', 'info')}>Add Info</button>
        <button onClick={() => addToast('Loading message', 'loading')}>Add Loading</button>
        <button onClick={() => removeToast('1')}>Remove Toast</button>
      </div>
    )
  }

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
