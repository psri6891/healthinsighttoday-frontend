#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Color codes for console logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Helper functions for logging
function logInfo(message) {
  console.log(`${colors.bright}${colors.blue}[INFO]${colors.reset} ${message}`);
}

function logError(message) {
  console.log(`${colors.bright}${colors.red}[ERROR]${colors.reset} ${message}`);
}

// Check if server.js exists
const serverPath = path.join(__dirname, 'server.js');
if (!fs.existsSync(serverPath)) {
  logError('server.js not found! Please make sure the file exists in the same directory.');
  process.exit(1);
}

logInfo('Starting HealthInsightToday local development server...');

// Start the server process
const serverProcess = spawn('node', [serverPath], { stdio: 'inherit' });

// Handle errors
serverProcess.on('error', (err) => {
  logError(`Failed to start server: ${err.message}`);
  process.exit(1);
});

// Handle process exit
serverProcess.on('close', (code) => {
  if (code !== 0) {
    logError(`Server process exited with code ${code}`);
  }
});