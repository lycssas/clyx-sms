import { useEffect, useMemo, useState } from "react";
import "./App.css";
import PhoneMock from "./PhoneMock"; // suppose que tu as déjà ce composant
import phoneIcone from "./img/img-2.png";
import personIcone from "./img/img-3.png";
import textIcone from "./img/img-1.png";
import logo from "./img/clyxlogo.png";

export default function App() {
  // -------- State
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [charCount, setCharCount] = useState(0);

  // -------- Constantes
  // URLs comptent pour 10 caractères dans le comptage "opérateur"
  const URL_REGEX = /(https?:\/\/[^\s]+|ftp:\/\/[^\s]+|www\.[^\s]+)/gi;
  const getNormalizedLength = (text) =>
    (text || "").replace(URL_REGEX, "XXXXXXXXXX").length;

  // -------- Templates (React garde la main là-dessus)
  const TEMPLATES = useMemo(
    () => [
      {
        id: "confirm",
        label: "✈️ Confirmation de vol",
        text: "Bonjour %%FirstName%%, votre vol %%flightNumber%% Air Côte d’Ivoire du %%Old_Departure_DateTime%% à %%New_Departure_Time%% est confirmé. Enregistrez-vous sur https://aircotedivoire.com.",
      },
      {
        id: "reminder",
        label: "🕒 Rappel avant départ",
        text: "Rappel : vol %%flightNumber%% le %%Old_Departure_DateTime%% à %%New_Departure_Time%%. Merci d’arriver 2h avant le départ. Bon voyage !",
      },
      {
        id: "promo",
        label: "💡 Offre spéciale",
        text: "Air Côte d’Ivoire : -20% si vous réservez avant %%New_Departure_DateTime%%. Détails sur https://aircotedivoire.com.",
      },
    ],
    []
  );

  // -------- Valeurs d’exemple pour la preview
  const SAMPLE_POOL = useMemo(
    () => ({
      FirstName: ["XXXXX", "XXXXXX"],
      LastName: ["XXXXX", "XXXXXX"],
      flightNumber: ["HFXXX", "HFXXX"],
      Old_Departure_DateTime: ["XX/XX/XXXX", "XX/XX/XXXX"],
      CampagnId: ["CMP-XXXXX", "CMP-XXXX"],
      ContactId: ["CID-XXXXX", "CID-XXXX"],
      HasResponded: ["Oui", "Non"],
      RespondedDate: ["XX/XX/XXXX", "XX/XX/XXXX", "XX/XX/XXXX"],
      DelayMin: ["15", "30", "45", "60"],
      Phone: ["+XXXXXXXXX", "+XXXXXXXXX"],
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
      New_Departure_DateTime: ["XX/XX/XXXX 08:35"],
      Id: ["CK-XXXXX", "CK-XXXXX"],
    }),
    []
  );

  const sampleSlugs = ["xXxXx", "XXXXX", "XxXxX"];
  const sampleUrlForSlug = () =>
    `https://clyx.io/${
      sampleSlugs[Math.floor(Math.random() * sampleSlugs.length)]
    }`;

  const sampleForKey = (key) => {
    const arr = SAMPLE_POOL[key];
    if (arr && arr.length) return arr[Math.floor(Math.random() * arr.length)];
    return "XXXX";
  };

  // Remplacements pour l’aperçu (non destructif du message)
  const renderPreviewText = (text) => {
    if (!text) return "";
    // {{Event.DE....FirstName}} -> prend le dernier segment en clé
    let out = text.replace(/\{\{[^}]*?\.([A-Za-z0-9_]+)\}\}/g, (_, last) =>
      sampleForKey(last)
    );
    // %%FirstName%% -> remplace par échantillon
    out = out.replace(/%%\s*([A-Za-z0-9_]+)\s*%%/g, (_, key) =>
      sampleForKey(key)
    );
    // URLs -> slug démo
    out = out.replace(URL_REGEX, () => sampleUrlForSlug());
    return out;
  };

  // -------- Effets
  useEffect(() => {
    setCharCount(getNormalizedLength(message));
  }, [message]);

  useEffect(() => {
    const node = document.getElementById("messageContent");
    const prefilled = node?.value ?? "";

    if (prefilled && !message) {
      setMessage(prefilled);
      return; // ne pas écraser par un template par défaut
    }

    if (!prefilled && !message && TEMPLATES.length) {
      setSelectedTemplate(TEMPLATES[0].id);
      setMessage(TEMPLATES[0].text);
    }
  }, []); // une seule fois au montage

  // ESC pour fermer la preview
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setShowPreview(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // -------- Handlers
  const onTemplateChange = (e) => {
    const id = e.target.value;
    setSelectedTemplate(id);
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (tpl) setMessage(tpl.text);
  };

  const onMessageChange = (e) => setMessage(e.target.value);

  const isPreviewDisabled = message.trim().length === 0;

  return (
    <div className="App">
      <div id="container">
        <div className="header">
          <img
            src={logo}
            width={40}
            alt="Lycs Logo"
            className="logo"
          />
        </div>

        <div className="section">
          {/* champ du destinataire (rempli par AMD via Schema) */}
          <div className="section-item">
            <div htmlFor="phoneField" className="label-phone">
              <img
                src={phoneIcone}
                width={30}
                alt="Icône téléphone"
                className="icon"
              />
            </div>
            <select id="phoneField" className="available-fields">
              <option value="">Select phone number attribute *</option>
              {/* Les options sont injectées par customActivity.js */}
            </select>
            <div id="phoneFieldError" className="error"></div>
          </div>

          {/* champ du template (géré par React uniquement) */}
          <div className="section-item">
            <div htmlFor="templateField" className="label-phone">
              <img
                src={textIcone}
                width={35}
                alt="Icône texte"
                className="icon"
              />
            </div>
            <select
              id="smsTemplate"
              className="available-fields"
              value={selectedTemplate}
              onChange={onTemplateChange}
            >
              <option value="">Select a template *</option>
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <div id="smsTemplateError" className="error"></div>
          </div>

          {/* champs perso (remplis par AMD) */}
          <div className="section-item right">
            <label className="label-message">MESSAGE</label>
            <div htmlFor="templateField" className="label-phone">
              <img
                src={personIcone}
                width={35}
                alt="Icône texte"
                className="icon"
              />
            </div>
            <select id="availableFields" className="available-fields">
              <option value="">Personalisation</option>
              {/* Options injectées par customActivity.js */}
            </select>
          </div>

          {/* corps du message (contrôlé par React) */}
          <div className="section-item message-area">
            <textarea
              id="messageContent"
              value={message}
              onChange={onMessageChange}
              rows={5}
            />
            <div id="characterCount" className="detailsms">
              <span className="textlenght"> ≈ {charCount} / 160</span>
              <span className="nbsms">
                {" "}
                | {Math.max(1, Math.ceil(charCount / 160))} SMS
              </span>
            </div>
            <div id="messageContentError" className="error"></div>
          </div>

          {/* bouton preview */}
          <div className="btn-section">
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

      {/* --- Modal Preview --- */}
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
              <h4 id="preview-title" style={{ marginTop: 0 }}>
                Aperçu du SMS
              </h4>
              <button
                className="btn-close"
                onClick={() => setShowPreview(false)}
              >
                ❌
              </button>
            </div>

            {/* Texte dans le mock téléphone */}
            <PhoneMock text={renderPreviewText(message)} />
          </div>
        </div>
      )}
    </div>
  );
}
