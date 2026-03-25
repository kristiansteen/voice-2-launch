import { Request, Response } from 'express';
import prisma from '../config/database';
import logger from '../utils/logger';

const flowController = {
  /** GET /api/v1/flows — list all flows for the authenticated user (data blob excluded for speed) */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const flows = await prisma.flow.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, data: true, createdAt: true, updatedAt: true },
      });
      res.json(flows);
    } catch (err) {
      logger.error('flow.list error:', err);
      res.status(500).json({ error: 'Failed to list flows' });
    }
  },

  /** PUT /api/v1/flows/:id — upsert a flow (create or update) */
  async upsert(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      const { name, data } = req.body;

      if (!name || !data) {
        res.status(400).json({ error: 'name and data are required' });
        return;
      }

      const flow = await prisma.flow.upsert({
        where: { id },
        update: { name: name.trim(), data },
        create: { id, userId, name: name.trim(), data },
      });

      res.json(flow);
    } catch (err) {
      logger.error('flow.upsert error:', err);
      res.status(500).json({ error: 'Failed to save flow' });
    }
  },

  /** DELETE /api/v1/flows/:id */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const existing = await prisma.flow.findFirst({ where: { id: req.params.id, userId } });
      if (!existing) {
        res.status(404).json({ error: 'Flow not found' });
        return;
      }
      await prisma.flow.delete({ where: { id: req.params.id } });
      res.status(204).end();
    } catch (err) {
      logger.error('flow.delete error:', err);
      res.status(500).json({ error: 'Failed to delete flow' });
    }
  },
};

export default flowController;
