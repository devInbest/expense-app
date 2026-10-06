import { env } from '../config/env';

export interface SmsMessage {
  to: string;
  text: string;
  /** Provider template (MSG91 DLT flows need one per message type in India). */
  templateId?: string;
  vars?: Record<string, string>;
}

interface SmsProvider {
  send(msg: SmsMessage): Promise<void>;
}

const consoleProvider: SmsProvider = {
  async send(msg) {
    console.log(`[sms:console] to=${msg.to} :: ${msg.text}`);
  },
};

const msg91Provider: SmsProvider = {
  async send(msg) {
    const res = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: { authkey: env.sms.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        template_id: msg.templateId || env.sms.templateId,
        sender: env.sms.senderId,
        short_url: '0',
        recipients: [{ mobiles: msg.to.replace(/^\+/, ''), ...(msg.vars ?? {}) }],
      }),
    });
    if (!res.ok) throw new Error(`MSG91 error ${res.status}: ${await res.text()}`);
  },
};

const twilioProvider: SmsProvider = {
  async send(msg) {
    const { twilioAccountSid: sid, twilioAuthToken: token, twilioFrom: from } = env.sms;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: msg.to, From: from, Body: msg.text }),
    });
    if (!res.ok) throw new Error(`Twilio error ${res.status}: ${await res.text()}`);
  },
};

const providers: Record<typeof env.sms.provider, SmsProvider> = {
  console: consoleProvider,
  msg91: msg91Provider,
  twilio: twilioProvider,
};

export const isConsoleSms = () => env.sms.provider === 'console';

export const sendSms = (msg: SmsMessage) => providers[env.sms.provider].send(msg);
