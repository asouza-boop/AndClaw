# Molde Padrão — Especificação Técnica de Agentes

Este documento define a estrutura obrigatória e os padrões de design para todos os agentes criados pela equipe de IA do AndClaw.

## Estrutura do Arquivo (.md)

Cada agente deve seguir rigorosamente esta ordem:

1. **Contexto do Agente**: Descrição executiva, problema central, solução proposta e diretrizes de comportamento.
2. **Global (H1)**: Seção de habilidades universais.
3. **Skills Globais (H1)**:
   - **H2 (Habilidade)**: Nome + Emoji.
     - **H3 (O Que É)**: Definição clara.
     - **H3 (Como Funciona)**: Entrada / Processamento / Saída.
     - **H3 (Regras)**: Constraints técnicas.
     - **H3 (Exemplo Prático)**: Exemplo de I/O.
     - **H3 (Padrão de Retroalimentação)**: OBRIGATÓRIO (Ciclo de memória).
     - **H3 (Triggers)**: Gatilhos para ativação.
     - **H3 (Memória de Evolução)**: Seção para aprendizado contínuo.
4. **Projetos Pessoais (H1)**: Habilidades específicas para vida pessoal.
5. **Projetos Empresariais (H1)**: Habilidades específicas para negócios/trabalho.

## Padrões Visuais e Semânticos

### Sumarização Progressiva
- **Negrito**: Termos técnicos e ações críticas.
- **Alertas (Callouts)**:
  - `> [!IMPORTANT]`: Para regras do Padrão de Retroalimentação.
  - `> [!NOTE]`: Para observações de contexto.
  - `> [!TIP]`: Para melhores práticas.

### Hierarquia de Toggles (Referência para Apps de Notas)
- Se o agente for visualizado em ferramentas com suporte a toggle:
  - H1: Cabeçalho fixo.
  - H2: Toggle principal da Skill.
  - H3: Detalhamento expansível.

## Padrão de Retroalimentação (Crítico)

Toda skill do agente DEVE ter um bloco de memória:
```markdown
### Memória de Evolução Skill [Nome]
- **Preferências Aprendidas**: [Espaço para preenchimento futuro]
- **Histórico de Feedbacks**: [Espaço para preenchimento futuro]
- **Inferências do Agente**: [Tendências detectadas]
```
