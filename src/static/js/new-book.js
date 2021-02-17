const apiKey = "AIzaSyCZb0ZbkRKgq06SprrrF3DNbxCZdjp8TP0";

$("#search-google-api").on("keyup", function () {
  var searchFieldValue = document.getElementById("search-google-api").value;
  searchFieldValue = searchFieldValue.split(" ").join("+");

  var container = document.getElementById("result-list-container");

  var resultListItems = document.querySelectorAll(".search-result-link");

  var url = `https://www.googleapis.com/books/v1/volumes?key=${apiKey}&q=${searchFieldValue}&printType=books`;
  var xhr = new XMLHttpRequest();
  if (searchFieldValue !== "") {
    xhr.open("GET", url);
    xhr.send();
    xhr.onreadystatechange = (e) => {
      var responseText = JSON.parse(xhr.responseText);
      if (!responseText.error) {
        document.getElementById("search-failed").classList.add("hidden");
        container.style.display = "block";
        var resultArray = responseText.items;
        for (var i = 0; i < 5; i++) {
          resultListItems[i].setAttribute(
            "onclick",
            `populateBookInfo('${resultArray[i].id}')`
          );
          var titleSpan = document.createElement("span");
          titleSpan.classList.add("title");
          titleSpan.innerText = resultArray[i].volumeInfo.title;
          var authorSpan = document.createElement("span");
          authorSpan.classList.add("author");
          authorSpan.innerText = resultArray[i].volumeInfo.authors[0];
          resultListItems[i].innerHTML = "";
          resultListItems[i].appendChild(titleSpan);
          resultListItems[i].appendChild(authorSpan);
        }
      } else {
        document.getElementById("search-failed").classList.remove("hidden");
        container.style.display = "none";
      }
    };
  }
});

function populateBookInfo(volumeId) {
  document.getElementById("result-list-container").style.display = "none";
  url = `https://www.googleapis.com/books/v1/volumes/${volumeId}?key=${apiKey}`;
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url);
  xhr.send();
  xhr.onreadystatechange = (e) => {
    if (xhr.status === 200) {
      var responseText = JSON.parse(xhr.responseText);
      var titleField = document.querySelector("input#title");
      var authorField = document.querySelector("input#author");
      var isbn10Field = document.querySelector("#ISBN10");
      var isbn13Field = document.querySelector("#ISBN13");
      titleField.value = responseText.volumeInfo.title;
      titleField.classList.add("autofill-success");
      authorField.value = responseText.volumeInfo.authors[0];
      authorField.classList.add("autofill-success");
      isbn10Field.value =
        responseText.volumeInfo.industryIdentifiers[0].identifier;
      isbn13Field.value =
        responseText.volumeInfo.industryIdentifiers[1].identifier;
      isbn10Field.classList.add("autofill-success");
      isbn13Field.classList.add("autofill-success");
    }
  };
}
