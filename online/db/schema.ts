import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const owner = sqliteTable('condo_owner', { id: integer('id').primaryKey(), userId: text('user_id').notNull() });
export const members = sqliteTable('condo_members', {
 id: integer('id').primaryKey({autoIncrement:true}), userId: text('user_id').unique(),
 name: text('name').notNull(), email: text('email').notNull().unique(), unit: text('unit').notNull(), role: text('role').notNull()
});
export const tickets = sqliteTable('condo_tickets', {
 id: integer('id').primaryKey({autoIncrement:true}), protocol: text('protocol').notNull().unique(),
 userId: text('user_id').notNull(), title: text('title').notNull(), description: text('description').notNull(),
 category: text('category').notNull(), location: text('location').notNull(), priority: text('priority').notNull().default('Normal'),
 status: text('status').notNull().default('Aberto'), assignee: text('assignee').notNull().default(''),
 photoKey: text('photo_key'), photoType: text('photo_type'), createdAt: text('created_at').notNull(),
 updatedAt: text('updated_at').notNull(), closedAt: text('closed_at'), version: integer('version').notNull().default(1)
});
export const history = sqliteTable('condo_history', {
 id: integer('id').primaryKey({autoIncrement:true}), ticketId: integer('ticket_id').notNull().references(()=>tickets.id),
 actorId: text('actor_id').notNull(), actorName: text('actor_name').notNull(), note: text('note').notNull(), createdAt: text('created_at').notNull()
});
