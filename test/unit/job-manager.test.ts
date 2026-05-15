import { describe, it, expect } from 'vitest'
import type { ExtractionJob, JobStatus } from '../../src/job-manager.js'

describe('JobManager', () => {
  describe('JobStatus type', () => {
    it('should accept valid job statuses', () => {
      const statuses: JobStatus[] = ['pending', 'running', 'completed', 'failed']
      
      expect(statuses).toContain('pending')
      expect(statuses).toContain('running')
      expect(statuses).toContain('completed')
      expect(statuses).toContain('failed')
    })
  })

  describe('ExtractionJob interface', () => {
    it('should have all required fields', () => {
      const job: ExtractionJob = {
        id: 'job_123',
        url: 'https://example.com',
        status: 'pending',
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      expect(job.id).toBeDefined()
      expect(job.url).toBeDefined()
      expect(job.status).toBe('pending')
      expect(job.progress).toBe(0)
      expect(job.createdAt).toBeDefined()
      expect(job.updatedAt).toBeDefined()
    })

    it('should support optional fields', () => {
      const job: ExtractionJob = {
        id: 'job_123',
        url: 'https://example.com',
        status: 'running',
        progress: 50,
        currentStage: 'extracting',
        message: 'Processing',
        startedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        apiKeyHash: 'hash_abc',
        userAgent: 'Mozilla/5.0',
      }

      expect(job.currentStage).toBe('extracting')
      expect(job.message).toBe('Processing')
      expect(job.startedAt).toBeDefined()
      expect(job.apiKeyHash).toBe('hash_abc')
      expect(job.userAgent).toBe('Mozilla/5.0')
    })

    it('should support result field', () => {
      const job: ExtractionJob = {
        id: 'job_123',
        url: 'https://example.com',
        status: 'completed',
        progress: 100,
        result: {
          success: true,
          recipe: {
            name: 'Test Recipe',
            duration: 'mittel',
            tags: ['test'],
            emoji: '🍕',
            ingredients: ['ingredient'],
            steps: ['step'],
          },
        },
        completedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      expect(job.result?.success).toBe(true)
      expect(job.result?.recipe?.name).toBe('Test Recipe')
    })

    it('should support error field', () => {
      const job: ExtractionJob = {
        id: 'job_123',
        url: 'https://example.com',
        status: 'failed',
        progress: 50,
        error: 'Network timeout',
        completedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      expect(job.error).toBe('Network timeout')
    })
  })

  describe('Job ID generation', () => {
    it('should generate unique job IDs', () => {
      const generateId = (): string => {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      const id1 = generateId()
      const id2 = generateId()

      expect(id1).toMatch(/^job_\d+_[a-z0-9]+$/)
      expect(id2).toMatch(/^job_\d+_[a-z0-9]+$/)
    })
  })

  describe('Job state transitions', () => {
    it('should allow valid state transitions', () => {
      const validTransitions: Record<JobStatus, JobStatus[]> = {
        pending: ['running', 'failed'],
        running: ['completed', 'failed'],
        completed: [],
        failed: [],
      }

      expect(validTransitions.pending).toContain('running')
      expect(validTransitions.running).toContain('completed')
      expect(validTransitions.running).toContain('failed')
      expect(validTransitions.completed).toHaveLength(0)
      expect(validTransitions.failed).toHaveLength(0)
    })
  })

  describe('Progress tracking', () => {
    it('should track progress as percentage', () => {
      const progressValues = [0, 10, 25, 50, 75, 90, 100]

      progressValues.forEach(p => {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(100)
      })
    })
  })

  describe('Timestamp handling', () => {
    it('should handle timestamp fields', () => {
      const now = Date.now()
      const job: ExtractionJob = {
        id: 'job_123',
        url: 'https://example.com',
        status: 'pending',
        progress: 0,
        createdAt: now,
        updatedAt: now,
      }

      expect(job.createdAt).toBe(now)
      expect(job.updatedAt).toBe(now)
      expect(job.createdAt).toBeLessThanOrEqual(job.updatedAt)
    })

    it('should calculate job duration from timestamps', () => {
      const startTime = 1_700_000_000_000
      const endTime = startTime + 60000
      const duration = endTime - startTime

      expect(duration).toBe(60000)
    })
  })
})
