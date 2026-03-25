import React from 'react'

interface SkeletonLoaderProps {
  type?: 'card' | 'text' | 'circle' | 'rectangle'
  className?: string
  count?: number
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ 
  type = 'card', 
  className = '', 
  count = 1 
}) => {
  const elements = Array.from({ length: count }, (_, i) => i)

  if (type === 'card') {
    return (
      <>
        {elements.map((i) => (
          <div 
            key={i} 
            className={`bg-gray-200 animate-pulse rounded-xl ${className}`}
          >
            <div className="h-48 bg-gray-300 rounded-t-xl"></div>
            <div className="p-6">
              <div className="h-6 bg-gray-300 rounded mb-4 w-3/4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-300 rounded w-full"></div>
                <div className="h-4 bg-gray-300 rounded w-2/3"></div>
              </div>
              <div className="flex space-x-4 mt-6">
                <div className="h-10 bg-gray-300 rounded-lg flex-1"></div>
                <div className="h-10 bg-gray-300 rounded-lg w-24"></div>
              </div>
            </div>
          </div>
        ))}
      </>
    )
  }

  if (type === 'text') {
    return (
      <>
        {elements.map((i) => (
          <div 
            key={i} 
            className={`bg-gray-200 animate-pulse rounded ${className}`}
          >
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 rounded w-full"></div>
              <div className="h-4 bg-gray-300 rounded w-5/6"></div>
              <div className="h-4 bg-gray-300 rounded w-4/6"></div>
            </div>
          </div>
        ))}
      </>
    )
  }

  if (type === 'circle') {
    return (
      <>
        {elements.map((i) => (
          <div 
            key={i} 
            className={`bg-gray-200 animate-pulse rounded-full ${className}`}
          />
        ))}
      </>
    )
  }

  if (type === 'rectangle') {
    return (
      <>
        {elements.map((i) => (
          <div 
            key={i} 
            className={`bg-gray-200 animate-pulse rounded ${className}`}
          />
        ))}
      </>
    )
  }

  return null
}

// Recipe List Skeleton
export const RecipeListSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <SkeletonLoader type="card" count={3} />
    </div>
  )
}

// Recipe Detail Skeleton
export const RecipeDetailSkeleton: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="h-8 bg-gray-200 animate-pulse rounded w-32"></div>
      
      <div className="bg-white rounded-2xl shadow-lg border border-warmgray/10 overflow-hidden">
        <div className="h-64 md:h-80 bg-gray-200 animate-pulse"></div>
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="h-12 w-12 bg-gray-200 animate-pulse rounded-full"></div>
            <div className="h-8 bg-gray-200 animate-pulse rounded w-48"></div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="h-20 bg-gray-200 animate-pulse rounded-xl"></div>
            <div className="h-20 bg-gray-200 animate-pulse rounded-xl"></div>
            <div className="h-20 bg-gray-200 animate-pulse rounded-xl"></div>
          </div>
          
          <div className="flex space-x-3 mb-8">
            <div className="h-12 bg-gray-200 animate-pulse rounded-lg flex-1"></div>
            <div className="h-12 bg-gray-200 animate-pulse rounded-lg w-32"></div>
          </div>
          
          <div className="space-y-6">
            <div>
              <div className="h-6 bg-gray-200 animate-pulse rounded w-32 mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 animate-pulse rounded w-full"></div>
                <div className="h-4 bg-gray-200 animate-pulse rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 animate-pulse rounded w-4/6"></div>
              </div>
            </div>
            
            <div>
              <div className="h-6 bg-gray-200 animate-pulse rounded w-32 mb-4"></div>
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 animate-pulse rounded w-full"></div>
                <div className="h-4 bg-gray-200 animate-pulse rounded w-full"></div>
                <div className="h-4 bg-gray-200 animate-pulse rounded w-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SkeletonLoader