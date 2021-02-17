// Join the rows with the same titles
function joinTitles() {
  var lastTitleTag = null;
  var titleCount = 0;
  for (var row of document.getElementsByClassName("report-row")) {
    titleCount++;
    var titleTag = row.getElementsByTagName("td")[0];
    if (
      lastTitleTag === null ||
      titleTag.innerText !== lastTitleTag.innerText
    ) {
      lastTitleTag = titleTag;
      titleCount = 1;
    } else {
      lastTitleTag.rowSpan = titleCount;
      titleTag.parentNode.removeChild(titleTag);
    }
  }
}

// When the page is ready
$(() => {
  joinTitles();
});
