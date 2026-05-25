import {
  ModuleName,
  ModerationCaseType,
  TicketStatus,
  LogEventType,
  DeploymentStatus,
  PremiumPlanTier,
} from './enums';

export interface GuildConfig {
  id: string;
  guildId: string;
  locale: string;
  prefix: string;
  premium: PremiumPlanTier;
  premiumSince: string | null;
  alphaMode: boolean;
  disabledModules: ModuleName[];
  moderation: ModerationSettings;
  protection: ProtectionSettings;
  tickets: TicketSettings;
  logs: LogSettings;
  levels: LevelSettings;
  economy: EconomySettings;
  music: MusicSettings;
  welcome: WelcomeSettings;
  autoroles: AutoroleSettings;
  embeds: EmbedPreset[];
  createdAt: string;
  updatedAt: string;
}

export interface ModerationSettings {
  enabled: boolean;
  modLogChannelId: string | null;
  modRoleId: string | null;
  adminRoleId: string | null;
  muteRoleId: string | null;
  defaultMuteDuration: number;
  maxWarns: number;
  warnPunishment: ModerationCaseType | null;
  dmOnWarn: boolean;
  dmOnMute: boolean;
  dmOnKick: boolean;
  dmOnBan: boolean;
}

export interface ProtectionSettings {
  enabled: boolean;
  emergencyMode?: boolean;
  antiRaid: boolean;
  raidThreshold: number;
  raidInterval: number;
  antiSpam: boolean;
  spamThreshold: number;
  spamInterval: number;
  antiLink: boolean;
  allowedLinks: string[];
  antiMassMention: boolean;
  mentionThreshold: number;
  antiAlts: boolean;
  altAccountAge: number;
  verificationLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  captchaVerification: boolean;
}

export interface TicketSettings {
  enabled: boolean;
  categoryId: string | null;
  ticketChannelId: string | null;
  supportRoleIds: string[];
  ticketLimit: number;
  closeOnLeave: boolean;
  loggingEnabled: boolean;
  transcriptEnabled: boolean;
  customMessage: string | null;
  allowedCategories: string[];
}

export interface LogSettings {
  enabled: boolean;
  logChannelId: string | null;
  enabledEvents: LogEventType[];
  ignoreChannels: string[];
  ignoreUsers: string[];
}

export interface LevelSettings {
  enabled: boolean;
  xpRate: number;
  voiceXpRate: number;
  xpCooldown: number;
  levelUpMessage: string | null;
  levelUpChannelId: string | null;
  stackRoles: boolean;
  roleRewards: RoleReward[];
}

export interface RoleReward {
  level: number;
  roleId: string;
}

export interface EconomySettings {
  enabled: boolean;
  currencyName: string;
  currencySymbol: string;
  dailyAmount: number;
  weeklyAmount: number;
  workMin: number;
  workMax: number;
  workCooldown: number;
  robberyEnabled: boolean;
  robberyCooldown: number;
  robberyMaxAmount: number;
  interestRate: number;
  interestInterval: number;
  bankCapacity: number;
  startupBalance: number;
  shopItems: ShopItem[];
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  roleId: string | null;
  isStackable: boolean;
}

export interface MusicSettings {
  enabled: boolean;
  maxQueueLength: number;
  maxPlaylistLength: number;
  defaultVolume: number;
  allowDjRole: boolean;
  djRoleId: string | null;
  restrictToVoiceChannel: boolean;
  voiceChannelId: string | null;
  announceTracks: boolean;
}

export interface WelcomeSettings {
  enabled: boolean;
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  welcomeEmbed: boolean;
  goodbyeChannelId: string | null;
  goodbyeMessage: string | null;
  goodbyeEmbed: boolean;
  dmWelcome: boolean;
  dmWelcomeMessage: string | null;
  welcomeImageUrl: string | null;
}

export interface AutoroleSettings {
  enabled: boolean;
  roleIds: string[];
  delay: number;
  botRoles: string[];
  ignoreBots: boolean;
}

export interface EmbedPreset {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  color: string;
  fields: EmbedField[];
  footer: string | null;
  thumbnail: string | null;
  image: string | null;
  timestamp: boolean;
}

export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface UserSession {
  userId: string;
  guildId: string;
  permissions: bigint;
  expires: string;
}

export interface OwnerSession {
  userId: string;
  twoFactorVerified: boolean;
  ip: string;
  userAgent: string;
}

export interface ModCase {
  id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  type: ModerationCaseType;
  reason: string;
  duration: number | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface TicketData {
  id: string;
  guildId: string;
  channelId: string;
  creatorId: string;
  status: TicketStatus;
  categoryId: string | null;
  claimedById: string | null;
  transcriptId?: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface XPProfile {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  voiceXp: number;
  messageCount: number;
  voiceMinutes: number;
  lastMessageAt: string | null;
  lastVoiceAt: string | null;
}

export interface EconomyWallet {
  userId: string;
  guildId: string;
  wallet: number;
  bank: number;
  totalEarned: number;
  lastDailyAt: string | null;
}

export interface MusicQueue {
  guildId: string;
  tracks: TrackInfo[];
  currentTrack: TrackInfo | null;
  loopMode: 'NONE' | 'QUEUE' | 'TRACK';
  autoplay: boolean;
}

export interface Giveaway {
  id: string;
  guildId: string;
  channelId: string;
  prize: string;
  winnerCount: number;
  duration: number;
  endsAt: string;
  requirements: GiveawayRequirements;
  entries: string[];
  status: 'RUNNING' | 'ENDING_SOON' | 'ENDED' | 'CANCELLED';
}

export interface GiveawayRequirements {
  minAccountAge: number;
  minGuildJoinTime: number;
  requiredRoleId: string | null;
  boostRequired: boolean;
}

export interface Poll {
  id: string;
  guildId: string;
  channelId: string;
  question: string;
  options: PollOption[];
  votes: Record<string, string>;
  status: 'ACTIVE' | 'CLOSED' | 'DELETED';
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface Suggestion {
  id: string;
  guildId: string;
  channelId: string;
  authorId: string;
  content: string;
  votes: SuggestionVotes;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED';
  staffResponse: StaffResponse | null;
}

export interface SuggestionVotes {
  up: number;
  down: number;
}

export interface StaffResponse {
  moderatorId: string;
  response: string;
  action: 'APPROVED' | 'REJECTED';
  timestamp: string;
}

export interface Deployment {
  id: string;
  version: string;
  releasePath: string;
  status: DeploymentStatus;
  startedAt: string;
  completedAt: string | null;
  log: string[];
}

export interface Changelog {
  id: string;
  title: string;
  content: string;
  version: string;
  authorId: string;
  createdAt: string;
}

export interface SystemMetrics {
  cpu: number;
  ram: { used: number; total: number; percent: number };
  uptime: number;
  guilds: number;
  users: number;
  commandsExecuted: number;
  messagesToday: number;
  activeChannels: number;
}

export interface PremiumFeature {
  key: string;
  enabled: boolean;
  tier: PremiumPlanTier;
}

export interface BlacklistEntry {
  id: string;
  targetId: string;
  targetType: 'USER' | 'GUILD';
  reason: string;
  moderatorId: string;
  createdAt: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface GuildKPIs {
  totalMembers: number;
  onlineMembers: number;
  channels: number;
  roles: number;
  moderationCases: number;
  xpEnabled: boolean;
  economyEnabled: boolean;
  musicEnabled: boolean;
}

export interface BotStats {
  totalGuilds: number;
  totalUsers: number;
  totalCommands: number;
  uptime: number;
  cpuUsage: number;
  ramUsage: number;
  premiumRevenue: number;
  systemStatus: 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE' | 'CRITICAL';
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  xp: number;
  level: number;
  guildId: string;
}

export interface TrackInfo {
  title: string;
  url: string;
  duration: number;
  thumbnail: string;
  author: string;
  source: 'YOUTUBE' | 'SPOTIFY' | 'SOUNDCLOUD' | 'OTHER';
}

export interface QueueState {
  tracks: TrackInfo[];
  currentTrack: TrackInfo | null;
  position: number;
  loopMode: 'NONE' | 'QUEUE' | 'TRACK';
  autoplay: boolean;
  volume: number;
}
