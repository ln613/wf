# Comfy tasks

## runWorkflow

### Input

- workflow json file path
- list of params to set, each one is a key/value pair
- output key

### Action

- create comfyui api object if the api object is null
- dynamiclly load the workflow json file
- create a comfy workflow object and set the params and output key
- run the workflow and log the progress percentage
- wait for the job to finish and return the generated file name

### Output

- return the generated file name

