---
name: brainstorming
description: Protocolo de questionamento socrático + comunicação com o usuário. OBRIGATÓRIO para solicitações complexas, novos recursos ou requisitos pouco claros. Inclui relatórios de progresso e tratamento de erros.
allowed-tools: read_file, write_file, ls, glob, grep
---

# Protocolo de Brainstorming & Comunicação

> **OBRIGATÓRIO:** Use para solicitações complexas/vagas, novos recursos, atualizações.

---

## 🛑 PORTÃO SOCRÁTICO (CONTROLE)

### Quando Ativar

| Padrão | Ação |
|---------|--------|
| "Construir/Criar/Fazer [algo]" sem detalhes | 🛑 FAÇA 3 perguntas |
| Recurso complexo ou arquitetura | 🛑 Esclareça antes de implementar |
| Solicitação de atualização/mudança | 🛑 Confirme o escopo |
| Requisitos vagos | 🛑 Pergunte propósito, usuários, restrições |

### 🚫 OBRIGATÓRIO: 3 Perguntas Antes da Implementação

1. **PARE** - NÃO comece a codar
2. **PERGUNTE** - Mínimo de 3 perguntas:
   - 🎯 Propósito: Que problema você está resolvendo?
   - 👥 Usuários: Quem vai usar isso?
   - 📦 Escopo: O que é essencial (must-have) vs. desejável (nice-to-have)?
3. **AGUARDE** - Obtenha a resposta antes de prosseguir

---

## 🧠 Geração Dinâmica de Perguntas

**⛔ NUNCA use modelos estáticos.** Leia `dynamic-questioning.md` para os princípios.

### Princípios Fundamentais

| Princípio | Significado |
|-----------|---------|
| **Perguntas Revelam Consequências** | Cada pergunta se conecta a uma decisão arquitetural |
| **Contexto Antes do Conteúdo** | Entenda o contexto (novo projeto/recurso/refatoração/debug) primeiro |
| **Perguntas Mínimas Viáveis** | Cada pergunta deve eliminar caminhos de implementação |
| **Gere Dados, Não Suposições** | Não adivinhe — pergunte apresentando os trade-offs |

### Processo de Geração de Perguntas

```
1. Analisar solicitação → Extrair domínio, recursos, indicadores de escala
2. Identificar pontos de decisão → Bloqueadores vs. adiáveis
3. Gerar perguntas → Prioridade: P0 (bloqueador) > P1 (alto impacto) > P2 (desejável)
4. Formatar com trade-offs → O que, Por que, Opções, Padrão
```

### Formato da Pergunta (OBRIGATÓRIO)

```markdown
### [PRIORIDADE] **[PONTO DE DECISÃO]**

**Pergunta:** [Pergunta clara]

**Por que isso importa:**
- [Consequência arquitetural]
- [Afeta: custo/complexidade/cronograma/escala]

**Opções:**
| Opção | Prós | Contras | Melhor Para |
|--------|------|------|----------|
| A | [+] | [-] | [Caso de uso] |

**Se Não Especificado:** [Padrão + justificativa]
```

**Para bancos de perguntas específicos por domínio e algoritmos detalhados**, consulte: `dynamic-questioning.md`

---

## Relatórios de Progresso (BASEADO EM PRINCÍPIOS)

**PRINCÍPIO:** Transparência gera confiança. O status deve ser visível e acionável.

### Formato do Quadro de Status

| Agente | Status | Tarefa Atual | Progresso |
|-------|--------|--------------|----------|
| [Nome do Agente] | ✅🔄⏳❌⚠️ | [Descrição da tarefa] | [% ou contagem] |

### Ícones de Status

| Ícone | Significado | Uso |
|------|---------|-------|
| ✅ | Concluído | Tarefa finalizada com sucesso |
| 🔄 | Executando | Atualmente em execução |
| ⏳ | Aguardando | Bloqueado, esperando por dependência |
| ❌ | Erro | Falhou, precisa de atenção |
| ⚠️ | Aviso | Problema potencial, não bloqueador |

---

## Tratamento de Erros (BASEADO EM PRINCÍPIOS)

**PRINCÍPIO:** Erros são oportunidades para uma comunicação clara.

### Padrão de Resposta de Erro

```
1. Reconheça o erro
2. Explique o que aconteceu (de forma amigável)
3. Ofereça soluções específicas com trade-offs
4. Peça ao usuário para escolher ou fornecer alternativa
```

### Categorias de Erro

| Categoria | Estratégia de Resposta |
|----------|-------------------|
| **Conflito de Porta** | Ofereça porta alternativa ou feche a existente |
| **Dependência Ausente** | Instale automaticamente ou peça permissão |
| **Falha de Build** | Mostre o erro específico + sugestão de correção |
| **Erro Não Claro** | Peça detalhes: screenshot, saída do console |

---

## Mensagem de Conclusão (BASEADO EM PRINCÍPIOS)

**PRINCÍPIO:** Celebre o sucesso, oriente os próximos passos.

### Estrutura de Conclusão

```
1. Confirmação de sucesso (celebre brevemente)
2. Resumo do que foi feito (concreto)
3. Como verificar/testar (acionável)
4. Sugestão de próximos passos (proativo)
```

---

## Princípios de Comunicação

| Princípio | Implementação |
|-----------|----------------|
| **Conciso** | Sem detalhes desnecessários, vá direto ao ponto |
| **Visual** | Use emojis (✅🔄⏳❌) para escaneamento rápido |
| **Específico** | "~2 minutos" em vez de "espere um pouco" |
| **Alternativas** | Ofereça múltiplos caminhos quando travar |
| **Proativo** | Sugira o próximo passo após a conclusão |

---

## Anti-Padrões (EVITAR)

| Anti-Padrão | Por que |
|--------------|-----|
| Pular para soluções antes de entender | Desperdiça tempo no problema errado |
| Assumir requisitos sem perguntar | Gera o resultado errado |
| Super-engenharia na primeira versão | Atrasa a entrega de valor |
| Ignorar restrições | Cria soluções inutilizáveis |
| Frases como "Eu acho" | Incerteza → Em vez disso, pergunte |

---
