# Frontend Cutover Plan

## Fonte de verdade

- Frontend oficial: `frontend/`
- Backend oficial: `src/server/`
- Deploy frontend validado: `andclaw-command-ui`
- O Lovable **não enxerga o projeto Vercel**. Ele enxerga o repositório conectado.

## Fluxo correto com Lovable

### Opção recomendada agora

Continuar usando o repositório `andclaw-command` como fonte gerada pelo Lovable e sincronizar para o monorepo principal:

```bash
git remote add lovable-frontend https://github.com/asouza-boop/andclaw-command.git
git subtree pull --prefix=frontend lovable-frontend main --squash
```

### O que isso resolve

- evita migração manual grande a cada iteração
- preserva o backend e o deploy principal no repositório `AndClaw`
- mantém o frontend React como interface oficial

## Gaps de API mapeados

### Corrigidos nesta rodada

1. `GET /api/tasks?project_id=...`
2. `PUT /api/skills/:id`
3. `DELETE /api/skills/:id`
4. `POST /api/agent` aceitando `message` como alias de `input`
5. `GET /api/notifications`
6. `GET /api/meetings/:id`
7. `PUT /api/meetings/:id`
8. `POST /api/meetings/:id/process`
9. `POST /api/meetings/:id/upload-audio`
10. substituição das páginas placeholder de `Favoritos`, `Conhecimento` e `Arquivo`
11. corte definitivo do frontend legado no servidor Express

### Ainda pendentes de evolução

1. upload/transcrição de áudio real no backend
2. painel de configurações React suportando múltiplos campos por integração
3. agenda com criação de evento dedicada, sem reutilizar meeting como atalho
4. refino de contratos de settings para permitir formulários mais completos

## Cutover definitivo

- `src/server/app.ts` agora serve apenas `frontend/dist`
- `npm run build` agora gera o frontend React antes do backend
- `public/` permanece no repositório apenas como legado histórico; não é mais servido
