# Spec: Agent Loop (Reasoning Engine)

**Versão:** 2.0  
**Status:** Aprovada  
**Autor:** AndClaw Agent  
**Data:** 2026-04-06

---

## 1. Resumo

O **AgentLoop** é o motor ReAct do AndClaw. Ele recebe uma entrada, injeta contexto relevante, consulta o provider de LLM, executa ferramentas quando necessário e persiste a saída final junto com memória semântica.

---

## 2. Objetivo

O loop deve manter três propriedades ao mesmo tempo:

- raciocínio iterativo
- execução determinística de ferramentas
- persistência de contexto útil para próximas interações

---

## 3. Goals

- G-01: Suportar resposta final ou tool call estruturado.
- G-02: Repassar observações das tools de volta ao LLM.
- G-03: Limitar a execução por `MAX_ITERATIONS`.
- G-04: Integrar memória vetorial sem quebrar o fluxo ReAct.

---

## 4. Fluxo Atual

1. Recebe input do usuário.
2. Monta o contexto com histórico recente.
3. Recupera memória semântica relevante.
4. Consulta o provider.
5. Executa tools quando o LLM pedir.
6. Injeta observações de volta no buffer.
7. Persiste o turno final em conversa + memória.

---

## 5. Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | O loop deve aceitar resposta final ou tool call. | Must | O fluxo termina corretamente nos dois casos. |
| RF-02 | O loop deve executar tools via registry. | Must | Tool call gera observação real. |
| RF-03 | O loop deve recuperar memória semântica antes da inferência. | Must | Contexto relevante entra no prompt. |
| RF-04 | O loop deve persistir o turno final. | Must | A resposta final fica salva em memória. |
| RF-05 | O loop deve respeitar `MAX_ITERATIONS`. | Must | Nunca entra em loop infinito. |

---

## 6. Não-Objetivos

- NG-01: Não fazer paralelismo entre tool calls nesta fase.
- NG-02: Não substituir o ProviderFactory.
- NG-03: Não transformar o loop em um workflow engine.

---

## 7. Dependências

| Dependência | Tipo | Impacto se indisponível |
|-------------|------|------------------------|
| ProviderFactory | Obrigatória | Sem inferência |
| ToolRegistry | Obrigatória | Sem Action |
| MemoryManager | Obrigatória | Sem contexto persistente |
| EmbeddingService | Obrigatória para memória semântica | Contexto sem busca vetorial |

---

## 8. Edge Cases

| Cenário | Trigger | Comportamento esperado |
|---------|---------|----------------------|
| JSON inválido | Tool call malformada | Falha controlada e novo ciclo |
| Tool inexistente | Nome fora do registry | Observação clara para correção |
| Limite de iterações | Loop sem convergência | Encerramento determinístico |

---

## 9. Observabilidade

O loop deve registrar:

- iteração atual
- tool call
- observação da tool
- fallback de erro

---

## 10. Diretriz de Evolução

O AgentLoop não deve concentrar mais responsabilidade.  
Qualquer crescimento futuro deve ir para:

- serviços de memória
- módulos de tools
- router de server
- provider adapters

