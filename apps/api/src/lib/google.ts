import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { ApiError } from '../core/ApiError';

const client = new OAuth2Client();

export interface GoogleProfile {
  googleId: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

/** Verifies a Google ID token issued to one of our OAuth client ids (web / Android / iOS). */
export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleProfile> => {
  if (env.google.clientIds.length === 0) {
    throw new ApiError(503, 'Google sign-in is not configured on the server', 'INTERNAL');
  }
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.google.clientIds });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new Error('Missing subject');
    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    throw ApiError.unauthorized('Google sign-in failed, please try again');
  }
};
