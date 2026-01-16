import { backgroundEvents, startBackgroundTask } from '../background/index.js'
import { executeWorkflow, workflows } from './index.js'

// Store registered triggers
const registeredTriggers = new Map()

/**
 * Register event triggers for all workflows that have them
 */
export const registerAllEventTriggers = () => {
  console.log('[Triggers] Registering event triggers for workflows...')
  
  for (const [workflowKey, workflow] of Object.entries(workflows)) {
    if (workflow.eventTrigger) {
      registerWorkflowTrigger(workflowKey, workflow)
    }
  }
  
  console.log(`[Triggers] Registered ${registeredTriggers.size} event triggers`)
}

/**
 * Register a single workflow's event trigger
 * @param {string} workflowKey - Workflow key
 * @param {Object} workflow - Workflow definition
 */
const registerWorkflowTrigger = (workflowKey, workflow) => {
  const { eventTrigger } = workflow
  
  validateEventTrigger(eventTrigger, workflowKey)
  
  const { event, condition, inputMapping } = eventTrigger
  
  // Start the background task if needed
  startBackgroundTaskForEvent(event)
  
  // Create the event handler
  const handler = createEventHandler(workflowKey, workflow, condition, inputMapping)
  
  // Register the event listener
  const eventName = getEventName(event)
  backgroundEvents.on(eventName, handler)
  
  registeredTriggers.set(workflowKey, {
    eventName,
    handler,
    event,
    condition,
  })
  
  console.log(`[Triggers] Registered trigger for workflow '${workflow.name}' on event '${eventName}'`)
}

/**
 * Validate event trigger configuration
 * @param {Object} eventTrigger - Event trigger config
 * @param {string} workflowKey - Workflow key for error messages
 */
const validateEventTrigger = (eventTrigger, workflowKey) => {
  if (!eventTrigger.event) {
    throw new Error(`Event trigger for workflow '${workflowKey}' must have an 'event' property`)
  }
}

/**
 * Start the background task required for an event
 * @param {Object} event - Event configuration
 */
const startBackgroundTaskForEvent = (event) => {
  if (event.type === 'watchEmail') {
    startBackgroundTask('watchEmail', {
      emailAccount: event.emailAccount,
      pollingInterval: event.pollingInterval || 10,
    })
  }
}

/**
 * Get the event name from event configuration
 * @param {Object} event - Event configuration
 * @returns {string} Event name
 */
const getEventName = (event) => {
  if (event.type === 'watchEmail') {
    return 'newEmail'
  }
  return event.type
}

/**
 * Create an event handler for a workflow trigger
 * @param {string} workflowKey - Workflow key
 * @param {Object} workflow - Workflow definition
 * @param {Object} condition - Trigger condition
 * @param {Object} inputMapping - Input mapping from event data to workflow inputs
 * @returns {Function} Event handler
 */
const createEventHandler = (workflowKey, workflow, condition, inputMapping) => {
  return async (eventData) => {
    console.log(`[Triggers] Event received for workflow '${workflow.name}'`)
    
    // Check if condition is met
    if (condition && !checkCondition(condition, eventData)) {
      console.log(`[Triggers] Condition not met for workflow '${workflow.name}', skipping`)
      return
    }
    
    // Map event data to workflow inputs
    const workflowInputs = mapEventDataToInputs(eventData, inputMapping)
    
    console.log(`[Triggers] Executing workflow '${workflow.name}' with inputs:`, workflowInputs)
    
    try {
      const result = await executeWorkflow(workflowKey, workflowInputs)
      console.log(`[Triggers] Workflow '${workflow.name}' completed successfully`)
      return result
    } catch (error) {
      console.error(`[Triggers] Workflow '${workflow.name}' failed:`, error.message)
    }
  }
}

/**
 * Check if the trigger condition is met
 * @param {Object} condition - Condition configuration
 * @param {Object} eventData - Event data
 * @returns {boolean} Whether condition is met
 */
const checkCondition = (condition, eventData) => {
  const { email } = eventData
  
  if (!email) return false
  
  // Check subject pattern
  if (condition.subjectPattern) {
    const regex = new RegExp(condition.subjectPattern, 'i')
    if (!regex.test(email.subject || '')) {
      console.log(`[Triggers] Subject '${email.subject}' does not match pattern '${condition.subjectPattern}'`)
      return false
    }
  }
  
  // Check attachment requirements
  if (condition.attachments) {
    const attachments = email.attachments || []
    
    // Check minimum count
    if (condition.attachments.minCount && attachments.length < condition.attachments.minCount) {
      console.log(`[Triggers] Not enough attachments: ${attachments.length} < ${condition.attachments.minCount}`)
      return false
    }
    
    // Check required types
    if (condition.attachments.requiredTypes) {
      for (const requiredType of condition.attachments.requiredTypes) {
        const hasType = attachments.some((att) => {
          const filename = att.filename?.toLowerCase() || ''
          if (requiredType === 'excel') {
            return filename.endsWith('.xlsx') || filename.endsWith('.xls')
          }
          if (requiredType === 'pdf') {
            return filename.endsWith('.pdf')
          }
          return filename.includes(requiredType.toLowerCase())
        })
        
        if (!hasType) {
          console.log(`[Triggers] Missing required attachment type: ${requiredType}`)
          return false
        }
      }
    }
  }
  
  return true
}

/**
 * Map event data to workflow inputs
 * @param {Object} eventData - Event data
 * @param {Object} inputMapping - Input mapping configuration
 * @returns {Object} Workflow inputs
 */
const mapEventDataToInputs = (eventData, inputMapping) => {
  if (!inputMapping) return {}
  
  const inputs = {}
  const { email } = eventData
  
  for (const [inputName, mapping] of Object.entries(inputMapping)) {
    if (typeof mapping === 'string') {
      // Simple path mapping like 'email.attachments[0].path'
      inputs[inputName] = getValueByPath(eventData, mapping)
    } else if (typeof mapping === 'object' && mapping.from) {
      // Complex mapping with transformation
      let value = getValueByPath(eventData, mapping.from)
      
      // Apply filter if specified
      if (mapping.filter && Array.isArray(value)) {
        value = value.find((item) => {
          if (mapping.filter.extension) {
            const filename = item.filename?.toLowerCase() || ''
            return filename.endsWith(mapping.filter.extension.toLowerCase())
          }
          return true
        })
      }
      
      // Get specific property if specified
      if (mapping.property && value) {
        value = value[mapping.property]
      }
      
      inputs[inputName] = value
    }
  }
  
  return inputs
}

/**
 * Get value from object by dot-notation path
 * @param {Object} obj - Source object
 * @param {string} path - Dot-notation path (supports array index like 'arr[0]')
 * @returns {*} Value at path
 */
const getValueByPath = (obj, path) => {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let current = obj
  
  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined
    }
    current = current[part]
  }
  
  return current
}

/**
 * Unregister all event triggers
 */
export const unregisterAllEventTriggers = () => {
  for (const [workflowKey, triggerInfo] of registeredTriggers) {
    backgroundEvents.off(triggerInfo.eventName, triggerInfo.handler)
    console.log(`[Triggers] Unregistered trigger for workflow '${workflowKey}'`)
  }
  registeredTriggers.clear()
}
