export interface ValidationResult {
    isValid: boolean;
    reason?: string;
}

export class SpecService {
    // Defines actions specifically restricted by the Constitution
    private static readonly RESTRICTED_PATTERNS = [
        /rm\s+-rf/i,
        /sudo\s+/i,
        /chmod\s+777/i,
        /\.env/i,
        /mkfs/i,
        /\/etc\//i
    ];

    /**
     * Validates a complete execution plan (array of tool calls).
     * Enforces the Spec Kit Constitution rules before any execution happens.
     */
    public static validatePlan(toolCalls: any[]): ValidationResult {
        if (!Array.isArray(toolCalls)) {
            console.log(`[Observability] spec.validation.fail: Plan is not an array`);
            return { isValid: false, reason: "Formato de plano inválido: Era esperado um array de tool calls." };
        }

        if (toolCalls.length === 0) {
            return { isValid: true };
        }

        for (const call of toolCalls) {
            // 1. Validate structure
            if (!call.name || typeof call.name !== 'string') {
                console.log(`[Observability] spec.validation.fail: Formato do call inválido`);
                return { isValid: false, reason: "Estrutura do plano inválida: Propriedade 'name' da ferramenta está faltando ou incorreta." };
            }

            // 2. Validate tool usage or unsafe actions inside arguments
            const stringifiedArgs = typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments || {});
            
            for (const pattern of this.RESTRICTED_PATTERNS) {
                if (pattern.test(stringifiedArgs)) {
                    console.log(`[Observability] spec.validation.fail: Restricted action detected: ${pattern.toString()} in ${call.name}`);
                    return { 
                        isValid: false, 
                        reason: `Ação restrita bloqueada pela constituição do sistema (Spec Governance): Detecção de padrão perigoso (${pattern.toString()}) na ferramenta ${call.name}.` 
                    };
                }
            }

            // More rule logic can be read natively from Constitution.md or dynamically expanded here
        }

        console.log(`[Observability] spec.validation.pass: Plano validado sem restrições constitutionais.`);
        return { isValid: true };
    }
}
