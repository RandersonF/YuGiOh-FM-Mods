# Yu-Gi-Oh! Forbidden Memories Mod Viewer (JSON)

Viewer estático (HTML/CSS/JS) para analisar dados de mods de Yu-Gi-Oh! Forbidden Memories a partir de JSONs com o mesmo padrão (cards, drops, fusões, etc).  
O app carrega um **mod padrão** (ou o último selecionado) via `mods.json`, baixa o `cards.json` do mod e processa tudo em um **Web Worker**.

## Funcionalidades
- Seleção de mod por dropdown (manifest `mods.json`)
- Carregamento automático do mod padrão (ou último usado)
- Processamento pesado no `worker.js` para manter UI fluida
- Busca e filtros de cartas (nome, tipo, atributos, guardian stars, level)
- Duelistas com tabs (Deck / Z POW / S POW / S TEC) + badges de contagem
- Navegação por cliques entre:
  - Carta -> detalhes
  - Drops -> duelista
- Cache local (IndexedDB) para acelerar recargas (quando habilitado no projeto)

## Estrutura do projeto
/index.html
/app.js
/worker.js
/style.css
/mods.json
/mods/
rmf/
cards.json
classic/
cards.json
...

## Manifest de mods (mods.json)
Exemplo:

```json
{
  "mods": [
    {
      "id": "rmf",
      "name": "Remaster Final",
      "version": "95",
      "path": "./mods/rmf/cards.json",
      "default": true
    },
    {
      "id": "classic",
      "name": "FM Classic",
      "version": "1",
      "path": "./mods/classic/cards.json"
    }
  ]
}

