import React from "react";
// import phoneMock from "http://127.0.0.1:3000/images/preview.png";

export default function PhoneMock({ text }) {
  return (
    <div
      className="phone-mock"
      aria-label="Prévisualisation SMS sur smartphone"
    >
      {/* Zone cliquable fermée par la modale parent, ici on n'empêche pas les clics */}
      <div className="phone-stage">
        {/* Bulle envoyée (à droite). Remplace "sent" par "received" si tu veux une bulle à gauche */}
        <div className="bubble received">{text}</div>

        {/* timestamp sous la bulle */}
        <div className="bubble-meta">Aujourd’hui • 11:33</div>
      </div>
    </div>
  );
}
