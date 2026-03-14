import { ITool } from '../ToolRegistry';
import { ProfileRepository } from '../../memory/repositories/ProfileRepository';

export class UpdateProfileTool implements ITool {
    name = "update_user_profile";
    description = "Atualiza ou adiciona uma preferência/informação ao perfil de longo prazo do usuário.";
    parameters = {
        type: "object",
        properties: {
            key: { type: "string", description: "Nome da preferência (ex: linguagem_favorita)" },
            value: { type: "string", description: "Valor da preferência (ex: TypeScript)" }
        },
        required: ["key", "value"]
    };

    private profileRepo = new ProfileRepository();

    async execute({ key, value }: { key: string, value: string }): Promise<string> {
        try {
            this.profileRepo.set(key, value);
            return `Perfil atualizado: ${key} = ${value}`;
        } catch (e: any) {
            return `Erro ao atualizar perfil: ${e.message}`;
        }
    }
}

export class DeleteProfileTool implements ITool {
    name = "delete_user_profile";
    description = "Remove uma informação do perfil do usuário.";
    parameters = {
        type: "object",
        properties: {
            key: { type: "string", description: "Chave a ser removida" }
        },
        required: ["key"]
    };

    private profileRepo = new ProfileRepository();

    async execute({ key }: { key: string }): Promise<string> {
        try {
            this.profileRepo.delete(key);
            return `Chave '${key}' removida do perfil com sucesso.`;
        } catch (e: any) {
            return `Erro ao remover chave do perfil: ${e.message}`;
        }
    }
}
