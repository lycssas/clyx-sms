define(["postmonger"], function (Postmonger) {
  ("use strict");

  var connection = new Postmonger.Session();
  var payload = {};
  var schemaFields = [];
  var fieldMappings = {}; // shortName -> fullPath (ex: FirstName -> Event.DE...FirstName)
  var buid = null;

  $(window).ready(onRender);

  connection.on("initActivity", initialize);
  connection.on("clickedNext", save);
  connection.on("requestedSchema", onRequestedSchema);

  connection.on("requestedTokens", async function (t) {
    // t peut contenir token, MID, etc.
    if (t && t.MID) buid = t.MID;
  });

  /* ---------- Helpers tokens ---------- */

  // --- IMPORTANT : fait comprendre le changement à React ---
  function setReactValue(el, value) {
    // Utilise le setter natif de HTMLTextAreaElement
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    ).set;
    setter.call(el, value);
    // Puis déclenche un 'input' qui bubble (capté par React -> onChange)
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function buildFieldMappingsFromSchema() {
    fieldMappings = {};
    (schemaFields || []).forEach((f) => {
      const fullPath = f.key || "";
      const short = (fullPath.split(".").pop() || "").trim();
      if (short) fieldMappings[short] = fullPath;
    });
    // Optionnel : Contact.Key
    fieldMappings["ContactKey"] = "Contact.Key";
  }

  // %%FirstName%% -> {{Event.DE...FirstName}}
  function replaceShortWithFull(text) {
    if (!text) return text;
    const shorts = Object.keys(fieldMappings).sort(
      (a, b) => b.length - a.length
    );
    shorts.forEach((shortName) => {
      const fullPath = fieldMappings[shortName];
      if (!fullPath) return;
      const re = new RegExp("%%" + shortName + "%%", "g");
      text = text.replace(re, "{{" + fullPath + "}}");
    });
    return text;
  }

  // {{Event.DE...FirstName}} -> %%FirstName%%
  function replaceFullWithShort(text) {
    if (!text) return text;
    return text.replace(/\{\{([^}]+)\}\}/g, function (m, path) {
      const last = (path.split(".").pop() || "").trim();
      const knownShort = Object.keys(fieldMappings).find(
        (s) => fieldMappings[s] === path
      );
      if (knownShort) return "%%" + knownShort + "%%";
      if (/^[A-Za-z0-9_]+$/.test(last)) return "%%" + last + "%%";
      return m;
    });
  }

  /* ---------- UI wiring ---------- */

  function onRender() {
    connection.trigger("ready");
    connection.trigger("requestSchema");
    connection.trigger("requestTokens");

    // ⚠️ IMPORTANT :
    // NE PAS gérer ici le select #smsTemplate (laisse React faire).
    // On ne branche que les éléments pilotés par le schema :
    // - #availableFields (insertion de token dans le textarea)
    // - #phoneField (première option si vide)

    // Insertion d'un champ de perso dans le textarea
    $("#availableFields").on("change", function () {
      const fullPath = $(this).val();
      if (!fullPath) return;

      const shortName = fullPath.split(".").pop();
      fieldMappings[shortName] = fullPath;

      const shortField = `%%${shortName}%%`;
      const node = document.getElementById("messageContent");
      if (!node) return;

      const start = node.selectionStart || (node.value || "").length;
      const before = node.value.substring(0, start);
      const after = node.value.substring(start);
      node.value = before + shortField + after;

      // 👉 Synchroniser React
      // node.dispatchEvent(new Event("input", { bubbles: true }));
      setReactValue(node, shortMsg);

      // replacer le curseur à la fin de l'insert
      const pos = start + shortField.length;
      node.setSelectionRange(pos, pos);
      node.focus();

      // reset le select
      $(this).prop("selectedIndex", 0);
    });
  }

  function setFirstPhoneIfEmpty() {
    const $phone = $("#phoneField");
    if (!$phone.val() && $phone.find("option").length > 1) {
      $phone.prop("selectedIndex", 1);
      $phone.val($phone.find("option:eq(1)").val());
    }
  }

  function onRequestedSchema(data) {
    if (!data || !data.schema) {
      $("#availableFields").html(
        "<option disabled>Aucun champ disponible</option>"
      );
      return;
    }

    schemaFields = data.schema;

    // Purge
    $("#phoneField").find("option:not(:first)").remove();
    $("#availableFields").find("option:not(:first)").remove();

    // Peupler depuis le schema
    schemaFields.forEach(function (field) {
      const fullPath = field.key || "";
      const fieldName =
        field.name ||
        field.label ||
        field.displayName ||
        fullPath.split(".").pop() ||
        "Champ";
      const icon = getFieldIcon(fullPath);

      if (/phone|mobile|tel/i.test(fullPath)) {
        $("#phoneField").append(
          `<option value="{{${fullPath}}}">${fieldName}</option>`
        );
      }
      $("#availableFields").append(
        `<option value="${fullPath}">${icon} ${fieldName}</option>`
      );
    });

    // ContactKey optionnel
    $("#availableFields").append(
      `<option value="Contact.Key">🔑 Contact Key</option>`
    );

    // mapping pour conversions
    buildFieldMappingsFromSchema();

    // Choisir un phone par défaut si possible
    setFirstPhoneIfEmpty();
  }

  function getFieldIcon(fieldKey) {
    const key = (fieldKey || "").toLowerCase();
    if (/(phone|mobile|tel)/.test(key)) return "📱";
    if (/email/.test(key)) return "✉️";
    if (/(name|nom|prenom|first|last)/.test(key)) return "👤";
    if (/date/.test(key)) return "📅";
    if (/time/.test(key)) return "🕒";
    if (/(number|nombre)/.test(key)) return "🔢";
    if (/(status|responded)/.test(key)) return "✅";
    if (/(key|id)/.test(key)) return "🔑";
    if (/(address|adresse)/.test(key)) return "🏠";
    return "🔤";
  }

  async function initialize(data) {
    if (data) {
      payload = data;

      const hasInArgs =
        payload?.arguments?.execute?.inArguments &&
        payload.arguments.execute.inArguments.length > 0;

      const inArguments = hasInArgs
        ? payload.arguments.execute.inArguments
        : [];

      // Récupérer et afficher valeurs sauvegardées
      inArguments.forEach((inArg) => {
        Object.entries(inArg).forEach(([key, val]) => {
          if (key === "phoneField") {
            $("#phoneField").val(val);
          } else if (key === "messageContent") {
            const node = document.getElementById("messageContent");
            if (node) {
              // Convertit {{Full.Path}} -> %%Short%%
              const shortMsg = replaceFullWithShort(val);
              node.value = shortMsg;
              // 👉 Synchroniser React (très important)
              setReactValue(node, shortMsg);
            }
          }
        });
      });
    }

    // Sécurité : si pas de phone, mettre la 1ère option
    setFirstPhoneIfEmpty();

    // Indiquer que l'UI est prête (bouton Done sera géré par SFMC + validations côté React si besoin)
    connection.trigger("ready");
  }

  function validateForm() {
    let ok = true;

    if (!$("#phoneField").val()) {
      $("#phoneFieldError").text(
        "Veuillez sélectionner le champ numéro de téléphone."
      );
      ok = false;
    } else {
      $("#phoneFieldError").text("");
    }

    const msg = $("#messageContent").val();
    if (!msg) {
      $("#messageContentError").text("Le contenu du message est requis.");
      ok = false;
    } else {
      $("#messageContentError").text("");
    }

    return ok;
  }

  async function save() {
    if (!validateForm()) {
      // Bloque l'avance si invalide
      connection.trigger("ready");
      return;
    }

    const phoneField = $("#phoneField").val();
    let messageContent = $("#messageContent").val();

    // Convertir %%Short%% -> {{Full.Path}} avant sauvegarde
    buildFieldMappingsFromSchema();
    messageContent = replaceShortWithFull(messageContent);

    setReactValue(node, messageContent);

    payload.arguments = payload.arguments || {};
    payload.arguments.execute = payload.arguments.execute || {};
    payload.arguments.execute.inArguments = [
      {
        phoneField,
        messageContent,
        contactKey: "{{Contact.Key}}",
        buid: buid,
      },
    ];

    payload.metaData = payload.metaData || {};
    payload.metaData.isConfigured = true;

    connection.trigger("updateActivity", payload);
  }

  return {
    onRender,
    initialize,
    onRequestedSchema,
    save,
  };
});
