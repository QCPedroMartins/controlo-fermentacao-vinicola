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
- [x] BD: remover dens_l2, dens_l3, temp_l2, temp_l3, baume_l2, baume_l3 da tabela leituras
- [x] Backend: actualizar db.ts e routers.ts para nova estrutura (dens, temp, baume, o2, redox)
- [x] Frontend: simplificar RegistoRapido.tsx (1 coluna densidade, 1 temperatura, 1 O₂, 1 Redox)
- [x] Frontend: simplificar ImportacaoCsvModal.tsx para nova estrutura
- [x] Frontend: garantir 4 casas decimais em gráficos, tabelas e formulários

## Hora na BD e Duplicados por Cuba+Data+Hora (v26)
- [x] Schema: adicionar coluna `hora` (varchar 8, ex: "14:10:25") na tabela `leituras`
- [x] Migração SQL aplicada na BD
- [x] Backend: leituraExistePorDataHora(cubaId, data, hora) — duplicado só se hora também igual
- [x] Backend: importacaoRouter.ts passa hora ao confirmarCsv e ao createLeitura
- [x] Backend: routers.ts registarLote aceita campo hora opcional
- [x] Frontend: ImportacaoCsvModal passa hora no payload de confirmação
- [x] Frontend: RegistoRapido passa hora (do CSV) ao registarLote
- [x] Frontend: tabela histórico da cuba mostra coluna Hora

## Legendas e Títulos nos Gráficos das Exportações (v27)
- [x] Excel: corrigir escala Y com 1 ponto, legenda visível, 4 casas decimais
- [x] PDF: corrigir escala Y com 1 ponto, legenda maior (11px bold), 4 casas decimais
- [x] Email: corrigir escala Y com 1 ponto, 4 casas decimais na densidade

## Correcção de Timezone e Legenda Lateral (v32)
- [x] BD: schema date fields alterados para mode:'string' para evitar shift de timezone UTC
- [x] Backend: db.ts usa strings ISO directamente (sem toDate()) em createLeitura, createAdicao, createArquivo
- [x] Backend: routers.ts removidos instanceof Date checks (dataLeitura é sempre string)
- [x] PDF: gerarGraficoPng redesenhado com legenda na lateral direita (160px) em vez de em baixo
- [x] Excel/Email: gerarGraficoLinha redesenhado com legenda na lateral direita (180px) em vez de em baixo

## Hora no Registo Rápido (v33)
- [x] Adicionar campo de hora global (ao lado da data) na barra de controlo do Registo Rápido
- [x] Adicionar coluna Hora por cuba nas tabelas CF e VP do Registo Rápido
- [x] Hora global aplica-se a todas as cubas sem hora individual definida
- [x] Hora individual por cuba sobrepõe a hora global
- [x] Horas vindas do CSV mantêm-se inalteradas

## Registo Directo CSV e Dashboard com Densidade (v35)
- [x] Backend: endpoint tRPC `leituras.registarLoteCsv` que aceita array completo de leituras (com hora, cubaId, fermentacaoNum, densidade, temperatura, baumeL1, tipoCuba)
- [x] Backend: query dashboard actualizada para incluir última densidade e nome do lote por cuba
- [x] Frontend: modal CSV passa a ter botão "Registar seleccionadas (N)" que envia directamente para a BD
- [x] Frontend: remover botão "Ir para Registo Rápido" do fluxo CSV (ou manter como alternativa)
- [x] Frontend: cartões do Dashboard mostram nome do lote (se definido) e última densidade registada

## Alerta de Limite de Densidade ao Registar (v39)

- [ ] Backend: após registar leitura (registarLote e confirmarCsv), verificar se densL1/baumeL1 <= densidadeLimite e retornar `alertasCubas` (array com cubaId, codigo, nomeLote, densidadeAtual, densidadeLimite)
- [ ] Frontend CubaPage: após registar leitura, se alertaLimite=true mostrar diálogo "Densidade atingiu o limite (X). Deseja terminar a fermentação?"
- [ ] Frontend RegistoRápido: após submissão, mostrar diálogo sequencial para cada cuba com alertaLimite
- [ ] Frontend modal CSV: após registo directo, mostrar diálogo sequencial para cada cuba com alertaLimite
- [ ] Ao confirmar terminar: abrir modal de terminar fermentação (já existente) pré-preenchido

## Relatório Completo, Email ao Iniciar Nova Fermentação e Exportação no Arquivo (v41)
- [ ] Botão "Iniciar Nova Fermentação" deve enviar email do relatório da fermentação anterior (igual ao "Terminar Fermentação")
- [ ] PDF do arquivo deve incluir gráficos, adições, ficha inicial e toda a informação da cuba (actualmente só tem tabela de leituras)
- [ ] Excel do arquivo deve incluir todas as séries (temperatura, O2, redox) além da densidade
- [ ] Botão de exportar PDF e Excel na tab Arquivo de cada cuba (por fermentação arquivada)

## Campanhas de Vindima na Sidebar e Correcções PDF (v22)
- [x] PDF: corrigir legenda sem texto — registar fontes NotoSans explicitamente em pdfReport.ts e emailReport.ts
- [x] PDF: corrigir página 1 em branco — adicionar secção "INFORMAÇÕES DA CUBA" sempre visível na página 1
- [x] PDF: gráficos ficam na mesma página 1 quando há espaço (sem addPage desnecessário)
- [x] Sidebar: adicionar item "Campanhas de Vindima" com ícone Grape no AppLayout.tsx
- [x] Backend: novo endpoint tRPC campanhas.fermentacoesByCampanha para listar todas as fermentações de uma campanha com dados da cuba
- [x] Frontend: página Campanhas.tsx melhorada — cartões expansíveis com lista de fermentações terminadas dentro de cada campanha
- [x] Frontend: cada fermentação mostra cuba, nº, lote, datas, dias, densidade mínima, link para arquivo
- [x] Testes Vitest: 33 testes a passar

## Correcções Dashboard e Legendas PDF/Excel (v23)
- [x] Dashboard: cubas com estado 'completa' devem aparecer como 'Vazia' (cinzento, sem verde)
- [x] CubaPage: badge de estado 'completa' mostra 'Vazia' (cinzento) em vez de 'Fermentação completa' (verde)
- [x] CubaPage: banner quando estado=completa renomeado para 'Cuba vazia' com botão 'Iniciar Nova Fermentação' (não obrigatório)
- [x] PDF: fontes NotoSans empacotadas em server/fonts/ — garantido em produção sem depender do sistema operativo
- [x] Excel: fontes NotoSans empacotadas em server/fonts/ — garantido em produção sem depender do sistema operativo

## Correcção Fluxo de Estados (v24)
- [x] Backend: verificarFermentacaoCompleta não muda estado automaticamente — só notifica
- [x] Backend: processarAlertas — quando densidade atinge limite, apenas envia aviso (estado permanece em_fermentacao)
- [x] Backend: novo procedimento arquivo.terminarFermentacao — arquiva, envia email, estado=completa, fermentacaoNum NÃO muda
- [x] Backend: arquivo.novaFermentacao — só disponível quando estado=completa, incrementa num, estado=em_fermentacao
- [x] CubaPage: terminarFermentacao usa novo endpoint terminarFermentacao
- [x] CubaPage: novaFermentacao usa endpoint separado (reinicia cuba)
- [x] CubaPage: diálogo de alerta de densidade limite reformulado como aviso (não força terminar)
- [x] RegistoRapido: terminarFermentacaoRapido usa novo endpoint terminarFermentacao
- [x] Testes: fermentacao.test.ts actualizado para terminarFermentacao — 33 testes a passar

## Correcção Estado Cuba com Leituras (v25)
- [x] Backend: ao inserir leitura numa cuba 'completa' ou 'sem_dados', mudar estado para 'em_fermentacao' automaticamente
- [x] Backend: registo em lote (CSV) também muda estado para 'em_fermentacao' quando cuba está 'completa'
- [x] Backend: importação CSV (confirmarCsv) também muda estado para 'em_fermentacao'
- [x] CubaPage: se estado='completa' mas há leituras no fermentacaoNum actual, mostrar botão 'Terminar Fermentação' em vez de banner 'Iniciar Nova Fermentação'
- [x] Dashboard: getDashboardCubas trata cubas 'completa' com leituras activas como 'em_fermentacao'
- [x] ImportacaoCsvModal: botão de alerta de densidade usa terminarFermentacao (não novaFermentacao)

## Exportação Excel do Dashboard (v28)
- [ ] Backend: endpoint REST GET /api/export/dashboard-excel que gera Excel com todas as cubas (código, tipo, estado, nº fermentação, lote, última densidade, temperatura, temp. pretendida, limite densidade)
- [ ] Frontend: botão "Exportar Excel" no Dashboard que descarrega o ficheiro gerado

## Nova Campanha Termina Todas as Fermentações (v29)
- [x] Backend: ao criar nova campanha (campanhas.criar), terminar automaticamente todas as cubas com estado='em_fermentacao' (arquivar leituras, estado=completa, fermentacaoNum+1)
- [x] Backend: função auxiliar terminarFermentacaoCuba reutilizável (sem email) usada pelo campanhas.criar
- [x] Backend: campanhas.criar retorna { success, cubasFechadas } para feedback ao utilizador
- [x] Frontend: aviso no modal de criar campanha com lista das 3 acções que irão acontecer
- [x] Frontend: toast de sucesso mostra quantas fermentações foram arquivadas automaticamente

## Controlo de Acesso por Role (v30)
- [ ] Backend: adminProcedure para cubas.criar, cubas.update, cubas.delete
- [ ] Backend: adminProcedure para campanhas.criar, campanhas.ativar
- [ ] Backend: utilizadores convidados podem usar leituras, adicoes, arquivo.terminarFermentacao, arquivo.novaFermentacao, importacao
- [ ] Frontend: ocultar botões admin-only (criar cuba, editar cuba, eliminar cuba, nova campanha) para utilizadores não-admin
- [ ] BD: promover o owner (administrador) a role=admin na base de dados

## Exportação Dashboard — Botão Único (v31)
- [ ] Backend: endpoint REST GET /api/export/dashboard-pdf — PDF com todas as cubas em fermentação activa
- [ ] Backend: endpoint REST GET /api/export/dashboard-excel — Excel com todas as cubas em fermentação activa
- [ ] Frontend: botão "Exportar" no Dashboard com dropdown (PDF / Excel)

## Botão Enviar Relatório Manual (v33)
- [x] Backend: procedure tRPC `relatorio.enviarDigestDiario` que gera Excel de todas as cubas activas e envia por email (já existia)
- [x] Frontend: botão "Enviar Relatório" no Dashboard (junto ao "Exportar") com estado de loading e toast de sucesso/erro

## Recepção de Uvas e Movimentos de Cuba (v34)
- [x] Schema BD: tabelas recepcoes, recepcao_cubas e movimentos_cuba criadas e migradas
- [x] Backend: helpers db.ts para recepções (getAllRecepcoes, getRecepcaoCubasByRecepcao, getRecepcoesByCuba, createRecepcao, deleteRecepcao)
- [x] Backend: helpers db.ts para movimentos (getAllMovimentos, getMovimentosByCuba, getMovimentosHoje, getRecepcoesDoDia, createMovimento)
- [x] Backend: recepcaoRouter tRPC (list, byCuba, criar, eliminar) — criar actualiza fichaKilos das cubas
- [x] Backend: movimentosRouter tRPC (list, byCuba, transferir, juntar) — copia leituras/adições, esvazia origem
- [x] Frontend: página /recepcoes com lista histórica e modal de nova recepção com distribuição de kg por cubas
- [x] Frontend: item "Recepção de Uvas" na sidebar
- [x] Frontend: botões "Transferir para outra cuba" e "Juntar com outra(s) cuba(s)" na CubaPage (quando em fermentação)
- [x] Frontend: modal de transferência/junção com selecção de destino, data e motivo
- [x] Excel digest diário: folha "Movimentos do Dia" com recepções e movimentos do dia
- [x] 34 testes Vitest a passar

## Sistema de Permissões (v35)
- [x] shared/permissions.ts: lista de emails autorizados (enologia1@castelares.com, laboratorio@castelares.com) e função podeEditar()
- [x] server/_core/trpc.ts: editProcedure — verifica email ou role=admin (proprietário)
- [x] server/routers.ts: todas as mutations de edição usam editProcedure em vez de protectedProcedure
- [x] client/src/hooks/usePodeEditar.ts: hook React que devolve true se o utilizador tem permissão de edição
- [x] CubaPage.tsx: botões de edição (leituras, adições, ficha, transferir, juntar) controlados por canEdit
- [x] Campanhas.tsx: botões de criar/ativar campanha controlados por canEdit
- [x] RegistoRapido.tsx: acesso controlado por canEdit
- [x] 34 testes Vitest a passar

## Entrega de Código-Fonte (v65)
- [x] Preparar uma versão limpa e documentada do frontend em HTML, CSS e JavaScript
- [x] Gerar pacote ZIP do código-fonte sem dependências e ficheiros temporários
- [ ] Criar repositório GitHub privado com o código-fonte e documentação de instalação
