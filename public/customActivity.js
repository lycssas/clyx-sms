define(["postmonger"], function (Postmonger) {
  "use strict";

  var connection = new Postmonger.Session();
  var payload = {};
  var schemaFields = [];
  var fieldMappings = {}; // shortName -> fullPath
  var buid = null;

  $(window).ready(onRender);

  connection.on("initActivity", initialize);
  connection.on("clickedNext", save);
  connection.on("requestedSchema", onRequestedSchema);
  connection.on("requestedTokens", function (t) {
    if (t && t.MID) buid = t.MID;
  });

  // ---------- Helper: synchroniser React (textarea contrôlé) ----------
  function setReactValue(el, value) {
    // setter natif pour mettre à jour le value tracker de React
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    ).set;
    setter.call(el, value);
    // event 'input' qui bubble (capté par React -> onChange)
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function extractPersonalizationKeys(message) {
    const found = new Set();
    if (!message) return [];

    // %%Token%%  (alphanum + _)
    const reShort = /%%\s*([A-Za-z0-9_:]+)\s*%%/g;
    let m;
    while ((m = reShort.exec(message)) !== null) {
      found.add(m[1]);
    }

    // {{Full.Path.To.Field}} -> prend le dernier segment "Field"
    const reFull = /\{\{[^}]*?\.([A-Za-z0-9_]+)\}\}/g;
    while ((m = reFull.exec(message)) !== null) {
      found.add(m[1]);
    }

    console.log("extractPersonalizationKeys", found);

    return Array.from(found);
  }

  function buildAvailableShortNames(schemaFields, extras = ["ContactKey"]) {
    const set = new Set();
    (schemaFields || []).forEach((f) => {
      const fullPath = f.key || "";
      const short = (fullPath.split(".").pop() || "").trim();
      if (short) set.add(short);
    });
    (extras || []).forEach((x) => set.add(x));
    return set;
  }

  // Valider les champs de la data extension avant de sauvegarder le message
  function validateMessageTokens(message, schemaFields, opts = {}) {
    const { caseInsensitive = true, extras = ["ContactKey"] } = opts;

    const tokens = extractPersonalizationKeys(message);
    const available = buildAvailableShortNames(schemaFields, extras);

    // Si insensible à la casse, on normalise tout en lower
    if (caseInsensitive) {
      const lowerAvail = new Set(Array.from(available, (s) => s.toLowerCase()));
      const missing = tokens.filter((t) => !lowerAvail.has(t.toLowerCase()));
      const present = tokens.filter((t) => lowerAvail.has(t.toLowerCase()));
      return {
        isValid: missing.length === 0,
        missing,
        present,
        allTokens: tokens,
      };
    } else {
      const missing = tokens.filter((t) => !available.has(t));
      const present = tokens.filter((t) => available.has(t));
      return {
        isValid: missing.length === 0,
        missing,
        present,
        allTokens: tokens,
      };
    }
  }

  // ---------- Mapping champs ----------
  function buildFieldMappingsFromSchema() {
    fieldMappings = {};
    (schemaFields || []).forEach((f) => {
      const fullPath = f.key || "";
      const short = (fullPath.split(".").pop() || "").trim();
      if (short) fieldMappings[short] = fullPath;
    });
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

  // Quand le contenu du textarea change (tape, collage, OU événement synthétique),
  // relancer la validation et mettre à jour le bouton "Done"
  $(document).on("input", "#messageContent", function () {
    validateAndToggleNext();
  });

  $(document).on("change", "#smsTemplate", function () {
    validateAndToggleNext();
  });

  // ---------- UI ----------
  function onRender() {
    // Ne pas toucher à #smsTemplate (géré par React)
    connection.trigger("ready");
    connection.trigger("requestSchema");
    connection.trigger("requestTokens");

    // Insertion de token depuis #availableFields
    $("#availableFields").on("change", function () {
      const fullPath = $(this).val();
      if (!fullPath) return;
      const shortName = fullPath.split(".").pop();
      fieldMappings[shortName] = fullPath;

      const node = document.getElementById("messageContent");
      if (!node) return;

      const start = node.selectionStart || (node.value || "").length;
      const before = node.value.substring(0, start);
      const after = node.value.substring(start);
      const token = `%%${shortName}%%`;
      const newText = before + token + after;

      setReactValue(node, newText);

      const pos = start + token.length;
      node.setSelectionRange(pos, pos);
      node.focus();

      $(this).prop("selectedIndex", 0);
      validateAndToggleNext();
    });
  }

  function setFirstPhoneIfEmpty() {
    const $phone = $("#phoneField");
    if (!$phone.val() && $phone.find("option").length > 1) {
      $phone.prop("selectedIndex", 1);
      $phone.val($phone.find("option:eq(1)").val());
    }
  }

  // // Insérer un champ de personnalisation choisi dans le <select>
  $("#availableFields").on("change", function () {
    const $select = $(this);
    const fieldPath = $select.val(); // ex. "Contact.Email"
    if (!fieldPath) return; // rien choisi

    const displayName = $select.find("option:selected").text().trim();
    const shortName = fieldPath.split(".").pop(); // ex. "Email"

    // Mémoriser la correspondance court ↔︎ complet
    fieldMappings[shortName] = fieldPath;

    const shortField = `%%${shortName}%%`;

    // Insertion au curseur
    const $msg = $("#messageContent");
    const node = $msg[0];
    const cursorPos = node.selectionStart;
    const newText =
      $msg.val().substring(0, cursorPos) +
      shortField +
      $msg.val().substring(cursorPos);
    $msg.val(newText);

    // Mettre à jour le compteur et la position du curseur
    $("#characterCount").text(
      `≈ ${getNormalizedLength(newText)} / 160 caractères`
    );
    node.setSelectionRange(
      cursorPos + shortField.length,
      cursorPos + shortField.length
    );
    $msg.focus();

    // (optionnel) revenir sur la première option neutre
    $select.prop("selectedIndex", 0);
  });

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

    buildFieldMappingsFromSchema();

    // avertir initialize() si une conversion attend le mapping
    $(document).trigger("schema:mapped");

    setFirstPhoneIfEmpty();
    validateAndToggleNext();
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

  // ---------- Cycle de vie ----------
  async function initialize(data) {
    console.log("initialize payload", data);
    payload = data || {};

    // Demander schema/tokens
    connection.trigger("requestSchema");
    connection.trigger("requestTokens");

    // Restauration
    const inArgs = payload?.arguments?.execute?.inArguments || [];
    let restoredPhone = "";
    let restoredMsgFull = "";
    let restoredTemplateId = "";

    inArgs.forEach((obj) => {
      if (obj.phoneField) restoredPhone = obj.phoneField;
      if (obj.messageContent) restoredMsgFull = obj.messageContent; // {{Full.Path}}
      if (obj.templateId) restoredTemplateId = obj.templateId;
    });

    if (restoredPhone) $("#phoneField").val(restoredPhone);

    if (restoredTemplateId) {
      const node = document.getElementById("smsTemplate");
      if (node) setReactValue(node, restoredTemplateId);
    }

    if (restoredMsgFull) {
      if (Object.keys(fieldMappings).length > 0) {
        const shortMsg = replaceFullWithShort(restoredMsgFull);
        const node = document.getElementById("messageContent");
        if (node) setReactValue(node, shortMsg);
      } else {
        // attend que le schema soit mappé
        $(document).one("schema:mapped", function () {
          const shortMsg = replaceFullWithShort(restoredMsgFull);
          const node = document.getElementById("messageContent");
          if (node) setReactValue(node, shortMsg);
          validateAndToggleNext();
        });
      }
    }

    setFirstPhoneIfEmpty();
    validateAndToggleNext();
    connection.trigger("ready");
  }

  // ---------- Validation & Save ----------
  function validateForm() {
    let ok = true;

    const phoneVal = $("#phoneField").val();
    if (!phoneVal) {
      $("#phoneFieldError").text(
        "Veuillez sélectionner le champ numéro de téléphone."
      );
      ok = false;
    } else {
      $("#phoneFieldError").text("");
    }

    const node = document.getElementById("messageContent");
    const msg = node ? node.value || "" : "";
    if (!msg.trim()) {
      $("#messageContentError").text("Le contenu du message est requis.");
      ok = false;
    } else {
      const check = validateMessageTokens(msg, schemaFields, {
        caseInsensitive: true,
        extras: ["ContactKey"], // ajoute ici d'autres champs “virtuels” si besoin
      });

      if (!check.isValid) {
        $("#messageContentError").html(
          "Certains champs personnalisés requis par le message ne figurent pas dans la DE : <br>" +
            check.missing.map((x) => `%%${x}%%`).join(", ")
        );
        ok = false;
      } else {
        $("#messageContentError").text("");
      }
    }

    return ok;
  }

  function validateAndToggleNext() {
    const ok = validateForm();
    connection.trigger("updateButton", {
      button: "next",
      text: "Done",
      visible: ok,
      // background: ok ? "#af00bd" : "#CCCCCC",
      enabled: ok,
    });
  }

  async function save() {
    if (!validateForm()) {
      connection.trigger("ready");
      return;
    }

    const phoneField = $("#phoneField").val() || "";
    const node = document.getElementById("messageContent");
    const shortMsg = node ? node.value || "" : "";
    const templateNode = document.getElementById("smsTemplate");
    const templateId = templateNode ? templateNode.value || "" : "";

    buildFieldMappingsFromSchema();
    let messageContent = replaceShortWithFull(shortMsg);

    const mid =
      typeof buid === "number" || typeof buid === "string" ? String(buid) : "";
    const messageType = $("#messageType")?.val?.() || "SMS";
    const smsName = $("#smsName").val() || "";
    const campaignName = $("#campaignName").val() || "";

    const inArgs = {
      contactKey: "{{Contact.Key}}",
      phoneField,
      messageContent,
      messageType,
      buid: mid,
      campaignName: campaignName || "",
      smsName: smsName || "",
      // smsCount: "1", --- IGNORE ---
    };

    payload.arguments = payload.arguments || {};
    payload.arguments.execute = payload.arguments.execute || {};
    payload.arguments.execute.inArguments = [inArgs];

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
