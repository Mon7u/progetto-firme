// ========== GENERAZIONE QR ==========

// Token semplice per tracciare la sessione QR
function generaTokenUnivoco() {
  const rand = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now().toString(36);
  return `${rand}-${timestamp}`;
}

// Mantiene l’eventuale /progetto/ nel path (GitHub Pages)
function getBasePath() {
  return window.location.pathname.replace(/index\.html$/, '');
}

function generaQrDaUrl(url) {
  const qrContainer = document.getElementById("qrContainer");
  qrContainer.innerHTML = "";
  const canvas = document.createElement("canvas");
  QRCode.toCanvas(canvas, url, { width: 220, margin: 2 }, (err) => {
    if (err) console.error(err);
  });
  qrContainer.appendChild(canvas);

  const linkDiv = document.getElementById("linkRegistrazione");
  linkDiv.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
  document.getElementById("istruzioni").style.display = "block";
}

// Genera QR usando l'host pubblico (GitHub Pages)
document.getElementById("generaQR").addEventListener("click", () => {
  const email = document.getElementById("emailInput").value.trim().toLowerCase();
  if (!email.endsWith("@ittsrimini.edu.it")) {
    alert("L'email deve terminare con @ittsrimini.edu.it");
    return;
  }
  const token = generaTokenUnivoco();
  const basePath = getBasePath();
  const url = `${window.location.origin}${basePath}registra.html?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  generaQrDaUrl(url);
});

// ========== EXPORT (usa Firestore se disponibile, altrimenti localStorage) ==========

async function getArchivio() {
  if (typeof window.fetchFirmeFromCloud === "function") {
    try { return await window.fetchFirmeFromCloud(); }
    catch (e) { console.warn("Cloud fetch fallita, uso localStorage:", e); }
  }
  // Fallback legacy
  return JSON.parse(localStorage.getItem("registroFirme") || "[]");
}

document.getElementById("exportCsv").addEventListener("click", async () => {
  const archivio = await getArchivio();
  if (!archivio.length) {
    document.getElementById("exportMessage").textContent = "Registro vuoto.";
    return;
  }
  const rows = [["nome","cognome","email","data","firmaDataURL"]];
  archivio.forEach(r => rows.push([r.nome, r.cognome, r.email, r.data, r.firmaDataURL || r.firma || ""]));

  const csv = rows.map(r => r.map(cell => `"${(cell ?? '').toString().replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `registro_firme.csv`; a.click();
  URL.revokeObjectURL(url);
  document.getElementById("exportMessage").textContent = "CSV scaricato.";
});

document.getElementById("exportPdf").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const archivio = await getArchivio();
  if (!archivio.length) {
    document.getElementById("exportMessage").textContent = "Registro vuoto.";
    return;
  }
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40, lineHeight = 18; let y = margin;

  for (const r of archivio) {
    if (y > 750) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.text(`Nome: ${r.nome || ""}`, margin, y);
    doc.text(`Cognome: ${r.cognome || ""}`, margin + 250, y);
    y += lineHeight;
    doc.text(`Email: ${r.email || ""}`, margin, y);
    doc.text(`Data: ${r.data || ""}`, margin + 250, y);
    y += lineHeight;

    const dataUrl = r.firmaDataURL || r.firma || "";
    if (dataUrl) {
      try {
        // Inserisce l'immagine (ridimensionata "a scatola")
        doc.addImage(dataUrl, 'PNG', margin, y, 220, 70);
      } catch (e) {
        console.warn("Firma non inserita:", e);
      }
    }
    y += 90;
    doc.setDrawColor(200);
    doc.line(margin, y - 20, 555, y - 20);
  }
  doc.save("registro_firme.pdf");
  document.getElementById("exportMessage").textContent = "PDF generato e scaricato.";
});
