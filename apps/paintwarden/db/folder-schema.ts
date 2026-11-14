import { sql } from "drizzle-orm";
import { check, index, integer, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

import { isUuid, maxLengths, oneOf, updatedAt, vaultTable } from "./schema-checks.ts";

export const FOLDER_KINDS = ["miniature", "template"] as const;
export const folders = vaultTable(
  "folders",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: FOLDER_KINDS }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    name: text("name").notNull(),
    parentId: text("parent_id").references((): AnySQLiteColumn => folders.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    isUuid("folders_id_check", t.id),
    oneOf("folders_kind_check", t.kind, FOLDER_KINDS),
    maxLengths("folders_lengths_check", [[t.name, "name"]]),
    check("folders_name_check", sql`length(trim(${t.name})) > 0`),
    check("folders_self_parent_check", sql`${t.parentId} IS NULL OR ${t.parentId} <> ${t.id}`),
    index("folders_parent_idx").on(t.kind, t.parentId),
  ],
);
