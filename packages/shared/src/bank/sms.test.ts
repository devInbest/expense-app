import { describe, expect, it } from 'vitest';
import { merchantKey, parseBankSms } from './sms';

const at = Date.UTC(2026, 9, 5, 4, 30);
const parse = (sender: string, body: string) => parseBankSms({ sender, body, receivedAt: at });

describe('parseBankSms: debits', () => {
  it.each([
    {
      bank: 'HDFC UPI',
      sender: 'AX-HDFCBK-S',
      body: 'Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 05/10/26\nRef 627812345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808',
      expected: { amount: 25000, counterparty: 'SWIGGY', bank: 'HDFC Bank', accountMask: '1234', reference: '627812345678', paymentMethod: 'upi' },
    },
    {
      bank: 'HDFC debit card',
      sender: 'VM-HDFCBK',
      body: 'Thank you for using your HDFC Bank Debit Card ending 4455 for Rs 1,250.50 at DMART AVENUE on 2026-10-05:10:20:11 Authorization code:- 123456',
      expected: { amount: 125050, counterparty: 'DMART AVENUE', accountMask: '4455', paymentMethod: 'card' },
    },
    {
      bank: 'SBI UPI (no currency symbol)',
      sender: 'JD-SBIUPI-S',
      body: 'Dear UPI user A/C X5678 debited by 120.0 on date 05Oct26 trf to ZOMATO LTD Refno 627811112222. If not u? call 1800111109. -SBI',
      expected: { amount: 12000, counterparty: 'ZOMATO LTD', bank: 'SBI', accountMask: '5678', reference: '627811112222' },
    },
    {
      bank: 'ICICI UPI',
      sender: 'BP-ICICIT',
      body: 'ICICI Bank Acct XX901 debited for Rs 349.00 on 05-Oct-26; Netflix credited. UPI:627855556666. Call 18002662 for dispute. SMS BLOCK 901 to 9215676766.',
      expected: { amount: 34900, counterparty: 'Netflix', bank: 'ICICI Bank', accountMask: '901', reference: '627855556666' },
    },
    {
      bank: 'ICICI credit card',
      sender: 'VK-ICICIB',
      body: 'INR 2,499.00 spent using ICICI Bank Card XX4321 on 05-Oct-26 on AMAZON PAY IN. Avl Limit: INR 1,20,000.00. If not you, call 1800 2662/SMS BLOCK 4321 to 9215676766',
      expected: { amount: 249900, counterparty: 'AMAZON PAY IN', accountMask: '4321', paymentMethod: 'card' },
    },
    {
      bank: 'Axis UPI',
      sender: 'VM-AXISBK-S',
      body: 'INR 500.00 debited\nA/c no. XX2345\n05-10-26, 10:15:22\nUPI/P2M/627877778888/BLINKIT\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank',
      expected: { amount: 50000, counterparty: 'BLINKIT', bank: 'Axis Bank', accountMask: '2345', reference: '627877778888' },
    },
    {
      bank: 'Kotak UPI to a VPA',
      sender: 'AD-KOTAKB',
      body: 'Sent Rs.80.00 from Kotak Bank AC X6789 to paytmqr123@paytm on 05-10-26.UPI Ref 627899990000. Not you, https://kotak.com/KBANKT/Fraud',
      expected: { amount: 8000, counterparty: 'paytmqr123@paytm', bank: 'Kotak Bank', accountMask: '6789', reference: '627899990000' },
    },
    {
      bank: 'Canara (Dr/Cr wording)',
      sender: 'CANBNK',
      body: 'A/c XX1234 Dr with Rs 750.00 on 05-10-2026 by UPI ref 627812341234. Bal Rs 5,000 CR -Canara Bank',
      expected: { amount: 75000, bank: 'Canara Bank', accountMask: '1234', reference: '627812341234' },
    },
    {
      bank: 'Bank of Baroda',
      sender: 'BV-BOBTXN',
      body: 'Rs.150.00 Dr. from A/C XXXXXX1234 and Cr. to vendor@upi. Ref:627812349999. AvlBal:Rs5000.00(2026:10:05 10:20:30) -Bank of Baroda',
      expected: { amount: 15000, counterparty: 'vendor@upi', bank: 'Bank of Baroda', accountMask: '1234' },
    },
    {
      bank: 'ATM withdrawal',
      sender: 'VM-PNBSMS',
      body: 'Rs.2000 withdrawn at ATM S1AW000123 from A/c XX1234 on 05Oct26. Avl Bal Rs.10000',
      expected: { amount: 200000, bank: 'Punjab National Bank', accountMask: '1234' },
    },
    {
      bank: 'Paytm wallet',
      sender: 'VM-iPaytm',
      body: 'Paid Rs.120 to Chai Point from Paytm Balance. Updated Balance: Rs.500. Order ID 1234567',
      expected: { amount: 12000, counterparty: 'Chai Point', bank: 'Paytm' },
    },
    {
      bank: 'an unknown bank',
      sender: 'VK-XYZBNK',
      body: 'Your A/c XX9999 is debited with INR 1,000.00 towards NEFT to ACME CORP. Ref UTR N123456789',
      expected: { amount: 100000, counterparty: 'ACME CORP', accountMask: '9999', reference: 'N123456789' },
    },
    {
      bank: 'UPI AutoPay execution',
      sender: 'JM-HDFCBK',
      body: 'Rs.199.00 debited from A/c XX1234 for UPI AutoPay mandate towards NETFLIX on 05-10-26. UPI Ref 627800001111',
      expected: { amount: 19900, counterparty: 'NETFLIX' },
    },
  ])('$bank', ({ sender, body, expected }) => {
    expect(parse(sender, body)).toMatchObject({ direction: 'debit', ...expected });
  });
});

describe('parseBankSms: credits', () => {
  it.each([
    {
      bank: 'HDFC',
      sender: 'AX-HDFCBK',
      body: 'Credit Alert!\nRs.1500.00 credited to HDFC Bank A/c XX1234 on 05-10-26 from VPA rahul.s@okicici (UPI 627898765432)',
      expected: { amount: 150000, counterparty: 'rahul.s@okicici', reference: '627898765432' },
    },
    {
      bank: 'SBI',
      sender: 'VM-SBIINB',
      body: 'Dear SBI User, your A/c X5678-credited by Rs.5000 on 05Oct26 transfer from PRIYA SHARMA Ref No 627833334444 -SBI',
      expected: { amount: 500000, counterparty: 'PRIYA SHARMA', accountMask: '5678', reference: '627833334444' },
    },
    {
      bank: 'Kotak',
      sender: 'AD-KOTAKB-S',
      body: 'Received Rs.500.00 in your Kotak Bank AC X6789 from amit@ybl on 05-10-26.UPI Ref:627811110000.',
      expected: { amount: 50000, counterparty: 'amit@ybl', accountMask: '6789' },
    },
    {
      bank: 'a refund',
      sender: 'VM-ICICIB',
      body: 'Refund of Rs 299.00 for your order has been credited to A/c XX1234',
      expected: { amount: 29900, accountMask: '1234' },
    },
    {
      bank: 'a reversal of a failed payment',
      sender: 'VM-HDFCBK',
      body: 'Rs 500 debited from A/c XX1234 on 01-10-26 for a failed txn has been reversed',
      expected: { amount: 50000 },
    },
    {
      bank: 'a salary NEFT',
      sender: 'VM-AXISBK',
      body: 'INR 85,000.00 credited to A/c no. XX2345 on 01-10-26 by NEFT from ACME TECHNOLOGIES PVT LTD. Avl Bal INR 1,02,345.67',
      expected: { amount: 8500000, counterparty: 'ACME TECHNOLOGIES PVT LTD' },
    },
  ])('$bank', ({ sender, body, expected }) => {
    expect(parse(sender, body)).toMatchObject({ direction: 'credit', ...expected });
  });
});

describe('parseBankSms: ignored messages', () => {
  it.each([
    ['a balance alert', 'VM-HDFCBK', 'Your A/c XX1234 balance is Rs 10,000 as on 05-Oct'],
    ['an OTP', 'VM-HDFCBK', '123456 is your OTP for txn of Rs 500 at AMAZON on HDFC Bank card xx1234. Valid for 5 mins.'],
    ['an OTP (code last)', 'VM-ICICIB', 'OTP for transaction of INR 999.00 at FLIPKART on ICICI Bank Card XX4321 is 845123. Do not share.'],
    ['a collect request', 'VM-HDFCBK', 'rahul@ybl has requested money Rs 200 from you. Approve on your UPI app. Ignore if not known.'],
    ['a failed payment', 'VM-SBIUPI', 'Your txn of Rs 500 from A/c XX1234 has failed.'],
    ['a pre-debit notice', 'VM-HDFCBK', 'Rs 199 will be debited from your A/c XX1234 on 07-10-26 for Netflix mandate'],
    ['a card bill reminder', 'VM-SBICRD', 'Total Amt Due Rs 12,345 for SBI Card XX1234 is due on 15-10-26.'],
    ['a mandate setup', 'VM-HDFCBK', 'UPI AutoPay mandate for Rs 199 towards Netflix has been created successfully on A/c XX1234.'],
    ['a text from a personal number', '+919876543210', 'Rs 500 debited from A/c XX1234'],
    ['a merchant promo', 'VM-SWIGGY', 'Congratulations! You received Rs 100 cashback offer. Order now.'],
    ['a loan offer', 'VM-BAJAJF', 'You are eligible for a pre-approved loan of up to Rs 5,00,000. Apply now.'],
  ])('%s', (_label, sender, body) => {
    expect(parse(sender, body)).toBeNull();
  });
});

describe('parseBankSms: fingerprints', () => {
  it('matches two alerts for the same UPI payment', () => {
    const a = parse('AX-HDFCBK', 'Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 05/10/26 Ref 627812345678');
    const b = parseBankSms({
      sender: 'VM-HDFCBK',
      body: 'Rs.250.00 debited from A/c XX1234 to VPA swiggy@icici UPI Ref 627812345678',
      receivedAt: at + 90_000,
    });
    expect(a!.fingerprint).toBe(b!.fingerprint);
  });

  it('separates payments without a reference by time', () => {
    const body = 'Rs.2000 withdrawn at ATM from A/c XX1234';
    const a = parseBankSms({ sender: 'VM-PNBSMS', body, receivedAt: at });
    const b = parseBankSms({ sender: 'VM-PNBSMS', body, receivedAt: at + 10 * 60_000 });
    expect(a!.fingerprint).not.toBe(b!.fingerprint);
  });

  it('uses the SMS time as the transaction time', () => {
    expect(parse('AX-HDFCBK', 'Sent Rs.10 From HDFC Bank A/C *1234 To X On 01/01/20')!.occurredAt).toBe(new Date(at).toISOString());
  });
});

describe('merchantKey', () => {
  it('normalises names', () => {
    expect(merchantKey('  ZOMATO   LTD. ')).toBe('zomato ltd.');
    expect(merchantKey('Swiggy@ICICI')).toBe('swiggy@icici');
  });
});
