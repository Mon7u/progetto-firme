// ================== CONFIG BACKEND ==================
const API_BASE_URL = 'https://Mon7u.pythonanywhere.com/api';

// ================== FUNZIONI UTILI ==================
function getBasePath() {
  return window.location.pathname.replace(/index\.html$/, '');
}

// ================== QR GENERATION (index.html) ==================
(function setupQR(){
  const btn = document.getElementById("generaQR");
  if (!btn) return;

  function generaQr(url) {
    const qrContainer = document.getElementById("qrContainer");
    qrContainer.innerHTML = "";
    const canvas = document.createElement("canvas");
    QRCode.toCanvas(canvas, url, { width: 220, margin: 2 });
    qrContainer.appendChild(canvas);

    document.getElementById("istruzioni").style.display = "block";
    document.getElementById("linkRegistrazione").innerHTML =
      `<a href="${url}" target="_blank">${url}</a>`;
  }

  btn.addEventListener("click", () => {
    const email = document.getElementById("emailInput").value.trim().toLowerCase();
    if (!email.includes("@")) { alert("Inserisci una email valida"); return; }

    const basePath = getBasePath();
    const url = `${window.location.origin}${basePath}registra.html?email=${encodeURIComponent(email)}`;

    generaQr(url);
  });
})();

// ================== FIRMA (mouse + touch) - registra.html ==================
(function setupSave(){
  const form = document.getElementById("firmaForm");
  if (!form) return; // siamo in index.html

  const canvas = document.getElementById("firmaCanvas");
  const ctx = canvas.getContext("2d");
  const emailInput = document.getElementById("email");
  const msgDiv = document.getElementById("message");

  // Precompila email dal QR
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get("email");
  if (emailParam) emailInput.value = emailParam;

  // ==== disegno con Pointer Events (valido per mouse + touch) ====
  let drawing = false;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function moveDraw(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function endDraw(e) {
    if (!drawing) return;
    e.preventDefault();
    drawing = false;
    ctx.beginPath();
  }

  canvas.addEventListener("pointerdown", startDraw);
  canvas.addEventListener("pointermove", moveDraw);
  canvas.addEventListener("pointerup", endDraw);
  canvas.addEventListener("pointerleave", endDraw);
  canvas.addEventListener("pointercancel", endDraw);

  // Pulsante cancella
  document.getElementById("clearCanvas").onclick = () =>
    ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ==== Invio dati ====
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const record = {
      nome: document.getElementById("nome").value.trim(),
      cognome: document.getElementById("cognome").value.trim(),
      email: emailInput.value.trim().toLowerCase(),
      firmaDataURL: canvas.toDataURL("image/png")
    };

    msgDiv.textContent = "⏳ Salvataggio...";

    // Server PythonAnywhere
    let remoto = false;
    try {
      const r = await fetch(`${API_BASE_URL}/firma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
      });
      const j = await r.json();
      remoto = j.ok === true;
    } catch (err) {
      console.warn("Errore salvataggio remoto:", err);
    }

    // Backup locale
    const key = "registroFirme";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push({...record, data: new Date().toLocaleString("it-IT") });
    localStorage.setItem(key, JSON.stringify(arr));

    msgDiv.textContent = remoto
      ? "✅ Registrazione salvata (server + locale)"
      : "⚠️ Salvato solo in locale";

    form.reset();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
})();

// ================== EXPORT (index.html) ==================
(async function setupExport(){
  const csvBtn = document.getElementById("exportCsv");
  const pdfBtn = document.getElementById("exportPdf");
  if (!csvBtn && !pdfBtn) return;

  // leggi dal server e normalizza i campi
  async function getFirmeOnline() {
    try {
      const r = await fetch(`${API_BASE_URL}/firme`);
      const j = await r.json();
      if (!j.ok || !Array.isArray(j.rows)) return null;

      return j.rows.map(row => ({
        nome: row.nome || "",
        cognome: row.cognome || "",
        email: row.email || "",
        data: row.timestamp || "",
        firmaDataURL: row.firmaDataURL || ""
      }));
    } catch (err) {
      console.warn("Errore lettura backend:", err);
      return null;
    }
  }

  async function getArchivio() {
    const online = await getFirmeOnline();
    if (online && online.length) return online;
    return JSON.parse(localStorage.getItem("registroFirme") || "[]");
  }

  // ---- CSV ----
  csvBtn.onclick = async () => {
    const arr = await getArchivio();
    const msg = document.getElementById("exportMessage");
    if (!arr.length) { msg.textContent = "Registro vuoto"; return; }

    const rows = [["nome","cognome","email","data","firmaDataURL"]];
    arr.forEach(r => rows.push([
      r.nome, r.cognome, r.email, r.data || "", r.firmaDataURL || ""
    ]));

    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "registro_firme.csv";
    a.click();
    URL.revokeObjectURL(url);
    msg.textContent = "CSV scaricato";
  };

  // ---- PDF ----
  pdfBtn.onclick = async () => {
    const arr = await getArchivio();
    const msg = document.getElementById("exportMessage");
    if (!arr.length) { msg.textContent = "Registro vuoto"; return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;

    arr.forEach(r => {
      doc.text(`Nome: ${r.nome}`, 10, y);
      doc.text(`Cognome: ${r.cognome}`, 10, y+10);
      doc.text(`Email: ${r.email}`, 10, y+20);
      doc.text(`Data: ${r.data || ""}`, 10, y+30);
      if (r.firmaDataURL) {
        try { doc.addImage(r.firmaDataURL, "PNG", 10, y+40, 120, 40); } catch(e) {}
      }
      y += 90;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    doc.save("registro_firme.pdf");
    msg.textContent = "PDF scaricato";
  };
})();
