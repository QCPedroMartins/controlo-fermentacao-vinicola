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
