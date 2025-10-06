import { useEffect, useMemo, useState } from "react";
import "./App.css";
import PhoneMock from "./PhoneMock.js"; // suppose que tu as déjà ce composant
import phoneIcone from "./img/img-2.png";
import personIcone from "./img/img-3.png";
import textIcone from "./img/img-1.png";
import logo from "./img/clyxlogo.png";
import sms from "./img/sms.png";
import campagne from "./img/campagn.png";

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
      // Template 1 : Confirmation de vol (Adapté avec clés formatées)
      {
        id: "confirm",
        label: "✈️ Confirmation de Vol",
        // Utilisation des clés formatées TECH_Nvl
        text: "Bonjour %%CampaignMember:Name%%, votre vol %%CampaignMember:Campaign:NumeroVolNew__c%% Air Côte d’Ivoire de la route %%CampaignMember:Campaign:RouteNew__c%% est confirmé. Départ le %%TECH_NvlDateDepart__c%% à %%TECH_NvlHeureDepart__c%%. Enregistrez-vous sur https://aircotedivoire.com.",
      },

      // Template 2 : Rappel avant départ (Adapté avec clés formatées)
      {
        id: "reminder",
        label: "🕒 Rappel avant Départ",
        // Utilisation des champs formatés pour l'heure et le numéro de vol
        text: "Rappel : vol %%CampaignMember:Campaign:NumeroVolNew__c%% le %%TECH_NvlDateDepart__c%% à %%TECH_NvlHeureDepart__c%%. Merci d’arriver 2h avant le départ. Bon voyage !",
      },

      // Template 3 : Offre spéciale (Clé de date formatée utilisée pour l'échéance)
      {
        id: "promo",
        label: "💡 Offre Spéciale",
        // Utilisation d'une clé formatée comme date d'échéance
        text: "Air Côte d’Ivoire : -20% si vous réservez avant %%TECH_NvlDateDepart__c%%. Détails sur https://aircotedivoire.com.",
      },

      // Nouveaux Templates de Perturbation (Clés formatées utilisées)

      {
        id: "delay_info",
        label: "⚠️ Retard de Vol - Information",
        text: "M/Mme %%CampaignMember:Name%%,\nEn raison de contraintes d’exploitation, le vol %%CampaignMember:Campaign:NumeroVolNew__c%%, %%CampaignMember:Campaign:RouteNew__c%% du %%TECH_OldDateDepart__c%% (initialement prévu à %%TECH_OldHeureDepart__c%%), connaîtra un retard.\n• Nouvelle heure de départ : %%TECH_NvlHeureDepart__c%% \n• Convocation : %%TECH_NvlHeureDepart__c%% (heure - 2h à gérer par la DE/logique)\n• Arrivée estimée : %%TECH_NvlHeureArrive__c%%\nNous vous prions d’accepter nos sincères excuses pour ce désagrément et restons à votre entière disposition.\nCordialement,\nService Réservation\nAir Côte d’Ivoire",
      },
      {
        id: "modification_escale",
        label: "✈️ Modification de Vol - Escale",
        text: "M/Mme %%CampaignMember:Name%%,\nEn raison de contraintes d’exploitation, le vol %%CampaignMember:Campaign:NumeroVolNew__c%%, %%CampaignMember:Campaign:RouteNew__c%% du %%TECH_OldDateDepart__c%% est modifié.\n• Nouvelle heure de départ : %%TECH_NvlHeureDepart__c%% avec une escale à %%CampaignMember:Campaign:Escale__c%% \n• Convocation : %%TECH_NvlHeureDepart__c%% (heure - 2h à gérer par la DE/logique)\nNous vous prions d’accepter nos sincères excuses pour ce désagrément et vous remercions de votre compréhension.\nCordialement,\nService Réservation\nAir Côte d’Ivoire – Abidjan",
      },
    ],
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
    let out = text.replace(/%%[^%]+%%/g, "XXXXX");
    // 2) URLs -> slug démo
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
    // if (tpl) setMessage(tpl.text);
    if (tpl) {
      setMessage(tpl.text);
      // IMPORTANT : notifier le script Postmonger que le contenu a changé
      // On attend le rendu React puis on émet un 'input' synthétique
      setTimeout(() => {
        const node = document.getElementById("messageContent");
        if (node) {
          node.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }, 0);
    }
  };

  const onMessageChange = (e) => setMessage(e.target.value);

  const isPreviewDisabled = message.trim().length === 0;

  return (
    <div className="App">
      <div id="container">
        <div className="header">
          <img src={logo} width={40} alt="Lycs Logo" className="logo" />
        </div>

        <div className="section">
          {/* champ du destinataire (rempli par AMD via Schema) */}
          <div className="sectionContainer">
            <div className="section-item">
              <div htmlFor="phoneField" className="label-phone">
                <img
                  src={phoneIcone}
                  width={30}
                  alt="Icône téléphone"
                  className="icon"
                />
              </div>
              <div className="input-item">
                <select id="phoneField" className="available-fields">
                  <option value="">Select phone number attribute *</option>
                  {/* Les options sont injectées par customActivity.js */}
                </select>
              </div>
              <div id="phoneFieldError" className="error"></div>
            </div>
            {/* Nom du sms_$ */}
            <div className="section-item m-left">
              <div htmlFor="phoneField" className="label-phone">
                <img
                  src={sms}
                  width={30}
                  alt="Icône téléphone"
                  className="icon"
                />
              </div>
              <div className="input-item">
                <input id="smsName" placeholder="SMS Name" />
              </div>
              <div id="smsNameError" className="error"></div>
            </div>
          </div>
          <div className="sectionContainer">
            {/* Nom du sms_$ */}
            <div className="section-item">
              <div htmlFor="phoneField" className="label-phone">
                <img
                  src={campagne}
                  width={30}
                  alt="Icône téléphone"
                  className="icon"
                />
              </div>
              <div className="input-item">
                <input id="campaignCode" placeholder="Campaign Code" />
              </div>
              <div id="smsNameError" className="error"></div>
            </div>

            {/* champ du template (géré par React uniquement) */}
            <div className="section-item m-left">
              <div htmlFor="templateField" className="label-phone">
                <img
                  src={textIcone}
                  width={35}
                  alt="Icône texte"
                  className="icon"
                />
              </div>
              <div className="input-item">
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
              </div>
              <div id="smsTemplateError" className="error"></div>
            </div>
          </div>
          {/* champs perso (remplis par AMD) */}
          <div className="sectionContainer right align-right">
            <label className="label-message">MESSAGE</label>
            <div className="section-item champsPerso right">
              <div htmlFor="templateField" className="label-personalisation">
                <img
                  src={personIcone}
                  width={35}
                  alt="Icône texte"
                  className="icon"
                />
              </div>
              <div className="input-item">
                <select id="availableFields" className="available-fields">
                  <option value="">Personalisation</option>
                  {/* Options injectées par customActivity.js */}
                </select>
              </div>
            </div>
          </div>
          {/* corps du message (contrôlé par React) */}
          <div className="section-container message-area">
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
