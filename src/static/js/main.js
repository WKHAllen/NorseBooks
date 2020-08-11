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

function copyLink(buttonId) {
    buttonId = buttonId || 'copy-to-clipboard';
    copyToClipboard(window.location.href);
    $(`#${buttonId}`).html('<i class="fas fa-link"></i> Copied!');
}

function submitForm(id) {
    document.getElementById(id).submit();
}

function showModal(id) {
    document.getElementById('blur').style.display = "block";
    document.getElementById(id).style.display = "block";
}

function hideModal(id) {
    document.getElementById('blur').style.display = "none";
    document.getElementById(id).style.display = "none";
}

function formatPhoneNumber(phone) {
    switch (phone.length) {
        case 7:
            return `${phone.slice(0, 3)}-${phone.slice(3, 7)}`;
        case 10:
            return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`;
        case 11:
            return `+${phone[0]} (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 11)}`;
        default:
            return phone;
    }
}

function makeContactInfoDynamic() {
    var platformType = document.getElementById('platform').innerText;
    var contactLink  = document.getElementById('contact-link');
    var contactIcon  = document.getElementById('contact-icon');
    var contactValue = document.getElementById('contact-value');
    if (platformType === "Email") {
        contactIcon.innerHTML = '<i class="fas fa-envelope"></i>';
        contactLink.setAttribute("href", "mailto:" + contactValue.innerText);
    } else if (platformType === "Phone") {
        contactIcon.innerHTML = '<i class="fas fa-phone-alt"></i>';
        contactLink.setAttribute("href", "tel:" + document.getElementById('original-contact-value').innerText);
        contactValue.innerText = formatPhoneNumber(contactValue.innerText);
    } else  if (platformType === "Facebook") {
        contactIcon.innerHTML = '<i class="fab fa-facebook-f"></i>';
        contactLink.setAttribute("href", "https://www.facebook.com/" + contactValue.innerText);
    } else if (platformType === "Twitter") {
        contactIcon.innerHTML = '<i class="fab fa-twitter"></i>';
        contactLink.setAttribute("href", "https://twitter.com/" + contactValue.innerText);
    } else if (platformType === "Instagram") {
        contactIcon.innerHTML = '<i class="fab fa-instagram"></i>';
        contactLink.setAttribute("href", "https://www.instagram.com/" + contactValue.innerText);
    } else if (platformType === "Snapchat") {
        contactIcon.innerHTML = '<i class="fab fa-snapchat-ghost"></i>';
        contactLink.setAttribute("href", "https://www.snapchat.com/add/" + contactValue.innerText);
    } else if (platformType === "WhatsApp") {
        contactIcon.innerHTML = '<i class="fab fa-whatsapp"></i>';
        contactLink.setAttribute("href", "https://wa.me/" + contactValue.innerText);
    }
}

// Fix the timestamps so that they display in a more human-readable format
function improveTimestamps() {
	for (var timestamp of document.getElementsByClassName('timestamp')) {
		timestamp.innerText = (new Date(parseInt(timestamp.innerText) * 1000).toLocaleString());
    }
    for (var timestampDate of document.getElementsByClassName('timestamp-date')) {
		timestampDate.innerText = (new Date(parseInt(timestampDate.innerText) * 1000).toDateString());
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
    improveTimestamps();
});
