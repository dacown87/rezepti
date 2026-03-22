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
  currentStage?: 'classifying' | 'fetching' | 'transcribing' | 'analyzing_image' | 'extracting' | 'exporting' | 'done' | 'error'
  message?: string
  result?: any
  error?: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
}

// In-memory job storage (simple for now, can be persisted later)
const jobs = new Map<string, ReactJob>

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
      // Process the URL through the pipeline with React DB option
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
              // Save to React database - use job.result for proper display
              const recipeId = DatabaseManager.saveRecipe(
                data.recipe,
                job.url,
                undefined, // transcript
                'react'
              )
              job.result = { 
                success: true,
                recipe: data.recipe,
                recipeId 
              }
            }
          } catch (error) {
            console.error('Failed to save recipe to React DB:', error)
          }
        }
      }, 'react')
    } catch (error) {
      job.status = 'failed'
      job.progress = 100
      job.currentStage = 'error'
      job.message = error instanceof Error ? error.message : 'Unknown error'
      job.error = job.message
      job.completedAt = new Date().toISOString()
      job.updatedAt = new Date().toISOString()
      throw error
    }

    // Mark job as completed
    job.status = 'completed'
    job.progress = 100
    job.currentStage = 'done'
    job.message = 'Fertig!'
    job.completedAt = new Date().toISOString()
    job.updatedAt = new Date().toISOString()
  }

  static getAllJobs(): ReactJob[] {
    return Array.from(jobs.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  static deleteJob(jobId: string): boolean {
    return jobs.delete(jobId)
  }
}