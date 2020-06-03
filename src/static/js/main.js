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

function copyLink() {
    copyToClipboard(window.location.href);
    $('#copy-to-clipboard').html('<i class="fas fa-link"></i> Copied!');
}

function submitForm(id) {
    document.getElementById(id).submit()
}

function showModal(id) {
    document.getElementById('blur').style.display = "block"
    document.getElementById(id).style.display = "block"
}

function hideModal(id) {
    document.getElementById('blur').style.display = "none"
    document.getElementById(id).style.display = "none"
}

function makeContactInfoDynamic() {
    var platformType = document.getElementById('platform').innerText;
    var contactLink  = document.getElementById('contact-link')
    if (platformType === "Email") {
        contactLink.innerHTML = "<i class='fas fa-envelope'></i> " + contactLink.innerHTML
        document.getElementById('contact-link').setAttribute("href", "mailto:" + document.getElementById('contact-value').innerText)
    } else if (platformType === "Phone") {
        contactLink.innerHTML = "<i class='fas fa-phone-alt'></i> " + contactLink.innerHTML
        document.getElementById('contact-link').setAttribute("href", "tel:" + document.getElementById('contact-value').innerText)
    } else  if (platformType === "Facebook") {
        contactLink.innerHTML = "<i class='fab fa-facebook-f'></i> " + contactLink.innerHTML
        document.getElementById('contact-link').setAttribute("href", "https://www.facebook.com/" + document.getElementById('contact-value').innerText)
    } else if (platformType === "Twitter") {
        contactLink.innerHTML = "<i class='fab fa-twitter'></i> " + contactLink.innerHTML
        document.getElementById('contact-link').setAttribute("href", "https://twitter.com/" + document.getElementById('contact-value').innerText)
    } else if (platformType === "Instagram") {
        contactLink.innerHTML = '<i class="fab fa-instagram"></i> ' + contactLink.innerHTML
        document.getElementById('contact-link').setAttribute("href", "https://www.instagram.com/" + document.getElementById('contact-value').innerText)
    } else if (platformType === "Snapchat") {
        contactLink.innerHTML = '<i class="fab fa-snapchat-ghost"></i> ' + contactLink.innerHTML
        document.getElementById('contact-link').setAttribute("href", "https://www.snapchat.com/add/" + document.getElementById('contact-value').innerText)
    } else if (platformType === "WhatsApp") {
        contactLink.innerHTML = '<i class="fab fa-whatsapp"></i> ' + contactLink.innerHTML
        document.getElementById('contact-link').setAttribute("href", "https:/wa.me/" + document.getElementById('contact-value').innerText)
    }
}

// Fix the timestamps so that they display in a more human-readable format
function improveTimestamps() {
	for (var timestamp of document.getElementsByClassName('timestamp')) {
		timestamp.innerText = (new Date(parseInt(timestamp.innerText) * 1000).toLocaleString());
	}
}

// Create the alert
function createAlert(alertValue, overrideClose) {
    if (alertValue && (localStorage.getItem('lastAlert') !== alertValue || (overrideClose || false))) {
        $('#site-alert-div').html(alertValue);
        $('#site-alert-container').removeClass('hidden');
    }
}

// Show the alert, querying the server if necessary
function showAlert(alertValue, overrideClose) {
    if (alertValue !== undefined) {
        createAlert(alertValue, overrideClose);
    } else {
        $.ajax({
            url: '/getAlert',
            type: 'GET',
            dataType: 'json',
            success: (data) => {
                createAlert(data.alertValue, overrideClose);
            }
        });
    }
}

// Hide the alert
function hideAlert() {
    $('#site-alert-container').addClass('hidden');
    localStorage.setItem('lastAlert', $('#site-alert-div').html());
}

// Remove the alert from local storage
function clearAlertStorage() {
    localStorage.removeItem('lastAlert');
}

$(() => {
    showAlert();
});
