# Geração Dinâmica de Perguntas

> **PRINCÍPIO:** Perguntas não servem para coletar dados — servem para **revelar consequências arquiteturais**.
>
> Cada pergunta deve se conectar a uma decisão de implementação concreta que afeta custo, complexidade ou cronograma.

---

## 🧠 Princípios Fundamentais

### 1. Perguntas Revelam Consequências

Uma boa pergunta não é "Que cor você quer?", mas sim:

```markdown
❌ RUIM: "Qual método de autenticação?"
✅ BOA: "Os usuários devem se cadastrar com e-mail/senha ou login social?

   Impacto:
   - E-mail/Senha → Necessita de infraestrutura para redefinição de senha, hashing, 2FA
   - Social → Provedores OAuth, mapeamento de perfil de usuário, menos controle

   Trade-off: Segurança vs. Tempo de desenvolvimento vs. Fricção do usuário"
```

### 2. Contexto Antes do Conteúdo

Primeiro entenda **onde** essa solicitação se encaixa:

| Contexto | Foco da Pergunta |
|---------|----------------|
| **Greenfield** (novo projeto) | Decisões de base: stack, hospedagem, escala |
| **Adição de Recurso** | Pontos de integração, padrões existentes, mudanças de impacto |
| **Refatoração** | Por que refatorar? Performance? Manutenibilidade? O que está quebrado? |
| **Debug** | Sintomas → Causa raiz → Caminho de reprodução |

### 3. Perguntas Mínimas Viáveis

**PRINCÍPIO:** Cada pergunta deve eliminar uma bifurcação no caminho da implementação.

```
Antes da Pergunta:
├── Caminho A: Fazer X (5 min)
├── Caminho B: Fazer Y (15 min)
└── Caminho C: Fazer Z (1 hora)

Depois da Pergunta:
└── Caminho Confirmado: Fazer X (5 min)
```

Se uma pergunta não reduz os caminhos de implementação → **DELETE-A**.

### 4. Perguntas Geram Dados, Não Suposições

```markdown
❌ SUPOSIÇÃO: "O usuário provavelmente quer Stripe para pagamentos"
✅ PERGUNTA: "Qual provedor de pagamento melhor atende às suas necessidades?

   Stripe → Melhor documentação, 2.9% + $0.30, focado nos EUA
   LemonSqueezy → Merchant of Record (MoR), 5% + $0.50, lida com taxas globais
   Paddle → Preços complexos, lida com IVA da UE, foco em empresas"
```

---

## 📋 Algoritmo de Geração de Perguntas

```
INPUT: Solicitação do usuário + Contexto (novo/recurso/refatoração/debug)
│
├── PASSO 1: Analisar Solicitação
│   ├── Extrair domínio (ecommerce, auth, realtime, cms, etc.)
│   ├── Extrair recursos (explícitos e implícitos)
│   └── Extrair indicadores de escala (usuários, volume de dados, frequência)
│
├── PASSO 2: Identificar Pontos de Decisão
│   ├── O que DEVE ser decidido antes de codar? (bloqueador)
│   ├── O que PODERIA ser decidido depois? (adiável)
│   └── O que tem impacto ARQUITETURAL? (alto impacto)
│
├── PASSO 3: Gerar Perguntas (Ordem de Prioridade)
│   ├── P0: Decisões bloqueadoras (não é possível prosseguir sem resposta)
│   ├── P1: Alto impacto (afeta >30% da implementação)
│   ├── P2: Médio impacto (afeta recursos específicos)
│   └── P3: Desejável (casos de borda, otimização)
│
└── PASSO 4: Formatar Cada Pergunta
    ├── O que: Pergunta clara
    ├── Por que: Impacto na implementação
    ├── Opções: Trade-offs (não apenas A vs B)
    └── Padrão: O que acontece se o usuário não responder
```

---

## 🎯 Bancos de Perguntas Específicos por Domínio

### E-Commerce

| Pergunta | Por que Isso Importa | Trade-offs |
|----------|----------------|------------|
| **Vendedor Único ou Multi-vendor?** | Multi-vendor → Lógica de comissão, dashboards de vendedores, pagamentos divididos | +Receita, -Complexidade |
| **Rastreamento de Estoque?** | Necessita de tabelas de estoque, lógica de reserva, alertas de baixo estoque | +Precisão, -Tempo de desenvolvimento |
| **Produtos Digitais ou Físicos?** | Digital → Links de download, sem frete | Físico → APIs de frete, rastreamento |
| **Assinatura ou Venda Única?** | Assinatura → Cobrança recorrente, dunning, prorrogação | +Receita, -Complexidade |

### Autenticação

| Pergunta | Por que Isso Importa | Trade-offs |
|----------|----------------|------------|
| **Login Social é Necessário?** | Provedores OAuth vs. infraestrutura de redefinição de senha | +UX, -Controle |
| **Permissões Baseadas em Regras (RBAC)?** | Tabelas de RBAC, aplicação de políticas, UI administrativa | +Segurança, -Tempo de desenvolvimento |
| **2FA Obrigatório?** | Infraestrutura de TOTP/SMS, códigos de backup, fluxo de recuperação | +Segurança, -Fricção na UX |
| **Verificação de E-mail?** | Tokens de verificação, serviço de e-mail, lógica de reenvio | +Segurança, -Fricção no cadastro |

### Real-time (Tempo Real)

| Pergunta | Por que Isso Importa | Trade-offs |
|----------|----------------|------------|
| **WebSocket ou Polling?** | WS → Escala do servidor, gerenciamento de conexão | Polling → Simples, maior latência |
| **Usuários Simultâneos Esperados?** | <100 → Servidor único, >1000 → Redis pub/sub, >10k → infra especializada | +Escala, -Complexidade |
| **Persistência de Mensagens?** | Tabelas de histórico, custos de armazenamento, paginação | +UX, -Armazenamento |
| **Efêmero ou Durável?** | Efêmero → Em memória, Durável → Gravação no banco antes de emitir | +Confiabilidade, -Latência |

### Conteúdo/CMS (Gerenciamento de Conteúdo)

| Pergunta | Por que Isso Importa | Trade-offs |
|----------|----------------|------------|
| **Rich Text ou Markdown?** | Rich Text → Sanitização, riscos de XSS | Markdown → Simples, sem WYSIWYG |
| **Fluxo Rascunho/Publicação?** | Campo de status, jobs agendados, versionamento | +Controle, -Complexidade |
| **Gerenciamento de Mídia?** | Endpoints de upload, armazenamento, otimização | +Recursos, -Tempo de desenvolvimento |
| **Multi-idioma?** | Tabelas de i18n, UI de tradução, lógica de fallback | +Alcance, -Complexidade |

---

## 📐 Template de Pergunta Dinâmica

```markdown
Com base na sua solicitação para [DOMÍNIO] [RECURSO]:

## 🔴 CRÍTICO (Decisões Bloqueadoras)

### 1. **[PONTO DE DECISÃO]**

**Pergunta:** [Pergunta clara e específica]

**Por que isso importa:**
- [Explique a consequência arquitetural]
- [Afeta: custo / complexidade / cronograma / escala]

**Opções:**
| Opção | Prós | Contras | Melhor Para |
|--------|------|------|----------|
| A | [Vantagem] | [Desvantagem] | [Caso de uso] |
| B | [Vantagem] | [Desvantagem] | [Caso de uso] |

**Se Não Especificado:** [Escolha padrão + justificativa]

---

## 🟡 ALTO IMPACTO (Afeta a Implementação)

### 2. **[PONTO DE DECISÃO]**
[Mesmo formato]

---

## 🟢 DESEJÁVEL (Casos de Borda)

### 3. **[PONTO DE DECISÃO]**
[Mesmo formato]
```

---

## 🔄 Questionamento Iterativo

### Primeira Passagem (3-5 Perguntas)
Foque em **decisões bloqueadoras**. Não prossiga sem as respostas.

### Segunda Passagem (Após a Implementação Inicial)
À medida que os padrões surgirem, pergunte:
- "Este recurso implica [X]. Devemos tratar [caso de borda] agora ou adiar?"
- "Estamos usando o [Padrão A]. O [Recurso B] deve seguir o mesmo padrão?"

### Terceira Passagem (Otimização)
Quando a funcionalidade estiver pronta:
- "Gargalo de performance em [X]. Otimizar agora ou está aceitável por enquanto?"
- "Refatorar [Y] para manutenibilidade ou entregar como está?"

---

## 🎭 Exemplo: Geração Completa de Perguntas

```
SOLICITAÇÃO DO USUÁRIO: "Construir um clone do Instagram"

PASSO 1: Analisar
├── Domínio: Rede Social
├── Recursos: Compartilhamento de fotos, engajamento (curtidas/comentários), perfis de usuários
├── Implícito: Feed, seguir usuários, autenticação
└── Escala: Potencialmente alta (apps sociais podem viralizar)

PASSO 2: Pontos de Decisão
├── Bloqueador: Estratégia de armazenamento, método de autenticação, tipo de feed
├── Alto impacto: Notificações em tempo real, complexidade do modelo de dados
└── Adiável: Analytics, busca avançada, reels/vídeo

PASSO 3: Gerar Perguntas (Prioridade)

P0 (Bloqueador):
1. Estratégia de Armazenamento → Afeta arquitetura, custo, velocidade
2. Algoritmo do Feed → Afeta consultas ao banco de dados, complexidade
3. Método de Autenticação → Afeta tempo de desenvolvimento, UX, segurança

P1 (Alto Impacto):
4. Notificações em Tempo Real → WebSocket vs polling
5. Processamento de Mídia → Otimização no cliente vs servidor

P2 (Adiável):
6. Stories/Reels → Aumento excessivo de escopo, adiar para v2
7. DM/Chat → Subsistema separado, adiar para v2

PASSO 4: Formatar Saída
```

---

## 📊 Exemplo de Saída Gerada

```
Com base na sua solicitação de clone do Instagram:

## 🔴 DECISÕES CRÍTICAS (Não é Possível Prosseguir Sem Respostas)

### 1. **Estratégia de Armazenamento de Fotos**

**Pergunta:** Onde as fotos dos usuários serão armazenadas e servidas?

**Por que isso importa:**
- Afeta: Custos mensais de hospedagem, velocidade de carregamento da página, complexidade de CDN
- Apps sociais de alto volume: 1000 usuários × 10 fotos × 2MB = 20GB de armazenamento

**Opções:**
| Opção | Custo | Velocidade | Complexidade | Melhor Para |
|--------|------|-------|------------|----------|
| **Cloudinary** | $89/mês (25GB) | Rápida (CDN) | Baixa | MVP, lançamento rápido |
| **AWS S3 + CloudFront** | $0.023/GB | Rápida (CDN) | Média | Produção, custo otimizado |
| **Supabase Storage** | Camada grátis 1GB | Média | Baixa | Pequena escala, simples |
| **Local Storage** | Custo do servidor | Lenta | Baixa | Apenas desenvolvimento |

**Se Não Especificado:** Cloudinary (equilibrado para MVP)

---

### 2. **Escolha do Algoritmo do Feed**

**Pergunta:** Como deve funcionar o feed principal?

**Por que isso importa:**
- Afeta: Complexidade das consultas ao banco de dados, estratégia de cache, tempo de desenvolvimento
- Feeds algorítmicos exigem infraestrutura de ML, sinais de ranking

**Opções:**
| Opção | Complexidade | Impacto no DB | Melhor Para |
|--------|------------|-----------------|----------|
| **Cronológico** | Baixa | Consulta simples | Estágio inicial, transparência |
| **Apenas Seguidos** | Média | JOIN com paginação | Maioria dos apps sociais |
| **Algorítmico** | Alta | Tabelas de feed pré-computadas | Concorrente do Instagram |

**Se Não Especificado:** Apenas Seguidos (equilibrado para app social)

---

### 3. **Abordagem de Autenticação**

**Pergunta:** Como os usuários se cadastram e fazem login?

**Por que isso importa:**
- Afeta: Tempo de desenvolvimento (2-5 horas), postura de segurança, fricção na UX

**Opções:**
| Opção | Tempo de Dev | Segurança | UX | Melhor Para |
|--------|----------|----------|-----|----------|
| **E-mail/Senha** | 4-5 h | Alta (com 2FA) | Média | Necessidade de controle total |
| **Apenas Social** | 1-2 h | Depende do provedor | Fluida | B2C, lançamento rápido |
| **Magic Link** | 2-3 h | Média | Muito fluida | Foco em segurança |
| **Clerk/Auth0** | 1 h | Alta | Fluida | Mais rápido para o mercado |

**Se Não Especificado:** Clerk (mais rápido para MVP)

---

## 🟡 ALTO IMPACTO (Afeta Arquitetura)

### 4. **Notificações em Tempo Real**

**Pergunta:** Os usuários precisam de notificações instantâneas para curtidas/comentários?

**Por que isso importa:**
- WebSocket adiciona complexidade de infraestrutura (Redis pub/sub para escala)
- Polling é mais simples, mas tem maior latência

**Opções:**
| Opção | Complexidade | Custo de Escala | Melhor Para |
|--------|------------|------------|----------|
| **WebSocket + Redis** | Alta | $10+/mês | >1000 usuários simultâneos |
| **Polling (30s)** | Baixa | Consultas ao DB | <1000 usuários |
| **Sem Tempo Real** | Nenhuma | Nenhum | MVP, validar primeiro |

**Se Não Especificado:** Polling para o MVP (adiar WebSocket até validação)

---

## 🟢 DESEJÁVEL (Adiar para v2)

### 5. **Suporte a Vídeo/Reels**
- Grande complexidade (processamento de vídeo, infraestrutura de streaming)
- Recomendação: Lançar apenas com fotos, adicionar vídeo após validação

### 6. **Mensagens Diretas (DM)**
- Subsistema separado (infraestrutura de chat diferente do feed)
- Recomendação: Usar Pusher/Stream para tempo real ou adiar completamente

---

## 📋 Resumo

| Decisão | Recomendação | Se Alterado |
|----------|----------------|------------|
| Armazenamento | Cloudinary | +3 h de configuração |
| Feed | Apenas Seguidos | +2 h de otimização de consulta |
| Autenticação | Clerk | -3 h de tempo de dev |
| Tempo Real | Polling | +5 h de config. WebSocket |
| Vídeo | Adiar para v2 | N/A |
| DM | Adiar para v2 | N/A |

**Tempo Total Estimado para o MVP:** 15-20 horas com as recomendações acima
```

---

## 🎯 Recapitulação de Princípios

1. **Cada pergunta = Decisão arquitetural** → Não apenas coleta de dados
2. **Mostre os trade-offs** → O usuário entende as consequências
3. **Priorize decisões bloqueadoras** → Não é possível prosseguir sem elas
4. **Forneça padrões** → Se o usuário não responder, prosseguimos mesmo assim
5. **Consciência de domínio** → Perguntas de e-commerce ≠ autenticação ≠ tempo real
6. **Iterativo** → Mais perguntas surgem conforme os padrões aparecem durante a implementação
