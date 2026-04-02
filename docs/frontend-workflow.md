# Frontend oficial do AndClaw

O frontend oficial agora vive em `frontend/`.

## Objetivo

- manter o backend e as regras de negócio no repositório principal `AndClaw`
- usar o projeto do Lovable como fonte de evolução visual e estrutural do frontend
- evitar novas migrações manuais de grande porte

## Estrutura

- `frontend/`: app React/Vite oficial
- `public/`: frontend legado, mantido apenas como fallback
- `src/server/`: backend oficial

O servidor Express usa `frontend/dist` quando existir. Se o build do frontend não existir, o fallback continua sendo `public/`.

## Comandos

```bash
npm run frontend:install
npm run frontend:dev
npm run frontend:build
npm run frontend:test
```

## Deploy recomendado

- frontend React no Vercel
- backend/API no Render

Para builds locais do backend servirem o frontend React:

```bash
npm run frontend:build
npm run build
npm start
```

## Fluxo de atualização a partir do Lovable

O repositório `andclaw-command` foi integrado via `git subtree` em `frontend/`.

Para puxar novas mudanças do Lovable:

```bash
git fetch lovable-frontend
git subtree pull --prefix=frontend lovable-frontend main --squash
```

## Regra de trabalho

- UI, layout e componentes: evoluem no frontend React
- contratos de API e regras de negócio: continuam no backend do `AndClaw`
- qualquer tela nova do Lovable deve ser adaptada ao contrato real da API antes de entrar em produção
