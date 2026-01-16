# Background Tasks

Background Tasks always run at the background after the services started, and will be stopped when the service stops.

A background task emits events, which can be used by workflows as triggers. 

## Watch Email

### Action

- watch email GMAIL_1
- emit event when new email received