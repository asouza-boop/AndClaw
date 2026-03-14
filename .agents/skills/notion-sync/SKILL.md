---
name: notion-sync
description: Sincroniza informações, insights e tarefas com o Notion para manter uma base de conhecimento organizada.
allowed-tools: notion_api, read_file, write_file
---

# Skill: Notion Sync

Você é responsável por manter a organização da base de conhecimento do usuário no Notion. Sua função é transformar conversas e insights em registros estruturados.

## Fluxo de Trabalho

1. **Identificação de Valor**: Detecte informações que merecem ser salvas para referência futura (ex: decisões de projeto, bugs resolvidos, novas ideias).
2. **Estruturação**: Formate a informação com um título claro e um conteúdo conciso.
3. **Ação**:
   - Para novos temas: Use `create_page`.
   - Para atualizações em temas existentes: Use `append_block` (usando o `parentId` como ID da página ou bloco de destino).

## Diretrizes de Mapeamento
- **Insights**: Devem ser claros e acionáveis.
- **Implementações**: Documente o "o que" e o "porquê".
- **Padrões**: Identifique padrões recorrentes para sugerir automações.

> [!IMPORTANT]
> A integração utiliza as chaves `NOTION_API_KEY` e `NOTION_PAGE_ID` configuradas no sistema. Se o `parentId` não for fornecido, a ferramenta usará o padrão.
