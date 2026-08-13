# Resumo do Fluxograma de Produção — base para protocolos

Fonte analisada: `/home/ubuntu/upload/FluxogramaProdução2.pdf`

## 5.1. Fluxograma Vinho Branco e Rosé

### Etapas principais observadas

1. Recepção de uvas
2. Escolha / selecção
3. Desengace
4. Esmagamento
5. Prensagem
6. Decantação / flotação
7. Passagem a limpo
8. Filtração das borras
10. Fermentação alcoólica
11. Armazenamento em barricas
12. Armazenamento inox
14. Passagem a limpo
15. Correcções
16. Estabilização proteica
17. Passagem a limpo
18. Filtração
19. Estabilização tartárica
20. Afinamento final
21. Filtração final
22. Despaletização automática
23. Encaixadora de garrafas
24. Enchedora
25. Rolhadora ou screw cap
26. Lavadora / secadora
27. Capsuladora
28. Rotuladora
29. Encaixotadora manual
30. Encaixotadora automática
31. Paletização
32. Armazenamento
33. Expedição
34. Distribuição

### Insumos e pontos operacionais anotados no PDF

- Sulfuroso / enxofre / “gel seco?” logo no início.
- Aplicação de enológicos em vários pontos.
- Azoto antes/depois de operações intermédias.
- Oxigénio associado à fermentação alcoólica.
- CO2 no afinamento final.
- SO2 perto dos tratamentos finais.
- Recepção de vinho a granel em etapas intermédias.

### Notas manuscritas úteis para protocolo

- Inoculação: `25 g/hL LS`, `1/20 g/hL transporté GH`, `apanho`.
- Fermentação: referência a nutrientes/enológicos por intervalo de densidade.
- Anotações de controlo analítico para brancos/rosés: pH, AT, gluconico e correções.

## 5.2. Fluxograma Vinho Tinto

### Etapas principais observadas

1. Etapas comuns até ao esmagamento
2. Fermentação alcoólica
3. Desencuba
4. Prensagem
5. Passagem a limpo
6. Fermentação maloláctica
7. Correcções
8. Colagem
9. Passagem a limpo
10. Descarboxilação
11. Filtração tangencial
12. Armazenamento em inox / barricas
13. Estabilização tartárica
14. Tratamentos finais
15. Filtração
16. Despaletização automática
17. Etapas posteriores comuns ao vinho branco

### Insumos e pontos operacionais anotados no PDF

- Sulfuroso, enzima, gel seco?
- Tannin VR Supra
- LS / Inocell / Actiferm / correcção alcoólica potencial
- Azoto após passagem a limpo / descarboxilação
- SO2 e Velcorin nos tratamentos finais

### Notas manuscritas úteis para protocolo

- Inoculação semelhante ao branco/rosé: `25 g/hL LS`, `1/20 g/hL transporté GH`.
- Fermentação: `10 g/hL Inocell`, `25 g/hL Oenocell`, `O2`.
- Desencuba: `5 g/hL Oenocell`.
- FML: indicação explícita “ter FML”.
- Pós-FML: passar a limpo, sulfitar, aplicar `10 g/hL Biolees` durante ~15 dias, voltar a passar a limpo.
- Descarboxilação com “centriados” e referência a `0,03 / 0,3 CO2`.
- Correcções analíticas anotadas: ácido tartárico, pH, acidez total e sulfuroso.

## Tradução preliminar para a lógica da app

1. Há etapas que devem existir **logo no início**, sem qualquer leitura — inoculação, sulfuroso, enzimas, nutrientes iniciais.
2. Há etapas que podem ser disparadas por **densidade/Baumé**, sobretudo durante fermentação alcoólica.
3. Há etapas que dependem de **evento manual** e não de sensor — desencuba, passagem a limpo, colagem, filtração, estabilização.
4. Há etapas que dependem de **sequência temporal** — por exemplo após FML, após x dias, ou durante 15 dias.
5. Os protocolos devem provavelmente ser separados em pelo menos:
   - Branco/Rosé
   - Tinto
   - eventualmente subprotocolos por estilo/processo

## Informação ainda por confirmar com a adega

- Nomes exactos dos produtos enológicos usados em cada família de protocolo.
- Doses finais por hL para cada produto.
- Regras exactas de disparo por densidade / Baumé.
- Quais as etapas que devem gerar apenas aviso e quais devem exigir conclusão obrigatória.
- Se FML deve ficar como etapa manual confirmada ou se precisa de campo próprio no sistema.
