import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAuthenticatedAccount } from "@/core/security/authorization.server";

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 52428800; // 50MB

export function sanitizeFilename(raw: string): string {
  const base = raw.replace(/[/\\]/g, "").replace(/\.\./g, "").trim();
  return base.replace(/[^a-zA-Z0-9._\- ]/g, "_") || "documento.pdf";
}

export function computeSha256Hex(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  return crypto.subtle.digest("SHA-256", buffer as unknown as BufferSource).then((hashBuffer) => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  });
}

export interface StoredDocumentItem {
  id: string;
  account_id: string;
  title: string;
  name: string;
  category: string;
  status: string;
  process_id?: string | null;
  client_id?: string | null;
  contract_id?: string | null;
  current_version_id?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  version_number?: number;
  original_filename?: string;
  mime_type?: string;
  file_size?: number;
  hash_sha256?: string;
}

/**
 * 1. Solicita URL assinada de upload seguro para o bucket privado lawhub-documents.
 * O path do objeto é determinado exclusivamente pelo servidor.
 */
export const requestLawHubDocumentUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    documentId?: string; // Se omitido, cria novo documento lógico
    title: string;
    category?: string;
    processId?: string;
    clientId?: string;
    contractId?: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    changeReason?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const auth = await requireAuthenticatedAccount(context.userId, data.accountId);
    const accountId = auth.accountId;

    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(data.mimeType)) {
      throw new Error(`Tipo de arquivo não permitido: ${data.mimeType}. Use PDF, DOCX ou Imagem.`);
    }

    if (data.fileSize <= 0 || data.fileSize > MAX_DOCUMENT_FILE_SIZE_BYTES) {
      throw new Error(`Tamanho de arquivo inválido. Limite máximo: 50MB.`);
    }

    const cleanFilename = sanitizeFilename(data.filename);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let documentId = data.documentId;

    if (!documentId) {
      // Cria novo documento lógico no banco
      const { data: newDoc, error: createDocErr } = await (supabaseAdmin as any)
        .from("law_documents")
        .insert({
          account_id: accountId,
          name: cleanFilename,
          title: data.title || cleanFilename,
          category: data.category || "geral",
          process_id: data.processId || null,
          client_id: data.clientId || null,
          contract_id: data.contractId || null,
          status: "active",
          created_by: context.userId,
        })
        .select("id")
        .single();

      if (createDocErr || !newDoc) {
        throw new Error(`Falha ao registrar documento: ${createDocErr?.message || "erro ao inserir"}`);
      }
      documentId = newDoc.id;
    } else {
      // Valida que o documento pertence à conta
      const { data: existingDoc, error: findDocErr } = await (supabaseAdmin as any)
        .from("law_documents")
        .select("id, status")
        .eq("id", documentId)
        .eq("account_id", accountId)
        .single();

      if (findDocErr || !existingDoc) {
        throw new Error("Documento não encontrado ou sem autorização na conta ativa.");
      }
      if (existingDoc.status === "archived") {
        throw new Error("Não é possível adicionar versão a um documento arquivado.");
      }
    }

    // Calcula próxima versão proposta
    const { data: versions } = await (supabaseAdmin as any)
      .from("law_document_versions")
      .select("version_number")
      .eq("document_id", documentId)
      .order("version_number", { ascending: false })
      .limit(1);

    const nextVersionNum = (versions?.[0]?.version_number || 0) + 1;
    const versionId = crypto.randomUUID();
    const ext = cleanFilename.includes(".") ? cleanFilename.slice(cleanFilename.lastIndexOf(".")) : "";
    const storagePath = `${accountId}/${documentId}/v${nextVersionNum}/${versionId}${ext}`;

    const { data: signedData, error: signErr } = await supabaseAdmin.storage
      .from("lawhub-documents")
      .createSignedUploadUrl(storagePath);

    if (signErr || !signedData) {
      throw new Error(`Falha ao gerar URL assinada de upload: ${signErr?.message || "erro de storage"}`);
    }

    return {
      documentId: documentId as string,
      versionId,
      versionNumber: nextVersionNum,
      storageBucket: "lawhub-documents",
      storagePath,
      uploadUrl: signedData.signedUrl,
      token: signedData.token,
    };
  });

/**
 * 2. Finaliza o upload no servidor: verifica bytes reais armazenados,
 * calcula o hash SHA-256 autoritativo e grava a versão atomicamente via RPC.
 */
export const finalizeLawHubDocumentUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    documentId: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    changeReason?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const auth = await requireAuthenticatedAccount(context.userId, data.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Valida que o MIME é estritamente permitido no servidor
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(data.mimeType)) {
      throw new Error(`Tipo de arquivo não permitido: ${data.mimeType}.`);
    }

    // Valida que o path pertence ao tenant e ao documento do usuário (sem path traversal)
    if (
      data.storagePath.includes("..") ||
      !data.storagePath.startsWith(`${accountId}/${data.documentId}/`)
    ) {
      throw new Error("Caminho de armazenamento inválido ou incompatível com o documento.");
    }

    try {
      // Baixa os bytes reais armazenados para verificação autoritativa
      const { data: fileBlob, error: downloadErr } = await supabaseAdmin.storage
        .from("lawhub-documents")
        .download(data.storagePath);

      if (downloadErr || !fileBlob) {
        throw new Error(`Objeto não encontrado no storage privado para validação: ${downloadErr?.message || "vazio"}`);
      }

      // Validação de limites de memória ANTES de carregar buffer completo
      if (fileBlob.size <= 0) {
        throw new Error("O arquivo enviado possui 0 bytes.");
      }
      if (fileBlob.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
        throw new Error("O arquivo armazenado excede o limite máximo permitido de 50MB.");
      }

      const arrayBuffer = await fileBlob.arrayBuffer();
      const fileSize = arrayBuffer.byteLength;

      // Cálculo autoritativo do SHA-256 no servidor a partir dos bytes reais
      const hashSha256 = await computeSha256Hex(arrayBuffer);

      // Persistência atômica via RPC transacional
      const { data: rpcResult, error: rpcErr } = await (supabaseAdmin as any).rpc(
        "create_lawhub_document_version_atomic",
        {
          p_actor_user_id: context.userId,
          p_account_id: accountId,
          p_document_id: data.documentId,
          p_storage_path: data.storagePath,
          p_original_filename: sanitizeFilename(data.originalFilename),
          p_mime_type: data.mimeType,
          p_file_size: fileSize,
          p_hash_sha256: hashSha256,
          p_change_reason: data.changeReason || "Versão inicial",
          p_metadata: {
            verified_at: new Date().toISOString(),
            verification_status: "verified",
          },
        }
      );

      if (rpcErr) {
        throw new Error(`Falha ao registrar versão do documento: ${rpcErr.message}`);
      }

      return {
        success: true,
        documentId: data.documentId,
        versionId: rpcResult.version_id,
        versionNumber: rpcResult.version_number,
        fileSize,
        hashSha256,
        status: "verified",
        idempotent: Boolean(rpcResult.idempotent),
      };
    } catch (err) {
      // Tratamento de objeto órfão: best-effort cleanup do arquivo recém-enviado não versionado
      try {
        await supabaseAdmin.storage.from("lawhub-documents").remove([data.storagePath]);
      } catch {}
      throw err;
    }
  });

/**
 * 3. Gera URL assinada de download de curta duração (5 minutos = 300 segundos).
 * Valida autorização do usuário e isolamento de tenant.
 */
export const getLawHubDocumentDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    documentId: string;
    versionNumber?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    const auth = await requireAuthenticatedAccount(context.userId, data.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Valida que o documento pertence à conta
    const { data: doc, error: docErr } = await (supabaseAdmin as any)
      .from("law_documents")
      .select("id, name, current_version_id")
      .eq("id", data.documentId)
      .eq("account_id", accountId)
      .single();

    if (docErr || !doc) {
      throw new Error("Documento não localizado ou acesso não autorizado.");
    }

    // Busca a versão solicitada ou a versão corrente
    let versionQuery = (supabaseAdmin as any)
      .from("law_document_versions")
      .select("storage_path, original_filename, mime_type, hash_sha256, version_number")
      .eq("document_id", data.documentId)
      .eq("account_id", accountId);

    if (data.versionNumber) {
      versionQuery = versionQuery.eq("version_number", data.versionNumber);
    } else if (doc.current_version_id) {
      versionQuery = versionQuery.eq("id", doc.current_version_id);
    } else {
      versionQuery = versionQuery.order("version_number", { ascending: false }).limit(1);
    }

    const { data: versionRow, error: verErr } = await versionQuery.maybeSingle();

    if (verErr || !versionRow) {
      throw new Error("Versão física do documento não encontrada.");
    }

    // Gera URL assinada de curta duração (5 minutos)
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("lawhub-documents")
      .createSignedUrl(versionRow.storage_path, 300);

    if (signErr || !signed) {
      throw new Error(`Falha ao gerar URL de download: ${signErr?.message || "erro de storage"}`);
    }

    return {
      signedUrl: signed.signedUrl,
      filename: versionRow.original_filename,
      mimeType: versionRow.mime_type,
      hashSha256: versionRow.hash_sha256,
      versionNumber: versionRow.version_number,
      expiresInSeconds: 300,
    };
  });

/**
 * 4. Lista documentos jurídicos da conta ativa com metadados da versão corrente.
 */
export const listLawHubDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    category?: string;
    status?: "active" | "archived" | "all";
    processId?: string;
    clientId?: string;
    contractId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) => input)
  .handler(async ({ data, context }): Promise<{ rows: StoredDocumentItem[]; totalCount: number }> => {
    const auth = await requireAuthenticatedAccount(context.userId, data?.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = (supabaseAdmin as any)
      .from("law_documents")
      .select("*, law_document_versions!law_documents_current_version_fkey(version_number, original_filename, mime_type, file_size, hash_sha256)", { count: "exact" })
      .eq("account_id", accountId);

    if (data?.status && data.status !== "all") {
      query = query.eq("status", data.status);
    } else if (!data?.status) {
      query = query.eq("status", "active");
    }

    if (data?.category && data.category !== "todas") {
      query = query.eq("category", data.category);
    }

    if (data?.processId) {
      query = query.eq("process_id", data.processId);
    }

    if (data?.clientId) {
      query = query.eq("client_id", data.clientId);
    }

    if (data?.contractId) {
      query = query.eq("contract_id", data.contractId);
    }

    if (data?.search && data.search.trim()) {
      const q = `%${data.search.trim()}%`;
      query = query.or(`title.ilike.${q},name.ilike.${q}`);
    }

    const limit = Math.min(Math.max(Number(data?.limit) || 50, 1), 100);
    const offset = Math.max(Number(data?.offset) || 0, 0);

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: rows, count, error } = await query;
    if (error) {
      throw new Error(`Falha ao listar documentos: ${error.message}`);
    }

    const mapped: StoredDocumentItem[] = (rows || []).map((r: any) => {
      const ver = r.law_document_versions || {};
      return {
        id: r.id,
        account_id: r.account_id,
        title: r.title || r.name,
        name: r.name,
        category: r.category,
        status: r.status,
        process_id: r.process_id,
        client_id: r.client_id,
        contract_id: r.contract_id,
        current_version_id: r.current_version_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
        archived_at: r.archived_at,
        version_number: ver.version_number || 1,
        original_filename: ver.original_filename || r.name,
        mime_type: ver.mime_type || "application/pdf",
        file_size: ver.file_size || 0,
        hash_sha256: ver.hash_sha256 || null,
      };
    });

    return {
      rows: mapped,
      totalCount: count || 0,
    };
  });

/**
 * 5. Arquiva um documento judicial (soft delete).
 * Preserva o histórico físico e impede remoção destrutiva.
 */
export const archiveLawHubDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    documentId: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const auth = await requireAuthenticatedAccount(context.userId, data.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: updated, error } = await (supabaseAdmin as any)
      .from("law_documents")
      .update({
        status: "archived",
        archived_at: new Date().toISOString(),
        archived_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.documentId)
      .eq("account_id", accountId)
      .select("id");

    if (error) {
      throw new Error(`Falha ao arquivar documento: ${error.message}`);
    }
    if (!updated || updated.length === 0) {
      throw new Error("Documento não encontrado para arquivamento.");
    }

    return { success: true, id: data.documentId };
  });

/**
 * 6. BLOCO 5B: Persistência de Rubrica Presencial Capturada em dispositivo (Canvas).
 * Classifica explicitamente como artefato manuscrito, sem certificação digital e sem
 * alterar contrato para formalmente assinado.
 */
export const saveRubricCaptureArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    contractId?: string;
    processId?: string;
    signerName: string;
    signerRole?: "cliente" | "advogado";
    pngBase64: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const auth = await requireAuthenticatedAccount(context.userId, data.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.pngBase64) {
      throw new Error("Imagem da rubrica em Base64 não informada.");
    }

    // Converte base64 para buffer de bytes reais
    const cleanBase64 = data.pngBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    if (buffer.length === 0) {
      throw new Error("Imagem da rubrica corrompida ou vazia.");
    }

    const hashSha256 = await computeSha256Hex(buffer);
    const artifactId = crypto.randomUUID();
    const timestamp = Date.now();
    const storagePath = `${accountId}/rubrics/${data.contractId || "standalone"}/${timestamp}_${artifactId}.png`;

    // Salva o artefato de imagem no storage privado
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("lawhub-documents")
      .upload(storagePath, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadErr) {
      throw new Error(`Falha ao armazenar artefato da rubrica: ${uploadErr.message}`);
    }

    return {
      success: true,
      artifactId,
      storagePath,
      hashSha256,
      capturedAt: new Date().toISOString(),
      artifactType: "rubric_capture",
      signerNameProvided: data.signerName,
      signerRole: data.signerRole || "cliente",
      identityVerified: false, // Explicitamente não verificado
      digitalCertificate: null, // Sem certificado digital
    };
  });
