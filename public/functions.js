// functions.js
define([], function () {
  // const $ = window.jQuery;

  function ajaxRequest(options) {
    var method = (options.method || options.type || "GET").toUpperCase();

    var ajaxOptions = {
      url: options.url,
      method: method,
      dataType: options.dataType || "json",
    };

    if (method === "GET") {
      if (options.data) {
        ajaxOptions.data = options.data; // jQuery va sérialiser en query string
      }
    } else {
      ajaxOptions.data = options.data ? JSON.stringify(options.data) : null;
      ajaxOptions.contentType = "application/json; charset=UTF-8";
    }

    return $.ajax(ajaxOptions);
  }

  function disableInputs(reason) {
    $("input, select, textarea, button").prop("disabled", true);

    var $msg = $("#warning-msg");
    if ($msg.length === 0) {
      $msg = $("<div>").attr("id", "warning-msg").css({
        color: "red",
        height: "auto",
        "font-size": "13px",
        "font-style": "italic",
        position: "absolute",
        left: "0",
        right: "0",
        top: "10px",
        "text-align": "center",
      });
      $("#app-root").prepend($msg);
    }

    $msg.text(
      reason ||
        "Votre abonnement n’est pas actif pour cette Business Unit. Contactez l’administrateur sur l'adresse contact@agencelycs.com."
    );
  }

  function enableInputs() {
    $("input, select, textarea, button").prop("disabled", false);
    $("#warning-msg").remove();
  }

  function checkSubscriptionStatus(params) {
    var buid = params && params.buid ? String(params.buid) : null;
    var connection = params && params.connection;
    var validateAndToggleNext =
      params && typeof params.validateAndToggleNext === "function"
        ? params.validateAndToggleNext
        : null;

    var initUrl = (params && params.initUrl) || "./init"; //  chemin RELATIF

    if (!buid) {
      disableInputs(
        "Votre abonnement n’est pas actif pour cette Business Unit. Contactez l’administrateur sur l'adresse contact@agencelycs.com."
      );
      if (connection) {
        connection.trigger("updateButton", {
          button: "next",
          text: "Done",
          visible: true,
          enabled: false,
        });
      }
      return;
    }

    ajaxRequest({
      method: "GET",
      url: initUrl,
      data: { buid: buid },
    })
      .done(function (response) {
        console.log("Réponse /init :", response);

        if (!response || response.enabled === false) {
          var reason =
            (response && response.reason) ||
            "Votre abonnement n’est pas actif pour cette Business Unit. Contactez l’administrateur sur l'adresse contact@agencelycs.com.";
          disableInputs(reason);

          if (connection) {
            connection.trigger("updateButton", {
              button: "next",
              text: "Done",
              visible: true,
              enabled: false,
            });
          }
        } else {
          enableInputs();
          if (validateAndToggleNext) {
            validateAndToggleNext();
          }
        }
      })
      .fail(function (xhr, status, error) {
        console.error("Erreur /init :", status, error, xhr.responseText);
        disableInputs(
          "Impossible de vérifier votre abonnement. Contactez l’administrateur sur l'adresse contact@agencelycs.com."
        );
        if (connection) {
          connection.trigger("updateButton", {
            button: "next",
            text: "Done",
            visible: true,
            enabled: false,
          });
        }
      });
  }

  return {
    ajaxRequest: ajaxRequest,
    disableInputs: disableInputs,
    enableInputs: enableInputs,
    checkSubscriptionStatus: checkSubscriptionStatus,
  };
});
