declare namespace Express {
  interface Request {
    requestId?: string;
    auth?: {
      user: {
        id: string;
        email: string;
        user_metadata?: Record<string, unknown>;
      };
      token: string;
      expiresAt?: number;
    } | null;
  }
}
