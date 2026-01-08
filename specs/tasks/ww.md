# ww tasks

## Parse QC Html

### Input

- html content

### Action

- find all <p> elements, sort them by top then left (top and left values are on the style attribute)
- group them by top
- for each group, join the text value of each <p>, separated by "|"

### Output

- return the list of groups