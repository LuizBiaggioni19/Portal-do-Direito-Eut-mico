# Portal do Direito Eutímico — Passo 13

Este pacote implementa o **Leitor Jurídico Interno** sobre a navegação do Passo 12.

## Situação do repositório na construção

O repositório mudou depois do Passo 12.

- Base anterior: `aa72abe6898d329386b852f83e268f570c8010f9`
- HEAD verificado no Passo 13: `e9d8096292643a5fd46829bfc1accb8fc33b0665`
- Mudanças detectadas:
  - AI 019/2026 — Código de Relações Públicas;
  - AI 020/2026 — instituição oficial do Repositório de Direito Eutímico;
  - republicação do `Código Eleitoral.md` no acervo ativo.

O Portal carrega o **HEAD atual em tempo de execução**, portanto novas publicações podem aparecer automaticamente na navegação. Os arquivos de consolidação mantêm seu próprio commit-base e o sistema mostra aviso quando houver divergência.

## O que o leitor já faz

- abre arquivos `.md` **dentro do Portal**;
- abre PDFs em leitor interno;
- renderiza Markdown básico, tabelas, listas, títulos, links e links internos `[[wiki]]`;
- oferece cinco visões:
  - **Original**;
  - **Vigente**;
  - **Multivigente**;
  - **Relacional**;
  - **Histórico**;
- aplica automaticamente consolidações editoriais seguras já mapeadas em documentos relevantes;
- preserva o Original;
- marca trechos revogados, superados ou exauridos;
- extrai referências a DS, AI, DEL, Súmulas, Códigos e wiki-links;
- tenta resolver referências para outros documentos do próprio Portal;
- monta relações com base no Livro de Alterações;
- consulta o histórico de commits do arquivo no GitHub;
- permite localizar termo dentro da visão aberta;
- mostra quando o Livro de Alterações está baseado em commit anterior ao HEAD atual.

## Arquivos de dados

- `dados/livro_alteracoes.json`
- `dados/regras_consolidacao.json`
- `dados/consolidacoes_leitor.json`
- `dados/delta_passo_13.json`

## Execução

Recomenda-se servir a pasta com HTTP:

`python -m http.server 8000`

Depois abra:

`http://localhost:8000`

Abrir diretamente por `file://` pode bloquear requisições locais ou ao GitHub em alguns navegadores.

## Limitações deliberadas

O leitor não inventa redação substitutiva quando o ato posterior apenas torna uma referência incompatível. Nesses casos ele insere **nota jurídica** e preserva o texto.

O leitor não remapeia automaticamente números de artigos entre edições diferentes de Códigos.

O Passo 14 será a **visão relacional avançada**, com grafo/colunas de modificadores e modificados no estilo do sistema Normas.


## Passo 14 — Consulta Relacional Avançada

O Portal agora possui visão relacional inspirada em sistemas públicos de consulta normativa:

- **coluna esquerda:** atos modificadores e incidências sobre o ato consultado;
- **centro:** ato consultado e seu status;
- **coluna direita:** atos modificados, afetados ou referenciados pelo ato;
- agrupamento por ano;
- filtros por código de relação e ano;
- opção de ocultar relações de mera citação;
- legenda de códigos;
- grau de certeza;
- escopo e fundamento de cada relação;
- navegação entre documentos relacionados;
- relações ambíguas marcadas como revisão, sem consolidação automática.

### Códigos relacionais

`ALT` altera · `REV` revoga · `DER` derroga · `INT` interpreta · `EXC` excepciona ·
`REP` repristina/reativa · `JUD` efeito jurisdicional · `SUP` supera · `EXA` exaure ·
`REN` renomeia · `CIT` cita/fundamenta · `PRE` preserva/recepciona · `CAD` caducidade ·
`REV?` relação a revisar.

### Índice relacional

Arquivo: `dados/relacoes_normativas.json`

Commit-base do índice relacional: `e9d8096292643a5fd46829bfc1accb8fc33b0665`.

O índice inclui as relações materiais e jurisprudenciais consolidadas nos passos anteriores e relações novas relevantes do Código Eleitoral republicado e do AI 020/2026.


# Passo 15 — Fechamento funcional

Commit verificado: `e9d8096292643a5fd46829bfc1accb8fc33b0665`.

Recursos finais: pesquisa avançada; filtros por tribunal e categoria; operadores de consulta; texto integral sob demanda; ordenação; exportação JSON/CSV; auditoria técnica; comparação incremental do repositório; reindexação; marco de última indexação e arquivos de preparação para publicação.

Exemplos de consulta:

`tipo:"Decreto Sapiencial" ano:2026 divórcio`

`tribunal:STE "Código Penal"`

`status:revogado numero:85`

`categoria:Estatuto nobreza`
