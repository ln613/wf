# Email tasks

## Get Latest Email

### Input

- email account (as env var, e.g, GMAIL_1)

### Action

- find the email account and its password in the .env file
- connect to the email server and get the latest email

### Output

- Sender
- Date
- Subject
- Email Body


## Send Email

### Input

- sender email account (as env var, e.g, GMAIL_1)
- receiver email account
- subject
- email body

### Action

- find the sender email account and its password in the .env file
- use that account to send an email to the receiver email account with the input subject and body

### Output

The result whether the email has been sent successfully.
