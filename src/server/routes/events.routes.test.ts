import http from 'http';
import express from 'express';
import assert from 'assert';
import eventsRouter from './events.routes';
import { agentEvents, MEMORY_DIGESTED } from '../../core/events/AgentEvents';

const app = express();
app.use('/api/events', eventsRouter);

async function test() {
  console.log("Running events.routes SSE tests...");

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'string' ? 0 : address?.port;
  const agent = new http.Agent({ keepAlive: false });

  try {
    // Test 3 & 4: responds with Content-Type: text/event-stream and connected message
    await new Promise((resolve, reject) => {
      const req = http.get({
        hostname: 'localhost',
        port: port,
        path: '/api/events/digest',
        agent: agent
      }, (res) => {
        assert.strictEqual(res.headers['content-type'], 'text/event-stream');
        res.on('data', (chunk) => {
          const text = chunk.toString();
          if (text.includes(': connected')) {
            req.destroy();
            resolve(true);
          }
        });
      });
      req.on('error', (err) => {
        if ((err as any).code === 'ECONNRESET') return;
        reject(err);
      });
    });
    console.log("✅ Success: SSE headers and connected message");

    // Test 5: Client disconnect removes the agentEvents listener
    agentEvents.removeAllListeners();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const initialListeners = agentEvents.listenerCount(MEMORY_DIGESTED);
    console.log(`Initial listeners: ${initialListeners}`);
    
    const req5 = http.get({
      hostname: 'localhost',
      port: port,
      path: '/api/events/digest',
      agent: agent
    });
    
    // Wait for the request to reach the handler
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const countAfterConnect = agentEvents.listenerCount(MEMORY_DIGESTED);
    console.log(`Listeners after connect: ${countAfterConnect}`);
    
    assert.strictEqual(countAfterConnect, initialListeners + 1, "Should have added a listener");
    
    req5.destroy();
    
    // Wait for the close event to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const finalListeners = agentEvents.listenerCount(MEMORY_DIGESTED);
    console.log(`Final listeners: ${finalListeners}`);
    
    assert.strictEqual(finalListeners, initialListeners, "Should have removed listener on disconnect");
    console.log("✅ Success: Listener removed on disconnect");

  } finally {
    server.close();
  }
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
