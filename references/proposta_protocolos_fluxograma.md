# Proposta de Protocolos a partir do Fluxograma de Produção

Esta proposta transforma o fluxograma em etapas configuráveis no sistema. Não fixa produtos, doses ou limites técnicos que estejam manuscritos de forma ambígua; esses valores devem ser confirmados pela equipa de enologia antes de criar protocolos activos.

## 1. Estrutura recomendada

| Protocolo | Âmbito | Estado |
|---|---|---|
| Branco / Rosé — entrada e fermentação | Desde a recepção até à fermentação alcoólica | Prioridade para configurar primeiro |
| Tinto — entrada e fermentação | Desde o esmagamento até à desencuba/prensagem | Prioridade para configurar primeiro |
| Tinto — pós-fermentação / FML | Após passagem a limpo e até estabilização | Criar depois de confirmar regras FML |
| Tratamentos finais / pré-engarrafamento | Branco, rosé e tinto | Segundo bloco; orientado a eventos manuais |

## 2. Etapas de protocolo que a aplicação já suporta

| Tipo de etapa | Como funciona na app | Exemplos do fluxograma |
|---|---|---|
| **Imediata — sem leitura** | Surge assim que o protocolo é atribuído à cuba. Pode ficar registada como adição. | Sulfuroso, enzima, inoculação, levedura, nutriente inicial. |
| **Por densidade** | Avisa quando a leitura fica abaixo/igual, acima/igual ou igual ao limite indicado. | Nutriente na quebra de densidade; controlos de fermentação. |
| **Por Baumé** | Igual à densidade, destinado às cubas de Vinho do Porto ou a regras com Baumé. | Aguardentação ou etapa prevista por °Bé. |
| **Por temperatura** | Avisa quando a temperatura atinge o limite configurado. | Controlo de temperatura e oxigenação. |
| **Por dia de fermentação** | Avisa no dia definido após início da fermentação. | Verificação no dia 1, 3, 7, etc. |
| **Manual** | Surge de imediato e exige confirmação operacional. | Desencuba, passagem a limpo, colagem, FML, filtração. |

## 3. Proposta inicial — Branco / Rosé

| Ordem | Etapa | Accionamento recomendado | Registo esperado |
|---:|---|---|---|
| 1 | Sulfitagem / preparação inicial | Imediato — sem leitura | Produto, dose real e observações. |
| 2 | Enzima / produto de clarificação inicial | Imediato — sem leitura | Produto, dose por hL e hora. |
| 3 | Inoculação de levedura | Imediato — sem leitura | Levedura, dose por hL, lote e observações. |
| 4 | Nutriente inicial | Imediato ou por dia de fermentação | Produto, dose e confirmação de homogeneização. |
| 5 | Nutriente intermédio | Por densidade ou Baumé **a confirmar** | Produto, dose e leitura que accionou o aviso. |
| 6 | Oxigenação / controlo | Por densidade, temperatura ou manual **a confirmar** | Confirmação e observações. |
| 7 | Passagem a limpo | Manual | Data, destino/observações e responsável. |
| 8 | Estabilização / correcções | Manual | Produto, dose, análises de suporte e observações. |

## 4. Proposta inicial — Tinto

| Ordem | Etapa | Accionamento recomendado | Registo esperado |
|---:|---|---|---|
| 1 | Sulfitagem / preparação | Imediato — sem leitura | Produto e dose real. |
| 2 | Enzima / tanino / preparações | Imediato — sem leitura | Produto, dose e observações. |
| 3 | Inoculação de levedura | Imediato — sem leitura | Levedura, dose e lote. |
| 4 | Nutriente inicial | Imediato ou dia 1 | Produto e dose. |
| 5 | Nutriente / oxigenação intermédia | Por densidade **a confirmar** | Produto, dose e leitura desencadeadora. |
| 6 | Desencuba | Manual | Data, destino e litros movimentados. |
| 7 | Prensagem / passagem a limpo | Manual | Data e observações. |
| 8 | Início / acompanhamento de FML | Manual | Confirmação e observações analíticas. |
| 9 | Pós-FML / sulfitação / tratamento | Manual ou por dias **a confirmar** | Produto, dose e tempo de contacto. |
| 10 | Estabilização, colagem e filtração | Manual | Produto, dose e confirmação. |

## 5. Primeira revisão necessária

Para transformar isto num protocolo activo, confirme apenas estes pontos para **um** dos protocolos (recomendo começar por Branco/Rosé):

1. Produtos exactos e doses por hL da adição inicial.
2. O valor de densidade ou Baumé que acciona cada nutriente/oxigenação.
3. Quais das etapas devem ficar apenas como lembrete e quais devem obrigar a confirmação.
4. Se a FML deve ficar como etapa manual ou ter regras adicionais de análise/tempo.

Depois de validar estes quatro pontos, o protocolo pode ser criado na aplicação e aplicado a uma cuba de teste sem afectar as restantes.
