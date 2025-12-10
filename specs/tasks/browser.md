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


## Find element(s)

### Input

- browser window instance
- query selector to locate the element(s)
- the attributes to extract

### Action

- find the element(s) on the page of the given browser window instance based on the query selector

### Output

Return an object with the key/value pairs for each given attribute, like:

```
{
  id: 'img1',
  src: '...',
  ...
}
```

If the elements found is an array, return an array of such objects.