CREATE TABLE `protocolo_etapas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`protocolo_id` int NOT NULL,
	`ordem` int NOT NULL DEFAULT 1,
	`titulo` varchar(160) NOT NULL,
	`descricao` text,
	`tipo_etapa` enum('adicao','controlo','manual') NOT NULL DEFAULT 'controlo',
	`gatilho_tipo` enum('densidade','baume','temperatura','dia','manual') NOT NULL DEFAULT 'manual',
	`operador` enum('menor_igual','maior_igual','igual'),
	`valor_gatilho` decimal(8,4),
	`produto` varchar(200),
	`dose_por_hl` decimal(8,3),
	`dose_unidade` varchar(30) DEFAULT 'g/hL',
	`instrucoes` text,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `protocolo_etapas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `protocolo_etapas_cuba` (
	`id` int AUTO_INCREMENT NOT NULL,
	`protocolo_cuba_id` int NOT NULL,
	`protocolo_etapa_id` int NOT NULL,
	`estado` enum('pendente','concluida','dispensada') NOT NULL DEFAULT 'pendente',
	`concluida_em` timestamp,
	`concluida_por_id` int,
	`concluida_por_nome` varchar(120),
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `protocolo_etapas_cuba_id` PRIMARY KEY(`id`),
	CONSTRAINT `protocolo_etapa_cuba_unq` UNIQUE(`protocolo_cuba_id`,`protocolo_etapa_id`)
);
--> statement-breakpoint
CREATE TABLE `protocolos_cuba` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cuba_id` int NOT NULL,
	`fermentacao_num` int NOT NULL,
	`protocolo_id` int NOT NULL,
	`atribuido_por_id` int,
	`atribuido_por_nome` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `protocolos_cuba_id` PRIMARY KEY(`id`),
	CONSTRAINT `protocolos_cuba_fermentacao_unq` UNIQUE(`cuba_id`,`fermentacao_num`)
);
--> statement-breakpoint
CREATE TABLE `protocolos_fermentacao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(160) NOT NULL,
	`descricao` text,
	`tipo_cuba` enum('vinho','porto','todos') NOT NULL DEFAULT 'todos',
	`ativo` boolean NOT NULL DEFAULT true,
	`criado_por_id` int,
	`criado_por_nome` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `protocolos_fermentacao_id` PRIMARY KEY(`id`)
);
