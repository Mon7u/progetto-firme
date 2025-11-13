// ================== CONFIG BACKEND ==================
const API_BASE_URL = 'https://Mon7u.pythonanywhere.com/api';

// ================== FUNZIONI UTILI ==================
function getBasePath() {
  return window.location.pathname.replace(/index\.html$/, '');
}

// ================== QR GENERATION ==================
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

// ================== FIRMA (SALVATAGGIO) ==================
(function setupSave(){
  const form = document.getElementById("firmaForm");
  if (!form) return;

  const canvas = document.getElementById("firmaCanvas");
  const ctx = canvas.getContext("2d");

  // Disegno firma
  let drawing = false;
  canvas.addEventListener("mousedown", () => drawing = true);
  canvas.addEventListener("mouseup", () => { drawing = false; ctx.beginPath(); });
  canvas.addEventListener("mousemove", e => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  });

  document.getElementById("clearCanvas").onclick = () =>
    ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Precompila email dal QR
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get("email");
  if (emailParam) document.getElementById("email").value = emailParam;

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const record = {
      nome: document.getElementById("nome").value.trim(),
      cognome: document.getElementById("cognome").value.trim(),
      email: document.getElementById("email").value.trim().toLowerCase(),
      firmaDataURL: canvas.toDataURL("image/png")
    };

    document.getElementById("message").innerHTML = "⏳ Salvataggio...";

    // Salva sul server PythonAnywhere
    let remoto = false;
    try {
      const r = await fetch(`${API_BASE_URL}/firma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
      });
      const j = await r.json();
      remoto = j.ok === true;
    } catch {}

    document.getElementById("message").innerHTML =
      remoto ? "✅ Registrazione salvata (server + locale)" :
               "⚠️ Salvato solo in locale";

    // backup
    const key = "registroFirme";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push({...record, data: new Date().toLocaleString("it-IT") });
    localStorage.setItem(key, JSON.stringify(arr));
  });
})();

// ================== EXPORT ==================
(async function setupExport(){
  const csvBtn = document.getElementById("exportCsv");
  const pdfBtn = document.getElementById("exportPdf");
  if (!csvBtn && !pdfBtn) return;

  async function getFirmeOnline() {
    try {
      const r = await fetch(`${API_BASE_URL}/firme`);
      const j = await r.json();
      return j.ok ? j.rows : null;
    } catch {
      return null;
    }
  }

  async function getArchivio() {
    const online = await getFirmeOnline();
    if (online) return online;

    return JSON.parse(localStorage.getItem("registroFirme") || "[]");
  }

  csvBtn.onclick = async () => {
    const arr = await getArchivio();
    if (!arr.length) return;

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
  };

  pdfBtn.onclick = async () => {
    const arr = await getArchivio();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let y = 20;
    arr.forEach(r => {
      doc.text(`Nome: ${r.nome}`, 10, y);
      doc.text(`Cognome: ${r.cognome}`, 10, y+10);
      doc.text(`Email: ${r.email}`, 10, y+20);
      doc.text(`Data: ${r.data || ""}`, 10, y+30);
      if (r.firmaDataURL) doc.addImage(r.firmaDataURL, "PNG", 10, y+40, 120, 40);
      y += 90;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    doc.save("registro_firme.pdf");
  };
})();
