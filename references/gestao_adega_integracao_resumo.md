# Gestão de Adega — Resumo para Integração

## Observação de 20 de agosto de 2026

A aplicação **Gestão de Cubas de Vinho** está acessível ao proprietário através de autenticação Manus e já cobre o circuito de adega posterior à fermentação. A navegação principal contém os módulos **Cubas**, **Barricas**, **Movimentos**, **Lotes IVDP**, **Engarrafamentos** e **Registos**.

O painel indica 142 cubas, stock em litros, ocupação total, alertas analíticos e aprovações IVDP. Os cartões de cuba incluem tipo de vinho, volume e alertas analíticos. Existem grupos de recipientes e alertas específicos de barricas, incluindo barricas sem análises recentes.

## Implicação para a integração

O controlo de fermentação deve permanecer a fonte de dados para a fase de recepção, fermentação, leituras de densidade/temperatura, protocolo, adições e análises finais. Quando o vinho termina a fermentação ou é transferido para barricas, deve criar ou actualizar o respectivo lote/recipiente na Gestão de Adega, mantendo uma chave comum de rastreabilidade.

Os módulos de integração prioritários são: cubas/recipientes, barricas, movimentos, análises e lotes IVDP. Engarrafamentos e registos podem consumir o lote já sincronizado, sem voltar a duplicar os dados de fermentação.

## Detalhe do módulo de barricas

O módulo de barricas é organizado por grupos, apresenta código individual, capacidade por barrica, volume ocupado, alertas analíticos e alertas de antiguidade da análise. Foram observadas capacidades de **225 L**, **228 L**, **300 L**, **550 L** e **2 500 L**, além de exportação para Excel/PDF e criação de novos grupos.

Para evitar criar uma segunda lista de barricas em paralelo, a transferência da fermentação deve passar a criar ou actualizar directamente uma barrica/grupo deste sistema. A transferência deve levar: identificação da cuba/fermentação de origem, litros, análise final mais recente, comentários, data, operador e uma referência de movimento comum. A aplicação de gestão de adega continuará responsável pelo acompanhamento analítico posterior, alertas de barrica, lotes IVDP e engarrafamento.

## Movimentos e lotes IVDP

O módulo **Movimentos** já regista transferências simples entre cubas, ajustes manuais, filtrações e movimentos de cuba para barrica. Cada movimento apresenta data/hora, utilizador, origem, destino, litros, observações e acesso à rastreabilidade. Também importa análises e SO₂ e pode exportar/enviar relatórios.

O módulo **Lotes IVDP** controla litragem autorizada, engarrafada e disponível. Um lote pode abranger várias cubas, e a aplicação pode criar lotes automaticamente quando atribui um código IVDP a uma cuba. A integração deve preservar esta responsabilidade: a fermentação fornece a proveniência/lote candidato e o movimento inicial; a Gestão de Adega decide ou confirma a associação ao lote IVDP e acompanha o saldo até ao engarrafamento.
