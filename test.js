const http = require('http');
const assert = require('assert');
const { spawn } = require('child_process');

const port = 3100;
const app = spawn(process.execPath, ['app.js'], {
  env: { ...process.env, PORT: String(port) }
});

function request(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

async function runTests() {
  try {
    await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('API startup timeout')), 5000);
      app.stdout.on('data', chunk => {
        output += chunk;
        if (output.includes(`Listening on ${port}`)) {
          clearTimeout(timeout);
          resolve();
        }
      });
      app.on('error', reject);
      app.on('exit', code => reject(new Error(`API exited early: ${code}`)));
    });

    const health = await request('/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body, 'OK');
    console.log('PASS: /health returns OK');

    const version = await request('/version');
    assert.strictEqual(version.body, '1.0.0');
    console.log('PASS: /version returns 1.0.0');

    console.log('All tests passed');
  } finally {
    app.kill();
  }
}

runTests().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
