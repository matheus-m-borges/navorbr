import React, { useRef, useState, useEffect } from "react";
import {
  PenTool,
  RotateCcw,
  CheckCircle2,
  Upload,
  FileText,
  X,
  Tablet,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ContractSignatureType } from "@/lib/lawhub/contract-types";
import { saveRubricCaptureArtifact } from "@/lib/lawhub/ged.functions";

interface DigitalSignaturePadProps {
  contractId?: string;
  processId?: string;
  signerName: string;
  signerRole?: "cliente" | "advogado";
  onConfirmSignature: (data: {
    signatureType: ContractSignatureType;
    signatureImage?: string;
    fileName?: string;
    signedByName: string;
    artifactId?: string;
    hashSha256?: string;
    identityVerified: false;
  }) => void;
  onCancel?: () => void;
}

export function DigitalSignaturePad({
  contractId,
  processId,
  signerName,
  signerRole = "cliente",
  onConfirmSignature,
  onCancel,
}: DigitalSignaturePadProps) {
  const [activeMode, setActiveMode] = useState<"touch" | "declaratorio" | "upload">("touch");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [customSignerName, setCustomSignerName] = useState(signerName);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Inicializa o Canvas para captura de rubrica
  useEffect(() => {
    if (activeMode !== "touch") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#1e293b"; // slate-800
  }, [activeMode]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0 };
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e) {
      e.preventDefault();
    }
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    if ("touches" in e) e.preventDefault();

    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      if (activeMode === "touch") {
        if (!hasDrawn) {
          toast.error("Por favor, faça a rubrica no espaço indicado antes de confirmar.");
          setIsSaving(false);
          return;
        }
        const canvas = canvasRef.current;
        const signatureImage = canvas?.toDataURL("image/png") || "";

        let artifactId: string | undefined;
        let hashSha256: string | undefined;

        try {
          const res = await saveRubricCaptureArtifact({
            data: {
              contractId,
              processId,
              signerName: customSignerName || signerName,
              signerRole,
              pngBase64: signatureImage,
            },
          });
          artifactId = res.artifactId;
          hashSha256 = res.hashSha256;
        } catch (err: any) {
          console.warn("[Rubric] Não foi possível persistir artefato remoto da rubrica:", err);
        }

        onConfirmSignature({
          signatureType: "tablet_touch",
          signatureImage,
          signedByName: customSignerName || signerName,
          artifactId,
          hashSha256,
          identityVerified: false,
        });
      } else if (activeMode === "declaratorio") {
        onConfirmSignature({
          signatureType: "digital",
          signedByName: customSignerName || signerName,
          identityVerified: false,
        });
      } else if (activeMode === "upload") {
        if (!uploadedFile) {
          toast.error("Selecione o arquivo da rubrica ou documento digitalizado.");
          setIsSaving(false);
          return;
        }
        onConfirmSignature({
          signatureType: "upload_digitalizado",
          fileName: uploadedFile.name,
          signedByName: customSignerName || signerName,
          identityVerified: false,
        });
      }
    } catch {
      toast.error("Erro ao registrar captura.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      {/* Seletor de Modo */}
      <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveMode("touch")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition",
            activeMode === "touch"
              ? "bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400 font-bold"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          )}
        >
          <Tablet className="size-3.5" />
          <span>Rubrica Presencial</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMode("declaratorio")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition",
            activeMode === "declaratorio"
              ? "bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400 font-bold"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          )}
        >
          <FileText className="size-3.5" />
          <span>Registro em Tela</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMode("upload")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition",
            activeMode === "upload"
              ? "bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400 font-bold"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          )}
        >
          <Upload className="size-3.5" />
          <span>Arquivo Digitalizado</span>
        </button>
      </div>

      {/* Aviso Legal de Enquadramento */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <p>
          <strong>Rubrica Presencial Capturada:</strong> Registro manuscrito coletado em tela para fins de formalização interna no escritório. Este procedimento não substitui certificado digital ICP-Brasil nem constitui assinatura eletrônica qualificada com provedor externo.
        </p>
      </div>

      {/* Nome do Signatário Informado */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Nome do Signatário (Informado pelo Operador — Não Verificado):
        </label>
        <input
          type="text"
          value={customSignerName}
          onChange={(e) => setCustomSignerName(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          placeholder="Nome completo do signatário"
        />
      </div>

      {/* MODO 1: CANVAS TOUCH */}
      {activeMode === "touch" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 text-[11px]">
              <PenTool className="size-3 text-blue-600" />
              Capture a rubrica manuscrita com o dedo, mouse ou caneta:
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition"
            >
              <RotateCcw className="size-3" /> Limpar tela
            </button>
          </div>

          <div className="relative touch-none rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-950/40">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="h-44 w-full cursor-crosshair rounded-lg bg-white dark:bg-slate-900"
            />
            <div className="pointer-events-none absolute bottom-4 left-6 right-6 border-b border-slate-300 dark:border-slate-700 text-center">
              <span className="text-[10px] text-slate-400 tracking-wider">
                X ___________________________________________________________ (Linha de Rubrica)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODO 2: DECLARATÓRIO */}
      {activeMode === "declaratorio" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-300 flex flex-col gap-2">
          <p className="font-semibold">
            Confirmação declaratória presencial registrada nos autos internos da contratação.
          </p>
          <div className="rounded-lg bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 space-y-1 text-[11px]">
            <p><strong>Signatário Informado:</strong> {customSignerName || signerName}</p>
            <p><strong>Data/Hora do Registro:</strong> {new Date().toLocaleString("pt-BR")}</p>
            <p className="text-slate-500 text-[10px]">
              Obs.: Integração com provedor de assinatura qualificada (Clicksign/DocuSign/ZapSign) disponível em bloco posterior.
            </p>
          </div>
        </div>
      )}

      {/* MODO 3: UPLOAD DIGITALIZADO */}
      {activeMode === "upload" && (
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
            Anexe o arquivo digitalizado da rubrica ou documento assinado (PDF ou imagem):
          </label>
          <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-blue-500 dark:border-slate-700 transition">
            <Upload className="size-8 text-slate-400 mb-2" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {uploadedFile ? uploadedFile.name : "Clique para selecionar ou arraste o arquivo aqui"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">PDF, PNG ou JPG até 25MB</p>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setUploadedFile(e.target.files[0]);
                  toast.success(`Arquivo anexado: ${e.target.files[0].name}`);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Botões de Ação */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          disabled={isSaving}
          onClick={handleConfirm}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 transition disabled:opacity-50"
        >
          <CheckCircle2 className="size-4" />
          <span>{isSaving ? "Salvando..." : "Salvar Rubrica Presencial"}</span>
        </button>
      </div>
    </div>
  );
}
