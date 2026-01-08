# LLM tasks

## Ollama API

### Input

- model
- prompt
- images
- ollama url (in .env file, default http://localhost:11434/api)
- stream (default false)

### Action

- if there are images, convert them to base64 string
- call the ollama API on the generate endpoint

### Output

- return the parsed JSON from the response field of the result

## Ollama List

### Input

- ollama url (in .env file, default http://localhost:11434/api)

### Action

- call ollama endpoint /api/tags

### Output

- return the model names