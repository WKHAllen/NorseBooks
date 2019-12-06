// Get the bookId of the last book on the page
function getLastBookId() {
    var bookCard = document.getElementById('index').lastElementChild;
    if (bookCard === null) return null;
    else return bookCard.getElementsByTagName('a')[0].href.slice(-4);
}

function deleteLastBook() {
    var bookCard = document.getElementById('index').lastElementChild;
    bookCard.parentNode.removeChild(bookCard);
}

// Add a book to the end of the page
function addBook(book) {
    var courseNumber = book.coursenumber ? ' ' + book.coursenumber : '';
    var newBook = `
        <div class="card-container col-12 col-md-6 col-lg-4 mb-4">
            <div class="card" style="width: 18rem;">
                <img src="${book.imageurl}" class="card-img-top thumbnail" alt="...">
                <div class="card-body">
                    <div class="space-between">
                        <a href="/book/${book.bookid}"><span class="title">${book.title}</span></a>
                        <span class="card-price">$${book.price}</span>
                    </div>
                    <div>By: <span>${book.author}</span></div>
                    <div>${book.department}${courseNumber}</div>
                </div>
            </div>
        </div>`;
    document.getElementById('index').innerHTML += newBook;
}

// Load more books using AJAX
function loadMoreBooks() {
    var lastBookId = getLastBookId();
    var params = new URLSearchParams(window.location.search);
    var query = {};
    if (params.get('title')) query.title = params.get('title');
    if (params.get('author')) query.author = params.get('author');
    if (params.get('department')) query.department = params.get('department');
    if (params.get('courseNumber')) query.courseNumber = params.get('courseNumber');
    query.lastBook = lastBookId;
    $.ajax({
        url: '/getBooks',
        type: 'GET',
        data: query,
        dataType: 'json',
        success: (data) => {
            if (data.books) {
                document.getElementById('status').classList.add('hidden');
                for (var book of data.books)
                    addBook(book);
            } else if (data.err) {
                deleteLastBook();
                loadMoreBooks();
            }
        },
        error: (req, err) => {
            document.getElementById('status').innerHTML = 'Failed to fetch books. <a href="/">Click here to refresh the page.</a>';
        }
    });
}

// Load more books when scrolled to the bottom of the page
window.onscroll = () => {
    if (Math.round(window.innerHeight + window.scrollY) >= document.body.scrollHeight) {
        loadMoreBooks();
    }
};

window.onload = loadMoreBooks;
