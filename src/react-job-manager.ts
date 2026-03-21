/**
 * React Job Manager - Simplified job tracking for polling-based extraction
 */

import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { processURL } from './pipeline.js'
import { DatabaseManager } from './db-manager.js'
import type { PipelineEvent, RecipeData } from './types.js'

export interface ReactJob {
  id: string
  url: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  currentStage?: string
  message?: string
  result?: any
  error?: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
}

// In-memory job storage (simple for now, can be persisted later)
const jobs = new Map<string, ReactJob>()

export class ReactJobManager {
  static createJob(url: string): string {
    const jobId = `react_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()
    
    const job: ReactJob = {
      id: jobId,
      url,
      status: 'pending',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    }
    
    jobs.set(jobId, job)
    return jobId
  }

  static getJob(jobId: string): ReactJob | null {
    return jobs.get(jobId) || null
  }

  static async processJob(jobId: string) {
    const job = jobs.get(jobId)
    if (!job) {
      throw new Error(`Job ${jobId} not found`)
    }

    // Update job to processing
    job.status = 'processing'
    job.startedAt = new Date().toISOString()
    job.updatedAt = new Date().toISOString()

    try {
      // Process the URL through the pipeline
      await processURL(job.url, async (event: PipelineEvent) => {
        // Update job progress based on pipeline stage
        const stageProgress: Record<string, number> = {
          'classifying': 10,
          'fetching': 25,
          'transcribing': 45,
          'analyzing_image': 65,
          'extracting': 85,
          'exporting': 95,
          'done': 100
        }

        job.progress = stageProgress[event.stage] || job.progress
        job.currentStage = event.stage
        job.message = event.message
        job.updatedAt = new Date().toISOString()

        // Check for extraction result in data
        if (event.stage === 'exporting' && event.data) {
          try {
            const data = event.data as { recipe?: RecipeData; recipeId?: number }
            if (data.recipe) {
              // Save to React database
              const recipeId = DatabaseManager.saveRecipe(
                data.recipe,
                job.url,
                undefined, // transcript
                'react'
              )
              job.result = { recipeId, ...data.recipe }
            }
          } catch (error) {
            console.error('Failed to save recipe to React DB:', error)
          }
        }

        // Handle completion
        if (event.stage === 'done') {
          job.status = 'completed'
          job.progress = 100
          job.completedAt = new Date().toISOString()
        }

        // Handle errors
        if (event.stage === 'error') {
          job.status = 'failed'
          job.error = event.message
          job.completedAt = new Date().toISOString()
        }
      })

    } catch (error) {
      console.error(`Job ${jobId} processing failed:`, error)
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Unknown error'
      job.completedAt = new Date().toISOString()
    }

    // Cleanup old jobs periodically
    ReactJobManager.cleanupOldJobs()
  }

  static updateJob(jobId: string, updates: Partial<Omit<ReactJob, 'id' | 'createdAt'>>) {
    const job = jobs.get(jobId)
    if (!job) return

    Object.assign(job, updates, {
      updatedAt: new Date().toISOString()
    })
  }

  static cleanupOldJobs(maxAgeMinutes: number = 60) {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString()
    
    for (const [jobId, job] of jobs) {
      if (job.createdAt < cutoff && (job.status === 'completed' || job.status === 'failed')) {
        jobs.delete(jobId)
      }
    }
  }
}

// Start cleanup on interval
setInterval(() => {
  ReactJobManager.cleanupOldJobs()
}, 15 * 60 * 1000) // Cleanup every 15 minutes