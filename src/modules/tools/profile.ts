import { Tool } from './Tool';
import { ProfileRepository } from '@/memory/repositories/ProfileRepository';
import { z } from 'zod';

export class UpdateProfileTool implements Tool {
  name = 'update_user_profile';
  description = 'Atualiza ou adiciona uma preferência/informação ao perfil de longo prazo do usuário.';
  category = 'cognitive' as const;
  inputSchema = z.object({
    key: z.string().min(1),
    value: z.string(),
  });
  parameters = {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Nome da preferência (ex: linguagem_favorita)' },
      value: { type: 'string', description: 'Valor da preferência (ex: TypeScript)' },
    },
    required: ['key', 'value'],
  };

  private profileRepo = new ProfileRepository();

  async execute({ key, value }: { key: string; value: string }): Promise<string> {
    try {
      await this.profileRepo.set(key, value);
      return `Perfil atualizado: ${key} = ${value}`;
    } catch (e: any) {
      return `Erro ao atualizar perfil: ${e.message}`;
    }
  }
}

export class DeleteProfileTool implements Tool {
  name = 'delete_user_profile';
  description = 'Remove uma informação do perfil do usuário.';
  category = 'cognitive' as const;
  inputSchema = z.object({
    key: z.string().min(1),
  });
  parameters = {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Chave a ser removida' },
    },
    required: ['key'],
  };

  private profileRepo = new ProfileRepository();

  async execute({ key }: { key: string }): Promise<string> {
    try {
      await this.profileRepo.delete(key);
      return `Chave '${key}' removida do perfil com sucesso.`;
    } catch (e: any) {
      return `Erro ao remover chave do perfil: ${e.message}`;
    }
  }
}
