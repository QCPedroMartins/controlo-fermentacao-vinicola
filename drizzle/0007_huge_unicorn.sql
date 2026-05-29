CREATE TABLE `baume_calculo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cuba_id` int NOT NULL,
	`mosto_fresco` decimal(10,1),
	`be_lagrima` decimal(5,2),
	`alcool` decimal(5,2),
	`be_actual` decimal(5,2),
	`grau_vinica` decimal(5,2) DEFAULT '77.00',
	`be_abafar` decimal(5,2),
	`be_lagrima_pretendido` decimal(5,2),
	`ad_necessaria` decimal(10,1),
	`ad_por_pipa` decimal(8,2),
	`volume_final` decimal(10,1),
	`pipas_finals` decimal(8,2),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `baume_calculo_id` PRIMARY KEY(`id`),
	CONSTRAINT `baume_calculo_cuba_id_unique` UNIQUE(`cuba_id`)
);
