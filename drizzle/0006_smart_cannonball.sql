ALTER TABLE `cubas` ADD `tipo_cuba` enum('vinho','porto') DEFAULT 'vinho' NOT NULL;--> statement-breakpoint
ALTER TABLE `cubas` ADD `alertas_densidade` text;--> statement-breakpoint
ALTER TABLE `cubas` ADD `ponto_aguardentacao` decimal(5,2);--> statement-breakpoint
ALTER TABLE `cubas` ADD `desvio_aguardentacao_alerta` decimal(5,2) DEFAULT '0.50' NOT NULL;--> statement-breakpoint
ALTER TABLE `leituras` ADD `baume_l1` decimal(5,2);--> statement-breakpoint
ALTER TABLE `leituras` ADD `baume_l2` decimal(5,2);--> statement-breakpoint
ALTER TABLE `leituras` ADD `baume_l3` decimal(5,2);