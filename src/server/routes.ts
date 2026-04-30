import { Router } from 'express';
import authRoutes from '@/server/auth-routes';
import systemRoutes from '@/server/system-routes';
import agentRoutes from '@/server/agent-routes';
import memoryRoutes from '@/server/memory-routes';
import toolRoutes from '@/server/tool-routes';
import performanceRoutes from '@/server/performance-routes';
import skillsRoutes from '@/server/routes/skills.routes';
import tagsRoutes from '@/server/routes/tags.routes';
import agentsRoutes from '@/server/routes/agents.routes';
import capturesRoutes from '@/server/routes/captures.routes';
import tasksRoutes from '@/server/routes/tasks.routes';
import meetingsRoutes from '@/server/routes/meetings.routes';
import googleRoutes from '@/server/routes/google.routes';
import messagingRoutes from '@/server/routes/messaging.routes';
import briefingRoutes from '@/server/routes/briefing.routes';
import llmRoutes from '@/server/routes/llm.routes';
import pushRoutes from '@/server/routes/push.routes';
import gitvaultRoutes from '@/server/routes/gitvault.routes';
import opsRoutes from '@/server/routes/ops.routes';

const router = Router();

router.use(authRoutes);
router.use(systemRoutes);
router.use(agentRoutes);
router.use(memoryRoutes);
router.use(toolRoutes);
router.use('/learning', performanceRoutes);

router.use(skillsRoutes);
router.use(tagsRoutes);
router.use(agentsRoutes);
router.use(capturesRoutes);
router.use(tasksRoutes);
router.use(meetingsRoutes);
router.use(googleRoutes);
router.use(messagingRoutes);
router.use(briefingRoutes);
router.use(llmRoutes);
router.use(pushRoutes);
router.use(gitvaultRoutes);
router.use(opsRoutes);

export default router;
