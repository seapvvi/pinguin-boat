import type {
  APIResponse,
  BotStats,
  GuildListDTO,
  GuildSettingsDTO,
  ModCaseListDTO,
  TicketListDTO,
  GiveawayListDTO,
  PollListDTO,
  SuggestionListDTO,
  XPLeaderboardDTO,
  XPProfileDTO,
  EconomyLeaderboardDTO,
  EconomyWalletDTO,
  DeploymentListDTO,
  ChangelogListDTO,
  BlacklistListDTO,
  GuildBlacklistListDTO,
  AnnouncementListDTO,
  ErrorLogListDTO,
  SystemMetricsDTO,
  StreamNotification,
} from '@pinguin/shared';

// ─── Shared pagination type ───────────────────────────────────────────────────
export interface Pagination {
  total?: number;
  totalPages?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

// ─── Shared entity interfaces ─────────────────────────────────────────────────

export interface OwnerLog {
  id: string;
  action: string;
  userId: string;
  username?: string;
  ip?: string;
  details?: string | null;
  success: boolean;
  createdAt: string;
}

export interface FeatureFlag {
  key: string;
  name: string;
  enabled: boolean;
  tier: string;
  description?: string;
}

export interface Service {
  name: string;
  displayName: string;
  status: 'RUNNING' | 'STOPPED' | 'ERROR' | 'RESTARTING';
  pid?: number;
  uptime?: number;
  memory?: number;
  cpu?: number;
  logs?: string[];
  lastHealthCheck?: string;
}

export interface OwnerUser {
  id: string;
  discordId: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  globalName: string | null;
  blacklisted: boolean;
  createdAt: string;
}

export interface OwnerServer {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  ownerId: string;
  ownerName: string;
  botStatus: 'ONLINE' | 'OFFLINE' | 'IDLE';
  blacklisted: boolean;
}

export interface ClanMember {
  id: string;
  userId: string;
  username: string;
  avatar: string | null;
  role: string;
  joinedAt: string;
}

export interface Clan {
  id: string;
  name: string;
  ownerId: string;
  description: string;
  tag?: string | null;
  icon?: string | null;
  memberCount?: number;
  totalXp?: number;
  totalWallet?: number;
  members?: ClanMember[];
  createdAt?: string;
}
export interface SystemMetricsSnapshot {
  id: string;
  cpuUsage: number;
  ramUsage: number;
  ramTotal: number;
  uptimeSeconds: number;
  guildCount: number;
  userCount: number;
  commandCount: number;
  messagesToday: number;
  activeChannels: number;
  onlineMembers: number;
  timestamp: string;
}

// ─── HTTP client ──────────────────────────────────────────────────────────────
interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

async function apiFetch<T = APIResponse<unknown>>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  fetchOptions.credentials = 'include';

  const method = (fetchOptions.method || 'GET').toUpperCase();
  const hasBody =
    fetchOptions.body !== undefined &&
    fetchOptions.body !== null &&
    method !== 'GET' &&
    method !== 'HEAD';

  const headers: Record<string, string> = {};
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  fetchOptions.headers = {
    ...headers,
    ...(fetchOptions.headers as Record<string, string>),
  };

  const response = await fetch(url, fetchOptions);

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 10;
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    const retryResponse = await fetch(url, fetchOptions);
    if (!retryResponse.ok) {
      const errorData = await retryResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur API: ${retryResponse.status}`);
    }
    const retryData = await retryResponse.json();
    return retryData;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erreur API: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

export const api = {
  get: <T = APIResponse<unknown>>(endpoint: string, params?: Record<string, string>) =>
    apiFetch<T>(endpoint, { params, method: 'GET' }),

  post: <T = APIResponse<unknown>>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T = APIResponse<unknown>>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  patch: <T = APIResponse<unknown>>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),

  delete: <T = APIResponse<unknown>>(endpoint: string) =>
    apiFetch<T>(endpoint, { method: 'DELETE' }),
};

// ─── API functions ────────────────────────────────────────────────────────────

export async function fetchOverview(): Promise<APIResponse<SystemMetricsDTO>> {
  return api.get<APIResponse<SystemMetricsDTO>>('/api/overview');
}

export async function fetchBotStats(): Promise<APIResponse<BotStats>> {
  return api.get<APIResponse<BotStats>>('/api/stats');
}

export async function fetchGuilds(): Promise<APIResponse<GuildListDTO>> {
  return api.get<APIResponse<GuildListDTO>>('/api/guilds');
}

export async function fetchGuildSettings(guildId: string): Promise<APIResponse<GuildSettingsDTO>> {
  return api.get<APIResponse<GuildSettingsDTO>>(`/api/guilds/${guildId}`);
}

export async function updateGuildSettings(
  guildId: string,
  settings: Record<string, unknown>
): Promise<APIResponse<GuildSettingsDTO>> {
  return api.put<APIResponse<GuildSettingsDTO>>(`/api/guilds/${guildId}`, settings);
}

export async function fetchModCases(
  guildId: string,
  params?: Record<string, string>
): Promise<APIResponse<ModCaseListDTO>> {
  return api.get<APIResponse<ModCaseListDTO>>(`/api/guilds/${guildId}/moderation`, params);
}

export async function fetchGuildChannels(guildId: string): Promise<APIResponse<{ channels: Record<string, unknown>[] }>> {
  return api.get<APIResponse<{ channels: Record<string, unknown>[] }>>(`/api/guilds/${guildId}/channels`);
}

export async function fetchGuildRoles(guildId: string): Promise<APIResponse<{ roles: Record<string, unknown>[] }>> {
  return api.get<APIResponse<{ roles: Record<string, unknown>[] }>>(`/api/guilds/${guildId}/roles`);
}

export async function fetchTickets(
  guildId: string,
  params?: Record<string, string>
): Promise<APIResponse<TicketListDTO>> {
  return api.get<APIResponse<TicketListDTO>>(`/api/guilds/${guildId}/tickets`, params);
}

export async function fetchTicketStats(guildId: string): Promise<APIResponse<{
  totalOpen: number;
  totalClosed: number;
  avgResponseTimeMs: number;
  avgResolutionTimeMs: number;
  byCategory: {
    categoryId: string;
    categoryName: string;
    count: number;
    avgResponseTimeMs: number;
    avgResolutionTimeMs: number;
  }[];
}>> {
  return api.get(`/api/guilds/${guildId}/tickets/stats`);
}

export async function fetchTicketCategories(guildId: string): Promise<APIResponse<{ categories: Record<string, unknown>[] }>> {
  return api.get(`/api/guilds/${guildId}/tickets/categories`);
}

export async function createTicketCategory(guildId: string, data: Record<string, unknown>): Promise<APIResponse<{ category: Record<string, unknown> }>> {
  return api.post(`/api/guilds/${guildId}/tickets/categories`, data);
}

export async function updateTicketCategory(guildId: string, categoryId: string, data: Record<string, unknown>): Promise<APIResponse<{ category: Record<string, unknown> }>> {
  return api.put(`/api/guilds/${guildId}/tickets/categories/${categoryId}`, data);
}

export async function deleteTicketCategory(guildId: string, categoryId: string): Promise<APIResponse<null>> {
  return api.delete(`/api/guilds/${guildId}/tickets/categories/${categoryId}`);
}

export async function reorderTicketCategories(guildId: string, orderedIds: string[]): Promise<APIResponse<null>> {
  return api.patch(`/api/guilds/${guildId}/tickets/categories/reorder`, { orderedIds });
}

export async function generateTicketTranscript(guildId: string, ticketId: string, format?: 'HTML' | 'TXT'): Promise<APIResponse<{
  content: string;
  format: string;
  filename: string;
  ticketId?: string;
}>> {
  return api.post(`/api/guilds/${guildId}/tickets/${ticketId}/transcript`, { format });
}

export async function fetchGiveaways(
  guildId: string,
  params?: Record<string, string>
): Promise<APIResponse<GiveawayListDTO>> {
  return api.get<APIResponse<GiveawayListDTO>>(`/api/guilds/${guildId}/giveaways`, params);
}

export async function fetchPolls(
  guildId: string,
  params?: Record<string, string>
): Promise<APIResponse<PollListDTO>> {
  return api.get<APIResponse<PollListDTO>>(`/api/guilds/${guildId}/polls`, params);
}

export async function fetchSuggestions(
  guildId: string,
  params?: Record<string, string>
): Promise<APIResponse<SuggestionListDTO>> {
  return api.get<APIResponse<SuggestionListDTO>>(`/api/guilds/${guildId}/suggestions`, params);
}

export async function fetchXPLeaderboard(
  guildId: string,
  params?: Record<string, string>
): Promise<APIResponse<XPLeaderboardDTO>> {
  return api.get<APIResponse<XPLeaderboardDTO>>(`/api/guilds/${guildId}/levels`, params);
}

export async function fetchXPProfile(guildId: string, userId: string): Promise<APIResponse<XPProfileDTO>> {
  return api.get<APIResponse<XPProfileDTO>>(`/api/guilds/${guildId}/levels/${userId}`);
}

export async function fetchRankCardSettings(guildId: string): Promise<APIResponse<{ settings: Record<string, unknown> }>> {
  return api.get<APIResponse<{ settings: Record<string, unknown> }>>(`/api/guilds/${guildId}/levels/rank-card`);
}

export async function updateRankCardSettings(guildId: string, settings: Record<string, unknown>): Promise<APIResponse<{ settings: Record<string, unknown> }>> {
  return api.put<APIResponse<{ settings: Record<string, unknown> }>>(`/api/guilds/${guildId}/levels/rank-card`, settings);
}

export async function fetchEconomySettings(guildId: string): Promise<APIResponse<{ settings: Record<string, unknown> }>> {
  return api.get<APIResponse<{ settings: Record<string, unknown> }>>(`/api/guilds/${guildId}/economy`);
}

export async function updateEconomySettings(guildId: string, settings: Record<string, unknown>): Promise<APIResponse<{ settings: Record<string, unknown> }>> {
  return api.put<APIResponse<{ settings: Record<string, unknown> }>>(`/api/guilds/${guildId}/economy`, settings);
}

export async function fetchShopItems(guildId: string): Promise<APIResponse<{ items: Record<string, unknown>[] }>> {
  return api.get<APIResponse<{ items: Record<string, unknown>[] }>>(`/api/guilds/${guildId}/economy/shop/items`);
}

export async function createShopItem(guildId: string, data: Record<string, unknown>): Promise<APIResponse<{ item: Record<string, unknown> }>> {
  return api.post<APIResponse<{ item: Record<string, unknown> }>>(`/api/guilds/${guildId}/economy/shop/items`, data);
}

export async function updateShopItem(guildId: string, itemId: string, data: Record<string, unknown>): Promise<APIResponse<{ item: Record<string, unknown> }>> {
  return api.put<APIResponse<{ item: Record<string, unknown> }>>(`/api/guilds/${guildId}/economy/shop/items/${itemId}`, data);
}

export async function deleteShopItem(guildId: string, itemId: string): Promise<APIResponse<null>> {
  return api.delete<APIResponse<null>>(`/api/guilds/${guildId}/economy/shop/items/${itemId}`);
}

export async function fetchEconomyLeaderboard(
  guildId: string,
  params?: Record<string, string>
): Promise<APIResponse<EconomyLeaderboardDTO>> {
  return api.get<APIResponse<EconomyLeaderboardDTO>>(`/api/guilds/${guildId}/economy`, params);
}

export async function fetchEconomyWallet(guildId: string, userId: string): Promise<APIResponse<EconomyWalletDTO>> {
  return api.get<APIResponse<EconomyWalletDTO>>(`/api/guilds/${guildId}/economy/${userId}`);
}

export async function fetchDeployments(params?: Record<string, string>): Promise<APIResponse<DeploymentListDTO>> {
  return api.get<APIResponse<DeploymentListDTO>>('/api/owner/deployments', params);
}

export async function fetchDeploymentStatus(id: string): Promise<APIResponse<{
  id: string;
  version: string;
  status: string;
  log: string[];
  startedAt: string;
  completedAt: string | null;
}>> {
  return api.get<APIResponse<{
    id: string;
    version: string;
    status: string;
    log: string[];
    startedAt: string;
    completedAt: string | null;
  }>>(`/api/deploy/status/${id}`);
}

export async function fetchChangelogs(params?: Record<string, string>): Promise<APIResponse<ChangelogListDTO>> {
  return api.get<APIResponse<ChangelogListDTO>>('/api/changelogs', params);
}

export async function fetchBlacklist(params?: Record<string, string>): Promise<APIResponse<BlacklistListDTO>> {
  return api.get<APIResponse<BlacklistListDTO>>('/api/owner/blacklist', params);
}

export async function fetchGuildBlacklist(
  guildId: string,
  params?: Record<string, string>
): Promise<APIResponse<GuildBlacklistListDTO>> {
  return api.get<APIResponse<GuildBlacklistListDTO>>(`/api/guilds/${guildId}/blacklist`, params);
}

// ─── Owner ────────────────────────────────────────────────────────────────────

export async function fetchOwnerUsers(params?: Record<string, string>): Promise<APIResponse<{ users: OwnerUser[]; pagination: Pagination }>> {
  return api.get<APIResponse<{ users: OwnerUser[]; pagination: Pagination }>>('/api/owner/users', params);
}

export async function fetchOwnerServers(params?: Record<string, string>): Promise<APIResponse<{ servers: OwnerServer[]; pagination: Pagination }>> {
  return api.get<APIResponse<{ servers: OwnerServer[]; pagination: Pagination }>>('/api/owner/servers', params);
}

export async function fetchOwnerServer(guildId: string): Promise<APIResponse<GuildSettingsDTO>> {
  return api.get<APIResponse<GuildSettingsDTO>>(`/api/owner/servers/${guildId}`);
}

export async function forceLeaveGuild(guildId: string): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>(`/api/owner/force-leave/${guildId}`);
}

export async function blacklistTarget(targetId: string, reason: string, targetType: 'USER' | 'GUILD'): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/owner/blacklist', { targetId, reason, targetType });
}

export async function unblacklistTarget(targetId: string, targetType?: 'USER' | 'GUILD'): Promise<APIResponse<{ success: boolean }>> {
  const suffix = targetType ? `?targetType=${targetType}` : '';
  return api.delete<APIResponse<{ success: boolean }>>(`/api/owner/blacklist/${targetId}${suffix}`);
}

export async function grantPremium(data: { userId?: string; guildId?: string; plan: string }): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/owner/premium/grant', data);
}

export async function revokePremium(userId?: string, guildId?: string): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/owner/premium/revoke', { userId, guildId });
}

export async function fetchFeatureFlags(): Promise<APIResponse<{ flags: FeatureFlag[] }>> {
  return api.get<APIResponse<{ flags: FeatureFlag[] }>>('/api/owner/feature-flags');
}

export async function updateFeatureFlag(key: string, enabled: boolean, minTier?: string): Promise<APIResponse<{ success: boolean }>> {
  return api.put<APIResponse<{ success: boolean }>>(`/api/owner/feature-flags/${key}`, { enabled, minTier });
}

export async function toggleAlphaMode(enabled: boolean): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/owner/alpha-mode', { enabled });
}

export async function triggerDeploy(): Promise<APIResponse<{ id: string; version: string }>> {
  return api.post<APIResponse<{ id: string; version: string }>>('/api/deploy/start', { confirm: true });
}

export async function triggerRollback(version?: string): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/deploy/rollback', { version, confirm: true });
}

export async function triggerBackup(): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/owner/backup', {});
}

export async function triggerRestart(service?: string): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>(service ? `/api/owner/services/restart/${service}` : '/api/owner/services/restart-all');
}

export async function createChangelog(data: { title: string; content: string; version: string }): Promise<APIResponse<{ changelog: Record<string, unknown> }>> {
  return api.post<APIResponse<{ changelog: Record<string, unknown> }>>('/api/owner/changelogs', data);
}

export async function updateChangelog(id: string, data: Partial<{ title: string; content: string; version: string; published: boolean }>): Promise<APIResponse<{ changelog: Record<string, unknown> }>> {
  return api.put<APIResponse<{ changelog: Record<string, unknown> }>>(`/api/owner/changelogs/${id}`, data);
}

export async function deleteChangelog(id: string): Promise<APIResponse<{ success: boolean }>> {
  return api.delete<APIResponse<{ success: boolean }>>(`/api/owner/changelogs/${id}`);
}

export async function fetchSystemMetrics(): Promise<APIResponse<SystemMetricsDTO>> {
  return api.get<APIResponse<SystemMetricsDTO>>('/api/owner/metrics');
}

export async function fetchErrorLogs(params?: Record<string, string>): Promise<APIResponse<ErrorLogListDTO>> {
  return api.get<APIResponse<ErrorLogListDTO>>('/api/owner/errors', params);
}

export async function fetchOwnerLogs(
  params?: Record<string, string>
): Promise<APIResponse<{ entries: OwnerLog[]; pagination?: Pagination }>> {
  return api.get<APIResponse<{ entries: OwnerLog[]; pagination?: Pagination }>>(
    '/api/owner/logs',
    params
  );
}

export async function sendAnnouncement(message: string, targetType: 'ALL' | 'GUILD', guildId?: string): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/owner/announcements', { message, targetType, guildId });
}

export async function fetchAnnouncements(params?: Record<string, string>): Promise<APIResponse<AnnouncementListDTO>> {
  return api.get<APIResponse<AnnouncementListDTO>>('/api/owner/announcements', params);
}

export async function get2FAStatus(): Promise<APIResponse<{ enabled: boolean; qrCode?: string; secret?: string }>> {
  return api.get<APIResponse<{ enabled: boolean; qrCode?: string; secret?: string }>>('/api/owner/2fa');
}

export async function setup2FA(): Promise<APIResponse<{ qrCode: string; secret: string }>> {
  return api.post<APIResponse<{ qrCode: string; secret: string }>>('/api/owner/2fa/setup');
}

export async function verify2FA(code: string): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/owner/2fa/verify', { code });
}

export async function disable2FA(code: string): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/owner/2fa/disable', { code });
}

export async function fetchServices(): Promise<APIResponse<{ services: Service[] }>> {
  return api.get<APIResponse<{ services: Service[] }>>('/api/owner/services');
}

export async function toggleModule(
  guildId: string,
  moduleKey: string,
  enabled: boolean
): Promise<{ success: boolean; moduleKey: string; enabled: boolean }> {
  return api.patch<{ success: boolean; moduleKey: string; enabled: boolean }>(
    `/api/guilds/${guildId}/settings/modules/${moduleKey}`,
    { enabled }
  );
}

export async function fetchAuditLogs(guildId: string, params?: Record<string, string>): Promise<APIResponse<{ entries: Record<string, unknown>[]; pagination: Pagination }>> {
  return api.get<APIResponse<{ entries: Record<string, unknown>[]; pagination: Pagination }>>(`/api/guilds/${guildId}/settings/audit`, params);
}

export async function serviceAction(service: string, action: 'start' | 'stop' | 'restart'): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>(`/api/owner/services/${service}/${action}`);
}

export async function stopService(service: string): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>(`/api/owner/services/${service}/stop`);
}

export async function startService(service: string): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>(`/api/owner/services/${service}/start`);
}

// ─── Forms ────────────────────────────────────────────────────────────────────

export async function fetchFormSettings(guildId: string): Promise<APIResponse<{ settings: Record<string, unknown> }>> {
  return api.get<APIResponse<{ settings: Record<string, unknown> }>>(`/api/guilds/${guildId}/forms`);
}

export async function updateFormSettings(guildId: string, settings: Record<string, unknown>): Promise<APIResponse<{ settings: Record<string, unknown> }>> {
  return api.put<APIResponse<{ settings: Record<string, unknown> }>>(`/api/guilds/${guildId}/forms`, settings);
}

export async function createFormTemplate(guildId: string, data: { name: string; description?: string; fields?: Record<string, unknown>[]; enabled?: boolean }): Promise<APIResponse<{ template: Record<string, unknown> }>> {
  return api.post<APIResponse<{ template: Record<string, unknown> }>>(`/api/guilds/${guildId}/forms/templates`, data);
}

export async function updateFormTemplate(guildId: string, templateId: string, data: Record<string, unknown>): Promise<APIResponse<{ template: Record<string, unknown> }>> {
  return api.put<APIResponse<{ template: Record<string, unknown> }>>(`/api/guilds/${guildId}/forms/templates/${templateId}`, data);
}

export async function deleteFormTemplate(guildId: string, templateId: string): Promise<APIResponse<{ success: boolean }>> {
  return api.delete<APIResponse<{ success: boolean }>>(`/api/guilds/${guildId}/forms/templates/${templateId}`);
}

export async function fetchFormSubmissions(guildId: string, params?: Record<string, string>): Promise<APIResponse<{ submissions: Record<string, unknown>[]; pagination: Pagination }>> {
  return api.get<APIResponse<{ submissions: Record<string, unknown>[]; pagination: Pagination }>>(`/api/guilds/${guildId}/forms/submissions`, params);
}

export async function updateFormSubmission(guildId: string, submissionId: string, data: Record<string, unknown>): Promise<APIResponse<{ submission: Record<string, unknown> }>> {
  return api.patch<APIResponse<{ submission: Record<string, unknown> }>>(`/api/guilds/${guildId}/forms/submissions/${submissionId}`, data);
}

// ─── Starboard ────────────────────────────────────────────────────────────────

export async function fetchStarboardSettings(guildId: string): Promise<APIResponse<{ settings: Record<string, unknown> }>> {
  return api.get<APIResponse<{ settings: Record<string, unknown> }>>(`/api/guilds/${guildId}/starboard`);
}

export async function updateStarboardSettings(guildId: string, settings: Record<string, unknown>): Promise<APIResponse<{ settings: Record<string, unknown> }>> {
  return api.put<APIResponse<{ settings: Record<string, unknown> }>>(`/api/guilds/${guildId}/starboard`, settings);
}

export async function fetchStarboardEntries(guildId: string, params?: Record<string, string>): Promise<APIResponse<{ entries: Record<string, unknown>[]; pagination: Pagination }>> {
  return api.get<APIResponse<{ entries: Record<string, unknown>[]; pagination: Pagination }>>(`/api/guilds/${guildId}/starboard/entries`, params);
}

// ─── Clans ────────────────────────────────────────────────────────────────────

export async function fetchClans(guildId: string): Promise<APIResponse<{ clans: Clan[] }>> {
  return api.get<APIResponse<{ clans: Clan[] }>>(`/api/guilds/${guildId}/clans`);
}

// ─── Minigames ────────────────────────────────────────────────────────────────

export async function fetchMinigameSettings(guildId: string): Promise<APIResponse<{ settings: Record<string, unknown> }>> {
  return api.get<APIResponse<{ settings: Record<string, unknown> }>>(`/api/guilds/${guildId}/minigames`);
}

export async function updateMinigameSettings(guildId: string, settings: Record<string, unknown>): Promise<APIResponse<{ settings: Record<string, unknown> }>> {
  return api.put<APIResponse<{ settings: Record<string, unknown> }>>(`/api/guilds/${guildId}/minigames`, settings);
}

export async function fetchMinigameLeaderboard(guildId: string, params?: Record<string, string>): Promise<APIResponse<{ entries: Record<string, unknown>[] }>> {
  return api.get<APIResponse<{ entries: Record<string, unknown>[] }>>(`/api/guilds/${guildId}/minigames/leaderboard`, params);
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export async function fetchOnboardingData(guildId: string): Promise<APIResponse<unknown>> {
  return api.get<APIResponse<unknown>>(`/api/guilds/${guildId}/onboarding-data`);
}

export async function markOnboardingDone(guildId: string): Promise<APIResponse<unknown>> {
  return api.patch<APIResponse<unknown>>(`/api/guilds/${guildId}/settings/onboarding-done`);
}

export async function submitOnboardingSource(data: { guildId: string; source: string; details?: string }): Promise<APIResponse<unknown>> {
  return api.post<APIResponse<unknown>>('/api/onboarding/source', data);
}

export async function fetchOnboardingSources(params?: Record<string, string>): Promise<APIResponse<unknown>> {
  return api.get<APIResponse<unknown>>('/api/admin/onboarding/sources', params);
}

// ─── Metrics Snapshots ────────────────────────────────────────────────────────

export async function fetchMetricsSnapshots(): Promise<APIResponse<{ snapshots: SystemMetricsSnapshot[] }>> {
  return api.get<APIResponse<{ snapshots: SystemMetricsSnapshot[] }>>('/api/system/metrics/snapshots');
}

// ─── Stream Notifications ─────────────────────────────────────────────────────

export async function fetchStreamNotifications(guildId: string): Promise<APIResponse<{ notifications: StreamNotification[] }>> {
  return api.get<APIResponse<{ notifications: StreamNotification[] }>>(`/api/guilds/${guildId}/notifications`);
}

export async function createStreamNotification(guildId: string, data: {
  platform: 'TWITCH' | 'YOUTUBE';
  channelName: string;
  channelId?: string;
  discordChannelId: string;
}): Promise<APIResponse<{ notification: StreamNotification }>> {
  return api.post<APIResponse<{ notification: StreamNotification }>>(`/api/guilds/${guildId}/notifications`, data);
}

export async function updateStreamNotification(guildId: string, notificationId: string, data: {
  discordChannelId?: string;
  channelId?: string;
  customTitle?: string | null;
  customDescription?: string | null;
  customColor?: string | null;
  customFooter?: string | null;
  mentionRoleId?: string | null;
  pingEveryoneOnLive?: boolean;
}): Promise<APIResponse<{ notification: StreamNotification }>> {
  return api.patch<APIResponse<{ notification: StreamNotification }>>(`/api/guilds/${guildId}/notifications/${notificationId}`, data);
}

export async function deleteStreamNotification(guildId: string, notificationId: string): Promise<APIResponse<{ success: boolean }>> {
  return api.delete<APIResponse<{ success: boolean }>>(`/api/guilds/${guildId}/notifications/${notificationId}`);
}

export async function testStreamNotification(guildId: string, notificationId: string): Promise<APIResponse<null>> {
  return api.post<APIResponse<null>>(`/api/guilds/${guildId}/notifications/${notificationId}/test`);
}
