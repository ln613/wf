# Test workflows

## Test Get Email

### Tasks

- Get Latest Email (GMAIL_1)

## Test Send Email

### Tasks

- Send email
  - sender: GMAIL_1
  - receiver: ln613@hotmail.com
  - subject: hh
  - body: hello

## Test Browser Automation

### Tasks

- Open browser window (chrome, https://wirelesswater.com/Account/LogOn?ReturnUrl=%2fmain)
- Enter text ('#username', WW_LAB)
- Enter text ('#password', WW_LAB_PASSWORD)
- Click ('button.filter')
- Wait 3 seconds
- Navigate to https://wirelesswater.com/labarchive
- Enter text ('#txtSearch1', '25G3917')
- Click ('a[title="search"]')
- Click ('a[href^="/LabArchive/SummaryView/"]')

## Test Ollama

### Tasks

- Call Ollama API (deepseek-r1:8b, 'tell me a joke')