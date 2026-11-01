import { STAFF_ROLES, notificationSeesAll } from '../../middleware/authorization.js';

export type NotificationViewer = { roles: string[]; userId: string | null };

/** One visibility rule for lists, counts and acknowledgements. No viewer means no access. */
export const notificationViewerFilter = (viewer: NotificationViewer) => {
  const roles = viewer.roles.map((role) => role.toLowerCase());
  if (notificationSeesAll(roles)) return {};
  const addressed = [
    { target_roles: { $in: roles } },
    ...(viewer.userId ? [{ target_user_ids: viewer.userId }] : []),
  ];
  const isStaff = roles.some((role) => STAFF_ROLES.includes(role));
  return { $or: [
    ...addressed,
    ...(isStaff ? [{ $and: [
      { $or: [{ target_roles: { $exists: false } }, { target_roles: { $size: 0 } }] },
      { $or: [{ target_user_ids: { $exists: false } }, { target_user_ids: { $size: 0 } }] },
    ] }] : []),
  ] };
};
