# ww tasks

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
    extract the key/value pairs as the metadata
  - if the group has only 1 item:
    - if ", Continued" is at the end of the text, remove it from the text
    - if it is in the format "{clientSampleId} ({labSampleId}) | Matrix: {matrix} | Sampled: {collectionDate} {collectionTime}", extract the info into an object and set it as the current Sample Info. ", Continued" could be at the end of the text, which should be ignored
    - otherwise, set it as the current Category
  - if the group is in the format Analyte, Result, RL, Units, Analyzed, Qualifier (optional), add it (as an object, with category = current Category and sampleInfo as the current Sample Info) to the Analyte list
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
