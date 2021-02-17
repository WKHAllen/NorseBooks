const defaultOption = '<option value="">Select...</option>';

// Select all columns
function selectAllCols() {
  $("#columns .column-checkbox").prop("checked", true);
}

// Deselect all columns
function deselectAllCols() {
  $("#columns .column-checkbox").prop("checked", false);
}

// Update the columns when a different table is selected
function updateColumns() {
  var table = $("#table").val();
  if (table !== "") {
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
  var tableElement = $("#table");
  tableElement.html(defaultOption);
  for (var table of tables) {
    tableElement.append(`<option value="${table}">${table}</option>`);
  }
}

// Populate the columns
function populateColumns(columns) {
  var columnElement = $("#columns");
  columnElement.html("");
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
  var columnElement = $("#where");
  columnElement.html(defaultOption);
  for (var column of columns) {
    columnElement.append(`<option value="${column}">${column}</option>`);
  }
}

// Populated the columns in the ORDER BY clause
function populateColumnsOrderBy(columns) {
  var columnElement = $("#orderBy");
  columnElement.html(defaultOption);
  for (var column of columns) {
    columnElement.append(`<option value="${column}">${column}</option>`);
  }
}

// Clear all column fields
function clearColumns() {
  $("#columns").html("");
  $("#where").html(defaultOption);
  $("#orderBy").html(defaultOption);
}

// Get the tables
function getTables(callback) {
  $.ajax({
    url: "/admin/getDBTables",
    type: "GET",
    dataType: "json",
    success: (data) => {
      hideError();
      if (callback) callback(data.tables);
    },
    error: (err, req) => {
      showError("Failed to load tables.");
    },
  });
}

// Get the columns in a table
function getColumns(table, callback) {
  $.ajax({
    url: "/admin/getDBColumns",
    type: "GET",
    data: { table: table },
    dataType: "json",
    success: (data) => {
      hideError();
      if (callback) callback(data.columns);
    },
    error: (err, req) => {
      showError("Failed to load columns.");
    },
  });
}

// Show that an error has occurred
function showError(text) {
  var status = $("#status");
  if (text) status.text(text);
  status.removeClass("hidden");
}

// Hide errors
function hideError() {
  $("#status").addClass("hidden");
}

// Get the query columns
function getQueryColumns() {
  var columns = [];
  for (var column of $("#columns .column-checkbox")) {
    if (column.checked) {
      columns.push(column.id.slice(7));
    }
  }
  return columns;
}

// Get the query inputs
function getQueryInputs() {
  // Table
  var table = $("#table").val();
  // Columns
  var columns = getQueryColumns();
  // Where
  var where = $("#where").val();
  // Where operator
  var whereOperator = $("#whereOperator").val();
  // Where value
  var whereValue = $("#whereValue").val();
  // Order by
  var orderBy = $("#orderBy").val();
  // Order by direction
  var orderByDirection = $("#orderByDirection").val();
  // Populate object
  var queryInputs = {};
  queryInputs.table = table;
  queryInputs.columns = columns;
  if (where !== "" && whereOperator !== "" && whereValue !== "") {
    queryInputs.where = where;
    queryInputs.whereOperator = whereOperator;
    queryInputs.whereValue = whereValue;
  }
  if (orderBy !== "") {
    queryInputs.orderBy = orderBy;
    queryInputs.orderByDirection = orderByDirection;
  }
  return queryInputs;
}

// Clear the results table
function clearResultsTable() {
  $("#query-results-head").html("");
  $("#query-results-body").html("");
}

// Add a row to the results table
function addResultsRow(rowData, columns) {
  var resultsBody = $("#query-results-body");
  resultsBody.append(`<tr></tr>`);
  var row = resultsBody.children().last();
  for (var column of columns) {
    row.append(`<td>${rowData[column]}</td>`);
  }
}

// Display the results of the query
function displayResults(data, columns) {
  $("#query-results").removeClass("hidden");
  var resultsHead = $("#query-results-head");
  for (var column of columns) {
    resultsHead.append(`<th scope="col">${column}</th>`);
  }
  for (var row of data) {
    addResultsRow(row, columns);
  }
}

// Execute the query
function executeQuery() {
  event.preventDefault();
  var queryColumns = getQueryColumns();
  var queryInputs = getQueryInputs();
  $.ajax({
    url: "/admin/executeSelect",
    type: "GET",
    data: { queryInputs: queryInputs },
    dataType: "json",
    success: (data) => {
      clearResultsTable();
      displayResults(data.result, queryColumns);
    },
    error: (err, req) => {
      showError("Failed to execute the query.");
    },
  });
  return false;
}

// Update the size of the results table
function updateTableSize() {
  if ($("#table-small-check").prop("checked"))
    $("#query-results-table").addClass("table-sm");
  else $("#query-results-table").removeClass("table-sm");
}

// When the page is ready
$(() => {
  getTables((tables) => {
    populateTables(tables);
  });
});
