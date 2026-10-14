/**
 * Dev helper: imports sample bank SMS for a user so the bank inbox can be tested without SMS access
 * (Expo Go, iOS, web, or an older build).
 * Usage: `pnpm --filter @expense/api seed:bank +919876543210` (phone or email of the account).
 * The SMS go through the same parser as the app; running it again adds nothing new.
 */
import { ingestBankTransactionsSchema, parseBankSms } from '@expense/shared';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { env } from '../config/env';
import { User } from '../modules/users/user.model';
import { ingest } from '../modules/bank/bankTransaction.service';

const HOUR = 60 * 60 * 1000;

const SAMPLES = [
  { sender: 'VM-HDFCBK-S', body: 'Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 14/10/26 Ref 627812345678 Not You? Call 18002586161' },
  { sender: 'AX-ICICIT-S', body: 'ICICI Bank Acct XX5678 debited for Rs 1,200.00 on 13-Oct-26; RAHUL SHARMA credited. UPI:628811223344. Call 18002662 for dispute.' },
  { sender: 'JD-SBIUPI-S', body: 'Dear UPI user A/C X9012 debited by 3600.0 on date 12Oct26 trf to ELECTRICITY BOARD Refno 628899887766. If not u? call 1800111109. -SBI' },
  { sender: 'BZ-KOTAKB-S', body: 'Rs.899.00 spent on Kotak Bank Card XX4321 at AMAZON on 12/10/2026. Avl limit Rs 45,000.00. Not you? Call 18602662666' },
  { sender: 'VM-HDFCBK-S', body: 'Rs.1500.00 credited to HDFC Bank A/c XX1234 on 11-10-26 from VPA priya@okaxis (UPI 628712345678)' },
  { sender: 'AD-AXISBK-S', body: 'INR 45,000.00 credited to A/c no. XX7788 on 01-10-26 by NEFT-ACME PVT LTD SALARY. Avl Bal INR 82,310.50 -Axis Bank' },
  { sender: 'VM-HDFCBK-S', body: '482913 is the OTP for txn of Rs 999.00 at FLIPKART on HDFC Bank card ending 1234. Valid for 5 mins.' },
];

const main = async () => {
  if (env.isProduction) throw new Error('seed:bank is for local development only');
  const who = process.argv[2]?.trim();
  if (!who) throw new Error('Pass the phone (e.g. +919876543210) or email of the account to seed');

  await connectDatabase();
  const user = await User.findOne(who.includes('@') ? { email: who.toLowerCase() } : { phone: who.replace(/[\s()-]/g, '') });
  if (!user) throw new Error(`No user found for "${who}"`);

  const now = Date.now();
  const parsed = SAMPLES.map((s, i) => parseBankSms({ ...s, receivedAt: now - (i + 1) * 5 * HOUR })).filter((p) => p !== null);
  const { items } = ingestBankTransactionsSchema.parse({ items: parsed });
  const result = await ingest(user, items);
  console.log(`Parsed ${items.length} of ${SAMPLES.length} sample SMS; added ${result.added} new for ${user.name ?? who}`);
};

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
