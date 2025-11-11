// Token semplice
function generaTokenUnivoco() {
  const rand = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now().toString(36);
  return `${rand}-${timestamp}`;
}

// Mantiene l'eventuale /progetto/ nel path (GitHub Pages)
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

// === Esportazione archivio locale ===
function getArchivio() {
  return JSON.parse(localStorage.getItem("registroFirme") || "[]");
}

document.getElementById("exportCsv").addEventListener("click", () => {
  const archivio = getArchivio();
  if (!archivio.length) {
    document.getElementById("exportMessage").textContent = "Registro vuoto.";
    return;
  }
  const rows = [["nome","cognome","email","data","firmaDataURL"]];
  archivio.forEach(r => rows.push([r.nome, r.cognome, r.email, r.data, r.firma]));
  const csv = rows.map(r => r.map(cell => `"${(cell+'').replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `registro_firme.csv`;
  a.click();
  URL.revokeObjectURL(url);
  document.getElementById("exportMessage").textContent = "CSV scaricato.";
});

document.getElementById("exportPdf").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const archivio = getArchivio();
  if (!archivio.length) {
    document.getElementById("exportMessage").textContent = "Registro vuoto.";
    return;
  }
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const lineHeight = 18;
  let y = margin;
  for (let i = 0; i < archivio.length; i++) {
    const r = archivio[i];
    if (y > 750) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.text(`Nome: ${r.nome}`, margin, y);
    doc.text(`Cognome: ${r.cognome}`, margin + 250, y);
    y += lineHeight;
    doc.text(`Email: ${r.email}`, margin, y);
    doc.text(`Data: ${r.data}`, margin + 250, y);
    y += lineHeight;
    if (r.firma) {
      try {
        const imgProps = doc.getImageProperties(r.firma);
        const maxW = 220, maxH = 70;
        let w = imgProps.width, h = imgProps.height;
        const scale = Math.min(maxW / w, maxH / h, 1);
        w *= scale; h *= scale;
        doc.addImage(r.firma, 'PNG', margin, y, w, h);
      } catch (e) {
        console.warn("Errore aggiunta firma:", e);
      }
    }
    y += 90;
    doc.setDrawColor(200);
    doc.line(margin, y - 20, 555, y - 20);
  }
  doc.save("registro_firme.pdf");
  document.getElementById("exportMessage").textContent = "PDF generato e scaricato.";
});
