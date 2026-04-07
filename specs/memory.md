# Spec: Memory Module (Postgres + pgvector)

**Versão:** 2.0  
**Status:** Aprovada  
**Autor:** AndClaw Agent  
**Data:** 2026-04-06

---

## 1. Resumo

O módulo de memória do AndClaw passou a atuar como uma camada híbrida:

- histórico conversacional persistente em Postgres
- memória semântica com `pgvector`
- janela de contexto gerenciada pelo `MemoryManager`

O objetivo é manter o agente útil em sessões longas sem depender apenas do histórico recente em RAM.

---

## 2. Contexto e Motivação

LLMs são stateless. Sem persistência, o agente perde continuidade, decisões e referências anteriores.

O modelo antigo de apenas truncar histórico continua válido, mas agora é insuficiente para:

- recuperar decisões antigas
- localizar reuniões e insights semelhantes
- reutilizar contexto entre sessões
- consolidar conhecimento de longo prazo

---

## 3. Goals (Objetivos)

- G-01: Persistir conversas, mensagens e memórias semânticas de forma confiável.
- G-02: Permitir recuperação por similaridade vetorial com `pgvector`.
- G-03: Manter o `MemoryManager` como fachada de orquestração do contexto.
- G-04: Evitar que o `AgentLoop` carregue lógica de storage diretamente.

**Métricas de sucesso:**

| Métrica | Baseline | Target |
|---------|----------|--------|
| Persistência de memória | Apenas histórico recente | Histórico + semântica recuperável |
| Recuperação contextual | LIMIT puro | LIMIT + busca por similaridade |
| Acoplamento ao loop | Alto | Baixo |

---

## 4. Non-Goals

- NG-01: Não substituir o Postgres por um banco de grafos nesta fase.
- NG-02: Não tornar a memória semântica obrigatória para todo fluxo; ela é complementar ao histórico.
- NG-03: Não acoplar o provider de embedding a um fornecedor específico.

---

## 5. Requisitos Funcionais

### 5.1 Requisitos Principais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | O sistema deve persistir conversas e mensagens em Postgres. | Must | Reiniciar o app não perde histórico. |
| RF-02 | O sistema deve persistir memória semântica com embedding vetorial. | Must | Um item salvo pode ser recuperado por similaridade. |
| RF-03 | O `MemoryManager` deve orquestrar persistência e recuperação sem expor SQL ao loop. | Must | `AgentLoop` não acessa SQL diretamente. |
| RF-04 | O contexto do agente deve combinar histórico recente com memória semântica relevante. | Must | Respostas mantêm continuidade entre sessões. |

### 5.2 Fluxo Principal

1. Usuário envia uma entrada.
2. O sistema gera embedding do texto.
3. O `MemoryService` busca memórias próximas por similaridade.
4. O `MemoryManager` monta o contexto para o `AgentLoop`.
5. A resposta final do agente é persistida como conversa e memória semântica.

---

## 6. Requisitos Não-Funcionais

| ID | Requisito | Valor alvo | Observação |
|----|-----------|-----------|------------|
| RNF-01 | Recuperação semântica | Determinística e indexável | Usar `ORDER BY embedding <-> $1` |
| RNF-02 | Resiliência a ausência de provider | Fallback local | O sistema continua operando |
| RNF-03 | Baixo acoplamento | Alto | Serviço de embedding e storage separados |

---

## 7. Modelo de Dados

### 7.1 Tabelas principais

- `conversations`
- `messages`
- `memory_items`

### 7.2 `memory_items`

Campos esperados:

- `type`
- `content`
- `source_type`
- `source_id`
- `metadata`
- `embedding`
- `created_at`

`embedding` deve ser compatível com `pgvector`.

---

## 8. Integrações e Dependências

| Dependência | Tipo | Impacto se indisponível |
|-------------|------|------------------------|
| Postgres | Obrigatória | Histórico e memória falham |
| `pgvector` | Obrigatória | Busca semântica falha |
| Provider de embedding | Opcional | Fallback local é usado |
| `MemoryManager` | Obrigatória | Loop perde contexto agregado |

---

## 9. Edge Cases

| Cenário | Trigger | Comportamento esperado |
|---------|---------|----------------------|
| Embedding provider indisponível | API externa falha | Fallback local determinístico |
| Base sem `pgvector` | Extensão ausente | Falha explícita na inicialização |
| Memória vazia | Primeira execução | Contexto semântico retorna vazio |

---

## 10. Rollout

1. Ativar extensão `vector` no banco.
2. Validar schema.
3. Liberar geração e busca vetorial.
4. Observar qualidade de recuperação semântica.

