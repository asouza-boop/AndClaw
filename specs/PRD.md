# Spec: PRD — AndClaw Core

**Versão:** 1.0
**Status:** Aprovada
**Autor:** AndClaw Agent
**Data:** 2026-03-06
**Reviewers:** Sandeco

---

## 1. Resumo

O AndClaw é um agente pessoal de Inteligência Artificial para uso local com backend Node.js, frontend PWA e múltiplos providers de LLM. O sistema recebe comandos pela web e por integrações de entrada, processa-os através de um pipeline com fallback entre providers e mantém memória persistente em Postgres.

---

## 2. Contexto e Motivação

**Problema:**
Agentes hospedados na nuvem e serviços de terceiros requerem expor dados privados ou têm custos recorrentes altos, além da falta de total governança sobre as próprias "skills" customizadas. O usuário não tem controle pleno de instâncias como o OpenClaw sem esbarrar na complexidade da nuvem ou lock-in.

**Evidências:**
Tentativas anteriores baseadas no OpenClaw funcionavam, mas a intenção primária agora é manter uma base minimalista sob controle total do usuário, operando no próprio SO.

**Por que agora:**
A ascensão de LLMs eficientes, somada à separação entre backend e frontend, permite operar um agente pessoal com UI própria sem perder controle sobre memória, skills e integrações.

---

## 3. Goals (Objetivos)

- [ ] G-01: Operar primariamente recebendo e respondendo requisições via frontend e API.
- [ ] G-02: Intercambiar "cérebros" (LLMs) usando padronização e fallback entre providers.
- [ ] G-03: Reter contexto por múltiplos turnos com Postgres via repositórios TS.
- [ ] G-04: Respeitar limites rigorosos de autorização via sessão/token.

**Métricas de sucesso:**
| Métrica | Baseline atual | Target | Prazo |
|---------|---------------|--------|-------|
| Uptime local da API | 0% | 99% após testes | 30 dias |
| Troca dinâmica de Skills via hot-reload | Parcial | 1 segundo recarga | 10 dias |

---

## 4. Non-Goals (Fora do Escopo)

- NG-01: Não será SaaS multi-tenant.
- NG-02: Não suportará expansão irrestrita de usuários sem revisão de autorização.
- NG-03: Não depende de uma UI legada; o frontend oficial é o PWA em `frontend/`.

---

## 5. Usuários e Personas

**Usuário primário:** Sandeco (proprietário), acessando via navegador no desktop ou mobile e usando integrações locais.

**Jornada atual (sem a feature):**
O usuário tem que gerir manualmente as APIs ou alternar entre ferramentas externas para acionar "skills" em blocos de texto independentes e sem integração com arquivos locais.

**Jornada futura (com a feature):**
O usuário envia uma solicitação pelo frontend, o AndClaw processa localmente em background, chama LLMs, lê Skills em pastas locais, aciona ferramentas e responde na própria interface.

---

## 6. Requisitos Funcionais

### 6.1 Requisitos Principais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | O sistema deve iniciar backend e frontend em conjunto no ambiente local | Must | `npm run dev` sobe a API e a UI sem intervenção manual. |
| RF-02 | O sistema deve validar autenticação/autorização antes das rotas protegidas | Must | Requisições sem token retornam `401` e não acessam dados sensíveis. |
| RF-03 | O sistema deve alternar "LLMs" instanciando fábricas (`ProviderFactory`) | Must | Trocar `DEFAULT_LLM_PROVIDER` envia prompts ao provider alvo corretamente. |

### 6.2 Fluxo Principal (Happy Path)

1. O usuário manda uma solicitação no frontend.
2. O sistema autentica a sessão e chama a facade do `AgentController`.
3. O sistema joga pro Loop (ReAct / `AgentLoop`) com contexto local salvo no banco.
4. O LLM selecionado processa, encontra ou não a Tool necessária.
5. A resposta volta pela própria interface.

### 6.3 Fluxos Alternativos

**Fluxo Alternativo A — Falha de API de LLM:**
1. LLM primário sobrecarregado (`503`).
2. O `AgentLoop` tenta fallback para outro provider ou falha graciosamente com aviso na interface em vez de quebrar a Promise da engine.

---

## 7. Requisitos Não-Funcionais

| ID | Requisito | Valor alvo | Observação |
|----|-----------|-----------|------------|
| RNF-01 | Latência de repassagem de Msg | < 1000ms | Não confunde atraso da UI com o da API do provedor LLM. |
| RNF-02 | Persistência Ágil | Postgres | Mantém histórico e memória com consultas persistentes e indexadas. |

---

## 8. Design e Interface

**Componentes afetados:** Frontend PWA, terminal log-output e rotas protegidas da API.

**Estados da UI (No frontend):**
- Estado de processamento: a UI sinaliza ação de carregamento até a resposta da API ser recebida.

---

## 9. Modelo de Dados

**Entidades modificadas/persistidas em Postgres**

```sql
conversations {
  id: string        // UUID ou Hash único da thread do usuário
  user_id: string   // O originador whitelisted
  provider: string  // ex: 'gemini'
}
messages {
  conversation_id: string 
  role: string      // 'user'|'assistant'|'system'
  content: string   // Raw Payload da conversa
}
```

---

## 10. Integrações e Dependências

| Dependência | Tipo | Impacto se indisponível |
|-------------|------|------------------------|
| APIs (Gemini/DeepSeek/etc.) | Obrigatória | Sem raciocínio lógico. Precisará tentar fallback no `ProviderFactory`. |
| pacote `Express` | Obrigatória | A API e as rotas deixam de funcionar. |
| Frontend React/Vite | Obrigatória | A interface principal deixa de existir. |

---

## 11. Edge Cases e Tratamento de Erros

| Cenário | Trigger | Comportamento esperado |
|---------|---------|----------------------|
| EC-01: Injeção por Usuário Falso | Receber requests de bots/crawlers | Cortar no Top-Level Middleware sem chegar ao DB. |
| EC-02: Banco de dados bloqueado | Dois loops simultâneos tentam escrita intensa | Espera via timeout natural do driver, senão descarta soft e avisa a UI. |
| EC-03: Key Inválida | O arquivo `.env` tá corrompido ou API key descontinuada | O sistema loga erro fatal de auth e marca o provider como indisponível. |
| EC-04: Excesso de processamento CPU | Arquivos imensos mandados para summary/pdf local | Trava por threshold e diz "Esse arquivo excede limites locais suportados." |

---

## 12. Segurança e Privacidade

- **Autenticação:** Baseada em sessão/token.
- **Autorização:** Perfis autenticados acessam apenas suas próprias rotas e dados.

---

## 13. Plano de Rollout

- **Estratégia:** Deploy local ou remoto com backend separado do frontend.
- **Monitoramento:** Log no Stdout para acompanhar transições de Agent Loop e falhas nas Requests.

---

## 14. Open Questions



