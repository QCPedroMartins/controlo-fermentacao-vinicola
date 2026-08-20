# Proposta de Integração — Fermentação e Gestão de Adega

## Decisão recomendada

> A **Gestão de Adega** deve tornar-se o registo central dos recipientes, lotes, barricas, movimentos, IVDP e engarrafamentos. O **Controlo de Fermentação** deve continuar especializado na recepção de uvas, fermentação, densidade, Baumé, temperatura, protocolos, adições e análises de fim de fermentação.

Em vez de manter duas cópias independentes da mesma cuba ou barrica, a integração deve fazer a transição controlada do vinho da fase de fermentação para a fase de adega. A primeira versão deve ser **unidireccional**: Fermentação cria/actualiza a origem de adega quando o vinho sai da cuba. Depois de validada, pode evoluir para uma consulta bidireccional de stock e movimentos posteriores.

## O que já existe em cada aplicação

| Domínio | Controlo de Fermentação | Gestão de Adega | Registo central recomendado |
|---|---|---|---|
| Recepção de uvas e kg | Sim | Não é o foco | Fermentação |
| Leituras de densidade, Baumé e temperatura | Sim | Não é o foco | Fermentação |
| Protocolos e adições de fermentação | Sim | Não é o foco | Fermentação |
| Análises finais | Sim | Pode consumir | Fermentação na fase inicial; Adega no acompanhamento posterior |
| Cubas físicas e volumes | Sim, subconjunto de fermentação | Sim, parque completo | Gestão de Adega |
| Barricas e grupos | Básico, criado na transferência | Sim, com grupos, capacidades e alertas | Gestão de Adega |
| Movimentos e rastreabilidade | Sim, dentro da fermentação | Sim, abrangendo a adega | Gestão de Adega, com ligação à origem de fermentação |
| Lotes IVDP e engarrafamento | Não | Sim | Gestão de Adega |

## Chaves de ligação obrigatórias

O código da cuba, por si só, não é suficiente: a mesma cuba pode receber vinhos diferentes em campanhas e fermentações distintas. Cada transferência integrada deve transportar as seguintes referências:

| Campo de integração | Exemplo | Finalidade |
|---|---|---|
| `origem_app` | `fermentacao` | Identifica o sistema que originou o registo. |
| `fermentacao_cuba_codigo` | `CF12` | Identifica o recipiente físico de origem. |
| `fermentacao_numero` | `3` | Distingue reutilizações da mesma cuba. |
| `fermentacao_movimento_id` | `MB-2026-00021` | Garante idempotência: o mesmo movimento não é duplicado. |
| `lote_origem` | `Codega L. Esp. 2026` | Preserva proveniência comercial/enológica. |
| `data_movimento`, `litros`, `operador` | `2026-08-20`, `600 L`, `Manuel Covas` | Auditoria e balanço de volume. |
| `analise_final_id` | `AF-00124` | Liga os valores analíticos copiados à análise de origem. |

## Fluxo operacional proposto

### 1. Fermentação activa

O trabalho decorre exclusivamente no Controlo de Fermentação. As leituras, protocolos, adições, alertas e análises finais mantêm-se no respectivo histórico.

### 2. Preparar saída de cuba

Ao escolher **Transferir para Barricas** ou **Transferir para Adega**, o sistema pede a confirmação do lote, destino, litros, data e operador. O sistema apresenta a análise final mais recente; caso não exista, cria um aviso de que o destino recebe vinho sem análise final registada.

### 3. Criar/actualizar destino na Gestão de Adega

Para cada destino, a integração deve procurar primeiro um recipiente existente pelo código. Se não existir, cria-o directamente na Gestão de Adega com a capacidade, volume, origem e tipo de recipiente. Se existir, valida capacidade disponível antes de gravar o movimento.

### 4. Gravar um único evento de rastreabilidade

O movimento deve surgir nas duas interfaces com a mesma referência. Na fermentação aparece como saída; na gestão de adega aparece como entrada proveniente de fermentação. Os comentários, a análise final e a proveniência devem acompanhar o evento.

### 5. Continuidade na adega

Depois da transferência confirmada, a Gestão de Adega passa a gerir trasfegas, análises posteriores, grupos de barricas, lotes IVDP, filtração e engarrafamento. A página original de fermentação mantém uma ligação de consulta para o destino, sem duplicar esses movimentos posteriores.

## Implementação por etapas

| Fase | Alteração | Resultado |
|---|---|---|
| **A. Mapeamento** | Associar os códigos de cuba de fermentação aos recipientes físicos da Gestão de Adega e validar divergências. | Evita criar cubas/barricas duplicadas. |
| **B. Ligação segura** | Criar uma API autenticada de integração na Gestão de Adega e uma configuração segura no Controlo de Fermentação. | Permite comunicação entre aplicações sem expor a base de dados. |
| **C. Transferência para barrica** | Ao confirmar uma transferência, criar/actualizar o destino e enviar a análise final, comentários e movimento. | O primeiro fluxo de ponta a ponta fica operacional. |
| **D. Transferência para cuba de adega** | Aplicar a mesma lógica às trasfegas para cubas existentes. | Cobertura da maior parte do pós-fermentação. |
| **E. Consulta cruzada** | Adicionar ligações entre a cuba de fermentação, a cuba/barrica de adega e o lote IVDP. | Rastreabilidade visual completa. |

## Decisões a confirmar antes de desenvolver

1. A integração deve começar apenas quando a fermentação é terminada, ou também durante a fermentação para recipientes que já existem na Gestão de Adega?
2. Quando o destino é uma barrica existente, deve permitir encher parcialmente e misturar vinho já presente, ou deve bloquear essa operação?
3. Os códigos automáticos de barrica criados pela fermentação devem seguir o padrão da Gestão de Adega, ou a escolha do grupo/código deve ser feita pelo utilizador no momento da transferência?
4. Na primeira fase, pretende integração apenas para as **barricas novas**, ou também para transferências para cubas de adega e lotes IVDP?

## Recomendação para o primeiro passo

Começar pelo fluxo **Cuba de Fermentação → Barrica existente ou novo grupo de barricas na Gestão de Adega**. É o ponto onde as duas aplicações se cruzam de forma natural e já existem dados de volume, análises finais, movimentos e alertas em ambos os lados.
