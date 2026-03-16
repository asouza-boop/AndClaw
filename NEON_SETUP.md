# Neon Setup

## Objetivo
Configurar a conexao Postgres (Neon) de forma segura, sem expor segredos no repositorio.

## Passos
1. Crie a base no Neon e copie a `DATABASE_URL`.
2. Configure `DATABASE_URL` nas variaveis do ambiente do backend (Render).
3. Execute o init do schema uma vez:

```bash
cd /Users/andersonsouza/Documents/New\ project/AndClaw
npm run db:init
```

## Health check
Use o endpoint para validar conectividade e schema:

- `GET /api/health`

Resposta esperada:
```json
{ "ok": true }
```

Verificacao somente do banco:
- `GET /api/health/db`

## Notas
- Nao comite o `DATABASE_URL` no git.
- Se rotacionar a senha no Neon, atualize o `DATABASE_URL` no Render.
