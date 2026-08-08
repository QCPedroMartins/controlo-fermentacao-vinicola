CREATE TABLE `analises_cuba` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cuba_id` int NOT NULL,
	`fermentacao_num` int NOT NULL DEFAULT 1,
	`data_analise` date NOT NULL,
	`ficha_kilos` decimal(10,1),
	`ficha_litros` decimal(10,1),
	`ficha_ph` decimal(4,2),
	`ficha_at` decimal(6,2),
	`ficha_av` decimal(6,2),
	`ficha_nfa` decimal(7,1),
	`ficha_ntu` decimal(8,1),
	`ficha_gluconico` decimal(6,2),
	`ficha_alcool_provavel` decimal(5,2),
	`user_id` int,
	`user_name` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analises_cuba_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comentarios_cuba` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cuba_id` int NOT NULL,
	`fermentacao_num` int NOT NULL DEFAULT 1,
	`texto` text NOT NULL,
	`herdado_de` varchar(120),
	`user_id` int,
	`user_name` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comentarios_cuba_id` PRIMARY KEY(`id`)
);
