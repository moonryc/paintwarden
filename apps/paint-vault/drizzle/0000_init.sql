CREATE TABLE `catalog_source_assets` (
	`source_id` text NOT NULL,
	`asset_path` text NOT NULL,
	`image_key` text NOT NULL,
	`sha256` text NOT NULL,
	PRIMARY KEY(`source_id`, `asset_path`),
	FOREIGN KEY (`source_id`) REFERENCES `catalog_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "catalog_source_assets_image_key_check" CHECK("catalog_source_assets"."image_key" IS NULL OR (substr("catalog_source_assets"."image_key", 1, 36) GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' AND substr("catalog_source_assets"."image_key", 37) IN ('.avif', '.gif', '.jpg', '.jpeg', '.png', '.webp', '.img')))
);
--> statement-breakpoint
CREATE TABLE `catalog_source_items` (
	`source_id` text NOT NULL,
	`kind` text NOT NULL,
	`item_id` text NOT NULL,
	PRIMARY KEY(`source_id`, `kind`, `item_id`),
	FOREIGN KEY (`source_id`) REFERENCES `catalog_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "catalog_source_items_kind_check" CHECK("catalog_source_items"."kind" IN ('paint', 'scheme', 'template')),
	CONSTRAINT "catalog_source_items_item_id_check" CHECK("catalog_source_items"."item_id" GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]')
);
--> statement-breakpoint
CREATE INDEX `catalog_source_items_item_idx` ON `catalog_source_items` (`kind`,`item_id`);--> statement-breakpoint
CREATE TABLE `catalog_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`repository` text NOT NULL,
	`url` text NOT NULL,
	`branch` text NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`license` text,
	`attribution` text,
	`dependencies` text NOT NULL,
	`updated_at` integer NOT NULL,
	`last_error` text,
	`logo_svg` text,
	CONSTRAINT "catalog_sources_id_check" CHECK("catalog_sources"."id" GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "catalog_sources_dependencies_check" CHECK(json_valid("catalog_sources"."dependencies") AND json_type("catalog_sources"."dependencies") = 'array'),
	CONSTRAINT "catalog_sources_integers_check" CHECK(typeof("catalog_sources"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_sources_repository_idx` ON `catalog_sources` (`repository`);--> statement-breakpoint
CREATE TABLE `color_scheme_dividers` (
	`id` text NOT NULL,
	`scheme_id` text NOT NULL,
	`label` text NOT NULL,
	`tone` text DEFAULT 'SECTION' NOT NULL,
	`role` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`scheme_id`, `id`),
	FOREIGN KEY (`scheme_id`) REFERENCES `color_schemes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "color_scheme_dividers_id_check" CHECK("color_scheme_dividers"."id" GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "color_scheme_dividers_lengths_check" CHECK(length("color_scheme_dividers"."label") <= 80),
	CONSTRAINT "color_scheme_dividers_tone_check" CHECK("color_scheme_dividers"."tone" IN ('SECTION', 'MILESTONE')),
	CONSTRAINT "color_scheme_dividers_role_check" CHECK("color_scheme_dividers"."role" IN ('START', 'COMPLETE') OR "color_scheme_dividers"."role" IS NULL),
	CONSTRAINT "color_scheme_dividers_role_tone_check" CHECK("color_scheme_dividers"."role" IS NULL OR "color_scheme_dividers"."tone" = 'MILESTONE'),
	CONSTRAINT "color_scheme_dividers_integers_check" CHECK(typeof("color_scheme_dividers"."sort_order") = 'integer' AND typeof("color_scheme_dividers"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `color_scheme_dividers_scheme_idx` ON `color_scheme_dividers` (`scheme_id`,`sort_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `color_scheme_dividers_role_idx` ON `color_scheme_dividers` (`scheme_id`,`role`) WHERE "color_scheme_dividers"."role" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `color_scheme_images` (
	`id` text NOT NULL,
	`scheme_id` text NOT NULL,
	`image_url` text NOT NULL,
	`thumbnail_url` text,
	`image_type` text,
	`method` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`scheme_id`, `id`),
	FOREIGN KEY (`scheme_id`) REFERENCES `color_schemes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "color_scheme_images_id_check" CHECK("color_scheme_images"."id" GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "color_scheme_images_lengths_check" CHECK(length("color_scheme_images"."image_url") <= 2000 AND length("color_scheme_images"."thumbnail_url") <= 2000 AND length("color_scheme_images"."image_type") <= 40 AND length("color_scheme_images"."method") <= 40),
	CONSTRAINT "color_scheme_images_integers_check" CHECK(typeof("color_scheme_images"."sort_order") = 'integer' AND typeof("color_scheme_images"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `color_scheme_images_scheme_idx` ON `color_scheme_images` (`scheme_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `color_scheme_paints` (
	`scheme_id` text NOT NULL,
	`paint_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`scheme_id`, `sort_order`),
	FOREIGN KEY (`scheme_id`) REFERENCES `color_schemes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paint_id`) REFERENCES `paint_catalog`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "color_scheme_paints_integers_check" CHECK(typeof("color_scheme_paints"."sort_order") = 'integer' AND typeof("color_scheme_paints"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `color_scheme_paints_paint_idx` ON `color_scheme_paints` (`paint_id`);--> statement-breakpoint
CREATE TABLE `color_schemes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "color_schemes_id_check" CHECK("color_schemes"."id" GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' OR "color_schemes"."id" GLOB 'user:[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "color_schemes_lengths_check" CHECK(length("color_schemes"."name") <= 200),
	CONSTRAINT "color_schemes_category_check" CHECK("color_schemes"."category" IN ('RED', 'PINK', 'ORANGE', 'YELLOW', 'GREEN', 'TURQUOISE', 'BLUE', 'PURPLE', 'BROWN', 'BLACK', 'GREY', 'WHITE', 'GOLD', 'SILVER', 'BONE', 'FLESH') OR "color_schemes"."category" IS NULL),
	CONSTRAINT "color_schemes_integers_check" CHECK(typeof("color_schemes"."created_at") = 'integer' AND typeof("color_schemes"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE TABLE `miniature_color_schemes` (
	`miniature_id` text NOT NULL,
	`scheme_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`miniature_id`, `scheme_id`),
	FOREIGN KEY (`miniature_id`) REFERENCES `miniatures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scheme_id`) REFERENCES `color_schemes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "miniature_color_schemes_integers_check" CHECK(typeof("miniature_color_schemes"."sort_order") = 'integer' AND typeof("miniature_color_schemes"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `miniature_color_schemes_scheme_idx` ON `miniature_color_schemes` (`scheme_id`);--> statement-breakpoint
CREATE TABLE `miniature_paint_substitutions` (
	`miniature_id` text NOT NULL,
	`target_paint_id` text NOT NULL,
	`substitution_id` text,
	`use_original` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`miniature_id`, `target_paint_id`),
	FOREIGN KEY (`miniature_id`) REFERENCES `miniatures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_paint_id`) REFERENCES `paint_catalog`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`substitution_id`) REFERENCES `paint_substitutions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "miniature_paint_substitutions_choice_check" CHECK(("miniature_paint_substitutions"."use_original" = 1 AND "miniature_paint_substitutions"."substitution_id" IS NULL) OR ("miniature_paint_substitutions"."use_original" = 0 AND "miniature_paint_substitutions"."substitution_id" IS NOT NULL)),
	CONSTRAINT "miniature_paint_substitutions_integers_check" CHECK(typeof("miniature_paint_substitutions"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `miniature_paint_substitutions_target_paint_idx` ON `miniature_paint_substitutions` (`target_paint_id`);--> statement-breakpoint
CREATE INDEX `miniature_paint_substitutions_substitution_idx` ON `miniature_paint_substitutions` (`substitution_id`);--> statement-breakpoint
CREATE TABLE `miniature_recipe_steps` (
	`miniature_id` text NOT NULL,
	`step` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`miniature_id`, `step`),
	FOREIGN KEY (`miniature_id`) REFERENCES `miniatures`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "miniature_recipe_steps_step_check" CHECK("miniature_recipe_steps"."step" IN ('PRIMER', 'UNDERCOAT', 'SPRAY', 'BASECOAT', 'APPLY', 'SHADE', 'WASH', 'LAYER', 'DRYBRUSH', 'GLAZE', 'HIGHLIGHT', 'EDGE_HIGHLIGHT', 'DETAIL', 'TECHNICAL', 'BASING', 'VARNISH', 'OTHER')),
	CONSTRAINT "miniature_recipe_steps_integers_check" CHECK(typeof("miniature_recipe_steps"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE TABLE `miniature_required_paints` (
	`id` text PRIMARY KEY NOT NULL,
	`miniature_id` text NOT NULL,
	`paint_id` text NOT NULL,
	`step` text DEFAULT 'OTHER' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`miniature_id`) REFERENCES `miniatures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paint_id`) REFERENCES `paint_catalog`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "miniature_required_paints_id_check" CHECK("miniature_required_paints"."id" GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "miniature_required_paints_lengths_check" CHECK(length("miniature_required_paints"."notes") <= 2000),
	CONSTRAINT "miniature_required_paints_step_check" CHECK("miniature_required_paints"."step" IN ('PRIMER', 'UNDERCOAT', 'SPRAY', 'BASECOAT', 'APPLY', 'SHADE', 'WASH', 'LAYER', 'DRYBRUSH', 'GLAZE', 'HIGHLIGHT', 'EDGE_HIGHLIGHT', 'DETAIL', 'TECHNICAL', 'BASING', 'VARNISH', 'OTHER')),
	CONSTRAINT "miniature_required_paints_integers_check" CHECK(typeof("miniature_required_paints"."sort_order") = 'integer' AND typeof("miniature_required_paints"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `miniature_required_paints_step_paint_idx` ON `miniature_required_paints` (`miniature_id`,`step`,`paint_id`);--> statement-breakpoint
CREATE INDEX `miniature_required_paints_paint_idx` ON `miniature_required_paints` (`paint_id`);--> statement-breakpoint
CREATE TABLE `miniature_template_paints` (
	`template_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`paint_id` text NOT NULL,
	`step` text DEFAULT 'OTHER' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`template_id`, `sort_order`),
	FOREIGN KEY (`template_id`) REFERENCES `miniature_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paint_id`) REFERENCES `paint_catalog`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "miniature_template_paints_lengths_check" CHECK(length("miniature_template_paints"."notes") <= 2000),
	CONSTRAINT "miniature_template_paints_step_check" CHECK("miniature_template_paints"."step" IN ('PRIMER', 'UNDERCOAT', 'SPRAY', 'BASECOAT', 'APPLY', 'SHADE', 'WASH', 'LAYER', 'DRYBRUSH', 'GLAZE', 'HIGHLIGHT', 'EDGE_HIGHLIGHT', 'DETAIL', 'TECHNICAL', 'BASING', 'VARNISH', 'OTHER')),
	CONSTRAINT "miniature_template_paints_integers_check" CHECK(typeof("miniature_template_paints"."sort_order") = 'integer' AND typeof("miniature_template_paints"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `miniature_template_paints_step_paint_idx` ON `miniature_template_paints` (`template_id`,`step`,`paint_id`);--> statement-breakpoint
CREATE INDEX `miniature_template_paints_paint_idx` ON `miniature_template_paints` (`paint_id`);--> statement-breakpoint
CREATE TABLE `miniature_template_schemes` (
	`template_id` text NOT NULL,
	`scheme_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`template_id`, `scheme_id`),
	FOREIGN KEY (`template_id`) REFERENCES `miniature_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scheme_id`) REFERENCES `color_schemes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "miniature_template_schemes_integers_check" CHECK(typeof("miniature_template_schemes"."sort_order") = 'integer' AND typeof("miniature_template_schemes"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `miniature_template_schemes_scheme_idx` ON `miniature_template_schemes` (`scheme_id`);--> statement-breakpoint
CREATE TABLE `miniature_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`manufacturer` text DEFAULT '' NOT NULL,
	`faction` text DEFAULT '' NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL,
	`image_key` text,
	`image_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "miniature_templates_id_check" CHECK("miniature_templates"."id" GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' OR "miniature_templates"."id" GLOB 'user:[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "miniature_templates_image_key_check" CHECK("miniature_templates"."image_key" IS NULL OR (substr("miniature_templates"."image_key", 1, 36) GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' AND substr("miniature_templates"."image_key", 37) IN ('.avif', '.gif', '.jpg', '.jpeg', '.png', '.webp', '.img'))),
	CONSTRAINT "miniature_templates_lengths_check" CHECK(length("miniature_templates"."name") <= 200 AND length("miniature_templates"."manufacturer") <= 200 AND length("miniature_templates"."faction") <= 200 AND length("miniature_templates"."image_url") <= 2000),
	CONSTRAINT "miniature_templates_categories_check" CHECK(json_valid("miniature_templates"."categories") AND json_type("miniature_templates"."categories") = 'array'),
	CONSTRAINT "miniature_templates_integers_check" CHECK(typeof("miniature_templates"."created_at") = 'integer' AND typeof("miniature_templates"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE TABLE `miniatures` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`manufacturer` text DEFAULT '' NOT NULL,
	`faction` text DEFAULT '' NOT NULL,
	`scale` text DEFAULT '' NOT NULL,
	`painting_status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`image_key` text,
	`source_image_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "miniatures_id_check" CHECK("miniatures"."id" GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "miniatures_image_key_check" CHECK("miniatures"."image_key" IS NULL OR (substr("miniatures"."image_key", 1, 36) GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' AND substr("miniatures"."image_key", 37) IN ('.avif', '.gif', '.jpg', '.jpeg', '.png', '.webp', '.img'))),
	CONSTRAINT "miniatures_lengths_check" CHECK(length("miniatures"."title") <= 200 AND length("miniatures"."notes") <= 10000 AND length("miniatures"."manufacturer") <= 200 AND length("miniatures"."faction") <= 200 AND length("miniatures"."scale") <= 200 AND length("miniatures"."source_image_url") <= 2000),
	CONSTRAINT "miniatures_status_check" CHECK("miniatures"."status" IN ('OWNED', 'WISHLIST')),
	CONSTRAINT "miniatures_painting_status_check" CHECK("miniatures"."painting_status" IN ('NOT_STARTED', 'ASSEMBLED', 'PRIMED', 'IN_PROGRESS', 'COMPLETE')),
	CONSTRAINT "miniatures_integers_check" CHECK(typeof("miniatures"."created_at") = 'integer' AND typeof("miniatures"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE TABLE `paint_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`range` text NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`discontinued` integer DEFAULT false NOT NULL,
	`color_hex` text,
	`source_url` text,
	`source_label` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "paint_catalog_id_check" CHECK("paint_catalog"."id" GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' OR "paint_catalog"."id" GLOB 'user:[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "paint_catalog_lengths_check" CHECK(length("paint_catalog"."brand") <= 120 AND length("paint_catalog"."range") <= 120 AND length("paint_catalog"."name") <= 200 AND length("paint_catalog"."source_url") <= 2000 AND length("paint_catalog"."source_label") <= 200),
	CONSTRAINT "paint_catalog_type_check" CHECK("paint_catalog"."type" IN ('PRIMER', 'BASE', 'LAYER', 'SHADE', 'CONTRAST', 'TECHNICAL', 'DRY', 'AIR', 'METALLIC', 'VARNISH', 'INK', 'OTHER') OR "paint_catalog"."type" IS NULL),
	CONSTRAINT "paint_catalog_discontinued_check" CHECK("paint_catalog"."discontinued" IN (0, 1)),
	CONSTRAINT "paint_catalog_color_hex_check" CHECK("paint_catalog"."color_hex" IS NULL OR "paint_catalog"."color_hex" GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
	CONSTRAINT "paint_catalog_integers_check" CHECK(typeof("paint_catalog"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE TABLE `paint_inventory` (
	`paint_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`stock_level` text DEFAULT 'FULL' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`paint_id`) REFERENCES `paint_catalog`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "paint_inventory_state_check" CHECK("paint_inventory"."state" IN ('OWNED', 'WISHLIST')),
	CONSTRAINT "paint_inventory_stock_level_check" CHECK("paint_inventory"."stock_level" IN ('FULL', 'LOW', 'EMPTY')),
	CONSTRAINT "paint_inventory_quantity_check" CHECK("paint_inventory"."quantity" >= 0),
	CONSTRAINT "paint_inventory_integers_check" CHECK(typeof("paint_inventory"."quantity") = 'integer' AND typeof("paint_inventory"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE TABLE `paint_substitution_ingredients` (
	`substitution_id` text NOT NULL,
	`paint_id` text NOT NULL,
	`parts` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`substitution_id`, `paint_id`),
	FOREIGN KEY (`substitution_id`) REFERENCES `paint_substitutions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paint_id`) REFERENCES `paint_catalog`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "paint_substitution_ingredients_parts_check" CHECK("paint_substitution_ingredients"."parts" >= 1),
	CONSTRAINT "paint_substitution_ingredients_integers_check" CHECK(typeof("paint_substitution_ingredients"."parts") = 'integer' AND typeof("paint_substitution_ingredients"."sort_order") = 'integer' AND typeof("paint_substitution_ingredients"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `paint_substitution_ingredients_paint_idx` ON `paint_substitution_ingredients` (`paint_id`);--> statement-breakpoint
CREATE TABLE `paint_substitutions` (
	`id` text PRIMARY KEY NOT NULL,
	`target_paint_id` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`target_paint_id`) REFERENCES `paint_catalog`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "paint_substitutions_id_check" CHECK("paint_substitutions"."id" GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
	CONSTRAINT "paint_substitutions_lengths_check" CHECK(length("paint_substitutions"."name") <= 80),
	CONSTRAINT "paint_substitutions_is_default_check" CHECK("paint_substitutions"."is_default" IN (0, 1)),
	CONSTRAINT "paint_substitutions_integers_check" CHECK(typeof("paint_substitutions"."created_at") = 'integer' AND typeof("paint_substitutions"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `paint_substitutions_target_paint_idx` ON `paint_substitutions` (`target_paint_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `paint_substitutions_default_idx` ON `paint_substitutions` (`target_paint_id`) WHERE "paint_substitutions"."is_default" = 1;--> statement-breakpoint
CREATE TABLE `vault_account` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`require_sign_in` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "vault_account_single_owner_check" CHECK("vault_account"."id" = 1),
	CONSTRAINT "vault_account_require_sign_in_check" CHECK("vault_account"."require_sign_in" IN (0, 1)),
	CONSTRAINT "vault_account_integers_check" CHECK(typeof("vault_account"."id") = 'integer' AND typeof("vault_account"."updated_at") = 'integer')
);
--> statement-breakpoint
CREATE TABLE `vault_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT "vault_sessions_integers_check" CHECK(typeof("vault_sessions"."expires_at") = 'integer')
);
--> statement-breakpoint
CREATE INDEX `vault_sessions_expires_at_idx` ON `vault_sessions` (`expires_at`);