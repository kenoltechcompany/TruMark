import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttler guard that correctly resolves client IPs when the backend
 * is deployed behind reverse proxies (Nginx, Docker, Cloudflare, AWS ALB).
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      // First IP in X-Forwarded-For is the originating client IP
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].trim();
    }
    return req.ips?.length ? req.ips[0] : req.ip || '127.0.0.1';
  }
}
