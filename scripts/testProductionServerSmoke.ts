import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== Running Production Server Smoke Tests ===\n');

  // Ensure dist directory and a fallback index.html exist so the SPA static server does not crash
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, '<!doctype html><html><body>SPA Dummy</body></html>');
  }

  const TEST_PORT = '3999';
  const baseUrl = `http://localhost:${TEST_PORT}`;

  // Spawn production server
  console.log(`Spawning production server on port ${TEST_PORT}...`);
  const serverProcess = spawn('node', ['dist/server.cjs'], {
    env: {
      ...process.env,
      PORT: TEST_PORT,
      GEMINI_API_KEY: '', // Explicitly empty to prevent contacting real Gemini
      NODE_ENV: 'production'
    }
  });

  // Track if process exited prematurely
  let serverExited = false;
  let exitCode: number | null = null;
  serverProcess.on('exit', (code) => {
    serverExited = true;
    exitCode = code;
  });

  // Helper to safely terminate the server
  const terminateServer = () => {
    return new Promise<void>((resolve) => {
      if (serverProcess.killed) {
        resolve();
        return;
      }
      serverProcess.once('exit', () => resolve());
      serverProcess.kill('SIGTERM');
      // Fallback
      setTimeout(() => {
        try {
          serverProcess.kill('SIGKILL');
        } catch (_) {}
        resolve();
      }, 500);
    });
  };

  // Wait for server to start by polling /api/health
  console.log('Waiting for server to become ready...');
  let isReady = false;
  for (let attempt = 1; attempt <= 50; attempt++) {
    if (serverExited) {
      console.error(`Server exited prematurely with exit code ${exitCode}`);
      break;
    }
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.status === 200) {
        isReady = true;
        break;
      }
    } catch (_) {
      // ignore connection errors during startup
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!isReady) {
    console.error('Server failed to start or become ready in time.');
    await terminateServer();
    process.exit(1);
  }
  console.log('Server is ready. Running assertions...');

  try {
    // Assertion A: GET /api/health
    {
      const res = await fetch(`${baseUrl}/api/health`);
      assert(res.status === 200, 'GET /api/health returns HTTP 200');
      
      const contentType = res.headers.get('content-type') || '';
      assert(contentType.includes('application/json'), `Content-Type contains application/json (received: ${contentType})`);
      
      const data = await res.json() as any;
      assert(data.status === 'ok', 'Response is valid JSON and status is ok');
      assert(data.geminiConfigured === false, 'geminiConfigured is false as expected');
    }

    // Assertion B: POST /api/ai/generate-tp with valid minimal CP input
    {
      const res = await fetch(`${baseUrl}/api/ai/generate-tp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cpGeneral: 'Peserta didik mampu memahami konsep aljabar',
          cpElements: [],
          cpAnalysisItems: [],
          subject: 'Matematika',
          grade: 'Kelas 4'
        })
      });

      assert(res.status === 503, `POST /api/ai/generate-tp returns HTTP 503 (received: ${res.status})`);
      
      const contentType = res.headers.get('content-type') || '';
      assert(contentType.includes('application/json'), `Content-Type contains application/json (received: ${contentType})`);
      
      const data = await res.json() as any;
      assert(data.error !== undefined && data.error.includes('GEMINI_API_KEY tidak terpasang'), 'Returns expected JSON error because Gemini key is absent');
      
      // Explicitly check it is not HTML
      const responseText = JSON.stringify(data);
      assert(!responseText.toLowerCase().includes('<!doctype'), 'Response does NOT contain HTML doctype declaration');
    }

    // Assertion C: unknown /api/...
    {
      const res = await fetch(`${baseUrl}/api/some-unknown-endpoint-12345`);
      assert(res.status === 404, `Unknown API route returns HTTP 404 (received: ${res.status})`);
      
      const contentType = res.headers.get('content-type') || '';
      assert(contentType.includes('application/json'), `Unknown API route Content-Type contains application/json (received: ${contentType})`);
      
      const data = await res.json() as any;
      assert(data.error === 'Unknown API route', 'Unknown API route returns expected JSON error description');
      
      const responseText = JSON.stringify(data);
      assert(!responseText.toLowerCase().includes('<!doctype'), 'Unknown API route response does NOT contain HTML doctype declaration');
    }

    // Assertion D: normal SPA route
    {
      const res = await fetch(`${baseUrl}/dashboard`);
      assert(res.status === 200, 'Normal SPA route returns HTTP 200');
      
      const contentType = res.headers.get('content-type') || '';
      assert(contentType.includes('text/html'), `Normal SPA route Content-Type contains text/html (received: ${contentType})`);
      
      const text = await res.text();
      assert(text.toLowerCase().includes('<!doctype html>'), 'Normal SPA route returns standard HTML page');
    }

  } catch (error: any) {
    console.error('An error occurred during verification:', error);
    failed++;
  } finally {
    console.log('Terminating production server...');
    await terminateServer();
  }

  console.log(`\n=== Smoke Tests Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Smoke tests failed with error:', err);
  process.exit(1);
});
