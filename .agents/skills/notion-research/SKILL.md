---
name: notion-research
description: Skill de pesquisa e síntese de alto nível dentro do ecossistema AndClaw. Use para cruzar dados entre os bancos de Agentes, Projetos e Brain para gerar reports técnicos, briefs de decisão e resumos estratégicos.
allowed-tools: notion_api, read_file, write_file, ls, glob, grep
---

# Notion Research & Synthesis 💡

Esta skill é a ponte entre o caos da informação e a clareza da execução. Ela navega por todo o AndClaw Hub para sintetizar conhecimento e apoiar decisões de alto nível.

---

## Skill 1 — Sintetizador Estratégico 📋

### Quando Usar
- "Qual o estado atual do projeto X no Jira e no Notion?"
- "Faça um resumo de todos os insights sobre Y colhidos esta semana"
- "Preciso de um brief para tomar uma decisão sobre Z"

### Como Funciona
1. **Varredura Multidimensional**: Busca simultânea em `🏢 Projetos`, `💡 Brain` e `🎙️ Transcrições`.
2. **Cruzamento de Dados**: Identifica onde uma decisão em reunião afetou o escopo de um projeto ou gerou uma nova skill em um agente.
3. **Geração de Documentação**: Publica no Notion utilizando templates de Resumo Executivo, Comparativo de Opções ou Relatório Técnico.

---

## Regras de Alto Nível ⚖️

- **Citações Obrigatórias**: Todo report deve conter links para as fontes originais dentro do Notion.
- **Foco em Decisão**: O output deve sempre terminar com uma seção "Próximos Passos Sugeridos".
- **Sintese vs. Cópia**: Não repita o texto original; extraia o *valor* e a *conexão* entre as informações.

## Padrão de Retroalimentação 🔄

### Memória de Evolução Notion Research
- **Preferências de Formato**: [Nível de detalhe preferido em reports]
- **Fontes de Confiança**: [Quais bancos de dados o usuário mais valoriza]
- **Gaps de Conexão**: [Onde o agente percebe que faltam dados para uma síntese completa]

---
*Powered by AndClaw High-Level Operations*
