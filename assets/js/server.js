const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const PORT = 8000;
const PROJECT_NAME = 'HealthInsightToday';
const ROOT_DIR = path.join(__dirname, '../..');

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
    } else {
      logInfo('Available pages in root directory:');
      htmlFiles.forEach(file => {
        const route = file === 'index.html' ? '/' : `/${file.replace('.html', '')}`;
        console.log(`  ${colors.cyan}http://localhost:${PORT}${route}${colors.reset}`);
      });
    }
    
    // Check pages directory
    const pagesDir = path.join(ROOT_DIR, 'pages');
    fs.readdir(pagesDir, (pagesErr, pagesFiles) => {
      if (pagesErr) {
        if (pagesErr.code !== 'ENOENT') {
          logError(`Could not read pages directory: ${pagesErr.message}`);
        }
      } else {
        const pagesHtmlFiles = pagesFiles.filter(file => path.extname(file).toLowerCase() === '.html');
        
        if (pagesHtmlFiles.length > 0) {
          logInfo('Available pages in /pages directory:');
          pagesHtmlFiles.forEach(file => {
            const route = `/${file.replace('.html', '')}`;
            console.log(`  ${colors.cyan}http://localhost:${PORT}${route}${colors.reset}`);
          });
        }
      }
      
      console.log('\n' + '-'.repeat(60) + '\n');
    });
  });
}

// Try these paths in order until a file is found
function tryFiles(urlPath, callback) {
  // List of possible file paths to try, in order
  const pathsToTry = [
    // Exact path as requested
    path.join(ROOT_DIR, urlPath),
    
    // Add .html extension if not present
    path.extname(urlPath) ? null : path.join(ROOT_DIR, `${urlPath}.html`),
    
    // Check in pages directory
    path.extname(urlPath) ? null : path.join(ROOT_DIR, 'pages', `${urlPath}.html`),
    
    // Try index.html if the path ends with /
    urlPath.endsWith('/') ? path.join(ROOT_DIR, urlPath, 'index.html') : null,
    
    // Check for 404.html
    path.join(ROOT_DIR, '404.html')
  ].filter(p => p !== null);
  
  function tryNextPath(index) {
    if (index >= pathsToTry.length) {
      // No more paths to try, return 404
      callback(null, 404);
      return;
    }
    
    const currentPath = pathsToTry[index];
    
    fs.readFile(currentPath, (err, content) => {
      if (err) {
        // File not found or error, try next path
        tryNextPath(index + 1);
      } else {
        // File found, return its content
        callback({
          path: currentPath,
          content: content,
          statusCode: index === pathsToTry.length - 1 ? 404 : 200 // 404 if we're using the fallback 404.html
        });
      }
    });
  }
  
  // Start trying paths
  tryNextPath(0);
}

// Create the server
const server = http.createServer((req, res) => {
  const startTime = Date.now();
  
  // Normalize URL by removing query string
  let url = req.url.split('?')[0];
  
  // Remove trailing slash except for root
  if (url.length > 1 && url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  
  // Handle root URL
  if (url === '' || url === '/') {
    url = '/index.html';
  }
  
  // Try to serve the requested file or find alternatives
  tryFiles(url, (result, statusCode) => {
    if (!result) {
      // No file found, send generic 404
      res.writeHead(404);
      res.end('404 - File Not Found');
      logRequest(req.method, url, 404, Date.now() - startTime);
      logError(`Page not found: ${url}`);
      return;
    }
    
    // Get the content type based on file extension
    const extname = path.extname(result.path).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';
    
    // Send the response
    res.writeHead(result.statusCode, { 'Content-Type': contentType });
    res.end(result.content);
    
    // Log the request
    logRequest(req.method, url, result.statusCode, Date.now() - startTime);
    
    // Additional logging for HTML pages
    if (extname === '.html') {
      if (result.statusCode === 200) {
        logInfo(`Page visited: ${url}`);
      } else if (result.statusCode === 404) {
        logWarning(`Page not found: ${url} (Served custom 404 page)`);
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