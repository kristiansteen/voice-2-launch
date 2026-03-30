import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../config/database';
import logger from '../utils/logger';

// Daily call limits per subscription tier
export const DAILY_LIMITS: Record<string, number | null> = {
  student: 10,
  commercial: 500,
  enterprise: null, // unlimited
};

// ElevenLabs cost: $0.30 per 1,000 characters (Starter plan overage / PAYG)
const EL_COST_PER_CHAR = 0.0003;

class UsageController {
  private todayStart(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  private async getDailyCount(userId: string): Promise<number> {
    return prisma.apiUsageLog.count({
      where: {
        userId,
        provider: 'anthropic',
        createdAt: { gte: this.todayStart() },
      },
    });
  }

  // POST /usage/check  — rate-limit check + record for Anthropic calls
  async checkAndRecord(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const tier = req.user!.subscriptionTier || 'student';
      const { endpoint = 'proxy' } = req.body;

      const dailyLimit = DAILY_LIMITS[tier] ?? DAILY_LIMITS.student!;
      const dailyCount = await this.getDailyCount(userId);

      if (typeof dailyLimit === 'number' && dailyCount >= dailyLimit) {
        logger.warn(`Usage limit reached for user ${userId} (tier=${tier}, count=${dailyCount})`);
        res.status(429).json({ allowed: false, dailyCount, dailyLimit });
        return;
      }

      await prisma.apiUsageLog.create({ data: { userId, provider: 'anthropic', endpoint } });
      res.json({ allowed: true, dailyCount: dailyCount + 1, dailyLimit });
    } catch (error) {
      logger.error('checkAndRecord error:', error);
      res.status(500).json({ error: 'Server Error' });
    }
  }

  // POST /usage/log  — called by proxy.js / tts.js after each API call
  async logUsage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { provider, endpoint, inputTokens, outputTokens, characters } = req.body;

      if (!provider || !endpoint) {
        res.status(400).json({ error: 'provider and endpoint are required' });
        return;
      }

      await prisma.apiUsageLog.create({
        data: {
          userId,
          provider,
          endpoint,
          inputTokens: inputTokens ?? null,
          outputTokens: outputTokens ?? null,
          characters: characters ?? null,
        },
      });

      res.json({ ok: true });
    } catch (error) {
      logger.error('logUsage error:', error);
      res.status(500).json({ error: 'Server Error' });
    }
  }

  // GET /usage/me
  async getMyUsage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const tier = req.user!.subscriptionTier || 'student';

      const [todayCount, monthCount] = await Promise.all([
        this.getDailyCount(userId),
        prisma.apiUsageLog.count({
          where: {
            userId,
            provider: 'anthropic',
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      const dailyLimit = DAILY_LIMITS[tier] ?? DAILY_LIMITS.student!;
      res.json({
        today: { calls: todayCount, limit: dailyLimit },
        last30Days: { calls: monthCount },
      });
    } catch (error) {
      logger.error('getMyUsage error:', error);
      res.status(500).json({ error: 'Server Error' });
    }
  }

  // GET /usage/admin?days=30
  async getAdminUsage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const days = Math.min(365, Math.max(1, parseInt((req.query.days as string) || '30')));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [anthropicRows, elevenRows] = await Promise.all([
        prisma.apiUsageLog.groupBy({
          by: ['userId'],
          where: { provider: 'anthropic', createdAt: { gte: since } },
          _count: { _all: true },
          _sum: { inputTokens: true, outputTokens: true },
          orderBy: { _count: { userId: 'desc' } },
        }),
        prisma.apiUsageLog.groupBy({
          by: ['userId'],
          where: { provider: 'elevenlabs', createdAt: { gte: since } },
          _count: { _all: true },
          _sum: { characters: true },
          orderBy: { _count: { userId: 'desc' } },
        }),
      ]);

      const userIds = [...new Set([
        ...anthropicRows.map(r => r.userId),
        ...elevenRows.map(r => r.userId),
      ])];

      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true, subscriptionTier: true },
      });
      const userMap = new Map(users.map(u => [u.id, u]));

      res.json({
        rows: anthropicRows.map(r => ({
          user: userMap.get(r.userId) ?? { id: r.userId, email: 'unknown' },
          calls: r._count._all,
          inputTokens: r._sum.inputTokens ?? 0,
          outputTokens: r._sum.outputTokens ?? 0,
        })),
        elevenlabs: elevenRows.map(r => {
          const chars = r._sum.characters ?? 0;
          return {
            user: userMap.get(r.userId) ?? { id: r.userId, email: 'unknown' },
            calls: r._count._all,
            characters: chars,
            estimatedCost: +(chars * EL_COST_PER_CHAR).toFixed(4),
          };
        }),
      });
    } catch (error) {
      logger.error('getAdminUsage error:', error);
      res.status(500).json({ error: 'Server Error' });
    }
  }
}

export default new UsageController();
