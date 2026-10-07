import { ERROR_CODES, LIMITS, type OtpPurpose, type OtpRequestResult } from '@expense/shared';
import { ApiError } from '../../core/ApiError';
import { hmac, randomDigits, safeEqual } from '../../lib/crypto';
import { isConsoleSms, sendSms } from '../../lib/sms';
import { env } from '../../config/env';
import { OtpRequest } from './otp.model';

const hashCode = (phone: string, purpose: string, code: string) => hmac(`${phone}:${purpose}:${code}`);

export const requestOtp = async (phone: string, purpose: OtpPurpose, ip?: string): Promise<OtpRequestResult> => {
  const now = Date.now();
  const latest = await OtpRequest.findOne({ phone, purpose }).sort({ createdAt: -1 }).lean();
  if (latest) {
    const waitMs = LIMITS.OTP_RESEND_COOLDOWN_SECONDS * 1000 - (now - new Date(latest.createdAt).getTime());
    if (waitMs > 0) throw ApiError.tooMany(`Please wait ${Math.ceil(waitMs / 1000)}s before requesting a new code`);
  }
  const sentLastHour = await OtpRequest.countDocuments({ phone, createdAt: { $gt: new Date(now - 3600_000) } });
  if (sentLastHour >= LIMITS.OTP_MAX_PER_HOUR) {
    throw ApiError.tooMany('Too many codes requested for this number. Try again in an hour.');
  }

  const code = randomDigits(LIMITS.OTP_LENGTH);
  await OtpRequest.updateMany({ phone, purpose, consumedAt: null }, { consumedAt: new Date() });
  await OtpRequest.create({
    phone,
    purpose,
    codeHash: hashCode(phone, purpose, code),
    ip,
    expiresAt: new Date(now + LIMITS.OTP_TTL_SECONDS * 1000),
  });

  await sendSms({
    to: phone,
    text: `${code} is your expenseHog verification code. It expires in ${LIMITS.OTP_TTL_SECONDS / 60} minutes. Do not share it with anyone.`,
    vars: { otp: code },
  });

  return {
    expiresInSeconds: LIMITS.OTP_TTL_SECONDS,
    resendInSeconds: LIMITS.OTP_RESEND_COOLDOWN_SECONDS,
    ...(isConsoleSms() && !env.isProduction ? { devCode: code } : {}),
  };
};

/** Consumes the latest code for this phone. Each wrong guess burns one of the limited attempts. */
export const verifyOtp = async (phone: string, purpose: OtpPurpose, code: string): Promise<void> => {
  const otp = await OtpRequest.findOne({ phone, purpose, consumedAt: null }).sort({ createdAt: -1 });
  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest('This code has expired. Request a new one.', undefined, ERROR_CODES.OTP_EXPIRED);
  }
  if (otp.attempts >= LIMITS.OTP_MAX_ATTEMPTS) {
    throw ApiError.badRequest('Too many wrong attempts. Request a new code.', undefined, ERROR_CODES.OTP_TOO_MANY_ATTEMPTS);
  }
  if (!safeEqual(hashCode(phone, purpose, code), otp.codeHash)) {
    otp.attempts += 1;
    await otp.save();
    const left = LIMITS.OTP_MAX_ATTEMPTS - otp.attempts;
    throw ApiError.badRequest(
      left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Request a new code.',
      undefined,
      left > 0 ? ERROR_CODES.OTP_INVALID : ERROR_CODES.OTP_TOO_MANY_ATTEMPTS,
    );
  }
  otp.consumedAt = new Date();
  await otp.save();
};
