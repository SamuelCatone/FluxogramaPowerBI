# Fluxo do Power BI

Aplicação web estática que desenha o caminho dos dados de um relatório Power BI, da origem até o visual:

**Origens → Consultas do Power Query → Tabelas do modelo → Medidas → Páginas e visuais**

Há dois jeitos de usar:

- **A partir de um .pbit:** o fluxo é montado sozinho a partir do arquivo, com diagnóstico, boas práticas de DAX, linhagem de colunas, comparação entre versões e dicionário de dados.
- **Fluxo próprio:** você monta o fluxo do zero, arrastando cards modelo para as cinco etapas e ligando um card no outro.

Tudo roda no navegador. O arquivo .pbit é lido na memória e **não é enviado para nenhum servidor**. Posições, anotações, checklist e o fluxo próprio ficam salvos no `localStorage` do navegador de quem usa.

## Como gerar o .pbit

No Power BI Desktop: **Arquivo → Exportar → Modelo do Power BI**. O .pbix não funciona, porque o modelo vem compactado num formato binário.

## Rodar localmente

Não há build nem dependências para instalar. Duas opções:

- Abrir o `index.html` direto no navegador; ou
- Servir a pasta, o que é mais próximo do Netlify:

```bash
python -m http.server 8080
# depois abra http://localhost:8080
```

## Subir para o GitHub

Crie um repositório vazio no GitHub (sem README, .gitignore ou licença, para não conflitar) e, nesta pasta:

```bash
git remote add origin https://github.com/<usuario>/<repositorio>.git
git push -u origin main
```

O `.gitignore` já impede que arquivos `.pbit`/`.pbix` e desenhos `.json` exportados entrem no repositório, porque eles carregam dados do modelo.

## Publicar no Netlify

1. Suba esta pasta para um repositório no GitHub (veja "Subir para o GitHub" abaixo).
2. No Netlify: **Add new site → Import an existing project** e escolha o repositório.
3. Deixe **Build command** vazio e **Publish directory** como `.` (o `netlify.toml` já define isso).

O `netlify.toml` também aplica cabeçalhos de segurança, inclusive uma Content Security Policy que só permite scripts do próprio site.

## Estrutura

```
index.html                 página e marcação
favicon.svg
netlify.toml               configuração do Netlify (publicação e cabeçalhos de segurança)
css/
  app.css                  estilos, com tema claro e escuro
js/
  vendor/
    jszip.min.js           JSZip 3.10.1 (leitura do .pbit e geração do .xlsx)
  analise/                 análise do modelo, sem tocar na tela
    leitura.js             lê o ZIP, o modelo e o relatório e monta o grafo
    uso-colunas.js         onde cada coluna é usada
    boas-praticas-regras.js  regras de DAX e de modelo
    diagnostico.js         pontos de atenção
    comparacao.js          diferenças entre duas versões
  interface/
    estado.js              constantes, estado e salvamento no navegador
    canvas.js              layout, caminho aceso, blocos e ligações
    desenho-livre.js       molduras, setas e rótulos
    exportar.js            PNG, SVG e desenho em .json
    fluxo-proprio.js       raias, paleta de modelos e cards editáveis
    boas-praticas.js       aba Boas práticas
    dicionario.js          dicionário de dados em Excel e Markdown
    vista.js               zoom e enquadramento
    painel.js              painel de detalhes, diagnóstico e linhagem de coluna
    arquivos.js            abrir o .pbit e comparar versões
    eventos.js             mouse, teclado e botões
    tutorial.js            tour da Ajuda
  main.js                  inicia o app
```

Os scripts são carregados em ordem com `defer` e compartilham o escopo global (sem bundler). Ao criar um arquivo novo, inclua no `index.html` na posição certa: `js/vendor` primeiro, depois `js/analise`, depois `js/interface`, e o `js/main.js` sempre por último.

Os arquivos de texto usam UTF-8 e quebra de linha LF (definido no `.gitattributes` e no `.editorconfig`), para o Git não marcar o arquivo inteiro como alterado quando alguém edita no Windows.

## Cuidados com dados

- O diagnóstico, o dicionário e as imagens exportadas mostram nomes de tabelas, colunas, fórmulas e endereços de servidores. Trate como material interno.
- O dicionário de dados não inclui o código M completo, só o servidor de cada origem, para não espalhar endereços de links públicos.
- Desenhos e fluxos abertos de arquivos `.json` passam por uma validação antes de aparecer na tela.

## Licenças

JSZip é distribuído sob a licença MIT (ou GPLv3, à escolha). As fontes IBM Plex são carregadas do Google Fonts sob a SIL Open Font License.
