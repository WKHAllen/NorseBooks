const updateStatsTimeout = 60 * 1000; // one minute

// Display the stats
function displayStats(stats) {
    $('#status').addClass('hidden');
    for (var stat in stats) {
        $(`#${stat}`).text(stats[stat]);
    }
}

// Show that an error has occurred
function displayError() {
    $('#status').removeClass('hidden');
}

// Update the stats
function updateStats() {
    $.ajax({
        url: '/getAdminStats',
        type: 'GET',
        dataType: 'json',
        success: (data) => {
            displayStats(data);
        },
        error: (req, err) => {
            displayError();
        }
    });
}

// When the window loads
window.onload = () => {
    updateStats();
    setInterval(updateStats, updateStatsTimeout);
};
