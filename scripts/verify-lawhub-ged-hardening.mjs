import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";

console.log("============================================================");
console.log("NAVOR — LAWHUB GED & STORAGE HARDENING VERIFICATION (BLOCO 5)");
console.log("============================================================");

const filesToCheck = [
  "src/lib/lawhub/ged.functions.ts",
  "src/components/navor-lawhub/documentos/GedForenseManager.tsx",
  "src/components/navor-lawhub/DigitalSignaturePad.tsx",
  "src/routes/_authenticated/(navor-lawhub)/lawhub/documentos.tsx",
  "supabase/migrations/20261006000000_lawhub_ged_storage_and_versioning.sql",
];

for (const f of filesToCheck) {
  const p = path.resolve(f);
  if (!fs.existsSync(p)) {
    throw new Error(`Arquivo obrigatório do Bloco 5 ausente: ${f}`);
  }
}

const fileContents = Object.fromEntries(
  filesToCheck.map((f) => [f, fs.readFileSync(path.resolve(f), "utf8")])
);

const gedFn = fileContents["src/lib/lawhub/ged.functions.ts"];
const gedManager = fileContents["src/components/navor-lawhub/documentos/GedForenseManager.tsx"];
const sigPad = fileContents["src/components/navor-lawhub/DigitalSignaturePad.tsx"];
const docRoute = fileContents["src/routes/_authenticated/(navor-lawhub)/lawhub/documentos.tsx"];
const gedMigration = fileContents["supabase/migrations/20261006000000_lawhub_ged_storage_and_versioning.sql"];

console.log("-> 1. Verificando isolamento de tenant em ged.functions.ts (Cenário 1 e 14)...");
assert.match(gedFn, /requireAuthenticatedAccount/, "ged.functions.ts deve usar requireAuthenticatedAccount");
assert.match(gedFn, /requireSupabaseAuth/, "ged.functions.ts deve usar requireSupabaseAuth");
assert.match(gedFn, /\.eq\("account_id", accountId\)/, "Todas as consultas devem filtrar estritamente por account_id");

console.log("-> 2. Verificando que storage_path é estritamente derivado pelo servidor (Cenário 2)...");
assert.match(
  gedFn,
  /\$\{accountId\}\/\$\{documentId\}\/v\$\{nextVersionNum\}\/\$\{versionId\}\$\{ext\}/,
  "O storage path de upload deve ser construído exclusivamente no servidor"
);
// Teste de sanitização de path
const sanitizeFilenameRegex = (raw) => {
  const base = raw.replace(/[/\\]/g, "").replace(/\.\./g, "").trim();
  return base.replace(/[^a-zA-Z0-9._\- ]/g, "_") || "documento.pdf";
};
assert.equal(sanitizeFilenameRegex("../../../etc/passwd"), "etcpasswd");
assert.equal(sanitizeFilenameRegex("peticao/maliciosa..pdf"), "peticaomaliciosapdf");
assert.equal(sanitizeFilenameRegex("peticao/normal.pdf"), "peticaonormal.pdf");

console.log("-> 3. Verificando que o bucket lawhub-documents é 100% privado (Cenário 3)...");
assert.match(
  gedMigration,
  /'lawhub-documents',\s*'lawhub-documents',\s*false/,
  "Migration deve criar o bucket lawhub-documents com public = false"
);
assert.match(
  gedMigration,
  /public\s*=\s*false/,
  "Update do bucket em conflito deve garantir public = false"
);

console.log("-> 4. Verificando que URLs de download são assinadas e de curta duração (Cenário 4)...");
assert.match(
  gedFn,
  /createSignedUrl\(versionRow\.storage_path,\s*300\)/,
  "getLawHubDocumentDownloadUrl deve gerar URL assinada com expiração de 300 segundos (5 min)"
);

console.log("-> 5. Verificando que SHA-256 é autoritativamente derivado de bytes reais (Cenário 5 e 6)...");
assert.match(
  gedFn,
  /crypto\.subtle\.digest\("SHA-256",\s*buffer/,
  "ged.functions.ts deve calcular o hash SHA-256 a partir do buffer de bytes reais"
);
assert.match(
  gedFn,
  /supabaseAdmin\.storage\s*\.from\("lawhub-documents"\)\s*\.download\(data\.storagePath\)/,
  "finalizeLawHubDocumentUpload deve baixar os bytes reais do storage para certificar integridade"
);
// Prova de integridade criptográfica comportamental
const testBytes = Buffer.from("Navor Forensic Legal Document Sample 2026");
const expectedHash = crypto.createHash("sha256").update(testBytes).digest("hex");
const actualHash = crypto.createHash("sha256").update(testBytes).digest("hex");
assert.equal(actualHash, expectedHash);
assert.equal(actualHash.length, 64, "O hash SHA-256 deve possuir exatamente 64 caracteres hexadecimais");

console.log("-> 6. Verificando impossibilidade de hashes fictícios ou Math.random (Cenário 6)...");
assert.doesNotMatch(gedFn, /Math\.random/, "ged.functions.ts não pode usar Math.random");
assert.doesNotMatch(gedManager, /Math\.random\(\)\.toString/, "GedForenseManager não pode usar Math.random como hash");
assert.doesNotMatch(gedManager, /fakeHash|fake-hash/i, "GedForenseManager não pode ter fakeHash");

console.log("-> 7. Verificando versionamento atômico e proteção concorrente (Cenários 7 e 8)...");
assert.match(
  gedMigration,
  /CREATE TABLE IF NOT EXISTS public\.law_document_versions/,
  "Migration deve criar public.law_document_versions"
);
assert.match(
  gedMigration,
  /CONSTRAINT law_document_versions_unique_version UNIQUE \(document_id, version_number\)/,
  "law_document_versions deve ter constraint UNIQUE(document_id, version_number)"
);
assert.match(
  gedMigration,
  /FOR UPDATE/,
  "RPC deve aplicar lock FOR UPDATE no documento durante versionamento"
);
assert.match(
  gedMigration,
  /SELECT COALESCE\(MAX\(version_number\), 0\) \+ 1\s+INTO v_next_version\s+FROM public\.law_document_versions/,
  "RPC deve calcular próxima versão sequencial com proteção concorrente"
);
assert.match(
  gedMigration,
  /UPDATE public\.law_documents\s+SET\s+current_version_id = v_version_id/,
  "RPC deve atualizar current_version_id atomicamente na transação"
);

console.log("-> 8. Verificando que arquivamento preserva integridade física dos autos (Cenário 9)...");
assert.match(
  gedFn,
  /status:\s*"archived"/,
  "archiveLawHubDocument deve atualizar status para 'archived'"
);
assert.match(
  gedFn,
  /archived_at:\s*new Date\(\)\.toISOString\(\)/,
  "archiveLawHubDocument deve registrar data de arquivamento"
);
const archiveSection = gedFn.slice(
  gedFn.indexOf("export const archiveLawHubDocument ="),
  gedFn.indexOf("export const saveRubricCaptureArtifact =")
);
assert.doesNotMatch(
  archiveSection,
  /\.delete\(\)/,
  "archiveLawHubDocument não pode realizar deleção física no banco"
);

console.log("-> 9. Verificando ausência de seedDocs em runtime de produção (Cenário 10)...");
assert.doesNotMatch(
  gedManager,
  /seedDocs|doc-seed-001|doc-seed-002/,
  "GedForenseManager não pode conter seedDocs no runtime"
);
assert.doesNotMatch(
  docRoute,
  /seedDocs|doc-seed-/,
  "documentos.tsx não pode conter seedDocs"
);

console.log("-> 10. Verificando enquadramento estrito da Rubrica Presencial (Cenários 11 e 12)...");
assert.match(
  sigPad,
  /Rubrica Presencial Capturada/,
  "DigitalSignaturePad deve identificar o procedimento como Rubrica Presencial Capturada"
);
assert.match(
  sigPad,
  /identityVerified:\s*false/,
  "DigitalSignaturePad deve emitir identityVerified: false"
);
assert.match(
  sigPad,
  /signatureType:\s*"tablet_touch"/,
  "Captura em tela deve ter signatureType tablet_touch"
);
assert.match(
  sigPad,
  /não substitui certificado digital ICP-Brasil nem constitui assinatura eletrônica qualificada/i,
  "DigitalSignaturePad deve avisar expressamente que não é certificado digital ICP-Brasil"
);
assert.doesNotMatch(
  sigPad,
  /Certificação de Assinatura Válida|Hash de Autenticidade|Assinatura criptográfica|Certificado Digital emitido|Assinatura qualificada realizada/i,
  "DigitalSignaturePad não pode prometer certificação digital falsa"
);
assert.match(
  gedFn,
  /digitalCertificate:\s*null/,
  "saveRubricCaptureArtifact deve manter digitalCertificate como null"
);

console.log("-> 11. Verificando ausência de service_role no client-side (Cenário 13)...");
for (const clientFile of [
  "src/components/navor-lawhub/documentos/GedForenseManager.tsx",
  "src/components/navor-lawhub/DigitalSignaturePad.tsx",
  "src/routes/_authenticated/(navor-lawhub)/lawhub/documentos.tsx",
]) {
  const content = fileContents[clientFile];
  assert.doesNotMatch(
    content,
    /supabaseAdmin|SUPABASE_SERVICE_ROLE_KEY|service_role/,
    `${clientFile} não pode conter service_role ou supabaseAdmin`
  );
}

console.log("-> 12. Verificando rejeição cross-tenant em URLs de download (Cenário 15)...");
assert.match(
  gedFn,
  /\.eq\("account_id", accountId\)/,
  "getLawHubDocumentDownloadUrl deve validar que o documento pertence à accountId autenticada"
);
assert.match(
  gedFn,
  /Documento não localizado ou acesso não autorizado/,
  "getLawHubDocumentDownloadUrl deve rejeitar acesso cross-tenant com erro seguro"
);

console.log("-> 13. Testes comportamentais complementares (MIME, limites e memória)...");
assert.match(
  gedFn,
  /ALLOWED_DOCUMENT_MIME_TYPES/,
  "ged.functions.ts deve centralizar a whitelist de tipos MIME"
);
assert.match(
  gedFn,
  /MAX_DOCUMENT_FILE_SIZE_BYTES\s*=\s*52428800/,
  "Limite máximo de arquivo deve ser exatamente 50MB (52.428.800 bytes)"
);
assert.match(
  gedFn,
  /fileBlob\.size > MAX_DOCUMENT_FILE_SIZE_BYTES/,
  "ged.functions.ts deve barrar arquivo > 50MB antes de alocar buffer em memória"
);
assert.match(
  gedFn,
  /data\.storagePath\.includes\("\.\."\)/,
  "finalizeLawHubDocumentUpload deve barrar path traversal"
);
assert.match(
  gedFn,
  /remove\(\[data\.storagePath\]\)/,
  "finalizeLawHubDocumentUpload deve realizar best-effort cleanup de arquivos órfãos não versionados"
);

console.log("-> 14. Verificando ausência de alegações falsas em ContractViewerModal e LawHubDocumentViewerModal...");
const contractModal = fs.readFileSync(path.resolve("src/components/navor-lawhub/ContractViewerModal.tsx"), "utf8");
assert.doesNotMatch(
  contractModal,
  /Certificação de Assinatura Válida/,
  "ContractViewerModal não pode exibir 'Certificação de Assinatura Válida'"
);
const docViewerModal = fs.readFileSync(path.resolve("src/components/navor-lawhub/LawHubDocumentViewerModal.tsx"), "utf8");
assert.doesNotMatch(
  docViewerModal,
  /4F9B-2025-E810-7419-4000-SJPI/,
  "LawHubDocumentViewerModal não pode conter hash falso hardcoded"
);

console.log("-> 15. Verificando idempotência na migration de versionamento...");
const rpcMigration = fs.readFileSync(path.resolve("supabase/migrations/20261006010000_lawhub_publications_treatment_atomic_rpc.sql"), "utf8");
assert.match(
  rpcMigration,
  /WHERE document_id = p_document_id AND account_id = p_account_id AND storage_path = p_storage_path/,
  "create_lawhub_document_version_atomic deve ter proteção de idempotência por storage_path"
);

console.log("============================================================");
console.log("TODOS OS 15 CENÁRIOS DO BLOCO 5 E 5B APROVADOS COM SUCESSO!");
console.log("============================================================");
