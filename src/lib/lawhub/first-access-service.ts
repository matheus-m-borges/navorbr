import {
  serverConsumeFirstAccess,
  serverCreateFirstAccessInvite,
  serverValidateFirstAccessToken,
} from "@/api/first-access";
import { LawHubService } from "./lawhub-service";

export interface FirstAccessToken {
  token: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  officeId: string;
  officeName: string;
  status: "pendente" | "utilizado" | "expirado";
  createdAt: string;
  expiresAt: string;
  usedAt?: string | null;
  createdBy?: string;
}

export const LawHubFirstAccessService = {
  async createFirstAccessInvite(params: {
    userId?: string;
    userEmail: string;
    userName?: string;
    userRole?: string;
    officeId?: string;
    officeName?: string;
    createdBy?: string;
  }): Promise<{ token: string; inviteUrl: string; expiresAt: string; tokenData: FirstAccessToken }> {
    const response = await serverCreateFirstAccessInvite({
      data: {
        userEmail: params.userEmail.trim().toLowerCase(),
        userName: params.userName,
        userRole: params.userRole,
        officeId: params.officeId,
        officeName: params.officeName,
      },
    });

    const origin = typeof window !== "undefined" ? window.location.origin : "https://lawhub.navor.com.br";
    const inviteUrl = `${origin}/primeiro-acesso?token=${encodeURIComponent(response.token)}`;
    const tokenData = response.tokenData as FirstAccessToken;

    // Keep only display state in the local office list. The bearer token itself remains server-issued.
    try {
      const users = LawHubService.getOfficeUsers();
      const index = users.findIndex(
        (user) => user.email?.trim().toLowerCase() === tokenData.userEmail,
      );
      const user = users[index];
      if (user) {
        users[index] = {
          ...user,
          first_access_token: undefined,
          first_access_expires_at: response.expiresAt,
          first_access_status: "pendente",
        };
        LawHubService.saveOfficeUsers(users);
      }
    } catch (error) {
      console.warn("Não foi possível atualizar o estado visual do convite:", error);
    }

    return { token: response.token, inviteUrl, expiresAt: response.expiresAt, tokenData };
  },

  async validateTokenAsync(token: string): Promise<{
    valid: boolean;
    error?: string;
    tokenData?: FirstAccessToken;
  }> {
    if (!token?.trim()) {
      return { valid: false, error: "Link de primeiro acesso inválido ou incompleto." };
    }
    try {
      const response = await serverValidateFirstAccessToken({ data: { token: token.trim() } });
      return response.valid && response.tokenData
        ? { valid: true, tokenData: response.tokenData as FirstAccessToken }
        : { valid: false, error: response.error || "Link de primeiro acesso inválido." };
    } catch (error) {
      console.error("Falha ao validar convite no servidor:", error);
      return {
        valid: false,
        error: "Não foi possível validar o convite com segurança. Tente novamente.",
      };
    }
  },

  async consumeFirstAccess(params: {
    token: string;
    newPassword: string;
  }): Promise<{ success: boolean; error?: string; userEmail?: string; userRole?: string }> {
    if (params.newPassword.length < 8) {
      return { success: false, error: "A senha individual deve possuir no mínimo 8 caracteres." };
    }

    try {
      const response = await serverConsumeFirstAccess({
        data: { token: params.token, password: params.newPassword },
      });
      if (!response.success) return response;

      if (response.userEmail) {
        try {
          const users = LawHubService.getOfficeUsers();
          const index = users.findIndex(
            (user) => user.email?.trim().toLowerCase() === response.userEmail?.trim().toLowerCase(),
          );
          const user = users[index];
          if (user) {
            users[index] = {
              ...user,
              status: "ativo",
              has_set_password: true,
              first_access_token: undefined,
              first_access_status: "utilizado",
              first_access_used_at: new Date().toISOString(),
            };
            LawHubService.saveOfficeUsers(users);
          }
        } catch (error) {
          console.warn("Não foi possível atualizar o estado visual do usuário:", error);
        }
      }
      return response;
    } catch (error) {
      console.error("Falha ao consumir convite no servidor:", error);
      return {
        success: false,
        error: "Não foi possível ativar a conta com segurança. Solicite um novo convite.",
      };
    }
  },

  getInviteMessage(
    tokenData: FirstAccessToken,
    inviteUrl: string,
    officeName?: string,
  ): string {
    const office = officeName || tokenData.officeName || "seu escritório";
    return `⚖️ *CONVITE DE PRIMEIRO ACESSO — NAVOR LAWHUB*

Olá, *${tokenData.userName}*! Seu acesso ao escritório *${office}* foi cadastrado.

Para ativar sua conta e cadastrar sua senha individual e exclusiva, acesse o link abaixo:
🔗 *Link de Primeiro Acesso:* ${inviteUrl}

📧 *E-mail de Acesso:* ${tokenData.userEmail}
⏳ *Validade:* 24 horas (link individual e de uso único)

Ao clicar no link, você definirá sua própria senha individual com total segurança e entrará diretamente no sistema.`;
  },
};
