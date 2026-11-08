export function isStaffRole(role) {
  return role === 'teacher' || role === 'super_admin'
}

export function isSuperAdmin(role) {
  return role === 'super_admin'
}
