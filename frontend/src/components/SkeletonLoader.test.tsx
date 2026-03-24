import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import SkeletonLoader, { 
  RecipeListSkeleton, 
  RecipeDetailSkeleton, 
  ExtractionProgressSkeleton,
  SettingsCardSkeleton 
} from './SkeletonLoader'

describe('SkeletonLoader Component', () => {
  describe('Rendering', () => {
    it('renders single card skeleton by default', () => {
      render(<SkeletonLoader />)
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('renders with custom className', () => {
      const { container } = render(<SkeletonLoader className="custom-class" />)
      expect(container.querySelector('.custom-class')).toBeInTheDocument()
    })

    it('renders multiple skeletons when count > 1', () => {
      const { container } = render(<SkeletonLoader count={3} />)
      const skeletons = container.querySelectorAll('.rounded-xl')
      expect(skeletons.length).toBe(3)
    })
  })

  describe('Card Type', () => {
    it('renders card skeleton with image placeholder', () => {
      const { container } = render(<SkeletonLoader type="card" />)
      expect(container.querySelector('.h-48')).toBeInTheDocument()
    })

    it('renders card skeleton with title placeholder', () => {
      const { container } = render(<SkeletonLoader type="card" />)
      expect(container.querySelector('.h-6')).toBeInTheDocument()
    })

    it('renders card skeleton with text placeholders', () => {
      const { container } = render(<SkeletonLoader type="card" />)
      expect(container.querySelector('.h-4')).toBeInTheDocument()
    })

    it('renders card skeleton with button placeholders', () => {
      const { container } = render(<SkeletonLoader type="card" />)
      const buttons = container.querySelectorAll('.h-10')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('renders multiple card skeletons', () => {
      const { container } = render(<SkeletonLoader type="card" count={3} />)
      const cardElements = container.querySelectorAll('.rounded-xl')
      expect(cardElements.length).toBe(3)
    })
  })

  describe('Text Type', () => {
    it('renders text skeleton with text lines', () => {
      const { container } = render(<SkeletonLoader type="text" />)
      const lines = container.querySelectorAll('.h-4')
      expect(lines.length).toBeGreaterThan(0)
    })

    it('renders text skeleton with rounded lines', () => {
      const { container } = render(<SkeletonLoader type="text" />)
      expect(container.querySelector('.rounded')).toBeInTheDocument()
    })

    it('renders multiple text skeletons', () => {
      const { container } = render(<SkeletonLoader type="text" count={2} />)
      const textElements = container.querySelectorAll('.space-y-2')
      expect(textElements.length).toBe(2)
    })
  })

  describe('Circle Type', () => {
    it('renders circle skeleton with rounded-full class', () => {
      const { container } = render(<SkeletonLoader type="circle" />)
      expect(container.querySelector('.rounded-full')).toBeInTheDocument()
    })

    it('renders multiple circle skeletons', () => {
      const { container } = render(<SkeletonLoader type="circle" count={4} />)
      const circles = container.querySelectorAll('.rounded-full')
      expect(circles.length).toBe(4)
    })
  })

  describe('Rectangle Type', () => {
    it('renders rectangle skeleton', () => {
      const { container } = render(<SkeletonLoader type="rectangle" />)
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('renders multiple rectangle skeletons', () => {
      const { container } = render(<SkeletonLoader type="rectangle" count={2} />)
      const rectangles = container.querySelectorAll('.rounded')
      expect(rectangles.length).toBe(2)
    })
  })
})

describe('RecipeListSkeleton Component', () => {
  it('renders grid layout', () => {
    const { container } = render(<RecipeListSkeleton />)
    expect(container.querySelector('.grid')).toBeInTheDocument()
  })

  it('renders 3 card skeletons in grid', () => {
    const { container } = render(<RecipeListSkeleton />)
    const grid = container.querySelector('.grid')
    const cards = grid?.querySelectorAll('.rounded-xl')
    expect(cards?.length).toBe(3)
  })

  it('has responsive grid columns', () => {
    const { container } = render(<RecipeListSkeleton />)
    expect(container.querySelector('.grid-cols-1')).toBeInTheDocument()
    expect(container.querySelector('[class*="grid-cols-2"]')).toBeInTheDocument()
    expect(container.querySelector('[class*="grid-cols-3"]')).toBeInTheDocument()
  })

  it('renders with gap spacing', () => {
    const { container } = render(<RecipeListSkeleton />)
    expect(container.querySelector('.gap-6')).toBeInTheDocument()
  })
})

describe('RecipeDetailSkeleton Component', () => {
  it('renders in max-width container', () => {
    const { container } = render(<RecipeDetailSkeleton />)
    expect(container.querySelector('.max-w-4xl')).toBeInTheDocument()
  })

  it('renders centered layout', () => {
    const { container } = render(<RecipeDetailSkeleton />)
    expect(container.querySelector('.mx-auto')).toBeInTheDocument()
  })

  it('renders large image placeholder', () => {
    const { container } = render(<RecipeDetailSkeleton />)
    const imagePlaceholder = container.querySelector('[class*="h-64"], [class*="h-80"]')
    expect(imagePlaceholder).toBeInTheDocument()
  })

  it('renders author info placeholder', () => {
    const { container } = render(<RecipeDetailSkeleton />)
    const authorCircle = container.querySelector('[class*="h-12"], [class*="w-12"]')
    expect(authorCircle).toBeInTheDocument()
  })

  it('renders stats placeholders (3 columns)', () => {
    const { container } = render(<RecipeDetailSkeleton />)
    const statsSection = container.querySelector('.grid-cols-3')
    expect(statsSection).toBeInTheDocument()
  })

  it('renders action buttons', () => {
    const { container } = render(<RecipeDetailSkeleton />)
    const buttons = container.querySelectorAll('[class*="h-12"]')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('renders section headers', () => {
    const { container } = render(<RecipeDetailSkeleton />)
    const headers = container.querySelectorAll('[class*="h-6"]')
    expect(headers.length).toBeGreaterThanOrEqual(2)
  })

  it('renders content sections with text lines', () => {
    const { container } = render(<RecipeDetailSkeleton />)
    const textLines = container.querySelectorAll('[class*="h-4"]')
    expect(textLines.length).toBeGreaterThan(0)
  })

  it('renders with proper spacing', () => {
    const { container } = render(<RecipeDetailSkeleton />)
    expect(container.querySelector('.space-y-6')).toBeInTheDocument()
  })
})

describe('ExtractionProgressSkeleton Component', () => {
  it('renders progress bar placeholder', () => {
    const { container } = render(<ExtractionProgressSkeleton />)
    expect(container.querySelector('.h-2')).toBeInTheDocument()
  })

  it('renders progress bar with rounded-full', () => {
    const { container } = render(<ExtractionProgressSkeleton />)
    expect(container.querySelector('.rounded-full')).toBeInTheDocument()
  })

  it('renders flex layout for status text', () => {
    const { container } = render(<ExtractionProgressSkeleton />)
    expect(container.querySelector('.flex')).toBeInTheDocument()
  })

  it('renders justify-between for status positions', () => {
    const { container } = render(<ExtractionProgressSkeleton />)
    expect(container.querySelector('.justify-between')).toBeInTheDocument()
  })

  it('renders status text placeholders', () => {
    const { container } = render(<ExtractionProgressSkeleton />)
    const textPlaceholders = container.querySelectorAll('.h-4')
    expect(textPlaceholders.length).toBe(2)
  })
})

describe('SettingsCardSkeleton Component', () => {
  it('renders card container', () => {
    const { container } = render(<SettingsCardSkeleton />)
    expect(container.querySelector('.bg-white')).toBeInTheDocument()
  })

  it('renders rounded card', () => {
    const { container } = render(<SettingsCardSkeleton />)
    expect(container.querySelector('.rounded-2xl')).toBeInTheDocument()
  })

  it('renders with shadow', () => {
    const { container } = render(<SettingsCardSkeleton />)
    expect(container.querySelector('.shadow-lg')).toBeInTheDocument()
  })

  it('renders header section with icon placeholder', () => {
    const { container } = render(<SettingsCardSkeleton />)
    const headerIcon = container.querySelector('[class*="h-6"], [class*="w-16"]')
    expect(headerIcon).toBeInTheDocument()
  })

  it('renders form field placeholders', () => {
    const { container } = render(<SettingsCardSkeleton />)
    const fields = container.querySelectorAll('.h-12')
    expect(fields.length).toBeGreaterThan(0)
  })

  it('renders text line placeholders', () => {
    const { container } = render(<SettingsCardSkeleton />)
    expect(container.querySelector('.h-4')).toBeInTheDocument()
  })

  it('renders textarea placeholder', () => {
    const { container } = render(<SettingsCardSkeleton />)
    expect(container.querySelector('.h-24')).toBeInTheDocument()
  })

  it('renders with proper padding', () => {
    const { container } = render(<SettingsCardSkeleton />)
    expect(container.querySelector('.p-6')).toBeInTheDocument()
  })
})

describe('Accessibility', () => {
  it('skeleton loaders use proper semantic structure', () => {
    const { container } = render(<SkeletonLoader type="text" />)
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  it('skeleton components include animation classes', () => {
    const { container } = render(<SkeletonLoader />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})

describe('Edge Cases', () => {
  it('handles count of 0 gracefully', () => {
    const { container } = render(<SkeletonLoader count={0} />)
    expect(container.querySelectorAll('.rounded-xl').length).toBe(0)
  })

  it('handles negative count gracefully', () => {
    const { container } = render(<SkeletonLoader count={-1} />)
    expect(container).toBeInTheDocument()
  })

  it('handles large count without crashing', () => {
    const { container } = render(<SkeletonLoader count={100} />)
    expect(container).toBeInTheDocument()
  })

  it('handles empty className', () => {
    const { container } = render(<SkeletonLoader className="" />)
    expect(container).toBeInTheDocument()
  })
})
