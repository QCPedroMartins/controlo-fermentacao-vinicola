CREATE TABLE `movimentos_cuba` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo_movimento` enum('transferencia','juncao') NOT NULL,
	`data_movimento` date NOT NULL,
	`cubas_origem_ids` text NOT NULL,
	`cuba_destino_id` int NOT NULL,
	`motivo` text,
	`campanha_id` int,
	`user_id` int,
	`user_name` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `movimentos_cuba_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recepcao_cubas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recepcao_id` int NOT NULL,
	`cuba_id` int NOT NULL,
	`kg` decimal(10,1) NOT NULL,
	`notas` text,
	CONSTRAINT `recepcao_cubas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recepcoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`data_recepcao` date NOT NULL,
	`casta` varchar(120),
	`kg_total` decimal(10,1) NOT NULL,
	`notas` text,
	`campanha_id` int,
	`user_id` int,
	`user_name` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recepcoes_id` PRIMARY KEY(`id`)
);
