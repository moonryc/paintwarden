PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_vault_account` (
	`id` integer PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`credential_generation` integer DEFAULT 0 NOT NULL,
	`require_sign_in` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "vault_account_single_owner_check" CHECK("__new_vault_account"."id" = 1),
	CONSTRAINT "vault_account_require_sign_in_check" CHECK("__new_vault_account"."require_sign_in" IN (0, 1)),
	CONSTRAINT "vault_account_integers_check" CHECK(typeof("__new_vault_account"."id") = 'integer' AND typeof("__new_vault_account"."credential_generation") = 'integer' AND typeof("__new_vault_account"."updated_at") = 'integer')
);
--> statement-breakpoint
INSERT INTO `__new_vault_account`("id", "username", "password_hash", "credential_generation", "require_sign_in", "updated_at") SELECT "id", "username", "password_hash", 0, "require_sign_in", "updated_at" FROM `vault_account`;--> statement-breakpoint
DROP TABLE `vault_account`;--> statement-breakpoint
ALTER TABLE `__new_vault_account` RENAME TO `vault_account`;--> statement-breakpoint
PRAGMA foreign_keys=ON;