CREATE TABLE `analises_barrica` (
	`id` int AUTO_INCREMENT NOT NULL,
	`barrica_id` int NOT NULL,
	`origem_cuba_id` int NOT NULL,
	`tipo_analise` enum('inicial','final') NOT NULL,
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
	`acucares_residuais` decimal(8,3),
	`acido_malico` decimal(7,3),
	`origem_analise_id` int,
	`user_id` int,
	`user_name` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analises_barrica_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analises_finais_fermentacao` (
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
	`acucares_residuais` decimal(8,3),
	`acido_malico` decimal(7,3),
	`observacoes` text,
	`user_id` int,
	`user_name` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analises_finais_fermentacao_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `barricas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(32) NOT NULL,
	`capacidade_litros` decimal(10,1) NOT NULL,
	`litros_atual` decimal(10,1) NOT NULL DEFAULT '0',
	`estado` enum('activa','vazia') NOT NULL DEFAULT 'activa',
	`cuba_origem_id` int,
	`fermentacao_origem_num` int,
	`campanha_id` int,
	`nome_lote` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `barricas_id` PRIMARY KEY(`id`),
	CONSTRAINT `barricas_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `comentarios_barrica` (
	`id` int AUTO_INCREMENT NOT NULL,
	`barrica_id` int NOT NULL,
	`texto` text NOT NULL,
	`herdado_de` varchar(120),
	`user_id` int,
	`user_name` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comentarios_barrica_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `movimentos_barrica` (
	`id` int AUTO_INCREMENT NOT NULL,
	`data_movimento` date NOT NULL,
	`cuba_origem_id` int NOT NULL,
	`fermentacao_origem_num` int NOT NULL,
	`barricas_json` text NOT NULL,
	`litros_total` decimal(10,1) NOT NULL,
	`motivo` text,
	`campanha_id` int,
	`user_id` int,
	`user_name` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `movimentos_barrica_id` PRIMARY KEY(`id`)
);
