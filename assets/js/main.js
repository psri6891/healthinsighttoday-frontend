const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const PORT = 8000;
const PROJECT_NAME = 'HealthInsightToday';
const ROOT_DIR = path.join(__dirname, '../../..'); // Navigate from assets/js to project root

// Color codes for console logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
};

// Helper functions for logging
function logInfo(message) {
  console.log(`${colors.bright}${colors.blue}[INFO]${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.bright}${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

function logWarning(message) {
  console.log(`${colors.bright}${colors.yellow}[WARNING]${colors.reset} ${message}`);
}

function logError(message) {
  console.log(`${colors.bright}${colors.red}[ERROR]${colors.reset} ${message}`);
}

function logRequest(method, url, status, time) {
  let statusColor = colors.green;
  if (status >= 400) statusColor = colors.red;
  else if (status >= 300) statusColor = colors.yellow;
  
  console.log(
    `${colors.dim}[${new Date().toISOString()}]${colors.reset} ` +
    `${colors.cyan}${method}${colors.reset} ` +
    `${url} ` +
    `${statusColor}${status}${colors.reset} ` +
    `${colors.dim}(${time}ms)${colors.reset}`
  );
}

// Print available pages
function listAvailablePages() {
  logInfo('Scanning for HTML pages...');
  
  fs.readdir(ROOT_DIR, (err, files) => {
    if (err) {
      logError(`Could not read directory: ${err.message}`);
      return;
    }
    
    const htmlFiles = files.filter(file => path.extname(file).toLowerCase() === '.html');
    
    if (htmlFiles.length === 0) {
      logWarning('No HTML pages found in the root directory.');
      return;
    }
    
    logInfo('Available pages:');
    htmlFiles.forEach(file => {
      console.log(`  ${colors.cyan}http://localhost:${PORT}/${file}${colors.reset}`);
    });
    
    // Check for specific pages
    if (htmlFiles.includes('index.html')) {
      logSuccess('Home page available at: http://localhost:8000/index.html');
    }
    
    if (htmlFiles.includes('privacy.html')) {
      logSuccess('Privacy Policy available at: http://localhost:8000/privacy.html');
    }
    
    if (htmlFiles.includes('terms.html')) {
      logSuccess('Terms of Service available at: http://localhost:8000/terms.html');
    }
    
    // Check pages directory
    const pagesDir = path.join(ROOT_DIR, 'pages');
    if (fs.existsSync(pagesDir)) {
      fs.readdir(pagesDir, (pagesErr, pagesFiles) => {
        if (!pagesErr && pagesFiles.length > 0) {
          const pagesHtmlFiles = pagesFiles.filter(file => path.extname(file).toLowerCase() === '.html');
          
          if (pagesHtmlFiles.length > 0) {
            logInfo('Pages in /pages directory:');
            pagesHtmlFiles.forEach(file => {
              console.log(`  ${colors.cyan}http://localhost:${PORT}/pages/${file}${colors.reset}`);
            });
          }
        }
        
        console.log('\n' + '-'.repeat(60) + '\n');
      });
    } else {
      console.log('\n' + '-'.repeat(60) + '\n');
    }
  });
}

// Create the server
const server = http.createServer((req, res) => {
  const startTime = Date.now();
  
  // Normalize URL by removing query string and trailing slash
  let url = req.url.split('?')[0];
  if (url.endsWith('/') && url !== '/') {
    url = url.slice(0, -1);
  }
  
  // Handle root URL by serving index.html
  if (url === '/') {
    url = '/index.html';
  }
  
  // Get the file path
  const filePath = path.join(ROOT_DIR, url);
  
  // Get the file extension
  const extname = path.extname(filePath).toLowerCase();
  
  // Default content type
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  // Read file and respond
  fs.readFile(filePath, (err, content) => {
    let statusCode;
    
    if (err) {
      if (err.code === 'ENOENT') {
        // Page not found
        statusCode = 404;
        // Try to find a 404.html file
        const notFoundPath = path.join(ROOT_DIR, '404.html');
        fs.readFile(notFoundPath, (notFoundErr, notFoundContent) => {
          if (notFoundErr) {
            res.writeHead(404);
            res.end('404 - File Not Found');
            logRequest(req.method, url, 404, Date.now() - startTime);
            logError(`Page not found: ${url}`);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(notFoundContent, 'utf-8');
            logRequest(req.method, url, 404, Date.now() - startTime);
            logWarning(`Page not found: ${url} (Served custom 404 page)`);
          }
        });
      } else {
        // Server error
        statusCode = 500;
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
        logRequest(req.method, url, 500, Date.now() - startTime);
        logError(`Server error: ${err.code} - ${err.message}`);
      }
    } else {
      // Success
      statusCode = 200;
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
      logRequest(req.method, url, 200, Date.now() - startTime);
      
      // Provide additional info for HTML pages
      if (extname === '.html') {
        logInfo(`Page visited: ${url}`);
      }
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  logSuccess(`${PROJECT_NAME} Local Server is running!`);
  console.log('='.repeat(60) + '\n');
  
  logInfo(`Server running at: ${colors.cyan}http://localhost:${PORT}/${colors.reset}`);
  console.log('\n' + '-'.repeat(60) + '\n');
  
  // List available pages
  listAvailablePages();
  
  // Try to open browser automatically
  logInfo('Attempting to open browser automatically...');
  let command;
  switch (process.platform) {
    case 'darwin': // macOS
      command = `open http://localhost:${PORT}`;
      break;
    case 'win32': // Windows
      command = `start http://localhost:${PORT}`;
      break;
    default: // Linux and others
      command = `xdg-open http://localhost:${PORT}`;
  }
  
  exec(command, (error) => {
    if (error) {
      logWarning(`Could not open browser automatically: ${error.message}`);
      logInfo(`Please open ${colors.cyan}http://localhost:${PORT}/${colors.reset} in your browser manually.`);
    } else {
      logSuccess('Browser opened automatically.');
    }
  });
  
  console.log('\n' + '-'.repeat(60));
  logInfo('Press Ctrl+C to stop the server');
  console.log('-'.repeat(60));
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logError(`Port ${PORT} is already in use. Try a different port.`);
  } else {
    logError(`Server error: ${err.message}`);
  }
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n' + '-'.repeat(60));
  logInfo('Server shutting down...');
  console.log('-'.repeat(60));
  server.close(() => {
    logSuccess('Server stopped successfully.');
    process.exit(0);
  });
});
