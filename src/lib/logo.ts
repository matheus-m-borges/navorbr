// Logomarca da marca guardada como imagem reduzida (até 256px) para aparecer
// em pedidos, relatórios e listagens sem depender de arquivos externos.

const MAX_INPUT_BYTES = 4 * 1024 * 1024;

export async function readLogoImage(file: File, maxSide = 256): Promise<string> {
  const MAX_SIDE = maxSide;
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("Imagem maior que 4 MB.");

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Imagem inválida."));
    el.src = dataUrl;
  });

  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}
