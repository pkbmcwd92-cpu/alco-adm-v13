import { generateTPWithAI, GenerateTPParams } from '../src/services/aiService';

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
  console.log('=== Running E.4.1A TP AI Transport Hardening Regression Tests ===\n');

  const dummyParams: GenerateTPParams = {
    cpGeneral: 'Peserta didik memahami konsep perkalian',
    cpElements: [{ id: 'el-1', name: 'Aljabar', content: 'Perkalian sederhana' }],
    cpAnalysisItems: [{ elementName: 'Aljabar', cpCompetence: 'Memahami', materialScope: 'Konsep perkalian', suggestedTp: 'Memahami perkalian' }],
    subject: 'Matematika',
    grade: 'Kelas 4',
    phase: 'Fase B',
    curriculum: 'Kurikulum Merdeka'
  };

  // Test 1: 200 text/html fails with explicit non-JSON/API-route error
  {
    const originalFetch = global.fetch;
    global.fetch = async (url, init) => {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null
        },
        text: async () => '<!doctype html><html><body>Error page</body></html>'
      } as any;
    };

    try {
      await generateTPWithAI(dummyParams);
      assert(false, 'Should have failed on HTML response');
    } catch (err: any) {
      assert(err.message.includes('Endpoint AI TP tidak mengembalikan JSON (received text/html)'), 
        'Correctly throws on HTML response indicating API fallback');
    } finally {
      global.fetch = originalFetch;
    }
  }

  // Test 2: JSON 4xx/5xx preserves backend error
  {
    const originalFetch = global.fetch;
    global.fetch = async (url, init) => {
      return {
        ok: false,
        status: 500,
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null
        },
        json: async () => ({ error: 'Kunci API Gemini terblokir atau kadaluwarsa' })
      } as any;
    };

    try {
      await generateTPWithAI(dummyParams);
      assert(false, 'Should have failed on 500 response');
    } catch (err: any) {
      assert(err.message.includes('Kunci API Gemini terblokir atau kadaluwarsa'), 
        'Preserved backend JSON error on 5xx response');
    } finally {
      global.fetch = originalFetch;
    }
  }

  // Test 3: Valid JSON TP response succeeds
  {
    const originalFetch = global.fetch;
    let lastBody: any = null;
    global.fetch = async (url, init) => {
      lastBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null
        },
        json: async () => ({
          success: true,
          items: [
            {
              code: 'TP 4.1',
              elementName: 'Aljabar',
              statement: 'Murid mampu mengidentifikasi perkalian sebagai penjumlahan berulang.',
              competence: 'Mengidentifikasi',
              contentScope: 'Penjualan berulang',
              p3Dimensions: ['Penalaran Kritis']
            }
          ]
        })
      } as any;
    };

    try {
      const items = await generateTPWithAI(dummyParams);
      assert(items.length === 1, 'Correctly parsed valid JSON items array');
      assert(items[0].statement === 'Murid mampu mengidentifikasi perkalian sebagai penjumlahan berulang.', 'Maps statement correctly');
      assert(lastBody && lastBody.cpAnalysisItems !== undefined, 'cpAnalysisItems was transmitted to the backend');
    } catch (err: any) {
      assert(false, 'Should have succeeded with valid JSON: ' + err.message);
    } finally {
      global.fetch = originalFetch;
    }
  }

  // Test 4: Malformed/empty items are rejected
  {
    const originalFetch = global.fetch;
    global.fetch = async (url, init) => {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null
        },
        json: async () => ({
          success: true,
          items: [] // Empty items
        })
      } as any;
    };

    try {
      await generateTPWithAI(dummyParams);
      assert(false, 'Should have failed on empty items');
    } catch (err: any) {
      assert(err.message.includes('array dan tidak boleh kosong'), 
        'Correctly rejected empty items array');
    } finally {
      global.fetch = originalFetch;
    }
  }

  // Test 5: Malformed item without statement/description is rejected
  {
    const originalFetch = global.fetch;
    global.fetch = async (url, init) => {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null
        },
        json: async () => ({
          success: true,
          items: [
            {
              code: 'TP 4.1',
              elementName: 'Aljabar'
              // missing statement and description
            }
          ]
        })
      } as any;
    };

    try {
      await generateTPWithAI(dummyParams);
      assert(false, 'Should have failed on missing statement');
    } catch (err: any) {
      assert(err.message.includes('tidak memiliki statement/description'), 
        'Correctly rejected items with missing statement/description');
    } finally {
      global.fetch = originalFetch;
    }
  }

  console.log(`\n=== Hardening Tests Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
