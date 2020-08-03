function selectColor(number) {
    const hue = Math.floor(number * 137.508) % 360; // golden angle approximation
    return `hsl(${hue}, 100%, 50%)`;
}

function generateColors(numColors) {
    var colors = [];
    for (let i = 0; i < numColors; i++) {
        colors.push(selectColor(i));
    }
    return colors;
}

function getRowsData() {
    var tables = [];
    var rows = [];

    $('#rows-table').find($('tr')).find($('.rows-table-table'))
        .each(function() {
            tables.push($(this).text());
        });
          
    $('#rows-table').find($('tr')).find($('.rows-table-rows'))
        .each(function() {
            rows.push($(this).text());
        });
          
    return { tables, rows };
}

function createChart() {
    var img = new Image();
    img.src = 'https://www.norsebooks.com/img/favicon.png';

    var rowsData = getRowsData();
    var colors = generateColors(rowsData.tables.length);
    var ctx = document.getElementById('rows-chart').getContext('2d');
    var chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: rowsData.tables,
            datasets: [{
                data: rowsData.rows,
                backgroundColor: colors
            }]
        }
    });
}

$(() => {
    createChart();
});
