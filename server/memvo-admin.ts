const normalizedAdminEmail = (process.env.MEMVO_ADMIN_EMAIL ?? '').trim().toLowerCase();

export function getMemvoAdminEmail() {
  return normalizedAdminEmail;
}

export function isMemvoAdminEmail(email?: string | null) {
  if (!email || !normalizedAdminEmail) return false;
  return email.trim().toLowerCase() == normalizedAdminEmail;
}

export function getMemvoBootstrapFlags() {
  return {
    isSupabaseConfigured: Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    adminEmailConfigured: Boolean(normalizedAdminEmail),
  };
}
