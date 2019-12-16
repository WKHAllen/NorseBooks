const defaultOption = '<option value="">Select...</option>';

// Select all columns
function selectAllCols() {
    $('.column-checkbox').prop('checked', true);
}

// Deselect all columns
function deselectAllCols() {
    $('.column-checkbox').prop('checked', false);
}

// Update the columns when a different table is selected
function updateColumns() {
    var table = $('#table').val();
    if (table !== '') {
        getColumns(table, (columns) => {
            populateColumns(columns);
            populateColumnsWhere(columns);
            populateColumnsOrderBy(columns);
        });
    } else {
        clearColumns();
    }
}

// Populate the tables dropdown
function populateTables(tables) {
    var tableElement = $('#table');
    tableElement.html(defaultOption);
    for (var table of tables) {
        tableElement.append(`<option value="${table}">${table}</option>`);
    }
}

// Populate the columns
function populateColumns(columns) {
    var columnElement = $('#columns');
    columnElement.html('');
    for (var column of columns) {
        columnElement.append(`
            <div class="custom-control custom-checkbox ml-3">
                <input type="checkbox" class="custom-control-input column-checkbox" id="column-${column}">
                <label for="column-${column}" class="custom-control-label">${column}</label>
            </div>
        `);
    }
}

// Populate the columns in the WHERE clause
function populateColumnsWhere(columns) {
    var columnElement = $('#where');
    columnElement.html(defaultOption);
    for (var column of columns) {
        columnElement.append(`<option value="${column}">${column}</option>`);
    }
}

// Populated the columns in the ORDER BY clause
function populateColumnsOrderBy(columns) {
    var columnElement = $('#orderby');
    columnElement.html(defaultOption);
    for (var column of columns) {
        columnElement.append(`<option value="${column}">${column}</option>`);
    }
}

// Clear all column fields
function clearColumns() {
    $('#columns').html('');
    $('#where').html(defaultOption);
    $('#orderby').html(defaultOption);
}

// Get the tables
function getTables(callback) {
    $.ajax({
        url: '/getDBTables',
        type: 'GET',
        dataType: 'json',
        success: (data) => {
            hideError();
            if (callback) callback(data.tables);
        },
        error: showError
    });
}

// Get the columns in a table
function getColumns(table, callback) {
    $.ajax({
        url: '/getDBColumns',
        type: 'GET',
        data: { table: table },
        dataType: 'json',
        success: (data) => {
            hideError();
            if (callback) callback(data.columns);
        },
        error: showError
    });
}

// Show that an error has occurred
function showError() {
    $('#status').removeClass('hidden');
}

// Hide errors
function hideError() {
    $('#status').addClass('hidden');
}

// When the page is ready
$(() => {
    getTables((tables) => {
        populateTables(tables);
    });
});
