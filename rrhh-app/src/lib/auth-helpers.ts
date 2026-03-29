export function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '.')
}

export function usernameToInternalEmail(username: string) {
  const normalized = normalizeUsername(username)
  return `${normalized}@users.internal`
}

export function normalizeLoginIdentifier(value: string) {
  const trimmed = value.trim().toLowerCase()
  if (trimmed.includes('@')) return trimmed
  return usernameToInternalEmail(trimmed)
}
