import { spawn } from 'child_process';
import path from 'path';

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
  console.log('=== Running Development Server Smoke Tests ===\n');

  const TEST_PORT = '3000';
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  // Spawn development server via 'npm run dev'
  console.log(`Spawning development server via 'npm run dev' on port ${TEST_PORT}...`);
  const serverProcess = spawn(npmCmd, ['run', 'dev'], {
    env: {
      ...process.env,
      PORT: TEST_PORT,
      NODE_ENV: 'development',
      GEMINI_API_KEY: '', // Explicitly empty to prevent contacting real Gemini
      DISABLE_HMR: 'true'
    }
  });

  // Track if process exited prematurely
  let serverExited = false;
  let exitCode: number | null = null;
  serverProcess.on('exit', (code) => {
    serverExited = true;
    exitCode = code;
  });

  // Pipe output for debugging logs (captured stdout/stderr)
  serverProcess.stdout?.on('data', (data) => {
    // console.log(`[DevServer STDOUT] ${data.toString().trim()}`);
  });
  serverProcess.stderr?.on('data', (data) => {
    // console.error(`[DevServer STDERR] ${data.toString().trim()}`);
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
      }, 1000);
    });
  };

  // Wait for server to start by polling /api/health
  console.log('Waiting for development server to become ready...');
  let isReady = false;
  // Poll up to 100 times (10 seconds)
  for (let attempt = 1; attempt <= 100; attempt++) {
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
    console.error('Development server failed to start or become ready in time.');
    await terminateServer();
    process.exit(1);
  }
  console.log('Development server is ready. Running assertions...');

  try {
    // Assertion A: Development server boot (GET /api/health)
    let isApiHealthJson = false;
    {
      const res = await fetch(`${baseUrl}/api/health`);
      assert(res.status === 200, 'GET /api/health returns HTTP 200');
      
      const contentType = res.headers.get('content-type') || '';
      assert(contentType.includes('application/json'), `Content-Type contains application/json (received: ${contentType})`);
      isApiHealthJson = contentType.includes('application/json');
      
      const data = await res.json() as any;
      assert(data.status === 'ok', 'Response is valid JSON and status is ok');
      assert(data.geminiConfigured === false, 'geminiConfigured is false as expected');
    }

    // Assertion B: TP API routing (POST /api/ai/generate-tp)
    let isApiGenerateTpJson = false;
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
          grade: 'Kelas 4',
          phase: 'Fase B',
          curriculum: 'Kurikulum Merdeka'
        })
      });

      assert(res.status === 503, `POST /api/ai/generate-tp returns HTTP 503 (received: ${res.status})`);
      
      const contentType = res.headers.get('content-type') || '';
      assert(contentType.includes('application/json'), `Content-Type contains application/json (received: ${contentType})`);
      isApiGenerateTpJson = contentType.includes('application/json');
      
      const data = await res.json() as any;
      assert(data.error !== undefined && (data.error.includes('GEMINI_API_KEY tidak terpasang') || data.error.includes('belum dikonfigurasi')), 'Returns expected JSON error because Gemini key is absent');
      
      // Explicitly check it is not HTML
      const responseText = JSON.stringify(data);
      assert(!responseText.toLowerCase().includes('<!doctype'), 'Response does NOT contain HTML doctype declaration');
    }

    // Assertion C: Unknown API route (GET /api/development-runtime-probe-does-not-exist)
    let isApiUnknownJson = false;
    {
      const res = await fetch(`${baseUrl}/api/development-runtime-probe-does-not-exist`);
      assert(res.status === 404, `Unknown API route returns HTTP 404 (received: ${res.status})`);
      
      const contentType = res.headers.get('content-type') || '';
      assert(contentType.includes('application/json'), `Unknown API route Content-Type contains application/json (received: ${contentType})`);
      isApiUnknownJson = contentType.includes('application/json');
      
      const data = await res.json() as any;
      assert(data.error === 'Unknown API route', 'Unknown API route returns expected JSON error description');
      
      const responseText = JSON.stringify(data);
      assert(!responseText.toLowerCase().includes('<!doctype'), 'Unknown API route response does NOT contain HTML doctype declaration');
    }

    // Assertion D: Vite frontend (GET /)
    let isFrontendHtml = false;
    {
      const res = await fetch(`${baseUrl}/`);
      assert(res.status === 200, 'GET / (Vite frontend) returns HTTP 200');
      
      const contentType = res.headers.get('content-type') || '';
      assert(contentType.includes('text/html'), `GET / Content-Type contains text/html (received: ${contentType})`);
      isFrontendHtml = contentType.includes('text/html');
      
      const text = await res.text();
      assert(text.toLowerCase().includes('<!doctype html>'), 'GET / response contains HTML doctype declaration');
    }

    // Assertion E: API/frontend separation
    {
      const separation = isApiHealthJson && isApiGenerateTpJson && isApiUnknownJson && isFrontendHtml;
      assert(separation, 'API/frontend separation is successful (all API responses are JSON, while Vite frontend is HTML)');
    }

  } catch (error: any) {
    console.error('An error occurred during verification:', error);
    failed++;
  } finally {
    console.log('Terminating development server...');
    await terminateServer();
  }

  console.log(`\n=== Development Smoke Tests Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Development smoke tests failed with error:', err);
  process.exit(1);
});
