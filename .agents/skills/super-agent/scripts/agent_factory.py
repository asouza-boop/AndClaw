import sys
import json
import os
from datetime import datetime

def generate_agent_md(data):
    """
    Gera o conteúdo em Markdown seguindo o Molde Padrão do AndClaw.
    Esperamos um JSON com as chaves preenchidas pelo braindump.
    """
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    template = f"""# Contexto do Agente
{data.get('descricao', 'Sem descrição.')}

**Problema Central:** {data.get('problema', 'Não definido')}
**Solução:** {data.get('solucao', 'Não definida')}
**Direção/Persona:** {data.get('personalidade', 'Assistente técnico padrão')}

# Global
# Skills Globais

## Skill 1 — {data.get('main_skill_name', 'Principal')} ⚡
### O Que É
{data.get('main_skill_desc', 'Habilidade principal do agente.')}

### Como Funciona
- **Entrada:** {data.get('skill_input', 'Input do usuário')}
- **Processamento:** {data.get('skill_process', 'Lógica de processamento')}
- **Saída:** {data.get('skill_output', 'Resposta formatada')}

### Regras
- Sempre seguir o tom de {data.get('personalidade', 'formal')}
- {data.get('additional_rules', 'Nenhuma regra adicional.')}

### Exemplo Prático
**Input:** {data.get('example_input', 'Exemplo de input')}
**Output:** {data.get('example_output', 'Exemplo de output')}

### Padrão de Retroalimentação
> [!IMPORTANT]
> Ciclo: LER memória → EXECUTAR → ATUALIZAR memória

### Triggers da Skill
- {data.get('triggers', 'Gatilhos da skill')}

### Memória de Evolução Skill 1
## Preferências Aprendidas
## Histórico de Feedbacks
## Inferências do Agente
## Padrões Por Tipo

# Projetos Pessoais
# Skills Pessoais

# Projetos Empresariais
# Skills Empresariais

---
*Gerado por Super Agent em {now}*
"""
    return template

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Erro: JSON de dados não fornecido.")
        sys.exit(1)
        
    try:
        raw_data = sys.argv[1]
        data = json.loads(raw_data)
        
        agent_name = data.get('nome', 'novo-agente').lower().replace(' ', '-')
        if not agent_name.endswith('.md'):
            agent_name += '.md'
            
        content = generate_agent_md(data)
        
        # Define o caminho de saída (assumindo uma pasta .agents/agents/)
        output_dir = os.path.join('.agents', 'agents')
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        file_path = os.path.join(output_dir, agent_name)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
        print(f"Agente [{agent_name}] criado com sucesso em {file_path}")
        
    except Exception as e:
        print(f"Erro ao gerar agente: {str(e)}")
        sys.exit(1)
