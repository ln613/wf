# Workflow Manager

This is a local nodejs service which runs and manages workflows.

Follow the specs under the workflows sub folder and generate the corresponding code for each workflow.

The tasks folder contains the common tasks (sub workflows) which can be used by other workflows.

## Task

A task is like a function, it takes some input parameters, perform some operations and output some results.

## Workflow

A workflow is also a task, so it has input and output, but differs from task in:

- It consists of a list of tasks/sub workflows
- It has a trigger which triggers the running of a workflow.
- If no ouput defined, use the output from the last task/sub workflow

## Trigger

A trigger can be:

- event, e.g, when receiving an email
- API call
- when the workflow is used as a sub workflow, the previous task/sub workflow in list will be the trigger

A workflow can always be triggered through API or as a sub workflow. In order to be triggered by an event, the event trigger has to be defined as part of the workflow definition.

For those workflows with auto/event triggers, check the env value in the .env file to determine whether to register the triggers on the corresponding background tasks. The env key/value format: {workflow name (joined by _)}_TRIGGER=1. 1 means on, 0 means off. Default to off for all triggers.

## API

Create an API for triggering the workflow

- request body includes workflow name and inputs
- response is the workflow outputs

## Front End

### Home Page

- Display 4 tabs - Local Workflows, UI, Test Workflows and Tasks
- Upon selecting the tab, show the list of all workflows/tasks/UIs. For tasks, group them by categories (each category corresponds to a markdown file)
- When selecting a workflow/task, go to the call page
- When selecting a UI, navigate to the corresponding url

### Call page

- Show the name of the selected workflow/task
- Based on the inputs of the selected workflow/task, show the corresponding input elements
- Show the Call button, upon click, call the workflow API and display the result

### UI page

Each markdown file under UI folder is a page within the frontend react app, with url corresponding to the file name