CREATE TABLE `campanhas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(60) NOT NULL,
	`descricao` text,
	`ativa` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campanhas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `adicoes` ADD `campanha_id` int;--> statement-breakpoint
ALTER TABLE `fermentacoes_arquivo` ADD `campanha_id` int;--> statement-breakpoint
ALTER TABLE `leituras` ADD `campanha_id` int;