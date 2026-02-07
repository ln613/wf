# Play Folder

## Layout

Start with folder C:\T. If the folder contains subfolders, show the sub folder list, otherwise, show video list for all video files.

- header
  - back button
  - current folder name
- sub folder list
  - show big folder icon, folder name below the icon
  - wrappable list
- video list
  - show thumbnail of videos
  - wrappable list

## Interactions

- on sub folder click: go to that folder
- on video hover: start playing the video as preview
- on video click: play the video full screen (repeat forever)
- when in full screen:
  - show big left arrow on left and right arrow on right
  - on left arrow click: play the previous video
  - on right arrow click: play the next video
  - show big X at top right, on click, exit full screen

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

## Comfy fsv

### Input

- type (radio button): fsv, fsvr, fsi (default fsv)
- scope: file or folder path (file picker, default folder is C:\T\ks)
- count (radio button): 1, 2, 3 (default 1)

### Tasks

- if scope is folder:
  - get all files in the folder
  - get folder name from the folder path
- do the following for each file sequentially
  - copy the file to \\nan-ai\aic\Software\comfy\ComfyUI\input
  - get file name from the file path, including extension
  - faces = count == 2 ? '0,1' : count == 3 ? '0,1,2' : '0'
  - comfy runWorkflow
    - workflow path: /utils/comfy/{type}.json
    - params (type = fsv):
      - '47.inputs.video': file name
      - '41.inputs.input_faces_index': faces
    - params (type = fsvr):
      - '45.inputs.video': 'ComfyUI/input/{file name}'
    - output key: 'images:31'
  - when the workflow is finished:
    - rename the generated file to '{type}-{file name}'
    - move the generated file to C:\T\fg\v or C:\T\fg\v\{folder name} for folder scope (when the folder name is chinese, convert it to pinying)
    - delete the file which was copied to the input folder ealier

### Output

- output the generated file name
