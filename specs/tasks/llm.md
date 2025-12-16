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

- return the response