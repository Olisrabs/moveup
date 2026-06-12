// ---- Role definitions ----
export type UserRole = 'user' | 'partner' | 'staff' | 'super_admin';

/** Only super_admin */
export const isSuperAdmin = (role?: string | null): boolean =>
  role === 'super_admin';

/** partner OR super_admin */
export const isPartner = (role?: string | null): boolean =>
  role === 'partner' || role === 'super_admin';

/** staff, partner, OR super_admin */
export const isStaff = (role?: string | null): boolean =>
  ['staff', 'partner', 'super_admin'].includes(role ?? '');

/**
 * Anyone who monitors rooms without competing for the pool
 * (partner, staff, super_admin)
 */
export const isObserver = (role?: string | null): boolean =>
  ['partner', 'staff', 'super_admin'].includes(role ?? '');

/** Regular competing participant */
export const isParticipant = (role?: string | null): boolean =>
  role === 'user' || !role;

/** Label shown in the UI for each role */
export const roleLabel = (role?: string | null): string => {
  switch (role) {
    case 'super_admin': return 'Super Admin';
    case 'partner':     return 'Partner';
    case 'staff':       return 'Staff';
    default:            return 'Member';
  }
};

/** Badge color class for each role */
export const roleBadgeClass = (role?: string | null): string => {
  switch (role) {
    case 'super_admin': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    case 'partner':     return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    case 'staff':       return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    default:            return 'bg-secondary text-muted-foreground';
  }
};
