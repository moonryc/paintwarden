CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "folders_id_check" CHECK("folders"."id" GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "folders_kind_check" CHECK("folders"."kind" IN ('miniature', 'template')),
	CONSTRAINT "folders_lengths_check" CHECK(length("folders"."name") <= 200),
	CONSTRAINT "folders_name_check" CHECK(length(trim("folders"."name")) > 0),
	CONSTRAINT "folders_self_parent_check" CHECK("folders"."parent_id" IS NULL OR "folders"."parent_id" <> "folders"."id"),
	CONSTRAINT "folders_integers_check" CHECK(typeof("folders"."sort_order") = 'integer' AND typeof("folders"."created_at") = 'integer' AND typeof("folders"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `folders_parent_idx` ON `folders` (`kind`,`parent_id`);--> statement-breakpoint
ALTER TABLE `miniature_templates` ADD `folder_id` text REFERENCES folders(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `miniature_templates_folder_idx` ON `miniature_templates` (`folder_id`);--> statement-breakpoint
ALTER TABLE `miniatures` ADD `folder_id` text REFERENCES folders(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `miniatures_folder_idx` ON `miniatures` (`folder_id`);
--> statement-breakpoint
CREATE TRIGGER folders_parent_insert BEFORE INSERT ON folders
WHEN NEW.parent_id IS NOT NULL BEGIN
  SELECT RAISE(ABORT, 'Folder parent must have the same kind')
    WHERE NOT EXISTS (SELECT 1 FROM folders WHERE id=NEW.parent_id AND kind=NEW.kind);
END;
--> statement-breakpoint
CREATE TRIGGER folders_parent_update BEFORE UPDATE OF parent_id,kind ON folders BEGIN
  SELECT RAISE(ABORT, 'Folder kind is immutable') WHERE NEW.kind <> OLD.kind;
  SELECT RAISE(ABORT, 'Folder parent must have the same kind')
    WHERE NEW.parent_id IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM folders WHERE id=NEW.parent_id AND kind=NEW.kind);
  SELECT RAISE(ABORT, 'Folder cycle') WHERE NEW.parent_id IN (
    WITH RECURSIVE subtree(id) AS (
      SELECT OLD.id UNION SELECT f.id FROM folders f JOIN subtree s ON f.parent_id=s.id
    ) SELECT id FROM subtree
  );
END;
--> statement-breakpoint
CREATE TRIGGER miniatures_folder_insert BEFORE INSERT ON miniatures
WHEN NEW.folder_id IS NOT NULL BEGIN
  SELECT RAISE(ABORT, 'Miniature folder must have miniature kind')
    WHERE NOT EXISTS (SELECT 1 FROM folders WHERE id=NEW.folder_id AND kind='miniature');
END;
--> statement-breakpoint
CREATE TRIGGER miniatures_folder_update BEFORE UPDATE OF folder_id ON miniatures
WHEN NEW.folder_id IS NOT NULL BEGIN
  SELECT RAISE(ABORT, 'Miniature folder must have miniature kind')
    WHERE NOT EXISTS (SELECT 1 FROM folders WHERE id=NEW.folder_id AND kind='miniature');
END;
--> statement-breakpoint
CREATE TRIGGER templates_folder_insert BEFORE INSERT ON miniature_templates
WHEN NEW.folder_id IS NOT NULL BEGIN
  SELECT RAISE(ABORT, 'Template folder must have template kind')
    WHERE NOT EXISTS (SELECT 1 FROM folders WHERE id=NEW.folder_id AND kind='template');
END;
--> statement-breakpoint
CREATE TRIGGER templates_folder_update BEFORE UPDATE OF folder_id ON miniature_templates
WHEN NEW.folder_id IS NOT NULL BEGIN
  SELECT RAISE(ABORT, 'Template folder must have template kind')
    WHERE NOT EXISTS (SELECT 1 FROM folders WHERE id=NEW.folder_id AND kind='template');
END;
