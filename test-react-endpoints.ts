/**
 * Test script for React API endpoints
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { DatabaseManager } from "./src/db-manager.js";
import { jobManager } from "./src/job-manager.js";
import { BYOKValidator } from "./src/byok-validator.js";

// Create test app
const testApp = new Hono();

// Initialize database
DatabaseManager.ensureSchema("react");

// Test endpoints
testApp.get("/test/health", (c) => {
  return c.json({ 
    status: "ok", 
    timestamp: new Date().toISOString() 
  });
});

testApp.post("/test/job", (c) => {
  const url = "https://example.com/test-recipe";
  const job = jobManager.createJob(url, "Test-Agent");
  
  return c.json({
    success: true,
    jobId: job.id,
    status: job.status,
    message: "Test job created"
  });
});

testApp.get("/test/jobs", (c) => {
  const jobs = jobManager.getRecentJobs(10);
  return c.json({
    total: jobs.length,
    jobs: jobs.map(j => ({
      id: j.id,
      url: j.url,
      status: j.status,
      progress: j.progress
    }))
  });
});

testApp.post("/test/validate", async (c) => {
  const { apiKey } = await c.req.json();
  
  if (!apiKey) {
    return c.json({ 
      error: "API key required",
      testKey: "gsk_test123" // Example format
    }, 400);
  }
  
  const result = await BYOKValidator.validateKey(apiKey);
  
  return c.json({
    valid: result.valid,
    reason: result.reason,
    model: result.model,
    note: "Using test validation - real key will validate with Groq API"
  });
});

// Start test server
const port = 3001;
console.log(`Test server running on http://localhost:${port}`);

serve({
  fetch: testApp.fetch,
  port
});

// Cleanup on exit
process.on("SIGINT", () => {
  console.log("Shutting down test server...");
  jobManager.close();
  process.exit(0);
});