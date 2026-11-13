import dotenv from 'dotenv';
import os from 'os';
import path from 'path';

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
  botDisplayName: process.env.BOT_DISPLAY_NAME || 'TruMark Attendance',
  // Direct worker address reported to TruMark to bypass load balancers
  directWorkerUrl:
    process.env.DIRECT_WORKER_URL ||
    `http://${getLocalIp()}:${process.env.PORT || '5001'}`,
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '5', 10),
  samplingIntervalMs: parseInt(process.env.BOT_SAMPLING_INTERVAL_MS || String(5 * 60 * 1000), 10),
  headless: process.env.BOT_HEADLESS ? process.env.BOT_HEADLESS === 'true' : false,
  browserChannel: process.env.BOT_BROWSER_CHANNEL || 'chrome',
  profileDir: process.env.BOT_PROFILE_DIR || path.join(os.homedir(), '.trumark-bot-profile'),
};
