# Transcricoes locais (Mac)

## Objetivo
Fazer upload automatico de transcricoes (txt) para o AndClaw usando o endpoint `/api/meetings`.

## Variaveis
- `ANDCLAW_API_BASE_URL` ex: `https://andclaw.onrender.com`
- `ANDCLAW_PASSWORD` senha do login do PWA
- `TRANSCRIPTS_DIR` pasta onde os `.txt` sao gravados
- `PROCESSED_DIR` pasta para mover os arquivos processados

## Uso
```bash
cd /Users/andersonsouza/Documents/New\ project/AndClaw
ANDCLAW_API_BASE_URL="https://andclaw.onrender.com" \
ANDCLAW_PASSWORD="SUA_SENHA" \
TRANSCRIPTS_DIR="$HOME/AndClaw/transcripts" \
npm run watch:transcripts
```

## Formato
Cada arquivo `.txt` gera uma entrada em Reunioes:
- `title`: nome do arquivo
- `transcript_text`: conteudo do arquivo
