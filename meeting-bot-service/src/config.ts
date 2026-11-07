import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  apiKey: process.env.BOT_API_KEY || 'trumark-bot-secret',
  botDisplayName: process.env.BOT_DISPLAY_NAME || 'TruMark Attendance Bot',
  // Direct worker address reported to TruMark to bypass load balancers
  directWorkerUrl:
    process.env.DIRECT_WORKER_URL ||
    `http://${getLocalIp()}:${process.env.PORT || '5001'}`,
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '5', 10),
};
