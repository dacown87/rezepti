/**
 * Job Manager for tracking extraction jobs (in-memory)
 * Jobs are transient and don't need to survive server restarts.
 */

import type { PipelineResult } from "./types.js";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface ExtractionJob {
  id: string;
  url: string;
  status: JobStatus;
  progress: number;
  currentStage?: string;
  message?: string;
  result?: PipelineResult;
  error?: string;
  hint?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  apiKeyHash?: string;
  userAgent?: string;
  userId?: string | null;
}

export interface JobEvent {
  id: string;
  status: JobStatus;
  progress: number;
  currentStage?: string;
  message?: string;
  result?: PipelineResult;
  error?: string;
  hint?: string;
  updatedAt: number;
}

interface JobManagerDependencies {
  now: () => number;
  random: () => number;
}

export class JobManager {
  private static instance: JobManager;
  private jobs = new Map<string, ExtractionJob>();
  private readonly deps: JobManagerDependencies;

  private constructor(deps: JobManagerDependencies = { now: Date.now, random: Math.random }) {
    this.deps = deps;
  }

  static getInstance(): JobManager {
    if (!JobManager.instance) {
      JobManager.instance = new JobManager();
    }
    return JobManager.instance;
  }

  static createTestInstance(deps: Partial<JobManagerDependencies> = {}): JobManager {
    return new JobManager({
      now: deps.now ?? Date.now,
      random: deps.random ?? Math.random,
    });
  }

  createJob(url: string, userAgent?: string, apiKeyHash?: string, userId?: string | null): ExtractionJob {
    const id = `job_${this.deps.now()}_${this.deps.random().toString(36).substring(2, 11)}`;
    const now = this.deps.now();
    const job: ExtractionJob = {
      id, url, status: "pending", progress: 0,
      createdAt: now, updatedAt: now, userAgent, apiKeyHash, userId: userId ?? null,
    };
    this.jobs.set(id, job);
    return job;
  }

  startJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    const now = this.deps.now();
    Object.assign(job, { status: "running", progress: 10, startedAt: now, updatedAt: now });
    return true;
  }

  updateJob(jobId: string, updates: {
    progress?: number;
    currentStage?: string;
    message?: string;
    status?: JobStatus;
  }): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (updates.progress   !== undefined) job.progress     = updates.progress;
    if (updates.currentStage !== undefined) job.currentStage = updates.currentStage;
    if (updates.message    !== undefined) job.message      = updates.message;
    if (updates.status     !== undefined) job.status       = updates.status;
    job.updatedAt = this.deps.now();
    return true;
  }

  completeJob(jobId: string, result: PipelineResult): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    const now = this.deps.now();
    Object.assign(job, { status: "completed", progress: 100, result, completedAt: now, updatedAt: now });
    return true;
  }

  failJob(jobId: string, error: string, hint?: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    const now = this.deps.now();
    Object.assign(job, { status: "failed", progress: 100, error, hint, completedAt: now, updatedAt: now });
    return true;
  }

  getJob(jobId: string): ExtractionJob | null {
    return this.jobs.get(jobId) ?? null;
  }

  getRecentJobs(limit = 50): ExtractionJob[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  getActiveJobs(): ExtractionJob[] {
    return Array.from(this.jobs.values())
      .filter(j => j.status === "pending" || j.status === "running")
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  isUrlProcessing(url: string): boolean {
    for (const job of this.jobs.values()) {
      if (job.url === url && (job.status === "pending" || job.status === "running")) return true;
    }
    return false;
  }

  cleanupOldJobs(daysToKeep = 7): number {
    const cutoff = this.deps.now() - daysToKeep * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const [id, job] of this.jobs) {
      if (job.createdAt < cutoff) { this.jobs.delete(id); count++; }
    }
    return count;
  }

  jobToEvent(job: ExtractionJob): JobEvent {
    return {
      id: job.id, status: job.status, progress: job.progress,
      currentStage: job.currentStage, message: job.message,
      result: job.result, error: job.error, hint: job.hint, updatedAt: job.updatedAt,
    };
  }

  getJobEventsSince(jobId: string, since: number): JobEvent | null {
    const job = this.jobs.get(jobId);
    if (!job || job.updatedAt <= since) return null;
    return this.jobToEvent(job);
  }

  close() { /* no-op for in-memory */ }
}

export const jobManager = JobManager.getInstance();
