ALTER TABLE `cubas` MODIFY COLUMN `densidade_limite` decimal(7,3) NOT NULL DEFAULT '0.990';--> statement-breakpoint
ALTER TABLE `movimentos_cuba` MODIFY COLUMN `cuba_destino_id` int;--> statement-breakpoint
ALTER TABLE `movimentos_cuba` ADD `destinos_json` text DEFAULT ('[]') NOT NULL;