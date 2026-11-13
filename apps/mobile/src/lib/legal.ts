import { config } from './config';

/**
 * Privacy Policy and Terms & Conditions shown in the app (Profile → About, and the sign-in screen).
 *
 * Written to match what the app actually does with data. Before publishing, have it reviewed for your
 * jurisdiction, set EXPO_PUBLIC_SUPPORT_EMAIL, and bump LEGAL_UPDATED whenever the text changes.
 */
export type LegalDocId = 'privacy' | 'terms';

export interface LegalSection {
  heading: string;
  /** Paragraphs. */
  body?: string[];
  /** Bullet points, shown after the paragraphs. */
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export const APP_NAME = 'ExpenseHog';
export const LEGAL_UPDATED = '13 November 2026';

const contact = config.supportEmail
  ? `Write to us at ${config.supportEmail}.`
  : 'Contact us through the support details on our app store listing.';

const privacy: LegalDoc = {
  title: 'Privacy Policy',
  intro: `This policy explains what ${APP_NAME} collects, why, who it is shared with, and the choices you have. We only collect what the app needs to work, and we never sell your data.`,
  sections: [
    {
      heading: 'What we collect',
      bullets: [
        'Account details: your name, and your phone number or the email, name and photo from your Google account, depending on how you sign in. You can also add a username and profile photo.',
        'Money you record: transactions, amounts, categories, notes, recipient names, payment method, dates, receipts you attach, budgets, recurring entries and self transfers.',
        'Saved accounts: a name you choose for each bank account or card and its last 4 digits. We never ask for or store full account numbers, card numbers, CVVs, PINs or bank passwords.',
        'UPI ID, if you add one.',
        'Rooms: rooms you create or join, shared expenses, splits, settlements and invites (including the phone numbers you invite).',
        'Device and usage: device model, operating system, app version, a push notification token, and basic app events such as screens opened and features used, so we can fix problems and improve the app.',
      ],
    },
    {
      heading: 'Bank SMS (Android only, optional)',
      body: [
        'If you allow SMS access, the app reads messages on your phone to find bank alerts. Messages are read on your device: anything that is not a bank transaction is ignored and never leaves your phone.',
        'For a bank alert, only the details needed to show the transaction are uploaded: amount, debit or credit, date, the other party’s name, the bank, the masked account digits, the reference number and the payment method. The full text of your messages is never uploaded.',
        'You can turn this off at any time by removing SMS permission in your phone’s settings.',
      ],
    },
    {
      heading: 'How we use it',
      bullets: [
        'To run the app: save and sync your records across your devices, show totals and insights, and send the reminders and alerts you have turned on.',
        'To run rooms: show shared expenses and balances to the members of that room.',
        'To keep your account secure: verify sign-ins, manage your signed-in devices and prevent abuse.',
        'To understand how the app is used and fix problems.',
      ],
    },
    {
      heading: 'Who can see your information',
      bullets: [
        'Your personal transactions, saved accounts, budgets and self transfers are private to you.',
        'Members of a room you are in can see your name, profile photo, the expenses and payments in that room, and your UPI ID so they can pay you back.',
        'People searching to invite someone can find you by your exact phone number or username, and see your name and photo.',
      ],
    },
    {
      heading: 'Service providers',
      body: [
        'We use trusted providers to run the app: cloud hosting and database services, file storage for receipts and photos, an SMS provider to send sign-in codes, Google for Google sign-in, and Expo for push notifications and app updates. They process data only to provide their service to us.',
        'We do not sell your personal data, and we do not share it with advertisers.',
      ],
    },
    {
      heading: 'Storage and security',
      body: [
        'Data is sent over encrypted connections. Sign-in tokens are stored in your phone’s secure storage. Records you add offline are kept on your device until they sync.',
        'No system is perfectly secure, but we take reasonable steps to protect your information.',
      ],
    },
    {
      heading: 'How long we keep it',
      bullets: [
        'Your data is kept while your account is active.',
        'Sign-in codes expire within minutes. Usage events are deleted after 90 days and security logs after one year.',
        'When you delete your account, we delete your transactions, bank transactions, self transfers, budgets, recurring entries, categories, saved accounts, UPI ID, notifications and devices, and remove your phone number, email, username and photo.',
        'Expenses you shared in rooms stay visible to the other members, so their balances stay correct, but your name is replaced with “Former member”.',
      ],
    },
    {
      heading: 'Your choices',
      bullets: [
        'Edit your profile, saved accounts and UPI ID at any time.',
        'Turn notifications on or off in Profile → Notifications.',
        'Download your transactions from Profile → Report.',
        'Sign out of other devices from Profile → Devices.',
        'Delete your account from Profile → Delete account.',
      ],
    },
    {
      heading: 'Children',
      body: [`${APP_NAME} is not meant for children under 13, and we do not knowingly collect their data.`],
    },
    {
      heading: 'Changes to this policy',
      body: ['If we make important changes, we will let you know in the app. The date at the top shows when this policy last changed.'],
    },
    {
      heading: 'Contact',
      body: [`Questions about your privacy or a request about your data? ${contact}`],
    },
  ],
};

const terms: LegalDoc = {
  title: 'Terms & Conditions',
  intro: `These terms apply when you use ${APP_NAME}. By creating an account or using the app, you agree to them. If you do not agree, please do not use the app.`,
  sections: [
    {
      heading: 'What the app does',
      body: [
        `${APP_NAME} helps you keep track of your own spending and income, budgets, self transfers between your accounts, and expenses you share with others in rooms.`,
        `It is a record-keeping tool. ${APP_NAME} is not a bank or a payment service: it does not hold or move money, and does not connect to your bank. Payments you make through UPI or other apps happen in those apps.`,
      ],
    },
    {
      heading: 'Your account',
      bullets: [
        'You must be at least 13 years old, and old enough to agree to these terms where you live.',
        'Give accurate sign-in details and keep your phone and accounts secure. You are responsible for what happens under your account.',
        'Tell us if you think someone else has accessed your account. You can sign out of all devices from Profile → Devices.',
      ],
    },
    {
      heading: 'Your content',
      body: [
        'You own the information you add. You give us permission to store and process it only to provide the app to you and, for rooms, to the other members of that room.',
        'You are responsible for the accuracy of what you record, including amounts, splits and settlements.',
      ],
    },
    {
      heading: 'Rooms and shared expenses',
      bullets: [
        'Balances in a room are worked out from what members record. They are a helpful summary, not a legal record of debt.',
        'Settling up happens outside the app, between members. We are not part of any payment or dispute between members.',
        'Only invite people you know, and only share what you are comfortable with the room seeing.',
      ],
    },
    {
      heading: 'Bank SMS import',
      body: [
        'Bank SMS import is optional and works on Android only. Transactions are read from your bank’s messages automatically and may sometimes be missed or read incorrectly. Please check them before saving.',
      ],
    },
    {
      heading: 'Acceptable use',
      bullets: [
        'Do not use the app for anything illegal, fraudulent or harmful.',
        'Do not try to access other people’s data, break or overload the service, or reverse-engineer it.',
        'Do not use rooms or invites to spam or harass anyone.',
      ],
    },
    {
      heading: 'Not financial advice',
      body: [
        'Totals, insights, budgets and alerts are for information only. They are not financial, tax or legal advice. Please check important figures against your bank statements.',
      ],
    },
    {
      heading: 'Availability',
      body: [
        'We work to keep the app running and your data safe, but the app is provided “as is”. It may sometimes be unavailable, change, or have errors. Records you add offline are only saved to your account once they sync.',
      ],
    },
    {
      heading: 'Limitation of liability',
      body: [
        `To the extent the law allows, ${APP_NAME} is not responsible for indirect losses, or for losses caused by incorrect records, missed or misread bank messages, or decisions made using the app. Nothing in these terms limits rights you have under consumer law that cannot be excluded.`,
      ],
    },
    {
      heading: 'Ending your use',
      body: [
        'You can stop using the app and delete your account at any time from Profile → Delete account. We may suspend or close accounts that break these terms or put other users or the service at risk.',
      ],
    },
    {
      heading: 'Changes to these terms',
      body: ['We may update these terms. If the changes are important, we will tell you in the app. Using the app after an update means you accept the new terms.'],
    },
    {
      heading: 'Governing law',
      body: ['These terms are governed by the laws of India, and disputes fall under the jurisdiction of the courts of India.'],
    },
    {
      heading: 'Contact',
      body: [`Questions about these terms? ${contact}`],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = { privacy, terms };
