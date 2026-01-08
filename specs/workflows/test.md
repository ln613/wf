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

### Input

- model (dropdown list, call the ollama list API to get the model names on load, default to qwen3-coder or the 1st)

### Tasks

- For every html file under C:\ww\h
  - Call Ollama API with the selected model
    - prompt: extract the table in the html file into JSON in the following format:
```
{
  header: { to:..., project:..., workOrder:..., date:... },
  content: [
    { analyte:..., result:..., RL:..., unit:..., date:..., qualifier:..., category:... },
    ...
  ]
}
```
- Combine all results into the final JSON (merge the content)

## Test Gemini

### Tasks

- Open browser window (chrome, https://gemini.google.com/app)
