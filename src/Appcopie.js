import { useEffect, useMemo, useState, useRef } from "react";
import "./App.css";
import PhoneMock from "./PhoneMock";

function App() {
  // --- State ---
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [charCount, setCharCount] = useState(0);

  // --- Templates (exemples) ---

  const textAreaRef = useRef(null);

  const urlregex = /(https?:\/\/[^\s]+|ftp:\/\/[^\s]+|www\.[^\s]+)/gi;

  function getNormalizedLength(text) {
    return (text || "").replace(URL_REGEX, "XXXXXXXXXX").length;
  }

  const TEMPLATES = useMemo(
    () => [
      {
        id: "confirm",
        label: "✈️ Confirmation de vol",
        text: "Bonjour %%FirstName%%, votre vol %%flightNumber%% Air Côte d’Ivoire du %%Old_Departure_DateTime%% à %%New_Departure_Time%% est confirmé. Enregistrez-vous sur https://aircotedivoire.com",
      },
      {
        id: "reminder",
        label: "🕒 Rappel avant départ",
        text: "Rappel : vol %%flightNumber%% le %%Old_Departure_DateTime%% à %%New_Departure_Time%%. Merci d’arriver 2h avant le départ. Bon voyage !",
      },
      {
        id: "promo",
        label: "💡 Offre spéciale",
        text: "Air Côte d’Ivoire : -20% si vous réservez avant %%New_Departure_DateTime%%. Détails sur https://aircotedivoire.com",
      },
    ],
    []
  );

  // --- Valeurs d'exemple aléatoires pour la preview ---
  const SAMPLE_POOL = useMemo(
    () => ({
      FirstName: ["Fatima", "Ibrahima", "Rosette", "Mariama", "Mathieu"],
      LastName: ["Ngom", "Traoré", "Diaw", "Koné", "Ndiaye"],
      flightNumber: ["HF123", "HF485", "HF902", "HF217", "HF678"],
      Old_Departure_DateTime: [
        "12/10/2025",
        "15/10/2025",
        "18/10/2025",
        "20/10/2025",
      ],
      CampagnId: ["CMP-202310", "CMP-202311", "CMP-202312"],
      ContactId: ["CID-123456", "CID-789012", "CID-345678"],
      HasResponded: ["Oui", "Non"],
      RespondedDate: ["01/10/2025", "05/10/2025", "10/10/2025"],
      DelayMin: ["15", "30", "45", "60"],
      Phone: ["+22501234567", "+22507654321", "+22509876543"],
      Email: [
        "fatima.ngom@example.com",
        "ibrahima.traore@example.com",
        "rosette.diaw@example.com",
        "mariama.kone@example.com",
        "mathieu.ndiaye@example.com",
      ],
      APD: ["Abidjan", "Dakar", "Bamako"],
      APA: ["Paris", "Bouaké", "San Pedro"],
      New_Departure_Time: ["08:35", "13:45", "20:10", "06:55"],
      Old_Departure_Time: ["08:00", "13:00", "20:00", "06:30"],
      New_Departure_DateTime: ["12/10/2025 08:35"],
      Id: ["CK-001122", "CK-778899"],
    }),
    []
  );

  const sample_slag = ["xXxXx", "XXXXX", "XxXxX"];

  // Retourner un url aleatoire en fonction d'un slug dans le pool sample_slag
  // function sampleUrlForSlug(slug) {
  //   if (sample_slag.includes(slug)) {
  //     return `https://clyx.io/${slug}`;
  //   }
  //   return "clyx.io/XXXX";
  // }

  function sampleUrlForSlug() {
    const randomSlug =
      sample_slag[Math.floor(Math.random() * sample_slag.length)];
    return `https://clyx.io/${randomSlug}`;
  }

  function sampleForKey(key) {
    const arr = SAMPLE_POOL[key];
    if (arr && arr.length) {
      return arr[Math.floor(Math.random() * arr.length)];
    }
    return "XXXX"; // fallback générique
  }

  // Remplace %%Token%% par une valeur d’exemple
  // Remplace aussi {{...Last.Segment}} → valeur d’exemple
  function renderPreviewText(text) {
    if (!text) return "";

    // {{Event.DEAudience-... .FirstName}} -> valeur d’exemple (on prend le dernier segment)
    let out = text.replace(/\{\{[^}]*?\.([A-Za-z0-9_]+)\}\}/g, (_, last) =>
      sampleForKey(last)
    );

    // %%FirstName%% -> valeur d’exemple
    out = out.replace(/%%\s*([A-Za-z0-9_]+)\s*%%/g, (_, key) =>
      sampleForKey(key)
    );

    // URLs (http, https, www) → URL d’exemple
    out = out.replace(urlregex, (url) => sampleUrlForSlug(url));

    return out;
  }

  // Compteur avec URLs comptant pour 10 caractères
  const URL_REGEX = /(https?:\/\/[^\s]+|ftp:\/\/[^\s]+|www\.[^\s]+)/gi;

  function getNormalizedLength(text) {
    return (text || "").replace(URL_REGEX, "XXXXXXXXXX").length;
  }

  useEffect(() => {
    setCharCount(getNormalizedLength(message));
  }, [message]);

  useEffect(() => {
    // Au montage, si le textarea a déjà une valeur, on la récupère
    if (textAreaRef.current) {
      setMessage(textAreaRef.current.value);
    }
  }, []);

  const onTemplateChange = (e) => {
    const id = e.target.value;
    setSelectedTemplate(id);
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (tpl) setMessage(tpl.text);
  };

  const onMessageChange = (e) => setMessage(e.target.value);

  const isPreviewDisabled = message.trim().length === 0;

  // Option: fermer modal avec ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setShowPreview(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="App">
      <div id="container">
        <div id="step1" className="step">
          <div className="header">
            <img src="images/iconsms1.png" alt="Lycs Logo" className="logo" />
            <h2>
              <strong>Clyx SMS</strong>
            </h2>
          </div>

          <div className="section">
            <div className="section-item">
              <div className="form-group">
                <label htmlFor="phoneField" className="label-phone">
                  <span className="required">* </span>
                  Champ pour le numéro du destinataire
                </label>
                <select id="phoneField">
                  <option value="">
                    Sélectionnez un champ pour le numéro de téléphone
                  </option>
                </select>
                <div id="phoneFieldError" className="error"></div>
              </div>

              <div className="section-item">
                <div className="de-fields-container right">
                  <p className="de-fields-help">Sélectionnez un template.</p>
                  <select
                    id="smsTemplate"
                    className="available-fields"
                    style={{ width: "100%", maxWidth: "320px" }}
                    value={selectedTemplate}
                    onChange={onTemplateChange}
                  >
                    <option value="">-- Sélectionnez un template --</option>
                    {TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-group">
              <textarea
                ref={textAreaRef}
                id="messageContent"
                placeholder="Écrivez votre message ici..."
                value={message}
                onChange={onMessageChange}
                rows={5}
              />
              <div className="character-count" id="charCount">
                <span id="characterCount">≈ {charCount} caractères</span>
                {/* {charCount > 160 && (
                  <span className="error" style={{ marginLeft: 8 }}>
                    Le message dépasse ~160 (URLs comptent pour 10).
                  </span>
                )} */}
              </div>
              <div id="messageContentError" className="error"></div>
            </div>

            <div className="section-item">
              <div className="de-fields-container left">
                <p className="de-fields-help">
                  Sélectionnez un champ de la Data Extension à insérer dans le
                  corps du message.
                </p>
                <select
                  id="availableFields"
                  className="available-fields"
                  style={{ width: "100%", maxWidth: "320px" }}
                >
                  <option disabled className="field-chip">
                    -- Sélectionnez un champ --
                  </option>
                </select>
              </div>
            </div>

            <button
              className="preview-button"
              id="previewButton"
              onClick={() => setShowPreview(true)}
              disabled={isPreviewDisabled}
              title={isPreviewDisabled ? "Message vide" : "Aperçu du SMS"}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* --- Modal de preview --- */}
      {showPreview && (
        <div
          className="modal-backdrop"
          onClick={() => setShowPreview(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <div className="modal-title">
              <h3 id="preview-title" style={{ marginTop: 0 }}>
                Aperçu du SMS
              </h3>
              <button
                className="btn-close"
                onClick={() => setShowPreview(false)}
              >
                ❌
              </button>
            </div>
            {/* <div className="modal-actions">
              <button className="btn" onClick={() => setShowPreview(false)}>
                Fermer❌
              </button>
            </div> */}
            {/* <h3 id="preview-title" style={{ marginTop: 0 }}>
              Aperçu du SMS
            </h3> */}

            {/* >>> Affichage du texte sur l'image du téléphone */}
            <PhoneMock text={renderPreviewText(message)} />

            {/* <div className="modal-actions">
              <button className="btn" onClick={() => setShowPreview(false)}>
                Fermer
              </button>
            </div> */}
          </div>
        </div>
      )}
      {/* {showPreview && (
        <div
          className="modal-backdrop"
          onClick={() => setShowPreview(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <h3 id="preview-title" style={{ marginTop: 0 }}>
              Aperçu du SMS
            </h3>
            <div className="sms-preview">{renderPreviewText(message)}</div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowPreview(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )} */}
    </div>
  );
}

export default App;
