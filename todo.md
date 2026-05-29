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

## Envio Manual de Relatório (v8)
- [x] Backend: procedimento tRPC `relatorio.enviarCuba` para gerar e enviar Excel de uma cuba por email
- [x] Frontend: botão "Enviar relatório" na página de cada cuba com spinner e toast de confirmação
- [x] Digest diário confirmado: filtra cubas com estado=em_fermentacao em scheduledHandlers.ts e emailReport.ts
- [x] Testes Vitest atualizados (28 testes a passar, mock corrigido para geral@castelares.com)
- [x] Checkpoint e deploy (v8: e3de77b4)

## Campanhas/Anos e Correção de Bugs (v9)
- [x] BUG: estado da cuba após arquivar corrigido para 'completa' (era 'sem_dados')
- [x] BUG: CF1 atualizada na BD para 'completa' + lógica corrigida no novaFermentacao
- [x] Schema: tabela `campanhas` (id, nome ex:"2025", descricao, ativa, createdAt)
- [x] Schema: campo `campanhaId` nas tabelas `fermentacoes_arquivo`, `leituras`, `adicoes`
- [x] Backend: campanhasRouter com list, ativa, criar, ativar, arquivoByCuba
- [x] Backend: ao arquivar fermentação, associa automaticamente à campanha ativa
- [x] Frontend: botão de campanha ativa no Dashboard (link para /campanhas)
- [x] Frontend: filtro por campanha no separador Arquivo de cada cuba + badge de campanha
- [x] Frontend: página /campanhas com lista, campanha ativa e criar nova
- [x] Testes Vitest: 28 testes a passar
- [x] Checkpoint e deploy (v9: d6a8e5f7)

## Terminar Fermentação e Excel Completo (v11)
- [x] BUG: botão "Terminar Fermentação" adicionado na CubaPage (visível quando em fermentação)
- [x] BUG: exportação Excel agora usa o servidor (exceljs + canvas) com gráficos completos
- [x] Modal de confirmação com campo de nome/lote e aviso de irreversibilidade
- [x] Ao terminar: arquivar, estado completa, email automático com Excel+gráficos
- [x] Endpoint tRPC relatorio.exportarExcelCuba que retorna base64 do Excel com gráficos
- [x] Botão Exportar Excel chama o servidor e descarrega o ficheiro com gráficos
- [x] Testes Vitest: 28 testes a passar
- [x] Checkpoint e deploy (v11: 00616461)

## Ficha Inicial e Marcadores nos Gráficos (v12)
- [x] Schema: adicionar campos fichaInicial à tabela cubas (kilos, litros, ph, at, av, nfa, ntu, gluconico, alcoolProvavel)
- [x] Migração SQL aplicada na BD
- [x] Backend: helper updateFichaInicial + procedimento tRPC cubas.updateFichaInicial
- [x] Backend: procedimento tRPC cubas.getFichaInicial (incluído no cubas.get)
- [x] Frontend: painel "Ficha Inicial" no topo da CubaPage com visualização e botão de edição
- [x] Frontend: modal de edição da ficha inicial com todos os campos
- [x] Frontend: marcadores verticais de adições/notas em todos os gráficos (densidade, temperatura, O₂, redox)
- [x] Frontend: tooltip nos marcadores com produto/dose/observação (label no gráfico)
- [x] Excel: bloco "FICHA INICIAL" na folha Leituras com todos os parâmetros
- [x] Excel: marcadores de adições nos gráficos (linhas verticais roxas com etiqueta em todos os 4 gráficos)
- [x] Testes Vitest: 33 testes a passar
- [x] Checkpoint (v12: bf5084ba)

## PDF, Marcadores e Legendas (v13)
- [x] BUG: texto dos marcadores de adições ilegível nos gráficos do browser — substituídos por ▼1, ▼2... com legenda numerada abaixo
- [x] BUG: gráficos Excel sem etiqueta nas linhas roxas de adições — corrigido para ▼N + tabela de legenda na folha Gráficos
- [x] BUG: botão PDF em falta na CubaPage — adicionado botão vermelho "PDF"
- [x] Frontend: marcadores de adições com ▼N (bold, roxo) nos gráficos do browser
- [x] Frontend: legenda de adições abaixo dos gráficos (lista numerada com produto/dose/observação)
- [x] Excel: ▼N nas linhas verticais de adições (legível, sem rotação)
- [x] Excel: tabela de legenda na folha "Gráficos" com Nº, Dia, Produto, Dose, Observações, Data
- [x] Backend: endpoint tRPC relatorio.exportarPdfCuba que gera PDF com ficha inicial, leituras e adições
- [x] Frontend: botão "PDF" (vermelho) na CubaPage ao lado do Excel e CSV
- [x] Testes Vitest: 33 testes a passar
- [x] Checkpoint e deploy

## Cubas VP (Vinho do Porto) e Alertas de Densidade (v14)
- [x] Schema: campo `tipoCuba` (enum: 'vinho' | 'porto') na tabela `cubas`
- [x] Schema: campos `baumeL1`, `baumeL2`, `baumeL3` (decimal) na tabela `leituras` para cubas VP
- [x] Schema: campo `pontoAguardentacao` na tabela `cubas` (ponto de aguardentação em Baumé)
- [x] Schema: campo `desvioAguardentacaoAlerta` (default 0.5) na tabela `cubas`
- [x] Schema: campo `alertasDensidade` (JSON) na tabela `cubas` — lista de valores de densidade para alertas
- [x] Migração SQL aplicada na BD
- [x] Backend: cubas VP01–VP05 inseridas na BD com tipoCuba='porto'
- [x] Backend: updateCubaAlertas actualizado com pontoAguardentacao, desvioAguardentacaoAlerta, alertasDensidade
- [x] Backend: processarAlertas verifica Baumé vs pontoAguardentacao nas cubas VP
- [x] Backend: processarAlertas verifica densidade vs alertasDensidade nas cubas normais
- [x] Backend: leituras.create e leituras.edit aceitam baumeL1/2/3
- [x] Frontend: CubaPage detecta tipoCuba — para VP mostra campos Baumé em vez de Dens. L1/L2/L3
- [x] Frontend: alerta visual de aguardentação quando Baumé está dentro do desvio configurado
- [x] Frontend: gráfico de Baumé na CubaPage VP com linha de referência do ponto de aguardentação
- [x] Frontend: modal de alertas VP com campos pontoAguardentacao e desvioAguardentacaoAlerta
- [x] Frontend: modal de alertas cubas normais com campo alertasDensidadeStr (lista de valores)
- [x] Dashboard: badge "VP" nos cartões das cubas VP01–VP05, total actualizado para 62
- [x] Menu lateral: grupo "VP01 – VP05 (Vinho do Porto)" adicionado
- [x] Testes Vitest: 33 testes a passar
- [x] Checkpoint e deploy

## Excel, PDF e Dashboard VP (v15)
- [x] Excel: legendas nas séries ("Densidade L1/L2/L3", "Temperatura L1/L2/L3") com linha colorida + ponto + texto
- [x] Excel: linha de referência tracejada para temperatura pretendida e ponto de aguardentação VP
- [x] Excel: séries VP com "Baumé L1/L2/L3" em vez de "Densidade L1/L2/L3"
- [x] PDF: gráficos gerados com @napi-rs/canvas (Densidade/Baumé, Temperatura, O₂, Redox) em página própria
- [x] PDF: linha de referência tracejada para temperatura pretendida e ponto de aguardentação VP
- [x] PDF: tabela de leituras adaptada para VP (Baumé L1/L2/L3 em vez de Dens. L1/L2/L3)
- [x] Dashboard: cubas VP01-VP05 já incluídas na query (select all), badge VP visível no grid
- [x] Testes Vitest: 33 testes a passar
- [x] Checkpoint e deploy

## Calculadoras de Correcção de Álcool (v17)
- [x] Componente CalculadoraCorrecao.tsx com duas abas: "Correcção com Água/AD" e "Correcção com Adjuvante"
- [x] Fórmula Água/AD: Litros = ((Álcool actual - Álcool pretendido) × Volume) / (Álcool pretendido - Álcool água/AD)
- [x] Fórmula Adjuvante: Litros = ((Álcool actual - Álcool pretendido) × Volume) / (Álcool pretendido - Álcool adjuvante)
- [x] Campos: Álcool actual (%), Álcool pretendido (%), Volume (L), Álcool da água/AD ou adjuvante (%) com valores por defeito (77% e 39%)
- [x] Resultado em litros com 2 casas decimais, com indicação se é para adicionar água/adjuvante
- [x] Volume pré-preenchido com o valor de "Litros" da ficha inicial da cuba (se existir)
- [x] Integrada na CubaPage abaixo dos gráficos (visível em todas as tabs)
- [x] Valores negativos/inválidos tratados com mensagem de aviso
- [x] Testes Vitest: 33 testes a passar
- [x] Checkpoint e deploy

## Calculadora de Baumé de Envasilhamento VP (v18)
- [x] Componente CalculadoraBaumeEnvasilhamento.tsx com fórmulas do Excel bédeenvasilhamento.xlsx
- [x] Inputs editáveis: Mosto Fresco (L) [azul], Bé Lágrima Mosto Fresco [laranja], Álcool V/V [amarelo], Bé actual [verde], Grau Vínica (por defeito 77%)
- [x] Cálculos: M=E×0.26, N=M+F, O=D-N, P=O×0.26, Q=N-P (Bé a abafar final), I=(C×(E-O))/(G-E) (AD necessária), K=I+C (volume final), L=K/550 (pipas), J=I/L (AD por pipa)
- [x] Resultados agrupados: Bé a abafar (Q, O), Aguardente (I, J), Volume final (K, L)
- [x] Volume pré-preenchido com fichaLitros da cuba VP
- [x] Visível apenas nas cubas VP (tipoCuba === 'porto')
- [x] Testes Vitest: 33 testes a passar
- [x] Checkpoint e deploy

## Persistência da Calculadora Baumé VP (v19)
- [x] Schema: tabela `baume_calculo` com cubaId, todos os inputs e resultados, updatedAt
- [x] Migração SQL aplicada
- [x] Backend: helper getBaumeCalculo(cubaId) e upsertBaumeCalculo(...) no db.ts
- [x] Backend: procedimento tRPC cubas.getBaumeCalculo (query) e cubas.saveBaumeCalculo (mutation)
- [x] Frontend: ao abrir cuba VP, carrega automaticamente os últimos inputs e resultados guardados
- [x] Frontend: guarda automaticamente com debounce de 1s após alterar qualquer campo
- [x] Frontend: indicador "A guardar…" / "Guardado às HH:MM" no cabeçalho da calculadora
- [x] Testes Vitest: 33 testes a passar
- [x] Checkpoint e deploy

## Importação CSV da Máquina de Densimetria (v20)
- [x] Backend: endpoint tRPC `importacao.processarCsv` que recebe o conteúdo do CSV como string
- [x] Backend: parser do CSV (separador `;`, decimal `,`, ignorar WaterCheck e linhas sem Sample ID)
- [x] Backend: mapear Col B (data DD.MM.YYYY), Col E (cuba), Col L (densidade SG 20/20), Col O (temperatura)
- [x] Backend: normalizar código da cuba (cf01, CF01, cf1 → CF01) e verificar se existe na BD
- [x] Backend: devolver preview das leituras a criar + linhas ignoradas + erros
- [x] Backend: endpoint `importacao.confirmarCsv` que persiste as leituras após confirmação do utilizador
- [x] Frontend: botão "Importar CSV" no Dashboard (topo direito, cor âmbar)
- [x] Frontend: modal com upload de ficheiro CSV (drag & drop ou clique), pré-visualização das leituras por cuba
- [x] Frontend: indica linhas ignoradas (WaterCheck, cuba não encontrada, dados inválidos) em secção colápsável
- [x] Frontend: checkboxes para seleccionar/desseleccionar leituras antes de confirmar
- [x] Frontend: botão "Confirmar Importação" que cria as leituras e mostra resumo de sucesso
- [x] Testes Vitest: 33 testes a passar
- [x] Checkpoint e deploy

## Detecção de Duplicados na Importação CSV (v21)
- [x] Backend: helper `leituraExiste(cubaId, dataLeitura, hora)` em db.ts para verificar duplicados
- [x] Backend: em processarCsv, marcar cada linha como `duplicado: true` se já existe leitura com mesma cuba+data+hora
- [x] Backend: em confirmarCsv, ignorar linhas duplicadas (não criar leitura)
- [x] Frontend: mostrar duplicados no preview com badge "Já existe" (cor âmbar), separados das linhas normais
- [x] Frontend: duplicados não têm checkbox (são sempre ignorados)

## Fluxo CSV → Registo Rápido (v22)
- [x] Frontend: ImportacaoCsvModal ao processar CSV redireciona para /registo-rapido com dados pré-preenchidos (via localStorage ou estado global)
- [x] Frontend: RegistoRapido.tsx lê dados do CSV ao montar (localStorage) e pré-preenche os campos correspondentes
- [x] Frontend: banner no Registo Rápido a indicar que os dados foram importados do CSV (com data e nº de cubas)
- [x] Frontend: densidade do CSV com 4 casas decimais nos inputs do Registo Rápido
- [x] Frontend: ao registar com sucesso, limpar os dados CSV do localStorage

## Melhorias v23
- [x] Frontend: guardar hora HH:MM:SS por cuba no localStorage e mostrar no banner do Registo Rápido
- [x] BD: alterar precisão de dens_l1/l2/l3 de (7,3) para (8,4) no schema Drizzle e migrar

## Simplificação v25: 1 leitura por campo
- [ ] BD: remover dens_l2, dens_l3, temp_l2, temp_l3, baume_l2, baume_l3 da tabela leituras
- [ ] Backend: actualizar db.ts e routers.ts para nova estrutura (dens, temp, baume, o2, redox)
- [ ] Frontend: simplificar RegistoRapido.tsx (1 coluna densidade, 1 temperatura, 1 O₂, 1 Redox)
- [ ] Frontend: simplificar ImportacaoCsvModal.tsx para nova estrutura
- [ ] Frontend: garantir 4 casas decimais em gráficos, tabelas e formulários
