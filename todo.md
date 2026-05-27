# Controlo de Fermentação Vinícola — TODO

## Base de Dados & Backend
- [x] Schema: tabela `cubas` (cf1..cf84, nome/lote, fermentação nº)
- [x] Schema: tabela `leituras` (cuba_id, data, dia_nº, dens_l1/l2/l3, temp_l1/l2/l3, o2, redox, user_id, created_at)
- [x] Schema: tabela `adicoes` (cuba_id, data, produto, dose, observacoes, user_id)
- [x] Schema: tabela `fermentacoes_arquivo` (cuba_id, fermentacao_nº, nome_lote, data_inicio, data_fim)
- [x] Gerar migração SQL e aplicar na base de dados
- [x] DB helpers: getCuba, getLeituras, getAdicoes, getArquivo
- [x] tRPC router: cubas (list, get, updateNome)
- [x] tRPC router: leituras (list por cuba, create, resumo)
- [x] tRPC router: adicoes (list por cuba, create, delete)
- [x] tRPC router: novaFermentacao (arquivar + reiniciar)
- [x] tRPC router: dashboard (estado de todas as cubas)

## Frontend — Estrutura & Estilos
- [x] Paleta de cores vinícola (bordô, dourado, creme) em index.css
- [x] DashboardLayout com sidebar: Dashboard, Cubas, e navegação cf1..cf84
- [x] Página de Login
- [x] Página 404

## Frontend — Dashboard Geral
- [x] Grid com 84 cubas: estado (em fermentação / completa / sem dados)
- [x] Indicadores visuais de estado por cuba
- [x] Filtro por estado

## Frontend — Página de Cuba
- [x] Cabeçalho com nome/lote editável e identificador cf1..cf84
- [x] Resumo: dias totais, densidade mínima, temperatura máxima
- [x] Painel de entrada de dados (data, dens L1/L2/L3, temp L1/L2/L3, O₂, Redox)
- [x] Tabela de histórico acumulado (uma linha por dia, dados permanentes)
- [x] Gráfico de densidade (3 séries: verde/azul/vermelho)
- [x] Gráfico de temperatura (3 séries: verde/azul/vermelho)
- [x] Gráfico de O₂ dissolvido (ciano)
- [x] Gráfico de potencial redox (roxo)
- [x] Tabela de adições/notas (data, produto, dose, observações)
- [x] Botão "Nova Fermentação" com confirmação e arquivo
- [x] Histórico de fermentações anteriores acessível

## Qualidade
- [x] Responsivo: mobile, tablet, desktop
- [x] Testes Vitest para routers principais (8 testes a passar)
- [x] Registo do utilizador em cada leitura (quem lançou)

## Novas Funcionalidades (v2)
- [x] Schema: adicionar campo `densidadeLimite` (decimal, default 1.000) na tabela `cubas`
- [x] Migração SQL aplicada na base de dados
- [x] Backend: router para atualizar `densidadeLimite` por cuba
- [x] Backend: ao criar leitura, verificar se alguma densidade atingiu o limite e atualizar estado para `completa`
- [x] Backend: enviar notificação ao owner quando cuba atinge fermentação completa
- [x] Frontend: campo editável de "Densidade Limite" na página de cada cuba
- [x] Frontend: botões de exportação Excel e CSV por cuba
- [x] 8 testes Vitest a passar (incluindo novos mocks)

## Registo Rápido Multi-Cuba (v4)
- [x] Backend: router tRPC `leituras.registarLote` para aceitar array de leituras de múltiplas cubas
- [x] Frontend: página `/registo-rapido` com seletor de data global, tabela com todas as 57 cubas e colunas editáveis
- [x] Frontend: botão "Registar Tudo" que envia apenas as linhas com dados preenchidos
- [x] Frontend: feedback visual de sucesso/erro por linha após registo
- [x] Integrar link no menu lateral e no dashboard

## Edição, Alertas de Temperatura e Densidade (v5)
- [x] Schema: adicionar campos `tempPretendida` e `desvioTempAlerta` (decimal) na tabela `cubas`
- [x] Schema: adicionar campo `desvioDesnsAlerta` (decimal) na tabela `cubas`
- [x] Schema: adicionar campos de auditoria na tabela `leituras`: `editedAt`, `editedBy`, `editedByName`
- [x] Migração SQL aplicada na base de dados
- [x] Backend: router `leituras.edit` para editar uma leitura existente (com log de quem editou)
- [x] Backend: router `cubas.updateAlertas` para atualizar tempPretendida, desvioTempAlerta, desvioDesnsAlerta
- [x] Backend: ao criar/editar leitura, verificar desvio de temperatura e variação brusca de densidade
- [x] Frontend: botão de edição em cada linha da tabela histórico (modal com formulário pré-preenchido)
- [x] Frontend: indicação visual de "editado" nas linhas que foram alteradas (tooltip com data/utilizador)
- [x] Frontend: configurações de alerta na página de cuba (tempPretendida, desvioTempAlerta, desvioDesnsAlerta)
- [x] Frontend: painel de alertas ativos na página de cuba (temperatura e variação de densidade)
- [x] Frontend: alertas visíveis no dashboard geral (cubas com alertas ativos, badge vermelho + filtro)
- [x] Testes Vitest atualizados (16 testes a passar)

## Consulta de Fermentações Arquivadas (v6)
- [x] Corrigir problema atual na aplicação (erro leituras.listAllDashboard resolvido com reinicio do servidor)
- [x] Backend: query para leituras de fermentação arquivada (por cubaId + fermentacaoNum)
- [x] Backend: query para adições de fermentação arquivada (por cubaId + fermentacaoNum)
- [x] Frontend: botão "Ver detalhe" em cada fermentação arquivada no separador Arquivo
- [x] Frontend: página de consulta completa /cuba/:codigo/arquivo/:fermentacaoNum (histórico, gráficos, adições, resumo)
- [x] Frontend: navegação de volta para a cuba atual (botão Voltar)
- [x] Testes Vitest atualizados (20 testes a passar)

## Emails Automáticos (v7)
- [x] Instalar dependências: resend, exceljs, @napi-rs/canvas
- [x] Criar helper server/emailReport.ts: gera Excel com leituras + gráficos (@napi-rs/canvas) por cuba
- [x] Criar handler /api/scheduled/daily-digest: envia email diário com todas as fermentações ativas em Excel
- [x] Criar handler /api/scheduled/fermentacao-completa: envia email imediato com a fermentação concluída
- [x] Integrar envio de email no fluxo novaFermentacao (trigger ao arquivar, background async)
- [x] Cron diário registado via manus-heartbeat: 0 0 20 * * * (21h Lisboa) — task_uid: gZiQCrbGLGbiAYja6r4JM2
- [x] Emails de destino configurados no código: pedromartins@castelares.com + enologia1@castelares.com
- [x] RESEND_API_KEY configurada e validada (API Key válida)
- [x] Testes Vitest: 20 testes a passar (handlers de email não testados com mock — dependem de Resend externo)
- [x] Deploy concluído (fermenta84-csbhypgs.manus.space) + cron ativo
