# Background Tasks

Background Tasks always run at the background after the services started, and will be stopped when the service stops.

A background task emits events, which can be used by workflows as triggers. 

## Watch Email

### Action

- watch email GMAIL_1
- emit event when new email received

## Watch Files

### File Watching Trigger

A file watching trigger defines:
- which folder to watch
- what type of file change to watch:
  - new file created
  - file modified
  - file deleted

### Register a trigger

A workflow can register/unregister itself on the file watching background task, with a specific trigger.

### Action

- when there are registered workflows, the file watching background task will watch file system based on the trigger conditions
- emit event when the trigger condition is met, with the file(s) affected as event data