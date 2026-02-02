# Local workflows

## WW QC

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

## KS Cut

### Input

- file path
- start
- end

### Tasks

- if file path is a folder, get all '.mp4' files in the folder, and do the following for each file sequentially
- ffprobe duration (file path)
- if start is empty, start = 0.133
- if end is empty, end = duration - 3.508
- ffmpeg cut (selected file path, start, end)

### Output

- output successful/error info after each file is done
