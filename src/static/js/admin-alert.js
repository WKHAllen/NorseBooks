// Preview an alert
function previewAlert() {
  showAlert($("#alertValue").val(), true);
}

// Fix the timeout timestamp so that it displays in a more human-readable format
function improveTimestamp() {
  var alertTimeout = $("#alert-timeout");
  alertTimeout.text(
    new Date(parseInt(alertTimeout.text()) * 1000).toLocaleString()
  );
}

$(() => {
  improveTimestamp();
});
