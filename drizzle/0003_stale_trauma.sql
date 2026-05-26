ALTER TABLE `cubas` ADD `temp_pretendida` decimal(5,1);--> statement-breakpoint
ALTER TABLE `cubas` ADD `desvio_temp_alerta` decimal(5,1) DEFAULT '5.0' NOT NULL;--> statement-breakpoint
ALTER TABLE `cubas` ADD `desvio_desns_alerta` decimal(7,3) DEFAULT '0.010' NOT NULL;--> statement-breakpoint
ALTER TABLE `leituras` ADD `edited_at` timestamp;--> statement-breakpoint
ALTER TABLE `leituras` ADD `edited_by` int;--> statement-breakpoint
ALTER TABLE `leituras` ADD `edited_by_name` varchar(120);