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
- type: radio button
  - { text: image, value: C:\ww\caro\img }
  - { text: html, value: C:\ww\caro\html }

### Tasks

- For every file under the folder for the selected type
  - Call Ollama API:
    - model: the selected model
    - images: only if type is image
    - prompt: the table in the file contains the results of some analytes (grouped into categories) taken from a sample, convert the contents of the table into JSON format. DO NOT try to output values that are not in the file, if you cannot find the values for some fields, just use empty string
    - format:
```
{
  header: { reportedTo:..., project:..., workOrder:..., reported:... },
  content: [
    { analyte:..., result:..., RL:..., units:..., analyzed:..., qualifier:..., category:... },
    ...
  ]
}
```
  - if type is html, read the file content and attach to the end of the prompt
- Combine all results into the final JSON (merge the content)

## Test WW

### Tasks

- read the file content as html 
- Parse All QC Htmls:
  - in "C:\ww\caro\html"
  - contains a <p> with content <b>TEST RESULTS</b>
