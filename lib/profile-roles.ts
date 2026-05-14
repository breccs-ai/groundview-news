/** Merge legacy `role` column with Postgres `roles` text[] so both stay supported. */

export type ProfileRoleFields = {
  roles?: string[] | null;
  role?: string | null;
};

export function normalizedRoles(profile: ProfileRoleFields | null | undefined): string[] {
  if (!profile) return [];
  const fromArray = [...(profile.roles || [])];
  const legacy = (profile.role || '').trim().toLowerCase();
  const norm = [...fromArray.map((r) => String(r).trim().toLowerCase())];
  if (legacy && !norm.includes(legacy)) norm.push(legacy);
  return norm;
}

export function profileIncludesRole(profile: ProfileRoleFields | null | undefined, role: string): boolean {
  const r = role.toLowerCase();
  return normalizedRoles(profile).includes(r);
}

/** Exact advertised checks (arrays use literal string match; legacy column exact equality). */

export function hasAdvertiserRole(profile: ProfileRoleFields | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(profile.roles?.includes('advertiser') || profile.role === 'advertiser');
}

export function hasJournalistRole(profile: ProfileRoleFields | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(profile.roles?.includes('journalist') || profile.role === 'journalist');
}

