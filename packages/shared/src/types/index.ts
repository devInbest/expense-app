import type {
  ActorType,
  AdminRole,
  BudgetPeriod,
  CategoryOwnerType,
  InviteChannel,
  InviteStatus,
  MemberStatus,
  NotificationType,
  PaymentMethod,
  Platform,
  RecurringFrequency,
  RoomRole,
  RoomType,
  SplitType,
  TransactionType,
  UserStatus,
} from '../constants/enums';
import type { NotificationPrefs } from '../schemas/user';
import type { RoomSettings } from '../schemas/room';
import type { Debt } from '../money/balances';

/** Dates travel as ISO strings over JSON. */
export type ISODate = string;

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
  pagination?: PagePagination;
}

export interface ApiFailure {
  success: false;
  message: string;
  code?: string;
  errors?: { field: string; message: string }[];
}

export interface PagePagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface Paged<T> {
  items: T[];
  pagination: PagePagination;
}

// ---------- Auth / users ----------
export interface UserDTO {
  _id: string;
  name: string;
  username?: string;
  phone?: string;
  phoneVerified: boolean;
  email?: string;
  hasGoogle: boolean;
  avatarUrl?: string;
  defaultCurrency: string;
  timezone: string;
  locale: string;
  status: UserStatus;
  onboarded: boolean;
  notificationPrefs: NotificationPrefs;
  /** UPI ID or UPI number for receiving payments from room members. */
  upiId?: string;
  createdAt: ISODate;
}

/** What other people see about a user (room members, search results). */
export interface PublicUserDTO {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  /** Last 4 digits only, for disambiguation. */
  phoneHint?: string;
  /** Only included for fellow room members, so they can pay this user. */
  upiId?: string;
  deleted?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: UserDTO;
  isNewUser: boolean;
}

export interface OtpRequestResult {
  expiresInSeconds: number;
  resendInSeconds: number;
  /** Only returned when SMS_PROVIDER=console (development). */
  devCode?: string;
}

export interface SessionDTO {
  _id: string;
  deviceId: string;
  deviceName?: string;
  platform: Platform;
  appVersion?: string;
  ip?: string;
  lastUsedAt: ISODate;
  createdAt: ISODate;
  current?: boolean;
}

export interface AdminDTO {
  _id: string;
  name: string;
  userName: string;
  role: AdminRole;
  isActive: boolean;
  lastLogin?: ISODate;
  createdAt: ISODate;
}

export interface AdminAuthResult extends AuthTokens {
  admin: AdminDTO;
}

// ---------- Finance ----------
export interface CategoryDTO {
  _id: string;
  key?: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  ownerType: CategoryOwnerType;
}

export interface TransactionDTO {
  _id: string;
  clientId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  categoryId: string;
  note: string;
  paymentMethod: PaymentMethod;
  occurredAt: ISODate;
  receiptUrl?: string;
  tags: string[];
  recurringId?: string;
  version: number;
  deletedAt?: ISODate | null;
  /** Moved to the bin: hidden from lists and totals until restored. */
  binnedAt?: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface SyncPushResult {
  results: {
    clientId: string;
    status: 'applied' | 'conflict' | 'error';
    message?: string;
    transaction?: TransactionDTO;
  }[];
}

export interface SyncPullResult {
  changes: TransactionDTO[];
  /** Cursor for the next pull. */
  serverTime: ISODate;
  /** More changes are waiting; pull again with `serverTime`. */
  hasMore: boolean;
}

export interface BudgetDTO {
  _id: string;
  ownerType: 'user' | 'room';
  ownerId: string;
  categoryId: string | null;
  period: BudgetPeriod;
  amount: number;
  startDate?: ISODate;
  endDate?: ISODate;
  alertThresholds: number[];
  rollover: boolean;
}

export interface BudgetProgressDTO extends BudgetDTO {
  periodStart: ISODate;
  periodEnd: ISODate;
  spent: number;
  remaining: number;
  percent: number;
}

export interface RecurringRuleDTO {
  _id: string;
  template: {
    type: TransactionType;
    amount: number;
    categoryId: string;
    note: string;
    paymentMethod: PaymentMethod;
  };
  frequency: RecurringFrequency;
  interval: number;
  startDate: ISODate;
  endDate?: ISODate | null;
  nextRunAt: ISODate;
  lastRunAt?: ISODate;
  active: boolean;
}

export interface InsightsSummaryDTO {
  currency: string;
  totalExpense: number;
  totalIncome: number;
  net: number;
  count: number;
  byCategory: { categoryId: string; total: number; count: number }[];
  byDay: { date: string; expense: number; income: number }[];
  byPaymentMethod: { paymentMethod: PaymentMethod; total: number }[];
  previousPeriodExpense: number;
}

export interface UploadSignResult {
  uploadUrl: string;
  publicUrl: string;
  headers: Record<string, string>;
}

// ---------- Rooms ----------
export interface RoomMemberDTO {
  _id: string;
  user: PublicUserDTO;
  role: RoomRole;
  status: MemberStatus;
  joinedAt: ISODate;
  leftAt?: ISODate;
}

export interface RoomDTO {
  _id: string;
  name: string;
  type: RoomType;
  currency: string;
  icon: string;
  inviteCode?: string;
  settings: RoomSettings;
  createdBy: string;
  archivedAt?: ISODate | null;
  hasExpenses: boolean;
  createdAt: ISODate;
  myRole?: RoomRole;
  memberCount?: number;
  /** My net balance in the room (split rooms only). */
  myBalance?: number;
  /** What I've paid back to others in the room (split rooms, list view only). */
  myPaid?: number;
  members?: RoomMemberDTO[];
}

export interface RoomExpenseDTO {
  _id: string;
  roomId: string;
  amount: number;
  categoryId?: string;
  note: string;
  occurredAt: ISODate;
  paidBy: { userId: string; amount: number }[];
  splitType: SplitType;
  /** `paidAt` is set when the creator marks that person's share as paid back. */
  splits: {
    userId: string;
    share: number;
    amount: number;
    paidAt?: ISODate | null;
    /** Set when the person paid through a UPI app from here rather than being marked paid by the creator. */
    upiTxnId?: string | null;
    paidViaUpi?: boolean;
  }[];
  /** Set once everyone who owes on this expense is marked paid; the expense is then locked. */
  settledAt?: ISODate | null;
  receiptUrl?: string;
  /** How the creator paid the bill. */
  paymentMethod: PaymentMethod;
  /** The creator's UPI ID for paying them back. */
  upiId?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface SettlementDTO {
  _id: string;
  roomId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  method: PaymentMethod;
  note: string;
  settledAt: ISODate;
  recordedBy: string;
  confirmedAt?: ISODate | null;
  confirmedBy?: string | null;
  /** Present when the payment was created by marking a share of this expense as paid. */
  expenseId?: string;
  createdAt: ISODate;
}

export interface RoomBalancesDTO {
  currency: string;
  net: Record<string, number>;
  debts: Debt[];
  simplified: boolean;
  totalSpent: number;
  /** Each person's share of all expenses, i.e. what they spent. */
  spentBy: Record<string, number>;
}

/**
 * My share of room expenses over a period, only from rooms in my default currency.
 * Split rooms count my split amount; shared-budget rooms count what I paid.
 */
export interface RoomSpendingDTO {
  currency: string;
  total: number;
  count: number;
  byCategory: { categoryId: string; total: number; count: number }[];
  byDay: { date: string; total: number }[];
}

/** One room expense as it appears in my activity feed; `share` is my part of `amount`. */
export interface RoomSpendingItemDTO {
  expenseId: string;
  roomId: string;
  roomName: string;
  note: string;
  categoryId?: string;
  occurredAt: ISODate;
  amount: number;
  share: number;
}

export interface RoomBudgetSummaryDTO {
  currency: string;
  budget: BudgetProgressDTO | null;
  totalSpent: number;
  byMember: { userId: string; paid: number }[];
  byCategory: { categoryId: string; total: number }[];
}

export interface RoomInviteDTO {
  _id: string;
  room: Pick<RoomDTO, '_id' | 'name' | 'type' | 'icon' | 'currency'>;
  invitedBy: PublicUserDTO;
  channel: InviteChannel;
  phone?: string;
  targetUser?: PublicUserDTO;
  status: InviteStatus;
  expiresAt: ISODate;
  createdAt: ISODate;
}

export interface RoomPreviewDTO {
  _id: string;
  name: string;
  type: RoomType;
  icon: string;
  memberCount: number;
  alreadyMember: boolean;
}

// ---------- Notifications / activity ----------
export interface NotificationDTO {
  _id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt?: ISODate | null;
  createdAt: ISODate;
}

export interface ActivityLogDTO {
  _id: string;
  actorType: ActorType;
  actorId?: string;
  actorName?: string;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: ISODate;
}

export interface AppSettingsDTO {
  themeColor: string;
  minAppVersion: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

// ---------- Admin ----------
export interface AdminDashboardDTO {
  totals: {
    users: number;
    activeUsers: number;
    blockedUsers: number;
    rooms: number;
    transactions: number;
    roomExpenses: number;
  };
  dau: number;
  wau: number;
  mau: number;
  signupsSeries: { date: string; count: number }[];
  activeSeries: { date: string; count: number }[];
  transactionsSeries: { date: string; count: number }[];
  platformSplit: { platform: string; count: number }[];
  appVersionSplit: { appVersion: string; count: number }[];
  roomTypeSplit: { type: string; count: number }[];
  retention: { cohort: string; size: number; week1: number; week4: number }[];
}

export interface AdminUserRowDTO {
  _id: string;
  name: string;
  username?: string;
  phone?: string;
  email?: string;
  hasGoogle: boolean;
  status: UserStatus;
  lastActiveAt?: ISODate;
  createdAt: ISODate;
  transactionCount: number;
  roomCount: number;
}

export interface AdminUserDetailDTO {
  user: UserDTO & { lastActiveAt?: ISODate; blockedReason?: string; blockedAt?: ISODate };
  sessions: SessionDTO[];
  rooms: (Pick<RoomDTO, '_id' | 'name' | 'type' | 'currency'> & { role: RoomRole; status: MemberStatus })[];
  stats: {
    transactionCount: number;
    totalExpense: number;
    totalIncome: number;
    lastTransactionAt?: ISODate;
    appOpens30d: number;
    screenViews30d: number;
    categoriesUsed: number;
  };
}

export interface AdminRoomRowDTO {
  _id: string;
  name: string;
  type: RoomType;
  currency: string;
  memberCount: number;
  expenseCount: number;
  totalSpent: number;
  createdBy: PublicUserDTO;
  archivedAt?: ISODate | null;
  lastActivityAt?: ISODate;
  createdAt: ISODate;
}

export interface AdminEventsSummaryDTO {
  byName: { name: string; count: number; users: number }[];
  topScreens: { screen: string; count: number }[];
  byDay: { date: string; count: number }[];
  features: { feature: string; count: number; users: number }[];
}
