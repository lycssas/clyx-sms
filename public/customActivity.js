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

  // Met à jour proprement une textarea contrôlée (React-like)
  function setReactValue(el, value) {
    try {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      ).set;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (e) {
      // fallback
      el.value = value;
    }
  }

  function getNormalizedLength(text) {
    if (!text) return 0;
    return String(text).replace(/\r\n/g, "\n").length;
  }

  function isQuoted(s) {
    return (
      typeof s === "string" &&
      s.length >= 2 &&
      s[0] === '"' &&
      s[s.length - 1] === '"'
    );
  }

  function quoteIfColon(segment) {
    if (!segment) return segment;
    if (segment.includes(":") && !isQuoted(segment)) return `"${segment}"`;
    return segment;
  }

  function unquote(s) {
    return isQuoted(s) ? s.slice(1, -1) : s;
  }

  // Normalise un fullPath pour garantir le dernier segment entre guillemets si contient ":"
  function normalizeFullPathWithQuotes(path) {
    if (!path) return path;
    const parts = String(path).split(".");
    if (parts.length === 0) return path;
    const last = parts[parts.length - 1];
    parts[parts.length - 1] = quoteIfColon(last);
    return parts.join(".");
  }

  // Récupère le short (dernier segment sans guillemets, conserve les ":")
  function shortFromFullPath(path) {
    if (!path) return "";
    const parts = String(path).split(".");
    const last = parts[parts.length - 1] || "";
    return unquote(last);
  }

  // Extraction & Validation des tokens
  function extractPersonalizationKeys(message) {
    const found = new Set();
    if (!message) return [];

    // %%Token%% (A-Z a-z 0-9 _ :)
    const reShort = /%%\s*([A-Za-z0-9_:]+)\s*%%/g;
    let m;
    while ((m = reShort.exec(message)) !== null) {
      found.add(m[1]);
    }

    // {{Full.Path.To."Field"}} -> prend le dernier segment (retire guillemets)
    const reFull = /\{\{\s*([^}]+?)\s*\}\}/g;
    while ((m = reFull.exec(message)) !== null) {
      const path = m[1];
      const last = shortFromFullPath(normalizeFullPathWithQuotes(path));
      if (last) found.add(last);
    }

    return Array.from(found);
  }

  function buildAvailableShortNames(schemaFields, extras = ["ContactKey"]) {
    const set = new Set();
    (schemaFields || []).forEach((f) => {
      const fullPath = f.key || "";
      const short = shortFromFullPath(normalizeFullPathWithQuotes(fullPath));
      if (short) set.add(short);
    });
    (extras || []).forEach((x) => set.add(x));
    return set;
  }

  function validateMessageTokens(message, schemaFields, opts = {}) {
    const { caseInsensitive = true, extras = ["ContactKey"] } = opts;

    const tokens = extractPersonalizationKeys(message);
    const available = buildAvailableShortNames(schemaFields, extras);

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

  // Mapping champs
  function buildFieldMappingsFromSchema() {
    fieldMappings = {};
    (schemaFields || []).forEach((f) => {
      const rawFull = f.key || "";
      const normalized = normalizeFullPathWithQuotes(rawFull);
      const short = shortFromFullPath(normalized); // ex: CampaignMember:MobilePhone
      if (short) fieldMappings[short] = normalized;
    });
    // Virtuel
    fieldMappings["ContactKey"] = "Contact.Key";
  }

  // %%Short%% -> {{Event.DE... "Short" }} (avec guillemets si ":" dans le short)
  function replaceShortWithFull(text) {
    if (!text) return text;
    const shorts = Object.keys(fieldMappings).sort(
      (a, b) => b.length - a.length
    );

    shorts.forEach((shortName) => {
      let fullPath = fieldMappings[shortName];
      if (!fullPath) return;
      fullPath = normalizeFullPathWithQuotes(fullPath);

      const re = new RegExp(
        "%%\\s*" +
          shortName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") +
          "\\s*%%",
        "g"
      );
      text = text.replace(re, "{{" + fullPath + "}}");
    });

    return text;
  }

  // {{Event.DE..."Short"}} -> %%Short%%
  function replaceFullWithShort(text) {
    if (!text) return text;

    return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (_m, path) {
      const normalized = normalizeFullPathWithQuotes(path);

      const knownShort = Object.keys(fieldMappings).find(
        (s) => normalizeFullPathWithQuotes(fieldMappings[s]) === normalized
      );
      if (knownShort) return "%%" + knownShort + "%%";

      const short = shortFromFullPath(normalized);
      return short ? "%%" + short + "%%" : _m;
    });
  }

  // UI bindings de base
  $(document).on("input", "#messageContent", function () {
    // mettre à jour compteur si présent
    const val = this.value || "";
    if ($("#characterCount").length) {
      $("#characterCount").text(
        `≈ ${getNormalizedLength(val)} / 160 caractères`
      );
    }
    validateAndToggleNext();
  });

  $(document).on("change", "#smsTemplate", function () {
    validateAndToggleNext();
  });

  function onRender() {
    connection.trigger("ready");
    connection.trigger("requestSchema");
    connection.trigger("requestTokens");

    // Insertion de token depuis #availableFields vers la textarea
    $("#availableFields").on("change", function () {
      const fullPath = $(this).val();
      if (!fullPath) return;
      const normalized = normalizeFullPathWithQuotes(fullPath);
      const shortName = shortFromFullPath(normalized);
      fieldMappings[shortName] = normalized;

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

  // Schéma (remplissage des selects)
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
      const rawFullPath = field.key || "";
      const normalized = normalizeFullPathWithQuotes(rawFullPath);
      const fieldName =
        field.name ||
        field.label ||
        field.displayName ||
        shortFromFullPath(normalized) ||
        "Champ";
      const icon = getFieldIcon(normalized);

      // --- Options téléphone : créer via DOM et stocker le chemin en data-path ---
      if (/phone|mobile|tel/i.test(normalized)) {
        const $opt = $("<option>")
          .text(fieldName)
          .attr("data-path", normalized)
          .val(shortFromFullPath(normalized)); // value lisible (facultative)
        $("#phoneField").append($opt);
      }

      // availableFields (pour insérer des %%tokens%% dans la textarea)
      $("#availableFields").append(
        `<option value="${rawFullPath}">${icon} ${fieldName}</option>`
      );
    });

    // ContactKey optionnel
    $("#availableFields").append(
      `<option value="Contact.Key">🔑 Contact Key</option>`
    );

    buildFieldMappingsFromSchema();

    // prévenir initialize() qu'on a fini de mapper
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

  // Cycle de vie
  async function initialize(data) {
    payload = data || {};

    // Demander schema/tokens
    connection.trigger("requestSchema");
    connection.trigger("requestTokens");

    // Restauration
    const inArgs = payload?.arguments?.execute?.inArguments || [];
    let restoredPhone = "";
    let restoredMsgFull = "";
    let restoredTemplateId = "";
    let restoredCampaignCode = "";
    let restoredSmsName = "";

    inArgs.forEach((obj) => {
      if (obj.phoneField) restoredPhone = obj.phoneField; // attendu: {{Event.DE..."Task:Column"}}
      if (obj.messageContent) restoredMsgFull = obj.messageContent; // {{Full.Path}}
      if (obj.templateId) restoredTemplateId = obj.templateId;
      if (obj.templateId) restoredTemplateId = obj.templateId;
      if (obj.campaignCode) restoredCampaignCode = obj.campaignCode; // <--- NEW
      if (obj.smsName) restoredSmsName = obj.smsName;
    });

    if (restoredTemplateId) {
      const node = document.getElementById("smsTemplate");
      if (node) setReactValue(node, restoredTemplateId);
    }

    if (restoredCampaignCode) {
      $("#campaignCode").val(restoredCampaignCode);
    } // <--- NEW
    if (restoredSmsName) {
      $("#smsName").val(restoredSmsName);
    }

    // Restaurer le message ({{…}} -> %%…%%)
    if (restoredMsgFull) {
      const doRestoreMsg = function () {
        const shortMsg = replaceFullWithShort(restoredMsgFull);
        const node = document.getElementById("messageContent");
        if (node) setReactValue(node, shortMsg);
        validateAndToggleNext();
      };

      if (Object.keys(fieldMappings).length > 0) {
        doRestoreMsg();
      } else {
        $(document).one("schema:mapped", doRestoreMsg);
      }
    }

    // Restaurer le phoneField (sélection dans le <select>) une fois les options présentes
    if (restoredPhone) {
      const tryRestore = function () {
        const match = String(restoredPhone)
          .trim()
          .match(/^\{\{\s*(.+?)\s*\}\}$/);
        const restoredPath = match
          ? normalizeFullPathWithQuotes(match[1])
          : null;
        if (restoredPath) {
          let found = false;
          $("#phoneField option").each(function () {
            const p = $(this).attr("data-path");
            if (p && normalizeFullPathWithQuotes(p) === restoredPath) {
              $(this).prop("selected", true);
              found = true;
              return false;
            }
          });
          if (!found) {
            // fallback lisible pour l'utilisateur
            $("#phoneField").val(shortFromFullPath(restoredPath));
          }
        }
      };

      if ($("#phoneField option").length > 1) {
        tryRestore();
      } else {
        $(document).one("schema:mapped", tryRestore);
      }
    }

    setFirstPhoneIfEmpty();
    validateAndToggleNext();
    connection.trigger("ready");
  }

  // Validation & Save
  function validateForm() {
    let ok = true;

    // Vérifie qu'une option est sélectionnée (on lit data-path au save)
    if (!$("#phoneField option:selected").length) {
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
        extras: ["ContactKey"],
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
      enabled: ok,
    });
  }

  async function save() {
    if (!validateForm()) {
      connection.trigger("ready");
      return;
    }

    // --- Construire phoneField depuis l'option sélectionnée (data-path) ---
    const $selOpt = $("#phoneField option:selected");
    let phoneField = "";
    if ($selOpt.length) {
      const rawPath = $selOpt.attr("data-path") || "";
      const normalizedPath = normalizeFullPathWithQuotes(rawPath);
      if (normalizedPath) {
        phoneField = "{{" + normalizedPath + "}}";
      }
    }

    // Message
    const node = document.getElementById("messageContent");
    const shortMsg = node ? node.value || "" : "";
    const templateNode = document.getElementById("smsTemplate");
    const templateId = templateNode ? templateNode.value || "" : "";

    // Assurer le mapping à jour
    buildFieldMappingsFromSchema();

    // Conversion %%Short%% -> {{FullPath}} (avec guillemets si ":" dans le dernier segment)
    let messageContent = replaceShortWithFull(shortMsg);

    // Autres champs optionnels
    const mid =
      typeof buid === "number" || typeof buid === "string" ? String(buid) : "";
    const messageType = $("#messageType")?.val?.() || "SMS";
    const smsName = $("#smsName").val() || "";
    const campaignCode = $("#campaignCode").val() || "";

    console.log("Phonefield : ", phoneField);
    console.log("Message : ", messageContent);

    const inArgs = {
      contactKey: "{{Contact.Key}}",
      phoneField, // {{Event.DE..."Task:Column"}} correctement formé
      messageContent, // {{Event.DE..."Task:Column"}}
      messageType,
      buid: mid,
      campaignCode: campaignCode || "",
      smsName: smsName || "",
      // templateId: templateId || "", // décommente si tu dois le passer à l'exécution
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
