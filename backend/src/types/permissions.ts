export const PERMISSION_MODULES = [
  "students",
  "attendance",
  "fees",
  "courses",
  "certificates",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export interface ModulePermission {
  view: boolean;
  edit: boolean;
}

export type Permissions = Record<PermissionModule, ModulePermission>;

export function defaultPermissions(): Permissions {
  return PERMISSION_MODULES.reduce((acc, mod) => {
    acc[mod] = { view: false, edit: false };
    return acc;
  }, {} as Permissions);
}

export type Role = "owner" | "admin";
