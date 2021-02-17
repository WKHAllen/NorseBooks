const updateStatsTimeout = 60 * 1000; // one minute

// Display the stats
function displayStats(stats) {
  $("#status").addClass("hidden");
  for (var stat in stats) {
    $(`#${stat}`).text(stats[stat]);
  }
}

// Show that an error has occurred
function showError() {
  $("#status").removeClass("hidden");
}

// Update the stats
function updateStats() {
  $.ajax({
    url: "/admin/getAdminStats",
    type: "GET",
    dataType: "json",
    success: (data) => {
      displayStats(data);
    },
    error: showError,
  });
}

// When the window loads
window.onload = () => {
  updateStats();
  setInterval(updateStats, updateStatsTimeout);
};
