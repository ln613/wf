# Browser tasks

## Find browser window

### Input

- browser type (any, chrome, firefox...)
- title (a sub string of the whole title, case insensitive)

### Action

- find the first existing browser window that matches the type and title

### Output

- The instance of the browser if found
- null otherwise

## Open browser window

### Input

- browser type (any, chrome, firefox...)
- url

### Action

- open a new browser window that matches the type and navigate to the url

### Output

- The instance of the new browser window

## Close browser window

### Input

- The instance of the new browser window

### Action

- close the browser window


## Find element(s)

### Input

- browser window instance
- query selector to locate the element(s)

### Action

- find the element(s) on the page of the given browser window instance based on the query selector

### Output

The element(s)

## Wait for element

### Input

Same input as Find element

### Action

- set interval of 1 second to find the element
- if found, clear the interval and return the element(s)
- if still not found after 30 seconds, clear the interval and return not found error

### Output

The element(s) or not found error

## Get attribute

### Input

Same input as Find element

- the array of attributes to extract

### Action

- find the element
- get the values of the attributes on the element

### Output

Return an object with the key/value pairs for each given attribute, like:

```
{
  id: 'img1',
  src: '...',
  ...
}
```

## Set attribute

### Input

Same input as Find element

- name and value of the attribute

### Action

- find the element
- set the value of the attribute

## Enter text

### Input

Same input as Find element

- the text to be entered

### Action

- find the element
- if element is not input box or text area, return
- enter the text into the box

## Click element

### Input

Same input as Find element

### Action

- find the element
- click on the element

## Check element

### Input

Same input as Find element

### Action

- find the element
- if element is not checkbox, return
- if element is unchecked, check it, otherwise do nothing

## Uncheck element

### Input

Same input as Find element

### Action

- find the element
- if element is not checkbox, return
- if element is checked, uncheck it, otherwise do nothing

## Toggle element

### Input

Same input as Find element

### Action

- find the element
- if element is not checkbox, return
- if element is checked, uncheck it, otherwise check it

## Select option

### Input

Same input as Find element

- the value or text to be selected

### Action

- find the element
- if element is not radio box, return
- select the one with the value or text in the radio box group

## Select from dropdown

### Input

Same input as Find element

- the value or text to be selected

### Action

- find the element
- if element is not select box / dropdown, return
- select the one with the value or text in the dropdown
