# ww tasks

## Generate Report

### Input

- lab report id *

### Action

- Open browser window (chrome, https://wirelesswater.com/Account/LogOn?ReturnUrl=%2fmain)
- Enter text ('#username', WW_LAB)
- Enter text ('#password', WW_LAB_PASSWORD)
- Click ('button.filter')
- Wait 3 seconds
- Navigate to https://wirelesswater.com/labarchive
- Enter text ('#txtSearch1', lab report id)
- Click ('a[title="Search"]')
- Wait 3 seconds
- Click ('a[href^="/LabArchive/SummaryView/"]')
- Wait for the download to finish
- Close the browser

## Parse QC Html

### Input

- html content *

### Action

- find all <p> elements, sort them by top then left (top and left values are on the style attribute, allow +1/-1 tolerance)
- group them by top
- for each group, get the text value of each <p>, then:
  - ignore the group if first item in group is "TEST RESULTS", "Analyte", "Page ..." or "Rev ..."
  - if the group is
    - "REPORTED TO", "...", "WORK ORDER", "..." or
    - "PROJECT", "...", "REPORTED", "..."
    extract the key/value pairs as the metadata. Key mapping: "REPORTED TO" -> clientName, "WORK ORDER" -> labReportId
  - if the group has only 1 item:
    - if ", Continued" is at the end of the text, remove it from the text
    - if it is in the format "{clientSampleId} ({labSampleId}) | Matrix: {matrix} | Sampled: {collectionDate} {collectionTime}", extract the info into an object and set it as the current Sample Info. ", Continued" could be at the end of the text, which should be ignored
    - otherwise, set it as the current Category
  - if the group is in the format Analyte, Result, RL, Units, Analyzed, Qualifier (optional), add it (as an object, with unit = Units, category = current Category and sampleInfo as the current Sample Info) to the Analyte list
  - order the Analyte list by sampleInfo.labSampleId then category then analyte name

### Output

- return the Analyte list and the metadata

## Parse All QC Htmls

### Input

- a folder *
- a filter function

### Action

- get all html files in the folder, filtered by the filter function
- for each file, get the file content and call the Parse QC Html task
- combine the analyte list (sort by sampleInfo.labSampleId then category then analyte name)
- merge the metadata

### Output

- return the Analyte list and the metadata

## Parse QC Excel

### Input

- lab report id *

### Action

- find the latest excel file in the download folder with the name "{lab report id} summary archive{...}.xlsx" (the ... part can be empty or anything). if not found or the date of the file is over 1 minute old, return null
- in the first worksheet:
  - find the first empty row (R1)
  - extract the info before R1 as metadata (col A is key, col b is value). Key mapping: "Client Name: " -> clientName, "Lab Name: " -> labName, "Lab Report ID: " -> labReportId, "Lab Report Name: " -> labReportName
  - find the row with col A = "Analyte", col b = "Unit", col c = "Analytical Method" (R2)
  - for each col starting from col D, extract the info before R2 as sample info (col A to C (just 1 cell, they are merged) is key). Key mapping: "Client Sample ID" -> clientSampleId, "Lab Sample ID" -> labSampleId, Matrix -> matrix, "Sampling Location Code" -> samplingLocationCode, "Date Sampled" -> collectionDate, "Time Sampled (24h)" -> collectionTime
  - for the rows after R2:
    - ignore if it's empty, or the first cell is "Lab Results"
    - if only the first cell has value, set the value as the current Category
    - for each sample info, create an analyte object with analyte (col A), unit (col B), result (the col where the sample info is from), category (the current Category), sample info
  - put all the analytes from the previous step into a big list, sort by sampleInfo.labSampleId then category then analyte name

### Output

- return the Analyte list and the metadata

## QC Check

### Input

- analyte list 1 *
- analyte list 2 *

### Action

- compare the 2 analyte list, report all different, mismatch or missing values or nodes
- rules for comparison:
  - ignore the follwoing fields: rl, analyzed, qualifier, sampleInfo.samplingLocationCode
  - for the result field: "< {value}" = "<{value}"
  - for the collectionDate field: it can be in 2 formats, "yyyy-MM-dd" and "dd-MMM-yy"
  - for the collectionTime field: ignore the time zone, such as "MDT"
  - for the unit field:
    - no difference regardless of the value for analyte ph
    - "µg/L" = "μg/L"
  - for the analyte field:
    - ignore case
    - ignore the analyte if the name starts with "Surrogate:"
    - "... + ..." = "...+..."
    - "... & ..." = "... and ..."
    - "{analyte}, {type}" = "{analyte}, {type} as ..." = "{analyte}, {type} (as ...)" = "{analyte} ({type})" = "{analyte} ({type}, as ...)" = "{analyte} ({type}, by ...)" = "{type} {analyte}" = , type can be "dissolved" or "total", "as ..."/"by ..." is optional
    - "conductivity" = "conductivity (ec)"
    - "methyl tert-butyl ether" = "methyl tert-butyl ether (MTBE)"
    - "Phosphorus, Total (as P)" under category "General Parameters" in list 1 = "Phosphorus (total, APHA 4500-P)" under category "General Parameters" in list 2

### Output

- the comparison result