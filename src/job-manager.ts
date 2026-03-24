/**
 * Job Manager for tracking extraction jobs
 * Provides persistence for job state across server restarts
 */

import type Database from "better-sqlite3";
import BetterSqlite3 from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";
import type { PipelineResult } from "./types.js";

/**
 * Job states
 */
export type JobStatus = "pending" | "running" | "completed" | "failed";

/**
 * Job data structure
 */
export interface ExtractionJob {
  id: string;
  url: string;
  status: JobStatus;
  progress: number;
  currentStage?: string;
  message?: string;
  result?: PipelineResult;
  error?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  apiKeyHash?: string; // Hash of BYOK API key for tracking
  userAgent?: string;
}

/**
 * Job event for polling updates
 */
export interface JobEvent {
  id: string;
  status: JobStatus;
  progress: number;
  currentStage?: string;
  message?: string;
  result?: PipelineResult;
  error?: string;
  updatedAt: number;
}

/**
 * Job Manager with SQLite persistence
 */
export class JobManager {
  private static instance: JobManager;
  private db: BetterSqlite3.Database;

  // Pre-compiled statements for performance
  private stmtInsert!: BetterSqlite3.Statement;
  private stmtGetById!: BetterSqlite3.Statement;
  private stmtStart!: BetterSqlite3.Statement;
  private stmtComplete!: BetterSqlite3.Statement;
  private stmtFail!: BetterSqlite3.Statement;
  private stmtIsProcessing!: BetterSqlite3.Statement;
  private stmtRecentJobs!: BetterSqlite3.Statement;
  private stmtActiveJobs!: BetterSqlite3.Statement;
  private stmtCleanup!: BetterSqlite3.Statement;
  private stmtGetUpdatedAt!: BetterSqlite3.Statement;

  private constructor() {
    this.db = this.openDb();
    this.ensureSchema();
    this.prepareStatements();
  }
  
  static getInstance(): JobManager {
    if (!JobManager.instance) {
      JobManager.instance = new JobManager();
    }
    return JobManager.instance;
  }
  
  private openDb() {
    const path = config.sqlite.reactPath;
    mkdirSync(dirname(path), { recursive: true });
    const sqlite = new BetterSqlite3(path);
    sqlite.pragma("journal_mode = WAL");
    return sqlite;
  }
  
  private ensureSchema() {
    // Create jobs table if not exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS extraction_jobs (
        id            TEXT PRIMARY KEY,
        url           TEXT NOT NULL,
        status        TEXT NOT NULL,
        progress      INTEGER NOT NULL DEFAULT 0,
        current_stage TEXT,
        message       TEXT,
        result        TEXT,
        error         TEXT,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL,
        started_at    INTEGER,
        completed_at  INTEGER,
        api_key_hash  TEXT,
        user_agent    TEXT
      )
    `);
    
    // Create index for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status 
      ON extraction_jobs(status, updated_at)
    `);
    
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_extraction_jobs_created 
      ON extraction_jobs(created_at DESC)
    `);
    
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_extraction_jobs_url
      ON extraction_jobs(url)
    `);
  }

  private prepareStatements() {
    this.stmtInsert = this.db.prepare(`
      INSERT INTO extraction_jobs (
        id, url, status, progress, created_at, updated_at,
        user_agent, api_key_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.stmtGetById = this.db.prepare(
      `SELECT * FROM extraction_jobs WHERE id = ?`
    );
    this.stmtStart = this.db.prepare(`
      UPDATE extraction_jobs
      SET status = ?, progress = ?, started_at = ?, updated_at = ?
      WHERE id = ?
    `);
    this.stmtComplete = this.db.prepare(`
      UPDATE extraction_jobs
      SET status = ?, progress = ?, result = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `);
    this.stmtFail = this.db.prepare(`
      UPDATE extraction_jobs
      SET status = ?, progress = ?, error = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `);
    this.stmtIsProcessing = this.db.prepare(`
      SELECT id FROM extraction_jobs
      WHERE url = ? AND status IN ('pending', 'running')
      LIMIT 1
    `);
    this.stmtRecentJobs = this.db.prepare(`
      SELECT * FROM extraction_jobs ORDER BY created_at DESC LIMIT ?
    `);
    this.stmtActiveJobs = this.db.prepare(`
      SELECT * FROM extraction_jobs
      WHERE status IN ('pending', 'running')
      ORDER BY created_at ASC
    `);
    this.stmtCleanup = this.db.prepare(`
      DELETE FROM extraction_jobs WHERE created_at < ?
    `);
    this.stmtGetUpdatedAt = this.db.prepare(
      `SELECT updated_at FROM extraction_jobs WHERE id = ?`
    );
  }
  
  /**
   * Create a new extraction job
   */
  createJob(
    url: string,
    userAgent?: string,
    apiKeyHash?: string
  ): ExtractionJob {
    const id = this.generateJobId();
    const now = Date.now();
    
    const job: ExtractionJob = {
      id,
      url,
      status: "pending",
      progress: 0,
      createdAt: now,
      updatedAt: now,
      userAgent,
      apiKeyHash,
    };
    
    this.stmtInsert.run(
      job.id,
      job.url,
      job.status,
      job.progress,
      job.createdAt,
      job.updatedAt,
      job.userAgent || null,
      job.apiKeyHash || null
    );
    
    return job;
  }
  
  /**
   * Start a job (transition from pending to running)
   */
  startJob(jobId: string): boolean {
    const now = Date.now();
    const result = this.stmtStart.run("running", 10, now, now, jobId);
    return result.changes > 0;
  }
  
  /**
   * Update job progress and stage
   */
  updateJob(
    jobId: string,
    updates: {
      progress?: number;
      currentStage?: string;
      message?: string;
      status?: JobStatus;
    }
  ): boolean {
    const updateValues: string[] = [];
    const params: (string | number)[] = [];
    
    if (updates.progress !== undefined) {
      updateValues.push("progress = ?");
      params.push(updates.progress);
    }
    
    if (updates.currentStage !== undefined) {
      updateValues.push("current_stage = ?");
      params.push(updates.currentStage);
    }
    
    if (updates.message !== undefined) {
      updateValues.push("message = ?");
      params.push(updates.message);
    }
    
    if (updates.status !== undefined) {
      updateValues.push("status = ?");
      params.push(updates.status);
    }
    
    if (updateValues.length === 0) {
      return false;
    }
    
    updateValues.push("updated_at = ?");
    params.push(Date.now());
    
    params.push(jobId);
    
    const sql = `
      UPDATE extraction_jobs 
      SET ${updateValues.join(", ")}
      WHERE id = ?
    `;
    
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return result.changes > 0;
  }
  
  /**
   * Complete a job with success result
   */
  completeJob(jobId: string, result: PipelineResult): boolean {
    const now = Date.now();
    const update = this.stmtComplete.run("completed", 100, JSON.stringify(result), now, now, jobId);
    return update.changes > 0;
  }

  /**
   * Fail a job with error
   */
  failJob(jobId: string, error: string): boolean {
    const now = Date.now();
    const update = this.stmtFail.run("failed", 100, error, now, now, jobId);
    return update.changes > 0;
  }
  
  /**
   * Get job by ID
   */
  getJob(jobId: string): ExtractionJob | null {
    const row = this.stmtGetById.get(jobId) as any;
    return row ? this.deserializeJob(row) : null;
  }

  /**
   * Get recent jobs (for admin/cleanup)
   */
  getRecentJobs(limit = 50): ExtractionJob[] {
    const rows = this.stmtRecentJobs.all(limit) as any[];
    return rows.map(row => this.deserializeJob(row));
  }

  /**
   * Cleanup old jobs (retain for 7 days)
   */
  cleanupOldJobs(daysToKeep = 7): number {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const result = this.stmtCleanup.run(cutoff);
    return result.changes;
  }
  
  /**
   * Convert job to event format for polling
   */
  jobToEvent(job: ExtractionJob): JobEvent {
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
      message: job.message,
      result: job.result,
      error: job.error,
      updatedAt: job.updatedAt,
    };
  }
  
  /**
   * Get job events since timestamp (for polling updates)
   */
  getJobEventsSince(jobId: string, since: number): JobEvent | null {
    // Lightweight check before fetching full row
    const ts = this.stmtGetUpdatedAt.get(jobId) as { updated_at: number } | undefined;
    if (!ts || ts.updated_at <= since) return null;

    const job = this.getJob(jobId);
    return job ? this.jobToEvent(job) : null;
  }
  
  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
  
  /**
   * Deserialize database row to ExtractionJob
   */
  private deserializeJob(row: any): ExtractionJob {
    return {
      id: row.id,
      url: row.url,
      status: row.status as JobStatus,
      progress: row.progress,
      currentStage: row.current_stage || undefined,
      message: row.message || undefined,
      result: row.result ? JSON.parse(row.result) as PipelineResult : undefined,
      error: row.error || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
      apiKeyHash: row.api_key_hash || undefined,
      userAgent: row.user_agent || undefined,
    };
  }
  
  /**
   * Get active jobs (running or pending)
   */
  getActiveJobs(): ExtractionJob[] {
    const rows = this.stmtActiveJobs.all() as any[];
    return rows.map(row => this.deserializeJob(row));
  }

  /**
   * Check if URL is already being processed
   */
  isUrlProcessing(url: string): boolean {
    const result = this.stmtIsProcessing.get(url) as any;
    return !!result;
  }
  
  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

/**
 * Create default instance for singleton access
 */
export const jobManager = JobManager.getInstance();