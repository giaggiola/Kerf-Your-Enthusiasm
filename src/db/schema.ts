import { pgTable, text, integer, doublePrecision, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// AUTHENTICATION TABLES (Better-Auth)
// ============================================

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').unique(),
  displayUsername: text('display_username'),
  name: text('name'),
  image: text('image'),
  emailVerified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).$defaultFn(() => new Date()),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull(),
  accountId: text('account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true, mode: 'date' }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true, mode: 'date' }),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).$defaultFn(() => new Date()),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).$defaultFn(() => new Date()),
});

// ============================================
// APPLICATION TABLES
// ============================================

// Projects: Container for stocks + cuts + settings
export const projects = pgTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  kerf: doublePrecision('kerf').notNull().default(0.125),
  units: text('units').default('in'),
  groupMultipliers: text('group_multipliers').default('{}'),
  layoutOverrides: text('layout_overrides').default('{}'),
  layoutExcludedKeys: text('layout_excluded_keys').default('[]'),
  layoutPadding: doublePrecision('layout_padding').default(0.5),
  layoutHasActive: boolean('layout_has_active').default(false),
  stepActiveFileId: text('step_active_file_id'),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
});

// Stocks: Material sheets for a project
export const stocks = pgTable('stocks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  length: doublePrecision('length').notNull(),
  width: doublePrecision('width').notNull(),
  thickness: doublePrecision('thickness').default(0),
  quantity: integer('quantity').notNull().default(1),
  material: text('material').notNull().default('Plywood'),
  sortOrder: integer('sort_order').default(0),
});

// Cuts: Parts to cut from stocks
export const cuts = pgTable('cuts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  length: doublePrecision('length').notNull(),
  width: doublePrecision('width').notNull(),
  thickness: doublePrecision('thickness').default(0),
  quantity: integer('quantity').notNull().default(1),
  material: text('material').default(''),
  groupName: text('group_name').default(''),
  stepFileId: text('step_file_id'),
  stepSessionId: text('step_session_id'),
  stepBodyIndex: integer('step_body_index'),
  stepFaceIndex: integer('step_face_index'),
  sortOrder: integer('sort_order').default(0),
});

// Persisted STEP files stored on disk and linked to a project
export const projectStepFiles = pgTable('project_step_files', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  storagePath: text('storage_path').notNull(),
  fileHash: text('file_hash').default(''),
  fileSize: integer('file_size').default(0),
  bodyState: text('body_state').default('[]'),
  selectedBodyIndex: integer('selected_body_index').default(0),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()),
});

// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  projects: many(projects),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  stocks: many(stocks),
  cuts: many(cuts),
  stepFiles: many(projectStepFiles),
}));

export const stocksRelations = relations(stocks, ({ one }) => ({
  project: one(projects, { fields: [stocks.projectId], references: [projects.id] }),
}));

export const cutsRelations = relations(cuts, ({ one }) => ({
  project: one(projects, { fields: [cuts.projectId], references: [projects.id] }),
}));

export const projectStepFilesRelations = relations(projectStepFiles, ({ one }) => ({
  project: one(projects, { fields: [projectStepFiles.projectId], references: [projects.id] }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Stock = typeof stocks.$inferSelect;
export type NewStock = typeof stocks.$inferInsert;
export type Cut = typeof cuts.$inferSelect;
export type NewCut = typeof cuts.$inferInsert;
export type ProjectStepFile = typeof projectStepFiles.$inferSelect;
export type NewProjectStepFile = typeof projectStepFiles.$inferInsert;
