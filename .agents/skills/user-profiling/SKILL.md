---
name: user-profiling
description: Identifica e memoriza informações, preferências e interesses do usuário para personalizar a interação.
allowed-tools: read_file, write_file, ls, glob, grep
---

# Skill: User Profiling

Sempre que o usuário fornecer informações pessoais, preferências, objetivos ou interesses, você deve identificar essas chaves e memorizá-las para que o agente possa ser mais assertivo em interações futuras.

## Fluxo de Trabalho

1. **Escuta Ativa**: Ao processar a mensagem do usuário, verifique se há fatos que definem o perfil dele (ex: "Eu prefiro usar TypeScript", "Meu objetivo é automatizar meu Notion").
2. **Identificação de Chaves**: Transforme esses fatos em pares Chave-Valor curtos.
3. **Persistência**: Use as ferramentas internas para salvar essas chaves no banco de dados de perfil (o sistema gerencia isso via injeção de prompt).

## Exemplos de Chaves
- `preferencia_linguagem`: TypeScript
- `objetivo_principal`: Automação de produtividade
- `estilo_comunicacao`: Direto e técnico

> [!TIP]
> Não memorize informações irrelevantes ou temporárias. Foque no que ajuda a construir um "perfil de longo prazo".
