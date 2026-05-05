import { Router, Request, Response } from 'express';
import { agentEvents, MEMORY_DIGESTED } from '../../core/events/AgentEvents';

const router = Router();

router.get('/digest', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Initial comment to confirm connection
  res.write(': connected\n\n');

  const onDigest = (data: { timestamp: string }) => {
    res.write(`data: ${JSON.stringify({ type: 'memory.digested', timestamp: data.timestamp })}\n\n`);
  };

  agentEvents.on(MEMORY_DIGESTED, onDigest);

  req.on('close', () => {
    agentEvents.off(MEMORY_DIGESTED, onDigest);
  });
});

export default router;
