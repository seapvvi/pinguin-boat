import type {
  APIResponse,
  SystemMetrics,
  BotStats,
  AuthCallbackDTO,
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
  SystemMetricsDTO,
} from '@pinguin/shared';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

function getBearerToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('pinguin_session_token');
  }
  return null;
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  fetchOptions.credentials = 'include';

  const token = getBearerToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  fetchOptions.headers = {
    ...headers,
    ...(fetchOptions.headers as Record<string, string>),
  };

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erreur API: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string>) =>
    apiFetch<T>(endpoint, { params, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  patch: <T>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(endpoint: string) =>
    apiFetch<T>(endpoint, { method: 'DELETE' }),
};

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

export async function fetchTickets(
  guildId: string,
  params?: Record<string, string>
): Promise<APIResponse<TicketListDTO>> {
  return api.get<APIResponse<TicketListDTO>>(`/api/guilds/${guildId}/tickets`, params);
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
  return api.get(`/api/deploy/status/${id}`);
}

export async function fetchChangelogs(params?: Record<string, string>): Promise<APIResponse<ChangelogListDTO>> {
  return api.get<APIResponse<ChangelogListDTO>>('/api/changelogs', params);
}

export async function fetchBlacklist(params?: Record<string, string>): Promise<APIResponse<BlacklistListDTO>> {
  return api.get<APIResponse<BlacklistListDTO>>('/api/owner/blacklist', params);
}

// --- Owner-specific API functions ---

export async function fetchOwnerUsers(params?: Record<string, string>): Promise<APIResponse<{ users: any[]; pagination: any }>> {
  return api.get<APIResponse<{ users: any[]; pagination: any }>>('/api/owner/users', params);
}

export async function fetchOwnerServers(params?: Record<string, string>): Promise<APIResponse<{ servers: any[]; pagination: any }>> {
  return api.get<APIResponse<{ servers: any[]; pagination: any }>>('/api/owner/servers', params);
}

export async function forceLeaveGuild(guildId: string): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>(`/api/owner/servers/${guildId}/force-leave`);
}

export async function blacklistTarget(targetId: string, reason: string, targetType: 'USER' | 'GUILD'): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/owner/blacklist', { targetId, reason, targetType });
}

export async function unblacklistTarget(entryId: string): Promise<APIResponse<{ success: boolean }>> {
  return api.delete<APIResponse<{ success: boolean }>>(`/api/owner/blacklist/${entryId}`);
}

export async function grantPremium(data: { userId?: string; guildId?: string; plan: string }): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/owner/premium/grant', data);
}

export async function revokePremium(userId?: string, guildId?: string): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/owner/premium/revoke', { userId, guildId });
}

export async function fetchFeatureFlags(): Promise<APIResponse<{ flags: any[] }>> {
  return api.get<APIResponse<{ flags: any[] }>>('/api/owner/feature-flags');
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

export async function createChangelog(data: { title: string; content: string; version: string }): Promise<APIResponse<{ changelog: any }>> {
  return api.post<APIResponse<{ changelog: any }>>('/api/owner/changelogs', data);
}

export async function updateChangelog(id: string, data: Partial<{ title: string; content: string; version: string; published: boolean }>): Promise<APIResponse<{ changelog: any }>> {
  return api.put<APIResponse<{ changelog: any }>>(`/api/owner/changelogs/${id}`, data);
}

export async function deleteChangelog(id: string): Promise<APIResponse<{ success: boolean }>> {
  return api.delete<APIResponse<{ success: boolean }>>(`/api/owner/changelogs/${id}`);
}

export async function fetchSystemMetrics(): Promise<APIResponse<SystemMetricsDTO>> {
  return api.get<APIResponse<SystemMetricsDTO>>('/api/owner/metrics');
}

export async function fetchErrorLogs(params?: Record<string, string>): Promise<APIResponse<{ entries: any[]; pagination: any }>> {
  return api.get<APIResponse<{ entries: any[]; pagination: any }>>('/api/owner/errors', params);
}

export async function fetchOwnerLogs(params?: Record<string, string>): Promise<APIResponse<any>> {
  return api.get<APIResponse<any>>('/api/owner/logs', params);
}

export async function sendAnnouncement(message: string, targetType: 'ALL' | 'GUILD', guildId?: string): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>('/api/owner/announcements', { message, targetType, guildId });
}

export async function fetchAnnouncements(params?: Record<string, string>): Promise<APIResponse<{ entries: any[]; pagination: any }>> {
  return api.get<APIResponse<{ entries: any[]; pagination: any }>>('/api/owner/announcements', params);
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

export async function fetchServices(): Promise<APIResponse<{ services: any[] }>> {
  return api.get<APIResponse<{ services: any[] }>>('/api/owner/services');
}

export async function toggleModule(
  guildId: string,
  moduleKey: string,
  enabled: boolean
): Promise<{ success: boolean; moduleKey: string; enabled: boolean }> {
  return api.patch<{ success: boolean; moduleKey: string; enabled: boolean }>(
    `/api/guilds/${guildId}/modules/${moduleKey}`,
    { enabled }
  );
}

export async function fetchAuditLogs(guildId: string, params?: Record<string, string>): Promise<APIResponse<{ entries: any[]; pagination: any }>> {
  return api.get<APIResponse<{ entries: any[]; pagination: any }>>(`/api/guilds/${guildId}/audit`, params);
}

export async function serviceAction(service: string, action: 'start' | 'stop' | 'restart'): Promise<APIResponse<{ success: boolean }>> {
  return api.post<APIResponse<{ success: boolean }>>(`/api/owner/services/${service}/${action}`);
}
