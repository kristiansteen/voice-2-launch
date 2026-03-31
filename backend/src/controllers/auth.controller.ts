import { Request, Response } from 'express';
import crypto from 'crypto';
import authService from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';
import logger from '../utils/logger';
import config from '../config';

// ── One-time auth code store ──────────────────────────────────────────────────
// Replaces ?token=<jwt> in redirect URLs with a short-lived ?code=<hex>
// to avoid Google Safe Browsing phishing flags on URLs containing raw JWTs.
const authCodes = new Map<string, { token: string; expiresAt: number }>();

function createAuthCode(token: string): string {
  const code = crypto.randomBytes(16).toString('hex'); // 32 chars, not a JWT
  authCodes.set(code, { token, expiresAt: Date.now() + 60_000 }); // 60s TTL
  // Purge expired codes on each creation (cheap, low frequency)
  for (const [k, v] of authCodes) {
    if (v.expiresAt < Date.now()) authCodes.delete(k);
  }
  return code;
}

function consumeAuthCode(code: string): string | null {
  const entry = authCodes.get(code);
  if (!entry || entry.expiresAt < Date.now()) {
    authCodes.delete(code);
    return null;
  }
  authCodes.delete(code); // single-use
  return entry.token;
}

class AuthController {
  /**
   * Register new user with email and password
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body;

      // Validation
      if (!email || !password) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Email and password are required',
        });
        return;
      }

      // Password strength validation
      if (password.length < 8) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Password must be at least 8 characters long',
        });
        return;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid email format',
        });
        return;
      }

      // Register user
      const user = await authService.register(email, password, name);

      // Generate tokens
      const tokens = authService.generateTokens(user);

      // Set refresh token as httpOnly cookie
      // Use 'none' in production for cross-domain (vimpl.com → backend.vercel.app)
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: config.nodeEnv === 'production' ? 'none' : 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(201).json({
        message: 'User registered successfully',
        user: authService.sanitizeUser(user),
        accessToken: tokens.accessToken,
      });
    } catch (error: any) {
      logger.error('Registration error:', error);
      res.status(400).json({
        error: 'Registration Failed',
        message: error.message || 'Failed to register user',
      });
    }
  }

  /**
   * Login with email and password
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Email and password are required',
        });
        return;
      }

      // Get IP address and user agent for audit logging
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Login
      const { user, tokens } = await authService.login(email, password, ipAddress, userAgent);

      // Set refresh token as httpOnly cookie
      // Use 'none' in production for cross-domain (vimpl.com → backend.vercel.app)
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: config.nodeEnv === 'production' ? 'none' : 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        message: 'Login successful',
        user: authService.sanitizeUser(user),
        accessToken: tokens.accessToken,
      });
    } catch (error: any) {
      logger.error('Login error:', error);
      res.status(401).json({
        error: 'Login Failed',
        message: error.message || 'Invalid credentials',
      });
    }
  }

  /**
   * Logout
   * POST /api/v1/auth/logout
   */
  async logout(_req: Request, res: Response): Promise<void> {
    try {
      // Clear refresh token cookie (must match the same options used when setting it)
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: config.nodeEnv === 'production' ? 'none' : 'strict',
      });

      res.json({
        message: 'Logout successful',
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        error: 'Logout Failed',
        message: 'Failed to logout',
      });
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'No refresh token provided',
        });
        return;
      }

      // Generate new access token
      const accessToken = await authService.refreshAccessToken(refreshToken);

      res.json({
        accessToken,
      });
    } catch (error: any) {
      logger.error('Token refresh error:', error);
      res.status(401).json({
        error: 'Refresh Failed',
        message: error.message || 'Invalid refresh token',
      });
    }
  }

  /**
   * Get current user
   * GET /api/v1/auth/me
   */
  async getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Not authenticated',
        });
        return;
      }

      const user = await authService.getUserById(req.user.userId);

      if (!user) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }

      res.json({
        user: authService.sanitizeUser(user),
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Failed to get user information',
      });
    }
  }

  /**
   * Verify email
   * POST /api/v1/auth/verify-email
   */
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Verification token is required',
        });
        return;
      }

      const user = await authService.verifyEmail(token);

      res.json({
        message: 'Email verified successfully',
        user: authService.sanitizeUser(user),
      });
    } catch (error: any) {
      logger.error('Email verification error:', error);
      res.status(400).json({
        error: 'Verification Failed',
        message: error.message || 'Failed to verify email',
      });
    }
  }

  /**
   * Refresh token endpoint (for explicit refresh token submission)
   * POST /api/v1/auth/refresh-token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Refresh token is required',
      });
      return;
    }

    try {
      const accessToken = await authService.refreshAccessToken(refreshToken);
      res.json({ accessToken });
    } catch (error) {
      if (error instanceof Error) {
        res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
        });
      } else {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
        });
      }
    }
  }

  /**
   * Send password reset email
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: 'Validation Error', message: 'Email is required' });
        return;
      }
      await authService.forgotPassword(email);
      // Always return 200 to avoid revealing whether the account exists
      res.json({ message: 'If that email is registered, a reset link is on its way.' });
    } catch (error: any) {
      logger.error('Forgot password error:', error);
      res.status(500).json({ error: 'Server Error', message: 'Failed to process request' });
    }
  }

  /**
   * Reset password using a valid reset token
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword(token, newPassword);
      res.json({ message: 'Password reset successfully.' });
    } catch (error: any) {
      logger.error('Reset password error:', error);
      res.status(400).json({ error: 'Reset Failed', message: error.message || 'Failed to reset password' });
    }
  }

  /**
   * Google OAuth callback handler
   * This is called by Passport after Google authentication
   */
  async googleCallback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const state = req.query.state as string;
      let redirectUrl = config.frontend.url;

      if (state) {
        try {
          const decodedOrigin = Buffer.from(state, 'base64').toString();
          if (decodedOrigin.startsWith('http')) {
            redirectUrl = decodedOrigin.replace(/\/+$/, '');
            logger.info(`Using dynamic redirect URL from state: ${redirectUrl}`);
          }
        } catch (e) {
          logger.warn('Failed to decode OAuth state, falling back to default frontend URL');
        }
      }

      if (!req.user) {
        res.redirect(`${redirectUrl}/login.html?error=auth_failed`);
        return;
      }

      const user = await authService.getUserById(req.user.userId);
      if (!user) {
        res.redirect(`${redirectUrl}/login.html?error=user_not_found`);
        return;
      }

      // Generate tokens
      const tokens = authService.generateTokens(user);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: config.nodeEnv === 'production' ? 'none' : 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect to frontend with a short-lived one-time code instead of raw JWT
      const code = createAuthCode(tokens.accessToken);
      res.redirect(`${redirectUrl}/callback.html?code=${code}`);
    } catch (error) {
      logger.error('Google callback error:', error);
      res.redirect(`${config.frontend.url}/login.html?error=auth_failed`);
    }
  }
  /**
   * Exchange a one-time auth code for a JWT access token.
   * GET /api/v1/auth/exchange-code?code=<code>
   * Public — no auth required (the code itself is the credential).
   */
  async exchangeCode(req: Request, res: Response): Promise<void> {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).json({ error: 'Missing code' });
      return;
    }
    const token = consumeAuthCode(code);
    if (!token) {
      res.status(400).json({ error: 'Invalid or expired code' });
      return;
    }
    res.json({ token });
  }

  /**
   * Create a one-time auth code for the currently authenticated user.
   * POST /api/v1/auth/create-code
   * Used by login.html and callback.html to forward the session cross-origin
   * without putting the raw JWT in a URL (which triggers Safe Browsing flags).
   */
  async createCode(req: AuthRequest, res: Response): Promise<void> {
    // Re-read the raw Bearer token from the Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const code = createAuthCode(token);
    res.json({ code });
  }
}

export default new AuthController();
