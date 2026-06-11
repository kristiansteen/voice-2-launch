import { Router } from 'express';
import adminController from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// All admin routes require authentication + admin role.
// Grant admin via DB isAdmin flag or ADMIN_EMAILS env var.
const guard = [authenticate, requireAdmin];

// ── Admin check (lightweight auth probe) ─────────────────────────────
router.get('/check', ...guard, (_req, res) => res.json({ ok: true }));

// ── User management ───────────────────────────────────────────────────
router.get('/users', ...guard, adminController.listUsers);
router.get('/users/:userId', ...guard, adminController.getUser);
router.patch('/users/:userId/subscription', ...guard, adminController.updateSubscription);
router.delete('/users/:userId', ...guard, adminController.deleteUser);
router.post('/users/:userId/onboarding/:day', ...guard, adminController.triggerOnboarding);

// ── Analytics ─────────────────────────────────────────────────────────
router.get('/stats', ...guard, adminController.getStats);

// ── Login audits ──────────────────────────────────────────────────────
router.get('/login-audits/download', ...guard, adminController.downloadLoginAudits);
router.get('/login-audits/stats', ...guard, adminController.getLoginStats);
router.get('/login-audits', ...guard, adminController.getLoginAudits);
router.get('/users/:userId/login-history', ...guard, adminController.getUserLoginHistory);

// ── Subscriptions (legacy endpoint) ───────────────────────────────────
router.get('/subscriptions', ...guard, adminController.getAllSubscriptions);

export default router;
