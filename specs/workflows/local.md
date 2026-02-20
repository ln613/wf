# Local workflows

## WW QC

### Event Trigger

#### Event

- watch email GMAIL_1

#### Trigger Condition

condition 1:

- the subject is like "FW: CARO ... Work Order ..."
- there are 2 attachments, 1 excel file and 1 pdf

condition 2:

- the subject is like "Lab Report Upload Successful (Lab: {lab name}, Lab Report ID: {lab report id})"

#### WF Input

- the path of the pdf file

### Tasks

- only continue when both conditions are triggered (work order matches lab report id). If one is triggered first, save the info to db. And everytime a condition is triggered, check the db to see if the other one is already triggered
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

## HTML Extract

### Input

- url
- query selector
- attributes (comma separated list) = ['text']

### Tasks

- Open browser window (chrome, url)
- Wait for the element (query selector)
- if found, for each of the elements:
  - Get attribute (attributes)
- close browser window

### Output

- output the attribute values of all elements or not found error

## KS Cut

### Input

- path: file picker, default folder is C:\T\ks
- trim start (initial value 0.133)
- trim end (initial value 3.508)

### Tasks

- if file path is a folder, get all '.mp4' files in the folder, and do the following for each file sequentially
- ffprobe duration (file path)
- ffmpeg cut (selected file path, start: trim start || 0, end: duration - (trim end || 0))

### Output

- output successful/error info after each file is done

## Comfy fsv

### Input

- type (radio button): fsv, fsvr, fsi (default fsv)
- scope: file or folder path (file picker, default folder is C:\T\ks)
- count (radio button): 1, 2, 3 (default 1)
- order (radio button): large-small, left-right (default large-small)

### Tasks

- if scope is folder:
  - get all files in the folder
  - get folder name from the folder path
- do the following for each file sequentially
  - get file name from the file path, including extension
  - target file name = '{type}-{file name}'
  - target folder = C:\T\fg\v or C:\T\fg\v\{folder name} for folder scope (when the folder name is chinese, convert it to pinying)
  - if the target file does not exist in the target folder, do the following:
  - copy the file to \\nan-ai\aic\Software\comfy\ComfyUI\input
  - faces = count == 2 ? '0,1' : count == 3 ? '0,1,2' : '0'
  - comfy runWorkflow
    - workflow path: /utils/comfy/{type}.json
    - params (type = fsv):
      - '47.inputs.video': file name
      - '41.inputs.input_faces_index': faces
      - '41.inputs.input_faces_order': order
    - params (type = fsvr):
      - '45.inputs.video': 'ComfyUI/input/{file name}'
    - output key: 'images:31'
  - when the workflow is finished:
    - rename the generated file to target file name
    - move the generated file to target folder
    - delete the file which was copied to the input folder ealier

### Output

- output the generated file name
