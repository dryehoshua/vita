export const ADMIN_EMAIL = 'support@roma-condesa.app';

export function hasAdministratorRole(user) {
  return user?.email === ADMIN_EMAIL && user.verified && user.status === 'active'
    && user.roles.includes('admin');
}

export function visibleRoles(user) {
  return hasAdministratorRole(user) ? user.roles : user.roles.filter(role => role !== 'admin');
}
