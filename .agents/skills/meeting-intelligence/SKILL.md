-----
name: meeting-intelligence
description: Skill de alto nível para preparação de pautas e análise comportamental de reuniões. Use para criar agendas ricas no Notion (Pre-Meeting) e extrair insights, padrões de comunicação e feedback de transcrições (Post-Meeting). Integre sempre com o AndClaw Hub.
allowed-tools: notion_api, read_file, write_file, ls, glob, grep
---

# Meeting Intelligence (AndClaw Edition) 🎙️

Esta skill transforma o ciclo de reuniões em um ativo estratégico do AndClaw Hub. Ela consolida a preparação inteligente e a análise profunda de comportamento e resultados.

---

## Skill 1 — Pre-Meeting (Preparação de Pautas) 📅

### Quando Usar
- "Prepare a pauta para a reunião X"
- "Preciso de contexto para falar com Y"
- "Monte os objetivos da reunião de hoje"

### Como Funciona
1. **Busca de Contexto**: Pesquisa no Notion (`🏢 Projetos`, `🤖 Agentes`, `💡 Brain`) por temas relacionados.
2. **Identificação de Stakeholders**: Analisa participações anteriores e perfis no Hub.
3. **Geração de Pauta**: Cria uma página no Notion com Objetivos, Decisões Necessárias, Contexto Prévio e Timeboxes.

---

## Skill 2 — Post-Meeting (Análise e Feedback) 🧠

### Quando Usar
- "Analise a transcrição da reunião de ontem"
- "Quais foram os insights da conversa com X?"
- "Onde evitei conflito nessa reunião?"

### Como Funciona
1. **Processamento Bruto**: Lê transcrições (VTT, TXT, MD) enviadas pelo usuário ou capturadas via Telegram.
2. **Análise Comportamental**: Identifica padrões como:
   - **Hedging**: Uso de linguagem defensiva ("talvez", "acho que").
   - **Dominância**: Relação de fala vs. escuta.
   - **Evitação de Conflito**: Momentos onde o feedback direto foi omitido.
3. **Extração de Action Items**: Gera tarefas automáticas para o `📅 Daily Planner`.

---

## Regras de Alto Nível ⚖️

- **NUNCA** fazer análise genérica; cite sempre trechos reais da transcrição.
- **SEMPRE** sugerir uma "Melhor Abordagem" para pontos de melhoria comportamental.
- **SEMPRE** linkar com projetos existentes no AndClaw Hub.
- **SEMPRE** registrar a reunião no database `🎙️ Transcrições & Reuniões`.

## Padrão de Retroalimentação 🔄

Toda análise deve ser salva para que o agente aprenda seu estilo e melhore as sugestões:

### Memória de Evolução Meeting Intelligence
- **Padrões de Comunicação**: [Inferências sobre estilo de fala]
- **Tópicos Recorrentes**: [Assuntos que sempre aparecem em reuniões]
- **Feedback do Usuário**: [O que o usuário concordou/discordou nas análises]

---
*Powered by AndClaw High-Level Operations*
