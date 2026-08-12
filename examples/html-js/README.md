# Versão limpa em HTML, CSS e JavaScript

> Esta pasta contém uma **demonstração autónoma**, deliberadamente simples, do comportamento de movimentos entre cubas. Funciona apenas no browser e guarda os dados locais em `localStorage`.

O ficheiro `index.html` é o ponto de entrada, `styles.css` contém os estilos e `app.js` contém a lógica. Basta abrir `index.html` num navegador moderno.

## Regra de rastreabilidade implementada

| Onde se consulta o movimento | Informação apresentada |
|---|---|
| Cuba de origem | Todos os destinos e respectivos litros. Exemplo: `Transferido para: CF2 (2524 L), CF6 (476 L)` |
| Cuba de destino | Apenas a parcela que essa cuba recebeu. Exemplo: `Recebido de: CF8 — 2524 L` |

## Limites desta versão

Esta demonstração **não** inclui autenticação, base de dados, importação CSV, relatórios PDF/Excel, email, controlo de permissões ou o backend tRPC da aplicação de produção. Essas funcionalidades fazem parte do código-fonte completo do projecto, fornecido separadamente no pacote ZIP.

