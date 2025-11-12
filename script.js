// ================== CONFIG BACKEND (Apps Script) ==================
const WEB_APP_URL = 'https://script.google.com/a/macros/studenti.ittsrimini.edu.it/s/AKfycbyPVgH-gPEUqZ-m0qyuZEVSFnIn8rqvRStVd874s1l1KUAEAfQVYe72KdHdLunZPcSxGQ/exec';

// ================== UTILI COMUNI ==================
function getBasePath() {
  // Mantiene l’eventuale sottocartella (es. GitHub Pages /repo/)
  return window.location.pathname.replace(/index\.html$/, '');
}

// ================== GENERAZIONE QR (index.html) ==================
(function setupQR(){
  const btn = document.getElementById("generaQR");
  if (!btn) return; // non siamo in index.html

  function generaTokenUnivoco() {
    const rand = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now().toString(36);
    return `${rand}-${timestamp}`;
  }
  function generaQrDaUrl(url) {
    const qrContainer = document.getElementById("qrContainer");
    qrContainer.innerHTML = "";
    const canvas = document.createElement("canvas");
    QRCode.toCanvas(canvas, url, { width: 220, margin: 2 }, (err) => { if (err) console.error(err); });
    qrContainer.appendChild(canvas);

    const linkDiv = document.getElementById("linkRegistrazione");
    linkDiv.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
    document.getElementById("istruzioni").style.display = "block";
  }

  btn.addEventListener("click", () => {
    const email = document.getElementById("emailInput").value.trim().toLowerCase();
    if (!email.includes('@')) {
      alert("Inserisci una email valida.");
      return;
    }
    const token = generaTokenUnivoco();
    const basePath = getBasePath();
    const url = `${window.location.origin}${basePath}registra.html?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
    generaQrDaUrl(url);
  });
})();

// ================== SALVATAGGIO FIRMA (registra.html) ==================
(function setupSave(){
  const form = document.getElementById("firmaForm");
  if (!form) return; // non siamo in registra.html

  const emailInput = document.getElementById("email");
  const nomeInput = document.getElementById("nome");
  const cognomeInput = document.getElementById("cognome");
  const canvas = document.getElementById("firmaCanvas");
  const messageDiv = document.getElementById("message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = (nomeInput.value || "").trim();
    const cognome = (cognomeInput.value || "").trim();
    const email = (emailInput.value || "").trim().toLowerCase();
    if (!nome || !cognome || !email) {
      messageDiv.textContent = "Compila tutti i campi."; messageDiv.style.color = "red";
      return;
    }

    messageDiv.textContent = "⏳ Salvataggio...";
    messageDiv.style.color = "#333";

    const firmaDataURL = canvas.toDataURL("image/png");
    const dataStr = new Date().toLocaleString("it-IT");

    // 1) Prova salvataggio remoto (Apps Script) — niente header per evitare preflight
    let remotoOk = false;
    try {
      const res = await fetch(WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({ nome, cognome, email, firmaDataURL })
      });
      const out = await res.json().catch(()=>({}));
      remotoOk = out && out.ok === true;
    } catch (e) {
      console.warn("Salvataggio remoto fallito:", e);
    }

    // 2) Salva SEMPRE anche in locale (backup + export offline)
    salvaInLocalStorage({ nome, cognome, email, data: dataStr, firmaDataURL });

    messageDiv.textContent = remotoOk
      ? "✅ Registrazione completata! (Foglio Google + locale)"
      : "✅ Registrazione salvata in locale. (Backend non raggiungibile)";

    messageDiv.style.color = "green";
    form.reset();
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  function salvaInLocalStorage(record) {
    const key = "registroFirme";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(record);
    localStorage.setItem(key, JSON.stringify(arr));
  }
})();

// ================== EXPORT (index.html) ==================
(async function setupExport(){
  const csvBtn = document.getElementById("exportCsv");
  const pdfBtn = document.getElementById("exportPdf");
  if (!csvBtn && !pdfBtn) return; // non siamo in index.html

  async function fetchFromBackend() {
    try {
      const res = await fetch(`${WEB_APP_URL}?action=list`, { method: 'GET' });
      const out = await res.json();
      if (out && out.ok && Array.isArray(out.rows)) {
        // Normalizza ai campi usati nel sito
        return out.rows.map(r => ({
          nome: r.nome || '',
          cognome: r.cognome || '',
          email: r.email || '',
          data: r.timestamp || '',
          firmaDataURL: r.firmaDataURL || ''
        }));
      }
    } catch (e) {
      console.warn("Lettura backend fallita:", e);
    }
    return null;
  }

  async function getArchivio() {
    const cloud = await fetchFromBackend();
    if (cloud && cloud.length) return cloud;
    // fallback locale
    return JSON.parse(localStorage.getItem("registroFirme") || "[]");
  }

  csvBtn?.addEventListener("click", async () => {
    const archivio = await getArchivio();
    const msg = document.getElementById("exportMessage");
    if (!archivio.length) { msg.textContent = "Registro vuoto."; return; }

    const rows = [["nome","cognome","email","data","firmaDataURL"]];
    archivio.forEach(r => rows.push([r.nome, r.cognome, r.email, r.data, r.firmaDataURL || ""]));

    const csv = rows.map(r => r.map(cell => `"${(cell ?? '').toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `registro_firme.csv`; a.click();
    URL.revokeObjectURL(url);
    msg.textContent = "CSV scaricato.";
  });

  pdfBtn?.addEventListener("click", async () => {
    const { jsPDF } = window.jspdf;
    const archivio = await getArchivio();
    const msg = document.getElementById("exportMessage");
    if (!archivio.length) { msg.textContent = "Registro vuoto."; return; }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40, lh = 18; let y = margin;

    for (const r of archivio) {
      if (y > 750) { doc.addPage(); y = margin; }
      doc.setFontSize(12);
      doc.text(`Nome: ${r.nome}`, margin, y);
      doc.text(`Cognome: ${r.cognome}`, margin + 250, y);
      y += lh;
      doc.text(`Email: ${r.email}`, margin, y);
      doc.text(`Data: ${r.data}`, margin + 250, y);
      y += lh;

      const dataUrl = r.firmaDataURL || "";
      if (dataUrl) {
        try { doc.addImage(dataUrl, 'PNG', margin, y, 220, 70); }
        catch (e) { console.warn("Firma non inserita:", e); }
      }
      y += 90;
      doc.setDrawColor(200);
      doc.line(margin, y - 20, 555, y - 20);
    }
    doc.save("registro_firme.pdf");
    msg.textContent = "PDF generato e scaricato.";
  });
})();
