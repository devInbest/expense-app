import type { AdminDoc } from '../modules/admins/admin.model';
import type { UserDoc } from '../modules/users/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: UserDoc;
      admin?: AdminDoc;
      sessionId?: string;
      validated?: { query?: unknown; params?: unknown };
      client?: { platform?: string; appVersion?: string };
    }
  }
}

export {};
