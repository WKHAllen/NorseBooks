const nodemailer = require('nodemailer');

try {
    var processenv = require('./processenv');
} catch (ex) {}

var emailAddress = process.env.EMAIL_ADDRESS || processenv.EMAIL_ADDRESS;
var emailPassword = process.env.EMAIL_APP_PASSWORD || processenv.EMAIL_APP_PASSWORD;

function sendEmail(emailTo, subject, html, text) {
    var transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        auth: {
            user: emailAddress,
            pass: emailPassword
        }
    });
    var mailOptions = {
        from: emailAddress,
        to: emailTo,
        subject: subject,
        html: html,
        text: text
    };
    transporter.sendMail(mailOptions, (err, info) => {
        // In case gsmtp servers encounter problems (they have before)
        if (err) {
            console.warn('Error sending emails (try 1):', err);
            setTimeout(() => {
                transporter.sendMail(mailOptions, (err, info) => {
                    if (err) {
                        console.warn('Error sending emails (try 2):', err);
                        setTimeout(() => {
                            transporter.sendMail(mailOptions, (err, info) => {
                                if (err) {
                                    console.warn('Error sending emails (try 3):');
                                    throw err;
                                }
                            });
                        }, 10 * 60 * 1000);
                    }
                });
            }, 60 * 1000);
        }
    });
}

module.exports = {
    'sendEmail': sendEmail,
    'emailAddress': emailAddress
};
