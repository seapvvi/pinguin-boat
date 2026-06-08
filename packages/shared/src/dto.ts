import {
  ModerationCaseType,
  PremiumPlanTier,
  TicketStatus,
} from './enums';
import type {
  GuildConfig,
  ModCase,
  TicketData,
  Giveaway,
  Poll,
  Suggestion,
  LeaderboardEntry,
  Deployment,
  Changelog,
  BlacklistEntry,
  GuildBlacklistUser,
  SystemMetrics,
  APIResponse,
  PaginationParams,
  XPProfile,
  EconomyWallet,
  Announcement,
  ErrorLog,
} from './types';

export interface LoginResponseDTO {
  url: string;
}

export interface AuthCallbackDTO {
  token: string;
  userId: string;
  username: string;
  discriminator: string;
  avatar: string;
  guilds: AuthGuildDTO[];
}

export interface AuthGuildDTO {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  botPresent: boolean;
}

export interface GuildListDTO {
  guilds: GuildItemDTO[];
}

export interface GuildItemDTO {
  id: string;
  name: string;
  icon: string | null;
  ownerId: string;
  memberCount: number;
  botPresent: boolean;
  premium: PremiumPlanTier;
}

export interface GuildSettingsDTO {
  guild: GuildConfig;
}

export type UpdateGuildSettingsDTO = Partial<GuildConfig>;

export interface CreateModCaseDTO {
  type: ModerationCaseType;
  userId: string;
  reason: string;
  duration?: number;
}

export interface ModCaseListDTO {
  cases: ModCase[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface CreateTicketDTO {
  category: string;
  subject: string;
  description: string;
}

export interface TicketListDTO {
  tickets: TicketData[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface UpdateTicketDTO {
  status?: TicketStatus;
  claimedById?: string | null;
}

export interface CreateGiveawayDTO {
  prize: string;
  winners: number;
  duration: number;
  requirements: {
    minAccountAge?: number;
    minGuildJoinTime?: number;
    requiredRoleId?: string | null;
    boostRequired?: boolean;
  };
}

export interface GiveawayListDTO {
  giveaways: Giveaway[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface CreatePollDTO {
  question: string;
  options: string[];
  duration: number;
  anonymous?: boolean;
  multiChoice?: boolean;
}

export interface PollListDTO {
  polls: Poll[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface SubmitSuggestionDTO {
  content: string;
}

export interface SuggestionListDTO {
  suggestions: Suggestion[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface SuggestionResponseDTO {
  suggestionId: string;
  action: 'APPROVED' | 'REJECTED';
  response: string;
}

export interface XPLeaderboardDTO {
  entries: LeaderboardEntry[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface XPProfileDTO {
  profile: XPProfile;
  rank: number;
}

export interface EconomyLeaderboardDTO {
  entries: (LeaderboardEntry & { wallet: number; bank: number })[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface EconomyWalletDTO {
  wallet: EconomyWallet;
}

export interface DeployRequestDTO {
  confirm: boolean;
}

export interface RollbackRequestDTO {
  version?: string;
  confirm: boolean;
}

export interface DeploymentListDTO {
  deployments: Deployment[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface ChangelogCreateDTO {
  title: string;
  content: string;
  version: string;
}

export interface ChangelogListDTO {
  entries: Changelog[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface BlacklistTargetDTO {
  targetId: string;
  reason: string;
  targetType: 'USER' | 'GUILD';
}

export interface BlacklistListDTO {
  entries: BlacklistEntry[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface GuildBlacklistListDTO {
  entries: GuildBlacklistUser[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface AnnouncementListDTO {
  entries: Announcement[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface ErrorLogListDTO {
  entries: ErrorLog[];
  pagination: PaginationParams & { total: number; totalPages: number };
}

export interface OwnerActionDTO {
  action:
    | 'FORCE_LEAVE'
    | 'SERVICE_RESTART'
    | 'BACKUP_CREATE'
    | 'BACKUP_RESTORE'
    | 'GLOBAL_ANNOUNCEMENT'
    | 'ALPHA_TOGGLE';
  details?: Record<string, unknown>;
}

export interface SystemMetricsDTO {
  metrics: SystemMetrics;
}

export interface PremiumGrantDTO {
  userId?: string;
  guildId?: string;
  plan: PremiumPlanTier;
}

export interface FeatureFlagDTO {
  key: string;
  enabled: boolean;
}

export interface MusicControlDTO {
  action:
    | 'PLAY'
    | 'PAUSE'
    | 'RESUME'
    | 'SKIP'
    | 'STOP'
    | 'VOLUME'
    | 'LOOP'
    | 'SHUFFLE'
    | 'QUEUE';
  value?: string | number | boolean;
}

export type {
  APIResponse,
  PaginationParams,
};
