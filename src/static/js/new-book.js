$('#search-google-api').on('keyup', function(){
    var searchFieldValue = document.getElementById('search-google-api').value
    searchFieldValue =  searchFieldValue.split(' ').join('+')

    var container = document.getElementById('result-list-container');
    container.style.display = "block"

    var resultListItems = document.querySelectorAll('.search-result-link')

    var url = 'https://www.googleapis.com/books/v1/volumes?key=' + 'AIzaSyCZb0ZbkRKgq06SprrrF3DNbxCZdjp8TP0' + '&q=' + searchFieldValue + '&printType=books';
    var xhr = new XMLHttpRequest();
    if (searchFieldValue !== "") {
        xhr.open('GET', url);
        xhr.send();
        xhr.onreadystatechange = (e) => {
            var responseText = JSON.parse(xhr.responseText)
            var resultArray = responseText.items;
            for (var i = 0; i < 5; i++) {
                resultListItems[i].setAttribute('onclick', 'populateBookInfo("' + resultArray[i].id + '")')
                console.log(responseText)
                var titleSpan = document.createElement('span');
                titleSpan.classList.add("title")
                titleSpan.innerText = resultArray[i].volumeInfo.title
                var authorSpan = document.createElement('span')
                authorSpan.classList.add('author')
                authorSpan.innerText = resultArray[i].volumeInfo.authors[0]
                resultListItems[i].innerHTML = "";
                resultListItems[i].appendChild(titleSpan)
                resultListItems[i].appendChild(authorSpan)
            }  
        }
    }
})

function populateBookInfo(volumeId) {
    document.getElementById('result-list-container').style.display = "none";
    console.log("Pop func hit")
    url = 'https://www.googleapis.com/books/v1/volumes/' + volumeId + '?key=AIzaSyCZb0ZbkRKgq06SprrrF3DNbxCZdjp8TP0';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.send()
    xhr.onreadystatechange = (e) => {
        if (xhr.status === 200) {
            var responseText = JSON.parse(xhr.responseText)
            var titleField = document.querySelector('input#title')
            var authorField = document.querySelector('input#author')
            var isbnField = document.querySelector('input#ISBN')
            titleField.value = responseText.volumeInfo.title
            authorField.value = responseText.volumeInfo.authors[0]
            isbnField.value = responseText.volumeInfo.industryIdentifiers[1].identifier
            console.log(responseText)
            // MAKE FIELDS GREEN!
        }
    }
}