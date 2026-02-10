import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as sharedSchema from '../lib/db/schema/sharedSchema';
import * as tenantSchema from '../lib/db/schema/tenantSchema';


export const userRegistrationSchema = z.object({
  username: z.string().nonempty("Username is required")
  .refine((val) => !val.includes('@'), {
    message: "Username must not contain '@'",
    path: ["username"],
  }),
  activeTenantCode: z.string().nonempty("ActiveTenantCode is required"),
  fullname: z.string().nonempty("Fullname is required"),
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  confirmPassword: z.string().nonempty("Confirm Password is required"),
})
.refine(
  (data) => {
    return data.password === data.confirmPassword
  },
  {
    message: "Password confirmation does not match",
    path: ["confirmPassword"],
  }
);

export const userRegistrationValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return userRegistrationSchema
    .refine(
      async (data) => {
        // check unique code when create data
        const newUsername = `${data.username}@${data.activeTenantCode}`;
        const existing = await tenantDb
          .select()
          .from(tenantSchema.user)
          .where(sql`lower(${tenantSchema.user.username}) = ${newUsername.toLowerCase()}`);
        return existing.length === 0;
      },
      {
        message: "Username already exists",
        path: ["username"],
      }
    )
}

export const userLoginSchema = z.object({
  username: z.string().nonempty("Username is required"),
  password: z.string().nonempty("Password is required"),
});

export const userAddSchema = z.object({
  activeTenantId: z.string().nonempty("TenantId is required"),
  activeTenantCode: z.string().nonempty("TenantCode is required"),
  username: z.string().nonempty("Username is required")
  .refine((val) => !val.includes('@'), {
    message: "Username must not contain '@'",
    path: ["username"],
  }),
  fullname: z.string().nonempty("Fullname is required"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  confirmPassword: z.string().nonempty("Confirm Password is required"),
  email: z.email().optional(),
  avatar: z.string().optional(),
  roleIds: z.array(z.string()).optional()
})
.refine(
  (data) => {
    return data.password === data.confirmPassword
  },
  {
    message: "Password confirmation does not match",
    path: ["confirmPassword"],
  }
);

export const userAddValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return userAddSchema
    .refine(
      async (data) => {
        // check unique code when create data
        const newUsername = `${data.username}@${data.activeTenantCode}`;
        console.log("New username:", newUsername);
        const existing = await tenantDb
          .select()
          .from(tenantSchema.user)
          .where(sql`lower(${tenantSchema.user.username}) = ${newUsername.toLowerCase()}`);
        return existing.length === 0;
      },
      {
        message: "Username already exists",
        path: ["username"],
      }
    )
    .refine(
      async (data) => {
        // check roleIds in the same tenant
        for (const roleId of data.roleIds || []) {
          const existing = await tenantDb
            .select()
            .from(tenantSchema.role)
            .where(sql`${tenantSchema.role.id} = ${roleId}`);
          if (existing.length === 0) {
            return false;
          }
        }
        return true;
      },
      {
        message: "Role ID is invalid",
        path: ["roleIds"],
      }
    );
}

export const userEditSchema = z.object({
  id: z.string().nonempty("ID is required"),
  username: z.string().nonempty("Username is required")
  .refine((val) => !val.includes('@'), {
    message: "Username must not contain '@'",
    path: ["username"],
  }),
  activeTenantId: z.string().nonempty("TenantId is required"),
  activeTenantCode: z.string().nonempty("TenantCode is required"),
  fullname: z.string().nonempty("Fullname is required"),
  email: z.email().optional(),
  avatar: z.string().optional(),
  status: z.enum(["active", "inactive"]).nonoptional("Status is required"),
  roleIds: z.array(z.string()).optional()
});

export const userEditValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return userEditSchema
    .refine(
      async (data) => {
        // check unique code when edit data
        const updatedUsername = `${data.username}@${data.activeTenantCode}`;
        const existing = await tenantDb
          .select()
          .from(tenantSchema.user)
          .where(sql`lower(${tenantSchema.user.username}) = ${updatedUsername.toLowerCase()} AND ${tenantSchema.user.id} != ${data.id}`);
        return existing.length === 0;
      },
      {
        message: "Username already exists",
        path: ["username"],
      }
    )
    .refine(
      async (data) => {
        // check roleIds in the same tenant
        for (const roleId of data.roleIds || []) {
          const existing = await tenantDb
            .select()
            .from(tenantSchema.role)
            .where(sql`${tenantSchema.role.id} = ${roleId}`);
          if (existing.length === 0) {
            return false;
          }
        }
        return true;
      },
      {
        message: "Role ID is invalid",
        path: ["roleIds"],
      }
    )
}

export const userResetPasswordSchema = z.object({
  id: z.string().nonempty("ID is required"),
  activeTenantId: z.string().nonempty("TenantId is required"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  confirmPassword: z.string().nonempty("Confirm Password is required")
})
.refine(
  (data) => {
    return data.password === data.confirmPassword
  },
  {
    message: "Password confirmation does not match",
    path: ["confirmPassword"],
  }
);

export const usernameValidationSchema = z.object({
  id: z.string().optional(),
  activeTenantCode: z.string().nonempty("ActiveTenantCode is required"),
  username: z.string().nonempty("Username is required")
  .refine((val) => !val.includes('@'), {
    message: "Username must not contain '@'",
    path: ["username"],
  }),
});

export const usernameValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return usernameValidationSchema
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const username = `${data.username}@${data.activeTenantCode}`;
          const existing = await tenantDb
            .select()
            .from(tenantSchema.user)
            .where(sql`lower(${tenantSchema.user.username}) = ${username.toLowerCase()} AND ${tenantSchema.user.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const username = `${data.username}@${data.activeTenantCode}`;
          const existing = await tenantDb
            .select()
            .from(tenantSchema.user)
            .where(sql`lower(${tenantSchema.user.username}) = ${username.toLowerCase()}`);
          return existing.length === 0;
        }
      },
      {
        message: "Username already exists",
        path: ["username"],
      }
    )
}

export const userForgetPasswordSchema = z.object({
  username: z.string().nonempty("Username is required")
})

export const tenantRegistrationSchema = z.object({
  activeTenantName: z.string().nonempty("ActiveTenantName Name is required"),
  activeTenantCode: z.string().nonempty("ActiveTenantCode is required").lowercase("Must be lowercase"),
  username: z.string().nonempty("Username is required")
  .refine((val) => !val.includes('@'), {
    message: "Username must not contain '@'",
    path: ["username"],
  }),
  fullname: z.string().nonempty("Fullname is required"),
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  confirmPassword: z.string().nonempty("Confirm Password is required"),
})
.refine(
    (data) => {
      return !data.activeTenantCode.includes(' ')
    },
    {
      message: "Must not contain spaces",
      path: ["activeTenantCode"],
    }
  )
.refine(
  (data) => {
    return data.password === data.confirmPassword
  },
  {
    message: "Password confirmation does not match",
    path: ["confirmPassword"],
  }
);

export const tenantRegistrationValidator = (
  sharedDb : PostgresJsDatabase<typeof sharedSchema> & {$client: postgres.Sql<{}>}
) => {
  return tenantRegistrationSchema
    .refine(
      async (data) => {
        // check unique code when create data
        const existing = await sharedDb
          .select()
          .from(sharedSchema.tenant)
          .where(sql`lower(${sharedSchema.tenant.code}) = ${data.activeTenantCode.toLowerCase()}`);
        return existing.length === 0;
      },
      {
        message: "Tenant code already exists",
        path: ["tenantCode"],
      }
    )
}

export const tenantCodeRegistrationValidationSchema = z.object({
  id: z.string().optional(),
  activeTenantCode: z.string().nonempty("ActiveTenantCode is required").lowercase("Must be lowercase"),
});

export const tenantCodeRegistrationValidator = (
  sharedDb : PostgresJsDatabase<typeof sharedSchema> & {$client: postgres.Sql<{}>}
) => {
  return tenantCodeRegistrationValidationSchema
    .refine(
      (data) => {
        return !data.activeTenantCode.includes(' ')
      },
      {
        message: "Must not contain spaces",
        path: ["activeTenantCode"],
      }
    )
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const existing = await sharedDb
            .select()
            .from(sharedSchema.tenant)
            .where(sql`lower(${sharedSchema.tenant.code}) = ${data.activeTenantCode.toLowerCase} AND ${sharedSchema.tenant.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const existing = await sharedDb
            .select()
            .from(sharedSchema.tenant)
            .where(sql`lower(${sharedSchema.tenant.code}) = ${data.activeTenantCode.toLowerCase()}`);
          return existing.length === 0;
        }
      },
      {
        message: "Tenant Code already exists",
        path: ["activeTenantCode"],
      }
    )
}