import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { DAMAGE_TYPES, VIEWS } from "./theme";
import type { CustomVehicle, Inspection } from "./storage";
import { getVehicle } from "./vehicles";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(insp: Inspection, custom: CustomVehicle[]): string {
  const vehicle = getVehicle(custom, insp.model);
  const modelLabel = vehicle?.label || insp.model || "—";

  const viewsHtml = VIEWS.map((v) => {
    const car = vehicle?.views?.[v.id];
    if (!car?.src) return "";
    const markersInView = insp.markers.filter((m) => m.view === v.id);
    const pinsHtml = markersInView
      .map((m) => {
        const globalIdx = insp.markers.indexOf(m) + 1;
        const color = DAMAGE_TYPES[m.type].color;
        return `<div style="position:absolute;left:${m.x * 100}%;top:${m.y * 100}%;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;background:${color};color:#fff;font:bold 12px sans-serif;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 0 0 2px #1c1c1e;">${globalIdx}</div>`;
      })
      .join("");
    return `
      <div class="view-block">
        <div class="view-title">${v.label.toUpperCase()}</div>
        <div style="position:relative;display:inline-block;width:100%;">
          <img src="${car.src}" style="width:100%;display:block;border:1px solid #ccc;" />
          ${pinsHtml}
        </div>
      </div>`;
  }).join("");

  const markerRows = insp.markers
    .map((m, i) => {
      const dt = DAMAGE_TYPES[m.type];
      const viewLabel = VIEWS.find((v) => v.id === m.view)?.label || "";
      const photoHtml = m.photo
        ? `<br/><img src="${m.photo}" style="max-width:160px;margin-top:6px;border:1px solid #ccc;border-radius:4px;" />`
        : "";
      return `
        <tr>
          <td style="text-align:center;font-weight:bold;background:${dt.color};color:#fff;width:30px;">${i + 1}</td>
          <td style="width:90px;">${viewLabel}</td>
          <td style="width:110px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dt.color};margin-right:6px;"></span>${dt.label}</td>
          <td>${escapeHtml(m.note || "—")}${photoHtml}</td>
        </tr>`;
    })
    .join("");

  const signatureHtml = (() => {
    if (!insp.signature || insp.signature.length === 0) {
      return `<div class="sig-block"><div class="sig-line"></div><div class="sig-label">Assinatura do Condutor</div></div>`;
    }
    const paths = insp.signature
      .map((p) => `<path d="${p.d}" stroke="#1c1c1e" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join("");
    return `
      <div class="sig-block">
        <svg viewBox="0 0 360 140" preserveAspectRatio="xMidYMid meet" style="width:100%;height:140px;">${paths}</svg>
        <div class="sig-line"></div>
        <div class="sig-label">Assinatura do Condutor — ${escapeHtml(insp.driver || "—")}</div>
      </div>`;
  })();

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Relatório de Vistoria</title>
<style>
  *{box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1c1e;padding:24px;font-size:12px;}
  h1{font-size:22px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;color:#1c1c1e;border-bottom:3px solid #ff6b35;padding-bottom:6px;}
  .sub{font-size:10px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;}
  .meta{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:18px;padding:12px;background:#f4f3ef;border-left:3px solid #ff6b35;}
  .meta div{font-size:11px;}
  .meta b{display:block;font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;}
  .view-block{margin:14px 0;page-break-inside:avoid;}
  .view-title{font-size:11px;font-weight:bold;letter-spacing:2px;color:#ff6b35;margin-bottom:6px;text-transform:uppercase;}
  table{width:100%;border-collapse:collapse;margin-top:12px;}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top;font-size:11px;}
  th{background:#1c1c1e;color:#fff;text-transform:uppercase;font-size:10px;letter-spacing:1px;}
  .legend{display:flex;flex-wrap:wrap;gap:14px;margin:8px 0 16px;font-size:10px;}
  .legend span{display:inline-flex;align-items:center;gap:5px;}
  .dot{display:inline-block;width:10px;height:10px;border-radius:50%;}
  .sig-block{margin-top:48px;page-break-inside:avoid;}
  .sig-line{border-top:1px solid #1c1c1e;width:100%;margin-top:4px;}
  .sig-label{font-size:10px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-top:4px;text-align:center;}
  .footer{margin-top:24px;font-size:9px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:8px;}
</style>
</head>
<body>
  <h1>Vistoria Diária do Veículo</h1>
  <div class="sub">Checklist visual de inspeção · Relatório gerado em ${new Date().toLocaleString("pt-BR")}</div>

  <div class="meta">
    <div><b>Data</b>${escapeHtml(insp.date || "—")}</div>
    <div><b>Placa</b>${escapeHtml(insp.plate || "—")}</div>
    <div><b>Condutor</b>${escapeHtml(insp.driver || "—")}</div>
    <div><b>Modelo</b>${escapeHtml(modelLabel)}</div>
    <div><b>Total de avarias</b>${insp.markers.length}</div>
  </div>

  <div class="legend">
    ${Object.entries(DAMAGE_TYPES)
      .map(([, v]) => `<span><span class="dot" style="background:${v.color}"></span>${v.label}</span>`)
      .join("")}
  </div>

  ${viewsHtml || '<p style="color:#999">Sem imagens cadastradas para este veículo.</p>'}

  <h2 style="font-size:14px;text-transform:uppercase;letter-spacing:1px;margin-top:24px;border-bottom:1px solid #ff6b35;padding-bottom:4px;">Pontos marcados</h2>
  ${
    insp.markers.length === 0
      ? '<p style="color:#666;font-style:italic;">Nenhum ponto marcado nesta vistoria.</p>'
      : `<table>
          <thead><tr><th>#</th><th>Vista</th><th>Tipo</th><th>Observação</th></tr></thead>
          <tbody>${markerRows}</tbody>
        </table>`
  }

  ${signatureHtml}

  <div class="footer">Vistoria Diária · Documento gerado automaticamente</div>
</body>
</html>`;
}

export async function exportInspectionPdf(insp: Inspection, custom: CustomVehicle[]): Promise<void> {
  const html = buildHtml(insp, custom);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Compartilhar relatório de vistoria",
      UTI: "com.adobe.pdf",
    });
  }
}
