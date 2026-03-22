#!/usr/bin/env node

// Simple script to check database contents
const fs = require('fs');
const path = require('path');

const legacyDb = path.join(__dirname, 'data', 'rezepti.db');
const reactDb = path.join(__dirname, 'data', 'rezepti-react.db');

console.log('Checking database files...');
console.log(`Legacy DB exists: ${fs.existsSync(legacyDb)} (${fs.statSync(legacyDb).size} bytes)`);
console.log(`React DB exists: ${fs.existsSync(reactDb)} (${fs.statSync(reactDb).size} bytes)`);

// Try to read some data from the React database by querying the API
const fetch = require('node-fetch');

async function checkApi() {
  try {
    console.log('\nChecking API endpoints...');
    
    // Check health
    const health = await fetch('http://localhost:3000/api/v1/health');
    const healthData = await health.json();
    console.log('React health:', healthData);
    
    // Check recipes
    const recipes = await fetch('http://localhost:3000/api/v1/recipes');
    const recipesData = await recipes.json();
    console.log(`Recipes in React DB: ${recipesData.length}`);
    
    if (recipesData.length > 0) {
      console.log('Sample recipe:', {
        id: recipesData[0].id,
        title: recipesData[0].name,
        source: recipesData[0].source_url
      });
    }
    
    // Check jobs
    const jobs = await fetch('http://localhost:3000/api/v1/extract/jobs?limit=3');
    const jobsData = await jobs.json();
    console.log(`\nRecent jobs: ${jobsData.jobs?.length || 0}`);
    if (jobsData.jobs && jobsData.jobs.length > 0) {
      jobsData.jobs.forEach(job => {
        console.log(`- ${job.id}: ${job.status} (${job.url})`);
      });
    }
    
  } catch (error) {
    console.error('Error checking API:', error.message);
  }
}

checkApi();