CREATE TABLE `adicoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cuba_id` int NOT NULL,
	`fermentacao_num` int NOT NULL DEFAULT 1,
	`data_adicao` date NOT NULL,
	`produto` varchar(200),
	`dose` varchar(100),
	`observacoes` text,
	`user_id` int,
	`user_name` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adicoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cubas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(8) NOT NULL,
	`nome_lote` varchar(120),
	`fermentacao_num` int NOT NULL DEFAULT 1,
	`estado` enum('sem_dados','em_fermentacao','completa') NOT NULL DEFAULT 'sem_dados',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cubas_id` PRIMARY KEY(`id`),
	CONSTRAINT `cubas_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `fermentacoes_arquivo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cuba_id` int NOT NULL,
	`fermentacao_num` int NOT NULL,
	`nome_lote` varchar(120),
	`data_inicio` date,
	`data_fim` date,
	`total_dias` int,
	`dens_min` decimal(7,3),
	`temp_max` decimal(5,1),
	`archived_by` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fermentacoes_arquivo_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leituras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cuba_id` int NOT NULL,
	`fermentacao_num` int NOT NULL DEFAULT 1,
	`data_leitura` date NOT NULL,
	`dia_nr` int,
	`dens_l1` decimal(7,3),
	`dens_l2` decimal(7,3),
	`dens_l3` decimal(7,3),
	`temp_l1` decimal(5,1),
	`temp_l2` decimal(5,1),
	`temp_l3` decimal(5,1),
	`o2` decimal(6,2),
	`redox` decimal(6,1),
	`user_id` int,
	`user_name` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leituras_id` PRIMARY KEY(`id`)
);
