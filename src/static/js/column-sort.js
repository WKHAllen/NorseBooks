// Show which column is being sorted
function showOrderBy() {
  var orderBy = $("#order-by").text();
  var orderDirection = $("#order-direction").text();
  var sortedColumn = $(`#${orderBy}-header`);
  sortedColumn.addClass("italic");
  var headerHref = sortedColumn.attr("href");
  if (orderDirection === "ASC") {
    sortedColumn.attr("href", headerHref + `&orderDirection=DESC`);
    sortedColumn
      .parent()
      .html(sortedColumn.parent().html() + ' <i class="fas fa-caret-up"></i>');
  } else if (orderDirection === "DESC") {
    sortedColumn.attr("href", headerHref + `&orderDirection=ASC`);
    sortedColumn
      .parent()
      .html(
        sortedColumn.parent().html() + ' <i class="fas fa-caret-down"></i>'
      );
  }
}

// When the page is ready
$(() => {
  showOrderBy();
});
