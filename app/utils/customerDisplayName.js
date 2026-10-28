const name = value => typeof value === 'string' ? Array.from(value
  .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '')
  .trim().replace(/\s+/g, ' ')).slice(0, 160).join('') : ''

export const customerDisplayName = (profile, user, fallback) => [profile?.full_name,
  user?.user_metadata?.preferred_name, user?.user_metadata?.display_name,
  user?.user_metadata?.full_name, user?.user_metadata?.name].map(name).find(Boolean) || fallback
