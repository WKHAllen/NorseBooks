const defaultOption = '<option value="">Select...</option>';

// Select all columns
function selectAllCols() {
    $('#columns .column-checkbox').prop('checked', true);
}

// Deselect all columns
function deselectAllCols() {
    $('#columns .column-checkbox').prop('checked', false);
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
    var columnElement = $('#orderBy');
    columnElement.html(defaultOption);
    for (var column of columns) {
        columnElement.append(`<option value="${column}">${column}</option>`);
    }
}

// Clear all column fields
function clearColumns() {
    $('#columns').html('');
    $('#where').html(defaultOption);
    $('#orderBy').html(defaultOption);
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
        error: (err, req) => {
            showError('Failed to load tables.');
        }
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
        error: (err, req) => {
            showError('Failed to load columns.');
        }
    });
}

// Show that an error has occurred
function showError(text) {
    var status = $('#status');
    if (text) status.text(text);
    status.removeClass('hidden');
}

// Hide errors
function hideError() {
    $('#status').addClass('hidden');
}

// Get the query inputs
function getQueryInputs() {
    // Table
    var table = $('#table').val();
    // Columns
    var columns = [];
    for (var column of $('#columns .column-checkbox')) {
        if (column.checked) {
            columns.push(column.id.slice(7));
        }
    }
    // Where
    var where = $('#where').val();
    // Where operator
    var whereOperator = $('#whereOperator').val();
    // Where value
    var whereValue = $('#whereValue').val();
    // Order by
    var orderBy = $('#orderBy').val();
    // Order by direction
    var orderByDirection = $('#orderByDirection').val();
    // Populate object
    var queryInputs = {};
    queryInputs.table = table;
    queryInputs.columns = columns;
    if (where !== '' && whereOperator !== '' && whereValue !== '') {
        queryInputs.where = where;
        queryInputs.whereOperator = whereOperator;
        queryInputs.whereValue = whereValue;
    }
    if (orderBy !== '') {
        queryInputs.orderBy = orderBy;
        queryInputs.orderByDirection = orderByDirection;
    }
    return queryInputs;
}

// Build the query
function buildQuery(queryInputs) {
    var select = 'SELECT ' + queryInputs.columns.join(', ');
    var from = `FROM ${queryInputs.table}`;
    var where = '';
    if (queryInputs.where && queryInputs.whereOperator && queryInputs.whereValue) {
        where = `WHERE ${queryInputs.where} ${queryInputs.whereOperator} ${queryInputs.whereValue}`;
    }
    var orderBy = '';
    if (queryInputs.orderBy && queryInputs.orderByDirection) {
        orderBy = `ORDER BY ${queryInputs.orderBy} ${queryInputs.orderByDirection}`;
    }
    var query = [select, from, where, orderBy].join(' ') + ';';
    while (query.includes('  ')) query = query.replace('  ', ' ');
    return query;
}

// Execute the query
function executeQuery() {
    event.preventDefault();
    var queryInputs = getQueryInputs();
    var query = buildQuery(queryInputs);
    $.ajax({
        url: '/executeQuery',
        type: 'GET',
        data: { query: query },
        dataType: 'json',
        success: (data) => {
            console.log(data);
        },
        error: (err, req) => {
            showError('Failed to execute the query.');
        }
    });
    return false;
}

// When the page is ready
$(() => {
    getTables((tables) => {
        populateTables(tables);
    });
});
