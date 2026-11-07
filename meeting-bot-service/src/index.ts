import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { JobManager } from './jobs/job-manager';

const app = express();
app.use(cors());
app.use(express.json());

// Auth middleware for bot worker endpoints
const authMiddleware = (req: Request, res: Response, next: () => void) => {
  const headerKey = req.headers['x-bot-api-key'];
  if (config.apiKey && headerKey !== config.apiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid x-bot-api-key' });
  }
  next();
};

// Health Check for load balancers
app.get('/health', (_req: Request, res: Response) => {
  const activeJobs = JobManager.getActiveJobsCount();
  const isOverloaded = activeJobs >= config.maxConcurrentJobs;

  res.status(isOverloaded ? 503 : 200).json({
    status: isOverloaded ? 'overloaded' : 'healthy',
    activeJobs,
    maxCapacity: config.maxConcurrentJobs,
    directWorkerUrl: config.directWorkerUrl,
    timestamp: new Date().toISOString(),
  });
});

// Start Meeting Attendance Job
app.post('/jobs/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { jobId, sessionId, meetingUrl, callbackUrl } = req.body;
    if (!jobId || !sessionId || !meetingUrl || !callbackUrl) {
      return res.status(400).json({
        error: 'jobId, sessionId, meetingUrl, and callbackUrl are required.',
      });
    }

    const result = await JobManager.startJob(req.body);
    return res.status(202).json({
      message: 'Job dispatched successfully.',
      jobId: result.jobId,
      directWorkerUrl: config.directWorkerUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to start meeting bot job.' });
  }
});

// Update config on the fly (Course Rep edited min time or duration)
app.patch('/jobs/:id/config', authMiddleware, async (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const success = await JobManager.updateConfig(jobId, req.body);
  if (!success) {
    return res.status(404).json({ error: 'Active job not found on this worker.' });
  }
  return res.json({ message: 'Job configuration updated successfully.' });
});

// Conclude attendance now (Course Rep hit "Hard End")
app.post('/jobs/:id/conclude', authMiddleware, async (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const success = await JobManager.concludeJob(jobId);
  if (!success) {
    return res.status(404).json({ error: 'Active job not found on this worker.' });
  }
  return res.json({ message: 'Job conclusion initiated.' });
});

// Query live job status
app.get('/jobs/:id/status', authMiddleware, (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const job = JobManager.getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found on this worker.' });
  }

  return res.json({
    id: job.id,
    status: job.status,
    statusMessage: job.statusMessage,
    cycleCount: job.cycleCount,
    attendeeMinutes: job.attendeeMinutes,
    directWorkerUrl: config.directWorkerUrl,
  });
});

app.listen(config.port, () => {
  console.log(`[TruMark Meeting Bot Service] Running on port ${config.port}`);
  console.log(`[TruMark Meeting Bot Service] Direct Worker URL: ${config.directWorkerUrl}`);
});
