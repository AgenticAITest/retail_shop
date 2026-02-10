# Showcase Module Module

React UI and Shadcn UI Component Showcase

## Overview

This module provides CRUD operations for Showcase Module management with the following features:

- Create, Read, Update, Delete operations
- Multi-tenant support
- Server-side pagination
- Search and filtering
- Form validation
- TypeScript support
- Modern UI components

## Structure

```
showcase-module/
├── module.json                     # Module metadata
├── client/                         # React frontend
│   ├── components/                 # Reusable components
│   ├── pages/                      # Page components
│   │   ├── ShowcaseModuleList.tsx       # List view
│   │   ├── ShowcaseModuleAdd.tsx        # Create form
│   │   ├── ShowcaseModuleView.tsx       # Detail view (TODO)
│   │   └── ShowcaseModuleEdit.tsx       # Edit form (TODO)
│   ├── menus/                      # Sidebar menu config
│   └── routes/                     # React routes
└── server/                         # Express backend
    ├── routes/                     # API endpoints
    └── lib/db/schemas/             # Database schema
```

## API Endpoints

- `GET /api/modules/showcase-module/showcase-module` - List all records
- `POST /api/modules/showcase-module/showcase-module` - Create new record
- `GET /api/modules/showcase-module/showcase-module/:id` - Get record by ID
- `PUT /api/modules/showcase-module/showcase-module/:id` - Update record (TODO)
- `DELETE /api/modules/showcase-module/showcase-module/:id` - Delete record (TODO)

## Database Schema

The module uses the following database table:

```sql
CREATE TABLE showcaseModule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Permissions

The module defines the following permissions:

- `showcase-module.view` - View records
- `showcase-module.create` - Create new records  
- `showcase-module.edit` - Edit existing records
- `showcase-module.delete` - Delete records

## TODO

- [ ] Implement Edit page and functionality
- [ ] Implement View page  
- [ ] Implement Delete functionality
- [ ] Add PUT and DELETE API endpoints
- [ ] Add form validation schemas
- [ ] Add error handling
- [ ] Add loading states
- [ ] Add confirmation dialogs
- [ ] Add bulk operations
- [ ] Add export functionality
- [ ] Add import functionality
- [ ] Add advanced filtering
- [ ] Add sorting options
- [ ] Write unit tests
- [ ] Write integration tests

## Getting Started

1. Make sure the module is registered in `src/client/route.ts`
2. Make sure the server routes are registered in `src/server/main.ts`
3. Run database migrations to create the table
4. Configure module authorization if required
5. Start implementing the TODO items above

## Created

- **Date**: 11/11/2025
- **Author**: Developer
- **Version**: 1.0.0
