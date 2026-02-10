CREATE TABLE "sys_module_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moduleId" varchar(255) NOT NULL,
	"moduleName" varchar(255) NOT NULL,
	"description" text,
	"version" varchar(50) NOT NULL,
	"category" varchar(100) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"repositoryUrl" varchar(500),
	"documentationUrl" varchar(500),
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sys_module_registry_moduleId_unique" UNIQUE("moduleId")
);
--> statement-breakpoint
CREATE TABLE "sys_tenant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sys_tenant_code_unique" UNIQUE("code")
);
