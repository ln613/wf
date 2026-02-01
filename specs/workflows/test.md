# Test workflows

These workflows will be triggered through the frontend UI manually unless it contains a auto trigger like email trigger, file watching trigger...

For those workflows with auto triggers, check the env value in the .env file to determine whether to register the triggers on the corresponding background tasks. The env key/value format: {workflow name (joined by _)}_TRIGGER=1. 1 means on, 0 means off. Default to off for all triggers.

## Test Get Email

### Tasks

- Get Latest Email with attachment (GMAIL_1)

## Test Send Email

### Tasks

- Send email
  - sender: GMAIL_1
  - receiver: ln613@hotmail.com
  - subject: hh
  - body: hello

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

### Input

- the path of the PDF file = C:\ww\c1.pdf

### Event Trigger

#### Event

- watch email GMAIL_1

#### Trigger Condition

- the subject is like "FW: CARO ... Work Order ..."
- there are 2 attachments, 1 excel file and 1 pdf

#### WF Input

- the path of the pdf file

### Tasks

- PDF to Htmls
- Parse All QC Htmls (as H):
  - in the html folder
  - contains a <p> with content <b>TEST RESULTS</b>
- Generate report with H.metadata.labReportId
- Parse QC Excel with H.metadata.labReportId (as E)
- if E is not null, perform QC check with H.analytes and E.analytes
- send email:
  - sender: GMAIL_1
  - receiver: GMAIL_1
  - subject: QC result for {H.metadata.labReportId}
  - body: {the QC check result}
  - attachment: the pdf file, the generated report

## Test File Watch

### Trigger Condition

- folder: /Users/nanli/t
- type: new file added

### Tasks

- move the new file(s) to /Users/nanli/t/tmp

## Test ffmpeg

### Input

- file path input and a Select a file button
  either enter the path manually or select a file then fill the path
- start
- end

### Tasks

- ffmpeg cut (selected file path, start, end)

### Output

- the successful/error info