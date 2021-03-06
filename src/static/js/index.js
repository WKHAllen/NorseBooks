// Get the bookId of the last book on the page
function getLastBookId() {
  var bookCard = document.getElementById("index").lastElementChild;
  if (bookCard === null) return null;
  else return bookCard.getElementsByTagName("a")[0].href.slice(-4);
}

// Remove the last book on the page
function deleteLastBook() {
  var bookCard = document.getElementById("index").lastElementChild;
  bookCard.parentNode.removeChild(bookCard);
}

// Add a book to the end of the page
function addBook(book) {
  var courseNumber = book.coursenumber ? " " + book.coursenumber : "";
  // <a href="/book/${book.bookid}">
  var newBookLink = document.createElement("a");
  newBookLink.classList.add("full-card-link");
  newBookLink.href = `/book/${book.bookid}`;
  // <div class="card-container col-12 col-md-6 col-lg-4 mb-4">
  var newBook = document.createElement("div");
  newBook.classList.add(
    "card-container",
    "col-12",
    "col-md-6",
    "col-lg-4",
    "mb-4"
  );
  // <div class="card" style="width: 18rem;">
  var newCard = document.createElement("div");
  newCard.classList.add("card");
  newCard.style = "width: 18rem;";
  var imgLink = document.createElement("a");
  imgLink.href = `/book/${book.bookid}`;
  newCard.appendChild(imgLink);
  // <img src="${book.imageurl}" class="card-img-top thumbnail" alt="...">
  var newImg = document.createElement("img");
  newImg.src = `/image/book/${book.bookid}`;
  newImg.classList.add("card-img-top", "thumbnail", "p-1", "pt-3");
  newImg.alt = "...";
  imgLink.appendChild(newImg);
  // <div class="card-body">
  var cardBody = document.createElement("div");
  cardBody.classList.add("card-body");
  // <div class="space-between">
  var spaceBetween = document.createElement("div");
  spaceBetween.classList.add("space-between");
  // <a href="/book/${book.bookid}">
  var bookLink = document.createElement("a");
  bookLink.href = `/book/${book.bookid}`;
  // <span class="title">${book.title}
  var bookTitle = document.createElement("span");
  bookTitle.classList.add("title");
  bookTitle.innerText = book.title;
  // </span>
  bookLink.appendChild(bookTitle);
  // </a>
  spaceBetween.appendChild(bookLink);
  // <span class="card-price">$${book.price}
  var cardPrice = document.createElement("span");
  cardPrice.classList.add("card-price");
  cardPrice.innerText = `$${book.price}`;
  // </span>
  spaceBetween.appendChild(cardPrice);
  // </div>
  cardBody.appendChild(spaceBetween);
  // <div>By: ${book.author}
  var authorDiv = document.createElement("div");
  authorDiv.innerText = `By: ${book.author}`;
  // </div>
  cardBody.appendChild(authorDiv);
  // <div>${book.department}${courseNumber}
  var departmentDiv = document.createElement("div");
  departmentDiv.innerText = book.department + courseNumber;
  // </div>
  cardBody.appendChild(departmentDiv);
  // </div>
  newCard.appendChild(cardBody);
  // </div>
  newBook.appendChild(newCard);
  // </div>
  newBookLink.appendChild(newBook);
  // </a>
  document.getElementById("index").appendChild(newBookLink);
}

// Load more books using AJAX
function loadMoreBooks() {
  var lastBookId = getLastBookId();
  var params = new URLSearchParams(window.location.search);
  var query = {};
  if (params.get("title")) query.title = params.get("title");
  if (params.get("author")) query.author = params.get("author");
  if (params.get("department")) query.department = params.get("department");
  if (params.get("courseNumber"))
    query.courseNumber = params.get("courseNumber");
  if (params.get("ISBN")) query.ISBN = params.get("ISBN");
  if (params.get("sort")) query.sort = params.get("sort");
  query.lastBook = lastBookId;
  $.ajax({
    url: "/getBooks",
    type: "GET",
    data: query,
    dataType: "json",
    success: (data) => {
      if (data.books) {
        if (data.books.length > 0) {
          document.getElementById("status").classList.add("hidden");
          for (var book of data.books) addBook(book);
          enableScrollAction();
        } else {
          document.getElementById("status").innerHTML =
            "No books found ¯\\_(ツ)_/¯";
        }
      } else if (data.err) {
        deleteLastBook();
        loadMoreBooks();
      }
    },
    error: (req, err) => {
      document.getElementById("status").innerHTML =
        'Failed to fetch books. <a href="/">Click here to refresh the page.</a>';
    },
  });
}

// Load more books when scrolled to the bottom of the page
function enableScrollAction() {
  var footer = document.getElementsByTagName("footer")[0];
  window.onscroll = () => {
    if (
      window.innerHeight + window.scrollY >=
      document.body.scrollHeight - footer.scrollHeight
    ) {
      disableScrollAction();
      loadMoreBooks();
    }
  };
}

// Disable scrolling action
function disableScrollAction() {
  window.onscroll = null;
}

// Load books once the page is loaded
window.onload = () => {
  loadMoreBooks();
};
