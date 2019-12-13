function showHidden(elementId) {
    document.getElementById(elementId).classList.remove('hidden');
}

function copyToClipboard(text) {
    var copyText = document.createElement('input');
    copyText.value = text;
    document.body.appendChild(copyText);
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    document.execCommand('copy');
    document.body.removeChild(copyText);
}

function submitForm(id) {
    document.getElementById(id).submit()
}

$('#copy-to-clipboard').on('click', function() {
    console.log("event hit")
    $('#copy-to-clipboard').html("<i class='fas fa-link'></i> Copied!")
})

function showModal(id) {
    document.getElementById('blur').style.display = "block"
    document.getElementById(id).style.display = "block"
}

function hideModal(id) {
    document.getElementById('blur').style.display = "none"
    document.getElementById(id).style.display = "none"
}

function makeContactInfoDynamic() {
    var type = document.getElementById()
}