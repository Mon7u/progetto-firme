// ===== CONFIG =====
const API_BASE_URL = "https://Mon7u.pythonanywhere.com/api";

// ===== TEMA LIGHT/DARK (solo se c'è il toggle, quindi solo index) =====
(function setupThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return; // in registra.html non c'è, quindi non fa niente

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
  });
})();

// ===== GENERA QR (index.html) =====
(function setupQR() {
  const btn = document.getElementById("generaQR");
  if (!btn) return; // non siamo in index

  btn.addEventListener("click", () => {
    const emailInput = document.getElementById("emailInput");
    const email = emailInput.value.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      alert("Inserisci una email valida");
      return;
    }

    // URL relativo: stessa cartella di index.html (funziona ovunque)
    const url = new URL("registra.html", window.location.href);
    url.searchParams.set("email", email);

    const qrContainer = document.getElementById("qrContainer");
    qrContainer.innerHTML = "";

    QRCode.toCanvas(url.toString(), { width: 220, margin: 2 }, (err, canvas) => {
      if (err) {
        alert("Errore nella generazione del QR");
        return;
      }
      qrContainer.appendChild(canvas);
    });

    document.getElementById("istruzioni").style.display = "block";
    document.getElementById("linkRegistrazione").innerHTML =
      `<a href="${url.toString()}" target="_blank">${url.toString()}</a>`;
  });
})();

// ===== FIRMA (registra.html) =====
(function setupFirma() {
  const form = document.getElementById("firmaForm");
  const canvas = document.getElementById("firmaCanvas");
  if (!form || !canvas) return; // non siamo in registra

  const ctx = canvas.getContext("2d");
  const emailInput = document.getElementById("email");
  const msgDiv = document.getElementById("message");
  const successCard = document.getElementById("successScreen");
  const firmaCard = document.getElementById("firmaCard");

  // Precompila email dal QR
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get("email");
  if (emailParam) emailInput.value = emailParam;

  // Disegno con pointer events (mouse + touch)
  let drawing = false;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    ctx.beginPath();
    const p = getPos(e);
    ctx.moveTo(p.x, p.y);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });

  canvas.addEventListener("pointerup", () => {
    drawing = false;
  });

  canvas.addEventListener("pointerleave", () => {
    drawing = false;
  });

  document.getElementById("clearCanvas").addEventListener("click", () =>
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  );

  let alreadySubmitted = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (alreadySubmitted) return;

    // Controlla firma non vuota
    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      msgDiv.textContent = "Metti la firma prima di confermare.";
      return;
    }

    alreadySubmitted = true;
    msgDiv.textContent = "Salvataggio in corso...";

    const record = {
      nome: document.getElementById("nome").value.trim(),
      cognome: document.getElementById("cognome").value.trim(),
      email: emailInput.value.trim().toLowerCase(),
      firmaDataURL: canvas.toDataURL("image/png"),
    };

    // Salva su PythonAnywhere
    try {
      const res = await fetch(`${API_BASE_URL}/firma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      const j = await res.json();
      // se vuoi puoi controllare j.ok
    } catch (err) {
      console.warn("Errore backend:", err);
    }

    // Backup locale
    const key = "registroFirme";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push({
      ...record,
      data: new Date().toLocaleString("it-IT"),
    });
    localStorage.setItem(key, JSON.stringify(arr));

    // Mostra schermata finale
    firmaCard.style.display = "none";
    successCard.style.display = "block";
  });
})();

// ===== EXPORT (index.html) =====
(function setupExport() {
  const csvBtn = document.getElementById("exportCsv");
  const pdfBtn = document.getElementById("exportPdf");
  if (!csvBtn && !pdfBtn) return; // non siamo in index

  async function getFirmeFromBackend() {
    try {
      const res = await fetch(`${API_BASE_URL}/firme`);
      const j = await res.json();
      if (!j.ok || !Array.isArray(j.rows)) return [];
      return j.rows.map((r) => ({
        nome: r.nome || "",
        cognome: r.cognome || "",
        email: r.email || "",
        data: r.timestamp || "",
        firmaDataURL: r.firmaDataURL || "",
      }));
    } catch (err) {
      console.warn("Errore lettura backend:", err);
      return [];
    }
  }

  async function getArchivio() {
    const online = await getFirmeFromBackend();
    if (online.length) return online;
    return JSON.parse(localStorage.getItem("registroFirme") || "[]");
  }

  const msg = document.getElementById("exportMessage");

  // CSV
  if (csvBtn) {
    csvBtn.addEventListener("click", async () => {
      const arr = await getArchivio();
      if (!arr.length) {
        if (msg) msg.textContent = "Registro vuoto.";
        return;
      }

      const rows = [["nome", "cognome", "email", "data", "firmaDataURL"]];
      arr.forEach((r) =>
        rows.push([r.nome, r.cognome, r.email, r.data || "", r.firmaDataURL])
      );

      const csv = rows.map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "registro_firme.csv";
      a.click();
      URL.revokeObjectURL(url);
      if (msg) msg.textContent = "CSV scaricato.";
    });
  }

  // PDF
  if (pdfBtn) {
    pdfBtn.addEventListener("click", async () => {
      const arr = await getArchivio();
      if (!arr.length) {
        if (msg) msg.textContent = "Registro vuoto.";
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      let y = 20;

      arr.forEach((r, i) => {
        doc.text(`Nome: ${r.nome}`, 10, y);
        doc.text(`Cognome: ${r.cognome}`, 10, y + 8);
        doc.text(`Email: ${r.email}`, 10, y + 16);
        doc.text(`Data: ${r.data || ""}`, 10, y + 24);
        if (r.firmaDataURL) {
          try {
            doc.addImage(r.firmaDataURL, "PNG", 10, y + 30, 80, 30);
          } catch (e) {}
        }
        y += 70;
        if (y > 260 && i < arr.length - 1) {
          doc.addPage();
          y = 20;
        }
      });

      doc.save("registro_firme.pdf");
      if (msg) msg.textContent = "PDF scaricato.";
    });
  }
})();
