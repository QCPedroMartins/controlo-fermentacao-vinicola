CREATE TABLE `alertas_historico` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cuba_id` int NOT NULL,
	`fermentacao_num` int NOT NULL DEFAULT 1,
	`tipo_alerta` varchar(64) NOT NULL,
	`valor_alerta` varchar(64),
	`criado_em` timestamp NOT NULL DEFAULT (now()),
	`reconhecido_em` timestamp,
	`reconhecido_por_id` int,
	`reconhecido_por_nome` varchar(120),
	CONSTRAINT `alertas_historico_id` PRIMARY KEY(`id`)
);
