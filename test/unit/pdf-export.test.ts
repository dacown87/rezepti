import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn().mockReturnValue(['line1', 'line2']),
    internal: { pageSize: { getWidth: () => 210 } },
    addPage: vi.fn(),
  })),
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
  },
}))

describe('pdf-export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should exist and be importable', async () => {
    const { shareRecipePDF } = await import('../../mobile/utils/pdf-export.web.js')
    expect(shareRecipePDF).toBeDefined()
  })
})